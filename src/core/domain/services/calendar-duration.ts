import { DurationBreakdown } from '../entities/models';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export interface CalendarDateParts {
  readonly year: number;
  readonly month: number; // 1..12
  readonly day: number; // 1..31
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function parseIsoDate(iso: string): CalendarDateParts | null {
  if (!iso) return null;
  const match = ISO_DATE_RE.exec(iso.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return null;
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;
  return { year, month, day };
}

export function toUtcMs(parts: CalendarDateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

export function formatIsoDate(parts: CalendarDateParts): string {
  const y = String(parts.year).padStart(4, '0');
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIsoLocal(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addCalendarDays(isoDate: string, deltaDays: number): string {
  const parts = parseIsoDate(isoDate);
  if (!parts) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  const targetMs = toUtcMs(parts) + Math.trunc(deltaDays) * MS_PER_DAY;
  const dt = new Date(targetMs);
  return formatIsoDate({
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  });
}

export function addCalendarMonths(parts: CalendarDateParts, monthsToAdd: number): CalendarDateParts {
  const totalMonths = parts.year * 12 + (parts.month - 1) + monthsToAdd;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12 + 1;
  const clampedDay = Math.min(parts.day, daysInMonth(targetYear, targetMonth));
  return { year: targetYear, month: targetMonth, day: clampedDay };
}

export function diffCalendarDays(fromIso: string, toIso: string): number {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) {
    throw new Error(`Invalid ISO dates for diff: "${fromIso}" -> "${toIso}"`);
  }
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

/**
 * Exact calendar-accurate decomposition into Years + Months + Weeks + Days.
 */
export function calculateCalendarDuration(fromIso: string, toIso: string): DurationBreakdown {
  const from = parseIsoDate(fromIso);
  const to = parseIsoDate(toIso);
  if (!from || !to) {
    throw new Error(`Invalid ISO dates: "${fromIso}" -> "${toIso}"`);
  }

  const signed = Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
  if (signed === 0) {
    return {
      years: 0,
      months: 0,
      weeks: 0,
      days: 0,
      totalDays: 0,
      direction: 'today',
    };
  }

  const direction: 'past' | 'future' = signed > 0 ? 'past' : 'future';
  const start = signed > 0 ? from : to;
  const end = signed > 0 ? to : from;
  const endMs = toUtcMs(end);

  let totalMonths = (end.year - start.year) * 12 + (end.month - start.month);
  let anchor = addCalendarMonths(start, totalMonths);
  while (toUtcMs(anchor) > endMs && totalMonths > 0) {
    totalMonths -= 1;
    anchor = addCalendarMonths(start, totalMonths);
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const remainingDays = Math.round((endMs - toUtcMs(anchor)) / MS_PER_DAY);
  const weeks = Math.floor(remainingDays / 7);
  const days = remainingDays % 7;

  return {
    years,
    months,
    weeks,
    days,
    totalDays: Math.abs(signed),
    direction,
  };
}

/**
 * Formats a DurationBreakdown into clean localized prose (EN / IT / ES) ready for sharing.
 */
export function formatDurationLocalized(
  breakdown: DurationBreakdown,
  lang: 'it' | 'en' | 'es' = 'en',
): string {
  if (breakdown.totalDays === 0) {
    if (lang === 'it') return '0 giorni';
    if (lang === 'es') return '0 días';
    return '0 days';
  }

  const units =
    lang === 'it'
      ? { y1: '1 anno', yn: 'anni', m1: '1 mese', mn: 'mesi', w1: '1 settimana', wn: 'settimane', d1: '1 giorno', dn: 'giorni' }
      : lang === 'es'
        ? { y1: '1 año', yn: 'años', m1: '1 mes', mn: 'meses', w1: '1 semana', wn: 'semanas', d1: '1 día', dn: 'días' }
        : { y1: '1 year', yn: 'years', m1: '1 month', mn: 'months', w1: '1 week', wn: 'weeks', d1: '1 day', dn: 'days' };

  const segments: string[] = [];
  if (breakdown.years > 0) {
    segments.push(breakdown.years === 1 ? units.y1 : `${breakdown.years} ${units.yn}`);
  }
  if (breakdown.months > 0) {
    segments.push(breakdown.months === 1 ? units.m1 : `${breakdown.months} ${units.mn}`);
  }
  if (breakdown.weeks > 0) {
    segments.push(breakdown.weeks === 1 ? units.w1 : `${breakdown.weeks} ${units.wn}`);
  }
  if (breakdown.days > 0) {
    segments.push(breakdown.days === 1 ? units.d1 : `${breakdown.days} ${units.dn}`);
  }
  return segments.join(', ');
}

/**
 * Formats a DurationBreakdown into clean English prose ready for social sharing.
 */
export function formatDurationEn(breakdown: DurationBreakdown): string {
  return formatDurationLocalized(breakdown, 'en');
}

export function formatCompactYmw(b: DurationBreakdown): string {
  return `${b.years}y ${b.months}m ${b.weeks}w ${b.days}d`;
}

export function formatDateShort(iso: string): string {
  const parts = parseIsoDate(iso);
  if (!parts) return '—';
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  return `${dd}/${mm}/${parts.year}`;
}

const ITALIAN_WEEKDAYS = [
  'Domenica',
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
] as const;

const ITALIAN_MONTHS = [
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
] as const;

/**
 * Formats an ISO date + hour/minute into Italian full date-time format:
 * e.g. "Giovedì, 26 novembre 2026, 16:29"
 */
export function formatItalianDateTime(
  isoDate: string,
  hours: number,
  minutes: number,
): string {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const weekday = ITALIAN_WEEKDAYS[new Date(toUtcMs(parts)).getUTCDay()];
  const monthName = ITALIAN_MONTHS[parts.month - 1];
  const hh = String(Math.max(0, Math.min(23, Math.trunc(hours)))).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, Math.trunc(minutes)))).padStart(2, '0');
  return `${weekday}, ${parts.day} ${monthName} ${parts.year}, ${hh}:${mm}`;
}
