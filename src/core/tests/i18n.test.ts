import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectPreferredLanguage,
  formatLocalizedDateTime,
  formatLocalizedShowcaseBrand,
  TRANSLATIONS,
  translate,
  TranslationKey,
} from '../i18n';

test('all language dictionaries share exact key parity with non-empty values', () => {
  const itKeys = Object.keys(TRANSLATIONS.it).sort();
  const enKeys = Object.keys(TRANSLATIONS.en).sort();
  const esKeys = Object.keys(TRANSLATIONS.es).sort();

  assert.deepEqual(enKeys, itKeys);
  assert.deepEqual(esKeys, itKeys);

  for (const lang of ['it', 'en', 'es'] as const) {
    for (const key of itKeys as TranslationKey[]) {
      assert.ok(TRANSLATIONS[lang][key].trim().length > 0, `Missing value for ${lang}.${key}`);
    }
  }
});

test('detectPreferredLanguage prioritizes stored preference over browser languages', () => {
  assert.equal(detectPreferredLanguage(['en-US', 'it-IT'], 'es'), 'es');
  assert.equal(detectPreferredLanguage(['es-MX', 'en-US'], null), 'es');
  assert.equal(detectPreferredLanguage(['en-GB'], undefined), 'en');
  assert.equal(detectPreferredLanguage(['fr-FR', 'de-DE'], null), 'it');
  assert.equal(detectPreferredLanguage([], null), 'it');
});

test('translate interpolates placeholders cleanly across IT, EN, ES', () => {
  assert.equal(translate('it', 'common.inDays', { days: 5 }), 'Tra 5 gg');
  assert.equal(translate('en', 'common.inDays', { days: 5 }), 'In 5d');
  assert.equal(translate('es', 'common.inDays', { days: 5 }), 'En 5 d');
});

test('formatLocalizedDateTime formats dates in Italian, English, and Spanish', () => {
  assert.equal(
    formatLocalizedDateTime('2026-11-26', 16, 29, 'it'),
    'Giovedì, 26 novembre 2026, 16:29',
  );
  assert.equal(
    formatLocalizedDateTime('2026-11-26', 16, 29, 'en'),
    'Thursday, November 26, 2026, 16:29',
  );
  assert.equal(
    formatLocalizedDateTime('2026-11-26', 16, 29, 'es'),
    'Jueves, 26 de noviembre de 2026, 16:29',
  );
});

test('formatLocalizedShowcaseBrand personalizes heading per language', () => {
  assert.equal(formatLocalizedShowcaseBrand('Orso', 'it'), 'CronoSheet di Orso');
  assert.equal(formatLocalizedShowcaseBrand('Orso', 'en'), 'Orso’s CronoSheet');
  assert.equal(formatLocalizedShowcaseBrand('Orso', 'es'), 'CronoSheet de Orso');
  assert.equal(formatLocalizedShowcaseBrand(null, 'en'), 'CronoSheet');
});
