import { ComputedGoalMetrics, GoalEntry } from '../entities/models';
import {
  calculateCalendarDuration,
  diffCalendarDays,
  formatCompactYmw,
  formatDurationLocalized,
  parseIsoDate,
} from './calendar-duration';

export type MessageLanguage = 'en' | 'it' | 'es';

function pluralDays(n: number, lang: MessageLanguage): string {
  const abs = Math.abs(n);
  if (lang === 'it') {
    return abs === 1 ? '1 giorno' : `${abs} giorni`;
  }
  if (lang === 'es') {
    return abs === 1 ? '1 día' : `${abs} días`;
  }
  return abs === 1 ? '1 day' : `${abs} days`;
}

/**
 * Mirrors the Google Sheet column Data!G:G ("data di riferimento: di inizio o di fine"):
 * =IF($C4 = "", $D4, $C4) -> uses startDate when present, otherwise falls back to endDate.
 */
export function getGoalReferenceDate(goal: Pick<GoalEntry, 'startDate' | 'endDate'>): string {
  const start = goal.startDate.trim();
  return start !== '' ? start : goal.endDate.trim();
}

/**
 * Computes exact day counts, Y/M/W/D breakdown, and BOTH shareable message formats.
 * Uses bare-infinitive-friendly constructions in EN ("wanting to ..."), IT ("voglio ..."),
 * and ES ("queriendo ...") so activities written in the infinitive read naturally in all 3 languages.
 */
