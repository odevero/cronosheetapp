import test from 'node:test';
import assert from 'node:assert/strict';
import { GoalEntry } from '../domain/entities/models';
import {
  enrichGoals,
  exportGoalsToCsv,
  filterAndSortGoals,
  validateGoalInput,
} from '../usecases/goal-usecases';

const sampleGoals: GoalEntry[] = [
  {
    id: '1',
    ownerId: 'u1',
    title: 'run 5km every morning',
    startDate: '2026-08-01',
    endDate: '',
    notes: 'Three times a week',
    sortOrder: 0,
    createdAtIso: '2026-08-01T00:00:00Z',
    updatedAtIso: '2026-08-01T00:00:00Z',
  },
  {
    id: '2',
    ownerId: 'u1',
    title: 'launch portfolio on GitHub',
    startDate: '2026-10-01',
    endDate: '',
    notes: 'Clean architecture',
    sortOrder: 1,
    createdAtIso: '2026-10-01T00:00:00Z',
    updatedAtIso: '2026-10-01T00:00:00Z',
  },
  {
    id: '3',
    ownerId: 'u1',
    title: '=SUM(A1:A5) finish TypeScript course',
    startDate: '2026-01-10',
    endDate: '2026-02-20',
    notes: 'Done early',
    sortOrder: 2,
    createdAtIso: '2026-01-10T00:00:00Z',
    updatedAtIso: '2026-02-20T00:00:00Z',
  },
];

test('validateGoalInput catches empty title and endDate < startDate', () => {
  const emptyRes = validateGoalInput({
    title: '   ',
    startDate: '2026-01-01',
    endDate: '',
    notes: '',
  });
  assert.equal(emptyRes.valid, false);

  const dateOrderRes = validateGoalInput({
    title: 'Test',
    startDate: '2026-05-10',
    endDate: '2026-05-01',
    notes: '',
  });
  assert.equal(dateOrderRes.valid, false);
});

test('filterAndSortGoals filters by completion and sorts without mutating original Data order', () => {
  const enriched = enrichGoals(sampleGoals, '2026-11-24', 1);
  const ongoingDesc = filterAndSortGoals(enriched, {
    search: '',
    completion: 'ongoing',
    sortKey: 'primaryDays',
    sortDir: 'desc',
  });

  assert.equal(ongoingDesc.length, 2);
  assert.equal(ongoingDesc[0].goal.id, '1'); // 115 days > 54 days
  assert.equal(ongoingDesc[1].goal.id, '2');
  // Original array order untouched
  assert.equal(enriched[0].goal.id, '1');

  const completedOnly = filterAndSortGoals(enriched, {
    search: '',
    completion: 'completed',
    sortKey: 'sortOrder',
    sortDir: 'asc',
  });
  assert.equal(completedOnly.length, 1);
  assert.equal(completedOnly[0].goal.id, '3');
});

test('exportGoalsToCsv neutralizes spreadsheet formula injection and exports strictly user data columns', () => {
  const enriched = enrichGoals(sampleGoals, '2026-11-24', 1);
  const csv = exportGoalsToCsv(enriched);
  const lines = csv.split(/\r?\n/);
  assert.equal(lines[0], 'Goal,Start Date,End Date');
  assert.ok(csv.includes("'=SUM(A1:A5) finish TypeScript course"));
  assert.ok(!csv.includes('Message (Days)'));
  assert.ok(!csv.includes('Debug Formula Trace'));
});
