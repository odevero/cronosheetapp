import { GoalEntry, GoalInput, RoadmapItem, TipNote } from '../entities/models';
import { parseIsoDate } from './calendar-duration';
import { validateGoalInput } from '../../usecases/goal-usecases';

export const CRONOSHEET_BACKUP_VERSION = 1;

export interface CronoSheetBackupPayload {
  readonly app: 'CronoSheet';
  readonly version: number;
  readonly exportedAtIso: string;
  readonly referenceDateIso: string;
  readonly goals: readonly {
    readonly title: string;
    readonly startDate: string;
    readonly endDate: string;
    readonly notes: string;
    readonly sortOrder: number;
  }[];
  readonly tips: readonly {
    readonly goalId: string;
    readonly nextStep: string;
    readonly done: boolean;
  }[];
  readonly roadmapItems: readonly {
    readonly text: string;
    readonly done: boolean;
  }[];
}

export type ImportRowStatus = 'valid' | 'duplicate' | 'invalid';

export interface AnalyzedImportRow {
  readonly lineNumber: number;
  readonly input: GoalInput;
  readonly status: ImportRowStatus;
  readonly errors: readonly string[];
}

export interface ImportAnalysisResult {
  readonly detectedFormat: 'csv' | 'json' | 'empty';
  readonly rows: readonly AnalyzedImportRow[];
  readonly validCount: number;
  readonly duplicateCount: number;
  readonly invalidCount: number;
  readonly parseError: string | null;
}

