import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GoalEntry } from '../domain/entities/models';
import { enrichGoals, exportGoalsToCsv } from '../usecases/goal-usecases';
import {
  analyzeGoalImport,
  exportWorkspaceBackupJson,
  normalizeImportedDate,
  parseCsvMatrix,
  stripFormulaGuard,
} from '../domain/services/goal-import-export';

const SAMPLE_GOALS: GoalEntry[] = [
  {
    id: 'g1',
    ownerId: 'u1',
    title: 'quit smoking, coffee & soda',
    startDate: '2025-01-15',
    endDate: '',
    notes: 'keep strong',
    sortOrder: 0,
    createdAtIso: '2025-01-15T00:00:00.000Z',
    updatedAtIso: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'g2',
    ownerId: 'u1',
    title: '=SUM(A1:A2) test',
    startDate: '2025-03-01',
    endDate: '2025-06-01',
    notes: '',
    sortOrder: 1,
    createdAtIso: '2025-03-01T00:00:00.000Z',
    updatedAtIso: '2025-03-01T00:00:00.000Z',
  },
];

describe('goal-import-export', () => {
  it('normalizes ISO and DD/MM/YYYY dates while flagging invalid dates', () => {
    assert.equal(normalizeImportedDate('2026-04-12'), '2026-04-12');
    assert.equal(normalizeImportedDate('12/04/2026'), '2026-04-12');
    assert.equal(normalizeImportedDate('5-3-2026'), '2026-03-05');
    assert.equal(normalizeImportedDate(''), '');
    assert.equal(normalizeImportedDate('31/02/2026'), '31/02/2026');
  });

  it('strips formula-injection leading apostrophe safely', () => {
    assert.equal(stripFormulaGuard("'=SUM(1,2)"), '=SUM(1,2)');
    assert.equal(stripFormulaGuard("'hello"), "'hello");
  });

  it('exports strictly user data (Goal,Start Date,End Date) and round-trips cleanly through analyzeGoalImport', () => {
    const enriched = enrichGoals(SAMPLE_GOALS, '2026-04-12');
    const csv = exportGoalsToCsv(enriched);

    const headerLine = csv.split(/\r?\n/)[0];
    assert.equal(headerLine, 'Goal,Start Date,End Date');
    assert.ok(!csv.includes('wanting to'), 'CSV export must not contain generated messages');

    const freshAnalysis = analyzeGoalImport(csv, []);
    assert.equal(freshAnalysis.detectedFormat, 'csv');
    assert.equal(freshAnalysis.validCount, 2);
    assert.equal(freshAnalysis.duplicateCount, 0);
    assert.equal(freshAnalysis.invalidCount, 0);
    assert.equal(freshAnalysis.rows[0].input.title, 'quit smoking, coffee & soda');
    assert.equal(freshAnalysis.rows[1].input.title, '=SUM(A1:A2) test');
    assert.equal(freshAnalysis.rows[1].input.endDate, '2025-06-01');
  });

  it('detects duplicates against existing goals and flags invalid rows (bad date / reversed range)', () => {
    const csv = [
      'Goal,Start Date,End Date',
      '"quit smoking, coffee & soda",2025-01-15,',
      'run 5km every morning,15/02/2026,',
      'bad range activity,2026-05-10,2026-05-01',
    ].join('\n');

    const res = analyzeGoalImport(csv, SAMPLE_GOALS);
    assert.equal(res.detectedFormat, 'csv');
    assert.equal(res.duplicateCount, 1);
    assert.equal(res.validCount, 1);
    assert.equal(res.invalidCount, 1);
    assert.equal(res.rows[0].status, 'duplicate');
    assert.equal(res.rows[1].status, 'valid');
    assert.equal(res.rows[1].input.startDate, '2026-02-15');
    assert.equal(res.rows[2].status, 'invalid');
  });

  it('round-trips JSON backup export and detects duplicates on re-import', () => {
    const json = exportWorkspaceBackupJson(SAMPLE_GOALS, [], [], '2026-04-12');
    const fresh = analyzeGoalImport(json, []);
    assert.equal(fresh.detectedFormat, 'json');
    assert.equal(fresh.validCount, 2);

    const reimport = analyzeGoalImport(json, SAMPLE_GOALS);
    assert.equal(reimport.duplicateCount, 2);
    assert.equal(reimport.validCount, 0);
  });

  it('parses RFC-4180 CSV with escaped quotes and CRLF', () => {
    const matrix = parseCsvMatrix('Goal,Start Date\r\n"read ""Dune"", book 1",2026-01-01\r\n');
    assert.equal(matrix.length, 2);
    assert.equal(matrix[1][0], 'read "Dune", book 1');
  });
});
