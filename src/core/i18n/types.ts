import { parseIsoDate, toUtcMs } from '../domain/services/calendar-duration';

export type AppLanguage = 'it' | 'en' | 'es';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['it', 'en', 'es'] as const;

export const LANGUAGE_LABELS: Record<AppLanguage, { readonly code: string; readonly nativeName: string }> = {
  it: { code: 'IT', nativeName: 'Italiano' },
  en: { code: 'EN', nativeName: 'English' },
  es: { code: 'ES', nativeName: 'Español' },
};

export type TranslationParams = Record<string, string | number>;

export function isSupportedLanguage(value: unknown): value is AppLanguage {
  return value === 'it' || value === 'en' || value === 'es';
}

/**
 * Resolves the active app language with priority:
 * 1) Explicit stored user preference (localStorage / profile)
 * 2) Browser/OS preferred languages list (navigator.languages / navigator.language)
 * 3) Default fallback ('it')
 */
export function detectPreferredLanguage(
  browserLanguages: readonly string[] | null | undefined,
  storedPreference?: string | null,
  fallback: AppLanguage = 'it',
): AppLanguage {
  if (isSupportedLanguage(storedPreference)) {
    return storedPreference;
  }

  if (browserLanguages && browserLanguages.length > 0) {
    for (const raw of browserLanguages) {
      if (!raw) continue;
      const base = raw.trim().toLowerCase().split(/[-_]/)[0];
      if (isSupportedLanguage(base)) {
        return base;
      }
    }
  }

  return fallback;
}

export function interpolateTemplate(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const val = params[key];
    return val === undefined ? '' : String(val);
  });
}

const WEEKDAYS_BY_LANG: Record<AppLanguage, readonly string[]> = {
  it: ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
};

const MONTHS_BY_LANG: Record<AppLanguage, readonly string[]> = {
  it: [
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
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
  es: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
};

export function formatLocalizedDateTime(
  isoDate: string,
  hours: number,
  minutes: number,
  lang: AppLanguage,
): string {
  const parts = parseIsoDate(isoDate);
  if (!parts) return isoDate;
  const weekday = WEEKDAYS_BY_LANG[lang][new Date(toUtcMs(parts)).getUTCDay()];
  const monthName = MONTHS_BY_LANG[lang][parts.month - 1];
  const hh = String(Math.max(0, Math.min(23, Math.trunc(hours)))).padStart(2, '0');
  const mm = String(Math.max(0, Math.min(59, Math.trunc(minutes)))).padStart(2, '0');

  if (lang === 'en') {
    return `${weekday}, ${monthName} ${parts.day}, ${parts.year}, ${hh}:${mm}`;
  }
  if (lang === 'es') {
    return `${weekday}, ${parts.day} de ${monthName} de ${parts.year}, ${hh}:${mm}`;
  }
  return `${weekday}, ${parts.day} ${monthName} ${parts.year}, ${hh}:${mm}`;
}

export function formatLocalizedShowcaseBrand(
  firstName: string | null,
  lang: AppLanguage,
): string {
  if (!firstName) return 'CronoSheet';
  if (lang === 'en') return `${firstName}’s CronoSheet`;
  if (lang === 'es') return `CronoSheet de ${firstName}`;
  return `CronoSheet di ${firstName}`;
}
