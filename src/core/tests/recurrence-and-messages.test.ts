import test from 'node:test';
import assert from 'node:assert/strict';
import { GoalEntry } from '../domain/entities/models';
import { computeGoalMetrics, getGoalReferenceDate } from '../domain/services/message-generator';
import { scanUpcomingRecurrences } from '../domain/services/recurrence-scanner';
import { getGooglePaletteForRow } from '../domain/services/google-palette';

function makeGoal(overrides: Partial<GoalEntry>): GoalEntry {
  return {
    id: 'g1',
    ownerId: 'u1',
    title: 'run a marathon',
    startDate: '',
    endDate: '',
    notes: '',
    sortOrder: 0,
    createdAtIso: '2026-01-01T00:00:00Z',
    updatedAtIso: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('computeGoalMetrics generates exact dual English messages for every date combination', () => {
  const ref = '2026-11-24';

  const noDates = computeGoalMetrics(makeGoal({}), ref);
  assert.equal(noDates.scenario, 'NO_DATES');
  assert.equal(noDates.isCompleted, false);
  assert.equal(noDates.primaryDays, null);

  // Start only (past) -> "Day X of wanting to ..." and "Wanting to ... for: ..."
  const ongoing = computeGoalMetrics(makeGoal({ startDate: '2026-10-24' }), ref);
  assert.equal(ongoing.scenario, 'ONGOING');
  assert.equal(ongoing.isCompleted, false);
  assert.equal(ongoing.primaryDays, 31);
  assert.equal(ongoing.shareDaysMessage, 'Day 31 of wanting to run a marathon');
  assert.equal(ongoing.shareYmwMessage, 'Wanting to run a marathon for: 1 month');

  // Start only (future)
  const futureStart = computeGoalMetrics(makeGoal({ startDate: '2026-12-04' }), ref);
  assert.equal(futureStart.scenario, 'FUTURE_START');
  assert.equal(futureStart.isCompleted, false);
  assert.equal(futureStart.primaryDays, 10);
  assert.equal(futureStart.shareDaysMessage, '10 days until run a marathon');
  assert.equal(futureStart.shareYmwMessage, 'Starting run a marathon in: 1 week, 3 days');

  // Start + End -> Completed in N days & Completed in y/m/w/d
  const completed = computeGoalMetrics(
    makeGoal({ startDate: '2026-10-01', endDate: '2026-11-20' }),
    ref,
  );
  assert.equal(completed.scenario, 'COMPLETED');
  assert.equal(completed.isCompleted, true);
  assert.equal(completed.primaryDays, 50);
  assert.equal(completed.shareDaysMessage, 'Completed "run a marathon" in 50 days');
  assert.equal(completed.shareYmwMessage, 'Completed "run a marathon" in 1 month, 2 weeks, 5 days');

  // End only
  const endOnly = computeGoalMetrics(makeGoal({ endDate: '2026-11-20' }), ref);
  assert.equal(endOnly.scenario, 'END_ONLY');
  assert.equal(endOnly.isCompleted, true);
  assert.equal(endOnly.shareDaysMessage, 'Completed "run a marathon" on 2026-11-20');
});

test('scanUpcomingRecurrences strictly enforces exact integer conditions (0w 0d for monthiversary, 0m 0w 0d for anniversary)', () => {
  const ref = '2026-11-24';
  const goals: GoalEntry[] = [
    // Exact 1st Anniversary in 3 days (2025-11-27 -> 2026-11-27 = 1y 0m 0w 0d)
    makeGoal({ id: 'anniv', title: 'run 5km every morning', startDate: '2025-11-27' }),
    // Exact 2-month Monthiversary in 2 days (2026-09-26 -> 2026-11-26 = 0y 2m 0w 0d)
    makeGoal({ id: 'monthiv', title: 'master TypeScript', startDate: '2026-09-26' }),
    // Exact 2-week Weekiversary in 1 day (2026-11-11 -> 2026-11-25 = 0y 0m 2w 0d)
    makeGoal({ id: 'weekiv', title: 'read 20 pages daily', startDate: '2026-11-11' }),
    // NOT an anniversary (1y 0m 1w 0d on 2026-11-27, should be weekiversary NOT anniversary)
    makeGoal({ id: 'not-anniv', title: 'learn piano', startDate: '2025-11-20' }),
    // Exact 100-day milestone in 4 days (2026-08-20 + 100 days = 2026-11-28)
    makeGoal({ id: 'mile100', title: 'stay sugar-free', startDate: '2026-08-20' }),
    // Completed goal should be ignored
    makeGoal({ id: 'done', title: 'finished task', startDate: '2025-11-27', endDate: '2026-01-01' }),
  ];

  const result = scanUpcomingRecurrences(
    goals,
    ref,
    { anniversaryDays: 7, monthiversaryDays: 5, weekiversaryDays: 3, milestoneDays: 7 },
    1,
  );

  assert.equal(result.anniversaries.length, 1);
  assert.equal(result.anniversaries[0].goalId, 'anniv');
  assert.equal(result.anniversaries[0].daysUntil, 3);
  assert.equal(result.anniversaries[0].exactBreakdown.months, 0);
  assert.equal(result.anniversaries[0].exactBreakdown.weeks, 0);
  assert.equal(result.anniversaries[0].exactBreakdown.days, 0);

  assert.equal(result.monthiversaries.length, 1);
  assert.equal(result.monthiversaries[0].goalId, 'monthiv');
  assert.equal(result.monthiversaries[0].daysUntil, 2);
  assert.equal(result.monthiversaries[0].exactBreakdown.weeks, 0);
  assert.equal(result.monthiversaries[0].exactBreakdown.days, 0);

  const weekIds = result.weekiversaries.map((w) => w.goalId);
  assert.ok(weekIds.includes('weekiv'));
  assert.ok(weekIds.includes('not-anniv'));

  assert.equal(result.milestones.length, 1);
  assert.equal(result.milestones[0].goalId, 'mile100');
  assert.equal(result.milestones[0].daysUntil, 4);
});

test('Google palette alternation respects custom starting row offset', () => {
  assert.equal(getGooglePaletteForRow(1, 1).color, 'blue');
  assert.equal(getGooglePaletteForRow(2, 1).color, 'red');
  assert.equal(getGooglePaletteForRow(3, 1).color, 'yellow');
  assert.equal(getGooglePaletteForRow(4, 1).color, 'green');
  assert.equal(getGooglePaletteForRow(5, 1).color, 'blue');

  assert.equal(getGooglePaletteForRow(2, 2).color, 'blue');
  assert.equal(getGooglePaletteForRow(3, 2).color, 'red');
  assert.equal(getGooglePaletteForRow(1, 2).color, 'green');
});

test('getGoalReferenceDate mirrors =IF($C4="", $D4, $C4)', () => {
  assert.equal(
    getGoalReferenceDate({ startDate: '2026-01-10', endDate: '2026-03-15' }),
    '2026-01-10',
  );
  assert.equal(getGoalReferenceDate({ startDate: '2026-01-10', endDate: '' }), '2026-01-10');
  assert.equal(getGoalReferenceDate({ startDate: '', endDate: '2026-03-15' }), '2026-03-15');
  assert.equal(getGoalReferenceDate({ startDate: '', endDate: '' }), '');
});

test('computeGoalMetrics generates natural bare-infinitive messages in Italian and Spanish', () => {
  const ref = '2026-11-24';

  const itOngoing = computeGoalMetrics(
    makeGoal({ title: 'correre una maratona', startDate: '2026-10-24' }),
    ref,
    'it',
  );
  assert.equal(itOngoing.shareDaysMessage, 'Giorno 31 in cui voglio correre una maratona');
  assert.equal(itOngoing.shareYmwMessage, 'Voglio correre una maratona da: 1 mese');

  const itCompleted = computeGoalMetrics(
    makeGoal({ title: 'correre una maratona', startDate: '2026-10-01', endDate: '2026-11-20' }),
    ref,
    'it',
  );
  assert.equal(itCompleted.shareDaysMessage, 'Completato «correre una maratona» in 50 giorni');
  assert.equal(
    itCompleted.shareYmwMessage,
    'Completato «correre una maratona» in 1 mese, 2 settimane, 5 giorni',
  );

  const esOngoing = computeGoalMetrics(
    makeGoal({ title: 'correr una maratón', startDate: '2026-10-24' }),
    ref,
    'es',
  );
  assert.equal(esOngoing.shareDaysMessage, 'Día 31 queriendo correr una maratón');
  assert.equal(esOngoing.shareYmwMessage, 'Queriendo correr una maratón desde hace: 1 mes');

  const esFuture = computeGoalMetrics(
    makeGoal({ title: 'correr una maratón', startDate: '2026-12-04' }),
    ref,
    'es',
  );
  assert.equal(esFuture.shareDaysMessage, 'Faltan 10 días para: correr una maratón');
  assert.equal(esFuture.shareYmwMessage, 'Empiezo «correr una maratón» en: 1 semana, 3 días');
});