export function computeGoalMetrics(
  goal: GoalEntry,
  referenceDateIso: string,
  lang: MessageLanguage = 'en',
): ComputedGoalMetrics {
  const hasStart = parseIsoDate(goal.startDate) !== null;
  const hasEnd = parseIsoDate(goal.endDate) !== null;
  const cleanTitle = goal.title.trim() || '...';

  // Case 1: Neither date filled
  if (!hasStart && !hasEnd) {
    const noDateDays =
      lang === 'it'
        ? 'Aggiungi una data di inizio per contare i giorni'
        : lang === 'es'
          ? 'Añade una fecha de inicio para contar días'
          : 'Add a start date to count days';
    const noDateYmw =
      lang === 'it'
        ? 'Aggiungi una data di inizio per calcolare a/m/s/g'
        : lang === 'es'
          ? 'Añade una fecha de inicio para calcular a/m/s/d'
          : 'Add a start date to calculate y/m/w/d';
    return {
      scenario: 'NO_DATES',
      isCompleted: false,
      primaryDays: null,
      signedDays: null,
      breakdown: null,
      formattedYmw: '—',
      compactYmw: '—',
      shareDaysMessage: noDateDays,
      shareYmwMessage: noDateYmw,
      debugFormulaTrace: 'START=∅ END=∅ -> NO_DATES',
    };
  }

  // Case 2: Both Start Date and End Date filled -> Completed
  if (hasStart && hasEnd) {
    const signedSpan = diffCalendarDays(goal.startDate, goal.endDate);
    const breakdown = calculateCalendarDuration(goal.startDate, goal.endDate);
    const formattedYmw = formatDurationLocalized(breakdown, lang);
    const compactYmw = formatCompactYmw(breakdown);

    const shareDaysMessage =
      lang === 'it'
        ? `Completato «${cleanTitle}» in ${pluralDays(breakdown.totalDays, lang)}`
        : lang === 'es'
          ? `Completado «${cleanTitle}» en ${pluralDays(breakdown.totalDays, lang)}`
          : `Completed "${cleanTitle}" in ${pluralDays(breakdown.totalDays, lang)}`;

    const shareYmwMessage =
      lang === 'it'
        ? `Completato «${cleanTitle}» in ${formattedYmw}`
        : lang === 'es'
          ? `Completado «${cleanTitle}» en ${formattedYmw}`
          : `Completed "${cleanTitle}" in ${formattedYmw}`;

    return {
      scenario: 'COMPLETED',
      isCompleted: true,
      primaryDays: breakdown.totalDays,
      signedDays: signedSpan,
      breakdown,
      formattedYmw,
      compactYmw,
      shareDaysMessage,
      shareYmwMessage,
      debugFormulaTrace: `END(${goal.endDate}) - START(${goal.startDate}) = ${signedSpan}d (${compactYmw}) -> COMPLETED`,
    };
  }

  // Case 3: End Date only (completed without start date)
  if (!hasStart && hasEnd) {
    const signedFromEnd = diffCalendarDays(goal.endDate, referenceDateIso);
    const breakdown = calculateCalendarDuration(goal.endDate, referenceDateIso);
    const formattedYmw = formatDurationLocalized(breakdown, lang);
    const compactYmw = formatCompactYmw(breakdown);

    const shareDaysMessage =
      lang === 'it'
        ? `Completato «${cleanTitle}» il ${goal.endDate}`
        : lang === 'es'
          ? `Completado «${cleanTitle}» el ${goal.endDate}`
          : `Completed "${cleanTitle}" on ${goal.endDate}`;

    const shareYmwMessage =
      lang === 'it'
        ? signedFromEnd >= 0
          ? `Completato «${cleanTitle}» (${formattedYmw} fa)`
          : `Completamento di «${cleanTitle}» tra ${formattedYmw}`
        : lang === 'es'
          ? signedFromEnd >= 0
            ? `Completado «${cleanTitle}» (hace ${formattedYmw})`
            : `Completando «${cleanTitle}» en ${formattedYmw}`
          : signedFromEnd >= 0
            ? `Completed "${cleanTitle}" (${formattedYmw} ago)`
            : `Completing "${cleanTitle}" in ${formattedYmw}`;

    return {
      scenario: 'END_ONLY',
      isCompleted: true,
      primaryDays: breakdown.totalDays,
      signedDays: signedFromEnd,
      breakdown,
      formattedYmw,
      compactYmw,
      shareDaysMessage,
      shareYmwMessage,
      debugFormulaTrace: `REF(${referenceDateIso}) - END(${goal.endDate}) = ${signedFromEnd}d -> END_ONLY`,
    };
  }

  // Case 4: Start Date only
  const elapsedSigned = diffCalendarDays(goal.startDate, referenceDateIso);
  const breakdown = calculateCalendarDuration(goal.startDate, referenceDateIso);
  const formattedYmw = formatDurationLocalized(breakdown, lang);
  const compactYmw = formatCompactYmw(breakdown);

  if (elapsedSigned < 0) {
    const until = Math.abs(elapsedSigned);
    const shareDaysMessage =
      lang === 'it'
        ? `${pluralDays(until, lang)} a: ${cleanTitle}`
        : lang === 'es'
          ? `Faltan ${pluralDays(until, lang)} para: ${cleanTitle}`
          : `${pluralDays(until, lang)} until ${cleanTitle}`;

    const shareYmwMessage =
      lang === 'it'
        ? `Inizio «${cleanTitle}» tra: ${formattedYmw}`
        : lang === 'es'
          ? `Empiezo «${cleanTitle}» en: ${formattedYmw}`
          : `Starting ${cleanTitle} in: ${formattedYmw}`;

    return {
      scenario: 'FUTURE_START',
      isCompleted: false,
      primaryDays: until,
      signedDays: elapsedSigned,
      breakdown,
      formattedYmw,
      compactYmw,
      shareDaysMessage,
      shareYmwMessage,
      debugFormulaTrace: `REF(${referenceDateIso}) - START(${goal.startDate}) = ${elapsedSigned}d -> FUTURE_START`,
    };
  }

  const shareDaysMessage =
    lang === 'it'
      ? `Giorno ${elapsedSigned} in cui voglio ${cleanTitle}`
      : lang === 'es'
        ? `Día ${elapsedSigned} queriendo ${cleanTitle}`
        : `Day ${elapsedSigned} of wanting to ${cleanTitle}`;

  const shareYmwMessage =
    lang === 'it'
      ? `Voglio ${cleanTitle} da: ${formattedYmw}`
      : lang === 'es'
        ? `Queriendo ${cleanTitle} desde hace: ${formattedYmw}`
        : `Wanting to ${cleanTitle} for: ${formattedYmw}`;

  return {
    scenario: 'ONGOING',
    isCompleted: false,
    primaryDays: elapsedSigned,
    signedDays: elapsedSigned,
    breakdown,
    formattedYmw,
    compactYmw,
    shareDaysMessage,
    shareYmwMessage,
    debugFormulaTrace: `REF(${referenceDateIso}) - START(${goal.startDate}) = +${elapsedSigned}d (${compactYmw}) -> ONGOING`,
  };
}
