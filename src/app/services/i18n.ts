import { Injectable, signal } from '@angular/core';
import {
  AppLanguage,
  detectPreferredLanguage,
  formatLocalizedDateTime,
  formatLocalizedShowcaseBrand,
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  translate,
  TranslationKey,
  TranslationParams,
} from '../../core/i18n';

const LANG_STORAGE_KEY = 'cronosheet_lang_v1';

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly languages = SUPPORTED_LANGUAGES;
  readonly labels = LANGUAGE_LABELS;
  readonly lang = signal<AppLanguage>(this.detectInitialLanguage());

  constructor() {
    this.syncDocumentLang(this.lang());
  }

  setLanguage(next: AppLanguage): void {
    this.lang.set(next);
    this.syncDocumentLang(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LANG_STORAGE_KEY, next);
      } catch {
        // Ignore private browsing / quota failures
      }
    }
  }

  t(key: TranslationKey, params?: TranslationParams): string {
    return translate(this.lang(), key, params);
  }

  formatDateTime(isoDate: string, hours: number, minutes: number): string {
    return formatLocalizedDateTime(isoDate, hours, minutes, this.lang());
  }

  formatShowcaseBrand(firstName: string | null): string {
    return formatLocalizedShowcaseBrand(firstName, this.lang());
  }

  private detectInitialLanguage(): AppLanguage {
    if (typeof window === 'undefined') {
      return 'it';
    }
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      stored = null;
    }

    const browserLangs =
      window.navigator.languages && window.navigator.languages.length > 0
        ? window.navigator.languages
        : window.navigator.language
          ? [window.navigator.language]
          : [];

    return detectPreferredLanguage(browserLangs, stored, 'it');
  }

  private syncDocumentLang(lang: AppLanguage): void {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = lang;
    }
  }
}
