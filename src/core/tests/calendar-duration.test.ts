import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCalendarDays,
  calculateCalendarDuration,
  diffCalendarDays,
  formatCompactYmw,
  formatDurationEn,
  formatItalianDateTime,
  isLeapYear,
} from '../domain/services/calendar-duration';

test('leap year detection handles century and 400-year rules', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
});

test('same day produces zero duration', () => {
  const b = calculateCalendarDuration('2026-05-10', '2026-05-10');
  assert.deepEqual(b, {
    years: 0,
    months: 0,
    weeks: 0,
    days: 0,
    totalDays: 0,
    direction: 'today',
  });
  assert.equal(formatDurationEn(b), '0 days');
});

test('exact 1 week equals 0y 0m 1w 0d', () => {
  const b = calculateCalendarDuration('2026-03-01', '2026-03-08');
  assert.equal(b.years, 0);
  assert.equal(b.months, 0);
  assert.equal(b.weeks, 1);
  assert.equal(b.days, 0);
  assert.equal(b.totalDays, 7);
});

test('month-end clamping: Jan 31 -> Feb 28 (common year) is exact 1 month', () => {
  const b = calculateCalendarDuration('2025-01-31', '2025-02-28');
  assert.equal(b.years, 0);
  assert.equal(b.months, 1);
  assert.equal(b.weeks, 0);
  assert.equal(b.days, 0);
  assert.equal(b.totalDays, 28);
});

test('month-end clamping: Jan 31 -> Feb 29 (leap year) is exact 1 month', () => {
  const b = calculateCalendarDuration('2024-01-31', '2024-02-29');
  assert.equal(b.years, 0);
  assert.equal(b.months, 1);
  assert.equal(b.weeks, 0);
  assert.equal(b.days, 0);
  assert.equal(b.totalDays, 29);
});

test('month-end clamping: Jan 31 -> Mar 1 (common year) is 1 month + 1 day', () => {
  const b = calculateCalendarDuration('2025-01-31', '2025-03-01');
  assert.equal(b.years, 0);
  assert.equal(b.months, 1);
  assert.equal(b.weeks, 0);
  assert.equal(b.days, 1);
  assert.equal(b.totalDays, 29);
});

test('leap-day anniversary: Feb 29 2024 -> Feb 28 2025 is exact 1 year', () => {
  const b = calculateCalendarDuration('2024-02-29', '2025-02-28');
  assert.equal(b.years, 1);
  assert.equal(b.months, 0);
  assert.equal(b.weeks, 0);
  assert.equal(b.days, 0);
  assert.equal(b.totalDays, 365);
});

test('multi-year span with weeks and residual days', () => {
  const b = calculateCalendarDuration('2023-04-14', '2026-11-24');
  assert.equal(b.years, 3);
  assert.equal(b.months, 7);
  assert.equal(b.weeks, 1);
  assert.equal(b.days, 3);
  assert.equal(b.totalDays, diffCalendarDays('2023-04-14', '2026-11-24'));
  assert.equal(formatDurationEn(b), '3 years, 7 months, 1 week, 3 days');
  assert.equal(formatCompactYmw(b), '3y 7m 1w 3d');
});

test('future dates report direction = future and positive magnitude', () => {
  const b = calculateCalendarDuration('2026-12-01', '2026-11-24');
  assert.equal(b.direction, 'future');
  assert.equal(b.weeks, 1);
  assert.equal(b.days, 0);
  assert.equal(b.totalDays, 7);
});

test('addCalendarDays crosses leap year cleanly', () => {
  assert.equal(addCalendarDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addCalendarDays('2024-02-28', 2), '2024-03-01');
  assert.equal(addCalendarDays('2025-02-28', 1), '2025-03-01');
});

test('formatItalianDateTime outputs weekday, day, month, year and HH:MM', () => {
  assert.equal(
    formatItalianDateTime('2026-11-26', 16, 29),
    'Giovedì, 26 novembre 2026, 16:29',
  );
  assert.equal(
    formatItalianDateTime('2026-01-04', 9, 5),
    'Domenica, 4 gennaio 2026, 09:05',
  );
  assert.equal(
    formatItalianDateTime('2026-03-02', 0, 0),
    'Lunedì, 2 marzo 2026, 00:00',
  );
  assert.equal(formatItalianDateTime('invalid', 12, 0), 'invalid');
});
