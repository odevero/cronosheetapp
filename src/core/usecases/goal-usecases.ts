import {
  EnrichedGoal,
  GoalEntry,
  GoalFilterCriteria,
  GoalInput,
} from '../domain/entities/models';
import { diffCalendarDays, parseIsoDate } from '../domain/services/calendar-duration';
import { getGooglePaletteForRow } from '../domain/services/google-palette';
import { computeGoalMetrics, MessageLanguage } from '../domain/services/message-generator';

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export const GOAL_LIMITS = {
  titleMax: 160,
  notesMax: 1000,
} as const;

export function validateGoalInput(input: GoalInput): ValidationResult {
  const errors: string[] = [];
  const title = input.title.trim();
  const notes = input.notes.trim();

  if (!title) {
    errors.push('Il testo dell’attività è obbligatorio.');
  } else if (title.length > GOAL_LIMITS.titleMax) {
    errors.push(`Il testo non può superare ${GOAL_LIMITS.titleMax} caratteri.`);
  }

  if (notes.length > GOAL_LIMITS.notesMax) {
    errors.push(`Le note non possono superare ${GOAL_LIMITS.notesMax} caratteri.`);
  }

  if (input.startDate && !parseIsoDate(input.startDate)) {
    errors.push('La data di inizio non è valida (formato YYYY-MM-DD).');
  }
  if (input.endDate && !parseIsoDate(input.endDate)) {
    errors.push('La data di fine non è valida (formato YYYY-MM-DD).');
  }

  if (
    input.startDate &&
    input.endDate &&
    parseIsoDate(input.startDate) &&
    parseIsoDate(input.endDate) &&
    diffCalendarDays(input.startDate, input.endDate) < 0
  ) {
    errors.push('La data di fine non può precedere la data di inizio.');
  }

  return { valid: errors.length === 0, errors };
}

export function sanitizeGoalInput(input: GoalInput): GoalInput {
  return {
    title: input.title.trim().slice(0, GOAL_LIMITS.titleMax),
    startDate: parseIsoDate(input.startDate) ? input.startDate.trim() : '',
    endDate: parseIsoDate(input.endDate) ? input.endDate.trim() : '',
    notes: input.notes.trim().slice(0, GOAL_LIMITS.notesMax),
  };
}

export function enrichGoals(
  goals: readonly GoalEntry[],
  referenceDateIso: string,
  paletteStartRow = 1,
  messageLang: MessageLanguage = 'en',
): EnrichedGoal[] {
  const ordered = [...goals].sort((a, b) => a.sortOrder - b.sortOrder);
  return ordered.map((goal, idx) => {
    const rowIndex = idx + 1;
    return {
      goal,
      rowIndex,
      palette: getGooglePaletteForRow(rowIndex, paletteStartRow),
      metrics: computeGoalMetrics(goal, referenceDateIso, messageLang),
    };
  });
}

export function filterAndSortGoals(
  enriched: readonly EnrichedGoal[],
  criteria: GoalFilterCriteria,
): EnrichedGoal[] {
  const query = criteria.search.trim().toLowerCase();

  const filtered = enriched.filter((item) => {
    if (criteria.completion === 'ongoing' && item.metrics.isCompleted) {
      return false;
    }
    if (criteria.completion === 'completed' && !item.metrics.isCompleted) {
      return false;
    }
    if (query) {
      const haystack = [
        item.goal.title,
        item.goal.notes,
        item.metrics.shareDaysMessage,
        item.metrics.shareYmwMessage,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const dir = criteria.sortDir === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    switch (criteria.sortKey) {
      case 'sortOrder':
        return (a.goal.sortOrder - b.goal.sortOrder) * dir;
      case 'title':
        return a.goal.title.localeCompare(b.goal.title) * dir;
      case 'startDate':
        return (a.goal.startDate || '9999-99-99').localeCompare(b.goal.startDate || '9999-99-99') * dir;
      case 'endDate':
        return (a.goal.endDate || '9999-99-99').localeCompare(b.goal.endDate || '9999-99-99') * dir;
      case 'primaryDays': {
        const da = a.metrics.primaryDays ?? -1;
        const db = b.metrics.primaryDays ?? -1;
        return (da - db) * dir;
      }
    }
  });
}

function escapeCsvCell(raw: string | number | null | undefined): string {
  const str = raw === null || raw === undefined ? '' : String(raw);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Exports pure user data only (Goal, Start Date, End Date) — computed day counters
 * and generated messages are derived app projections and intentionally excluded.
 */
export function exportGoalsToCsv(enriched: readonly EnrichedGoal[]): string {
  const headers = ['Goal', 'Start Date', 'End Date'];

  const rows = enriched.map((e) => {
    const base: (string | number | null)[] = [
      e.goal.title,
      e.goal.startDate,
      e.goal.endDate,
    ];
    return base.map(escapeCsvCell).join(',');
  });

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}
