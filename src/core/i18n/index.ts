import { EN_MESSAGES } from './en';
import { ES_MESSAGES } from './es';
import { IT_MESSAGES, TranslationDictionary, TranslationKey } from './it';
import { AppLanguage, interpolateTemplate, TranslationParams } from './types';

export * from './types';
export type { TranslationDictionary, TranslationKey } from './it';

export const TRANSLATIONS: Record<AppLanguage, TranslationDictionary> = {
  it: IT_MESSAGES,
  en: EN_MESSAGES,
  es: ES_MESSAGES,
};

export function translate(
  lang: AppLanguage,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS.it;
  const template = dict[key] ?? TRANSLATIONS.it[key] ?? key;
  return interpolateTemplate(template, params);
}
