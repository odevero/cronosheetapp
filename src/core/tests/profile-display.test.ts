import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatShowcaseBrandTitle,
  isGenericOrEmailDerivedName,
  needsNameOnboarding,
  suggestOnboardingName,
  validateDisplayName,
} from '../domain/services/profile-display';

test('formatShowcaseBrandTitle personalizes heading for real names and falls back cleanly', () => {
  assert.equal(formatShowcaseBrandTitle('Orso', 'orsodxwxro@gmail.com'), 'CronoSheet di Orso');
  assert.equal(
    formatShowcaseBrandTitle('  Marco Rossi  ', 'marco@example.com'),
    'CronoSheet di Marco Rossi',
  );
  assert.equal(formatShowcaseBrandTitle('Utente', 'user@example.com'), 'CronoSheet');
  assert.equal(formatShowcaseBrandTitle('Workspace Demo', 'demo@cronosheet.local'), 'CronoSheet');
  assert.equal(
    formatShowcaseBrandTitle('orso.dxwxro+cronosheetapp3', 'orso.dxwxro+cronosheetapp3@gmail.com'),
    'CronoSheet',
  );
  assert.equal(formatShowcaseBrandTitle('', 'user@example.com'), 'CronoSheet');
});

test('needsNameOnboarding detects missing or email-derived names in Firebase mode only', () => {
  assert.equal(
    needsNameOnboarding('orso.dxwxro+cronosheetapp3', 'orso.dxwxro+cronosheetapp3@gmail.com', 'firebase'),
    true,
  );
  assert.equal(needsNameOnboarding('Utente', 'test@example.com', 'firebase'), true);
  assert.equal(needsNameOnboarding('', 'test@example.com', 'firebase'), true);
  assert.equal(needsNameOnboarding('Orso', 'orsodxwxro@gmail.com', 'firebase'), false);
  assert.equal(needsNameOnboarding('Workspace Demo', 'demo@cronosheet.local', 'demo'), false);
});

test('isGenericOrEmailDerivedName and suggestOnboardingName handle full names vs aliases', () => {
  assert.equal(isGenericOrEmailDerivedName('Orso De Vero', 'orsodxwxro@gmail.com'), false);
  assert.equal(suggestOnboardingName('Orso De Vero', 'orsodxwxro@gmail.com'), 'Orso');
  assert.equal(
    suggestOnboardingName('orso.dxwxro+test', 'orso.dxwxro+test@gmail.com'),
    '',
  );
});

test('validateDisplayName enforces length bounds and normalizes whitespace', () => {
  assert.deepEqual(validateDisplayName('  Orso  '), {
    valid: true,
    sanitized: 'Orso',
    error: null,
  });
  assert.equal(validateDisplayName('A').valid, false);
  assert.equal(validateDisplayName('   ').valid, false);
  assert.equal(validateDisplayName('A'.repeat(51)).valid, false);
});