export function exportWorkspaceBackupJson(
  goals: readonly GoalEntry[],
  tips: readonly TipNote[],
  roadmapItems: readonly RoadmapItem[],
  referenceDateIso: string,
  exportedAtIso: string = new Date().toISOString(),
): string {
  const orderedGoals = [...goals].sort((a, b) => a.sortOrder - b.sortOrder);
  const payload: CronoSheetBackupPayload = {
    app: 'CronoSheet',
    version: CRONOSHEET_BACKUP_VERSION,
    exportedAtIso,
    referenceDateIso,
    goals: orderedGoals.map((g) => ({
      title: g.title,
      startDate: g.startDate,
      endDate: g.endDate,
      notes: g.notes,
      sortOrder: g.sortOrder,
    })),
    tips: tips.map((t) => ({
      goalId: t.goalId,
      nextStep: t.nextStep,
      done: t.done,
    })),
    roadmapItems: roadmapItems.map((r) => ({
      text: r.text,
      done: r.done,
    })),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Strips leading single-quote formula guard added by exportGoalsToCsv
 * (e.g. `'=1+1` -> `=1+1`) so CSV export -> import round-trips cleanly.
 */
export function stripFormulaGuard(value: string): string {
  if (value.length >= 2 && value[0] === "'" && /^[=+\-@\t\r]/.test(value[1])) {
    return value.slice(1);
  }
  return value;
}

/**
 * Normalizes common date inputs:
 * - YYYY-MM-DD (valid) -> YYYY-MM-DD
 * - DD/MM/YYYY or DD-MM-YYYY (valid) -> YYYY-MM-DD
 * - Empty -> ''
 * - Invalid -> returns trimmed raw string so validateGoalInput catches and explains it
 */
export function normalizeImportedDate(raw: string | null | undefined): string {
  const trimmed = stripFormulaGuard((raw ?? '').trim()).trim();
  if (!trimmed) return '';

  if (parseIsoDate(trimmed)) {
    return trimmed;
  }

  const dmyMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    const candidate = `${year}-${month}-${day}`;
    if (parseIsoDate(candidate)) {
      return candidate;
    }
  }

  return trimmed;
}

/**
 * RFC-4180 compliant CSV parser (handles BOM, quoted commas, escaped "", CRLF/LF).
 */
export function parseCsvMatrix(rawCsv: string): string[][] {
  const text = rawCsv.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === ';') {
      // Support both standard comma and European Excel semicolon delimiters when outside quotes
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') {
        i++;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function buildDuplicateFingerprint(input: GoalInput): string {
  return `${input.title.trim().toLowerCase()}|${input.startDate.trim()}|${input.endDate.trim()}`;
}

interface CandidateRow {
  readonly lineNumber: number;
  readonly input: GoalInput;
}

const TITLE_HEADERS = new Set(['goal', 'title', 'activity', 'attivita', 'attività', 'actividad', 'name', 'nome', 'nombre']);
const START_HEADERS = new Set(['start date', 'startdate', 'start', 'data inizio', 'inizio', 'fecha inicio', 'inicio']);
const END_HEADERS = new Set(['end date', 'enddate', 'end', 'data fine', 'fine', 'fecha fin', 'fin']);
const NOTES_HEADERS = new Set(['notes', 'note', 'notas', 'memo']);

function normalizeHeader(header: string): string {
  return stripFormulaGuard(header).trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseJsonCandidates(trimmed: string): { candidates: CandidateRow[]; error: string | null } {
  try {
    const parsed: unknown = JSON.parse(trimmed);
    let rawList: unknown[] | null = null;

    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if (
      parsed &&
      typeof parsed === 'object' &&
      'goals' in parsed &&
      Array.isArray((parsed as { goals: unknown }).goals)
    ) {
      rawList = (parsed as { goals: unknown[] }).goals;
    }

    if (!rawList) {
      return {
        candidates: [],
        error: 'Formato JSON non riconosciuto: atteso un backup CronoSheet ({ "goals": [...] }) o un array di attività.',
      };
    }

    const candidates: CandidateRow[] = rawList.map((item, idx) => {
      const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const rawTitle = rec['title'] ?? rec['goal'] ?? rec['name'] ?? '';
      const rawStart = rec['startDate'] ?? rec['start_date'] ?? rec['start'] ?? '';
      const rawEnd = rec['endDate'] ?? rec['end_date'] ?? rec['end'] ?? '';
      const rawNotes = rec['notes'] ?? '';

      return {
        lineNumber: idx + 1,
        input: {
          title: typeof rawTitle === 'string' ? rawTitle.trim() : String(rawTitle ?? '').trim(),
          startDate: normalizeImportedDate(typeof rawStart === 'string' ? rawStart : String(rawStart ?? '')),
          endDate: normalizeImportedDate(typeof rawEnd === 'string' ? rawEnd : String(rawEnd ?? '')),
          notes: typeof rawNotes === 'string' ? rawNotes.trim() : '',
        },
      };
    });

    return { candidates, error: null };
  } catch {
    return {
      candidates: [],
      error: 'JSON non valido: verifica parentesi, virgole e virgolette.',
    };
  }
}

function parseCsvCandidates(rawText: string): CandidateRow[] {
  const matrix = parseCsvMatrix(rawText);
  if (matrix.length === 0) return [];

  const firstRowNormalized = matrix[0].map(normalizeHeader);
  let titleIdx = firstRowNormalized.findIndex((h) => TITLE_HEADERS.has(h));
  let startIdx = firstRowNormalized.findIndex((h) => START_HEADERS.has(h));
  let endIdx = firstRowNormalized.findIndex((h) => END_HEADERS.has(h));
  let notesIdx = firstRowNormalized.findIndex((h) => NOTES_HEADERS.has(h));

  const hasHeader = titleIdx !== -1 || startIdx !== -1 || endIdx !== -1;

  if (!hasHeader) {
    titleIdx = 0;
    startIdx = 1;
    endIdx = 2;
    notesIdx = 3;
  } else if (titleIdx === -1) {
    titleIdx = 0;
  }

  const startRow = hasHeader ? 1 : 0;
  const candidates: CandidateRow[] = [];

  for (let i = startRow; i < matrix.length; i++) {
    const cols = matrix[i];
    const title = stripFormulaGuard(cols[titleIdx] ?? '').trim();
    const startDate = startIdx >= 0 ? normalizeImportedDate(cols[startIdx] ?? '') : '';
    const endDate = endIdx >= 0 ? normalizeImportedDate(cols[endIdx] ?? '') : '';
    const notes = notesIdx >= 0 ? stripFormulaGuard(cols[notesIdx] ?? '').trim() : '';

    candidates.push({
      lineNumber: i + 1,
      input: { title, startDate, endDate, notes },
    });
  }

  return candidates;
}

export function analyzeGoalImport(
  rawText: string,
  existingGoals: readonly Pick<GoalEntry, 'title' | 'startDate' | 'endDate'>[],
): ImportAnalysisResult {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return {
      detectedFormat: 'empty',
      rows: [],
      validCount: 0,
      duplicateCount: 0,
      invalidCount: 0,
      parseError: null,
    };
  }

  const isJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  let candidates: CandidateRow[] = [];

  if (isJson) {
    const parsed = parseJsonCandidates(trimmed);
    if (parsed.error) {
      return {
        detectedFormat: 'json',
        rows: [],
        validCount: 0,
        duplicateCount: 0,
        invalidCount: 0,
        parseError: parsed.error,
      };
    }
    candidates = parsed.candidates;
  } else {
    candidates = parseCsvCandidates(trimmed);
  }

  const seenFingerprints = new Set<string>(
    existingGoals.map((g) =>
      buildDuplicateFingerprint({
        title: g.title,
        startDate: g.startDate,
        endDate: g.endDate,
        notes: '',
      }),
    ),
  );

  const rows: AnalyzedImportRow[] = [];
  let validCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;

  for (const candidate of candidates) {
    const validation = validateGoalInput(candidate.input);
    if (!validation.valid) {
      invalidCount++;
      rows.push({
        lineNumber: candidate.lineNumber,
        input: candidate.input,
        status: 'invalid',
        errors: validation.errors,
      });
      continue;
    }

    const fp = buildDuplicateFingerprint(candidate.input);
    if (seenFingerprints.has(fp)) {
      duplicateCount++;
      rows.push({
        lineNumber: candidate.lineNumber,
        input: candidate.input,
        status: 'duplicate',
        errors: [],
      });
      continue;
    }

    seenFingerprints.add(fp);
    validCount++;
    rows.push({
      lineNumber: candidate.lineNumber,
      input: candidate.input,
      status: 'valid',
      errors: [],
    });
  }

  return {
    detectedFormat: isJson ? 'json' : 'csv',
    rows,
    validCount,
    duplicateCount,
    invalidCount,
    parseError: null,
  };
}
