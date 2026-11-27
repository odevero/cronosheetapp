import {
  GoalEntry,
  RecurrenceCompartments,
  RecurrenceMatch,
  RecurrenceThresholds,
  RecurrenceType,
} from '../entities/models';
import {
  addCalendarDays,
  calculateCalendarDuration,
  diffCalendarDays,
  parseIsoDate,
} from './calendar-duration';
import { getGooglePaletteForRow } from './google-palette';

export const DEFAULT_RECURRENCE_THRESHOLDS: RecurrenceThresholds = {
  anniversaryDays: 7,
  monthiversaryDays: 5,
  weekiversaryDays: 3,
  milestoneDays: 7,
};

const ROUND_DAY_MILESTONES: readonly number[] = [
  50, 100, 150, 200, 250, 300, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000,
];

function classifyIntegerRecurrence(
  years: number,
  months: number,
  weeks: number,
  days: number,
): RecurrenceType | null {
  if (years >= 1 && months === 0 && weeks === 0 && days === 0) {
    return 'anniversary';
  }
  if (months >= 1 && weeks === 0 && days === 0) {
    return 'monthiversary';
  }
  if (weeks >= 1 && days === 0) {
    return 'weekiversary';
  }
  return null;
}

function buildRecurrenceLabel(
  type: RecurrenceType,
  years: number,
  months: number,
  weeks: number,
  totalDays: number,
): string {
  switch (type) {
    case 'anniversary':
      return years === 1 ? '1st Anniversary (1 year)' : `${years}th Anniversary (${years} years)`;
    case 'monthiversary': {
      const totalMonths = years * 12 + months;
      return years > 0
        ? `${years}y ${months}m Monthiversary (${totalMonths} months)`
        : `${months}m Monthiversary (${months} ${months === 1 ? 'month' : 'months'})`;
    }
    case 'weekiversary': {
      const totalWeeks = Math.round(totalDays / 7);
      return years === 0 && months === 0
        ? `Week ${weeks} (${totalDays} days)`
        : `Exact Week (${totalWeeks} wks · ${years}y ${months}m ${weeks}w)`;
    }
    case 'milestone':
      return `${totalDays}-Day Milestone`;
  }
}

export function scanUpcomingRecurrences(
  goals: readonly GoalEntry[],
  referenceDateIso: string,
  thresholds: RecurrenceThresholds = DEFAULT_RECURRENCE_THRESHOLDS,
  paletteStartRow = 1,
): RecurrenceCompartments {
  const maxWindow = Math.max(
    thresholds.anniversaryDays,
    thresholds.monthiversaryDays,
    thresholds.weekiversaryDays,
    thresholds.milestoneDays,
  );

  const rawAnniversaries: Omit<RecurrenceMatch, 'palette'>[] = [];
  const rawMonthiversaries: Omit<RecurrenceMatch, 'palette'>[] = [];
  const rawWeekiversaries: Omit<RecurrenceMatch, 'palette'>[] = [];
  const rawMilestones: Omit<RecurrenceMatch, 'palette'>[] = [];

  for (const goal of goals) {
    if (!parseIsoDate(goal.startDate) || parseIsoDate(goal.endDate) !== null) {
      continue;
    }

    const seenTypes = new Set<string>();

    for (let offset = 0; offset <= maxWindow; offset++) {
      const candidateDate = addCalendarDays(referenceDateIso, offset);
      const elapsedOnCandidate = diffCalendarDays(goal.startDate, candidateDate);
      if (elapsedOnCandidate <= 0) {
        continue;
      }

      const b = calculateCalendarDuration(goal.startDate, candidateDate);
      const calType = classifyIntegerRecurrence(b.years, b.months, b.weeks, b.days);

      if (calType === 'anniversary' && offset <= thresholds.anniversaryDays && !seenTypes.has('anniversary')) {
        seenTypes.add('anniversary');
        rawAnniversaries.push({
          id: `${goal.id}:anniversary:${candidateDate}`,
          goalId: goal.id,
          goalTitle: goal.title,
          startDate: goal.startDate,
          recurrenceDate: candidateDate,
          daysUntil: offset,
          type: 'anniversary',
          label: buildRecurrenceLabel('anniversary', b.years, b.months, b.weeks, b.totalDays),
          exactBreakdown: b,
        });
      } else if (
        calType === 'monthiversary' &&
        offset <= thresholds.monthiversaryDays &&
        !seenTypes.has('monthiversary')
      ) {
        seenTypes.add('monthiversary');
        rawMonthiversaries.push({
          id: `${goal.id}:monthiversary:${candidateDate}`,
          goalId: goal.id,
          goalTitle: goal.title,
          startDate: goal.startDate,
          recurrenceDate: candidateDate,
          daysUntil: offset,
          type: 'monthiversary',
          label: buildRecurrenceLabel('monthiversary', b.years, b.months, b.weeks, b.totalDays),
          exactBreakdown: b,
        });
      } else if (
        calType === 'weekiversary' &&
        offset <= thresholds.weekiversaryDays &&
        !seenTypes.has('weekiversary')
      ) {
        seenTypes.add('weekiversary');
        rawWeekiversaries.push({
          id: `${goal.id}:weekiversary:${candidateDate}`,
          goalId: goal.id,
          goalTitle: goal.title,
          startDate: goal.startDate,
          recurrenceDate: candidateDate,
          daysUntil: offset,
          type: 'weekiversary',
          label: buildRecurrenceLabel('weekiversary', b.years, b.months, b.weeks, b.totalDays),
          exactBreakdown: b,
        });
      }

      if (
        offset <= thresholds.milestoneDays &&
        ROUND_DAY_MILESTONES.includes(b.totalDays) &&
        !seenTypes.has(`milestone:${b.totalDays}`)
      ) {
        seenTypes.add(`milestone:${b.totalDays}`);
        rawMilestones.push({
          id: `${goal.id}:milestone:${b.totalDays}`,
          goalId: goal.id,
          goalTitle: goal.title,
          startDate: goal.startDate,
          recurrenceDate: candidateDate,
          daysUntil: offset,
          type: 'milestone',
          label: buildRecurrenceLabel('milestone', b.years, b.months, b.weeks, b.totalDays),
          exactBreakdown: b,
        });
      }
    }
  }

  const sortFn = (a: Omit<RecurrenceMatch, 'palette'>, b: Omit<RecurrenceMatch, 'palette'>): number => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return a.goalTitle.localeCompare(b.goalTitle);
  };

  rawAnniversaries.sort(sortFn);
  rawMonthiversaries.sort(sortFn);
  rawWeekiversaries.sort(sortFn);
  rawMilestones.sort(sortFn);

  let globalRow = 1;
  const attachPalette = (items: Omit<RecurrenceMatch, 'palette'>[]): RecurrenceMatch[] =>
    items.map((item) => {
      const palette = getGooglePaletteForRow(globalRow, paletteStartRow);
      globalRow += 1;
      return { ...item, palette };
    });

  const anniversaries = attachPalette(rawAnniversaries);
  const monthiversaries = attachPalette(rawMonthiversaries);
  const weekiversaries = attachPalette(rawWeekiversaries);
  const milestones = attachPalette(rawMilestones);

  return {
    anniversaries,
    monthiversaries,
    weekiversaries,
    milestones,
    totalCount:
      anniversaries.length + monthiversaries.length + weekiversaries.length + milestones.length,
  };
}
