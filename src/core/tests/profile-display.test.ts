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
  assert.equal(formatShowcaseBrandTitle('Orso', 'orso.demo@example.com'), 'CronoSheet di Orso');
  assert.equal(
    formatShowcaseBrandTitle('  Marco Rossi  ', 'marco@example.com'),
    'CronoSheet di Marco Rossi',
  );
  assert.equal(formatShowcaseBrandTitle('Utente', 'user@example.com'), 'CronoSheet');
  assert.equal(formatShowcaseBrandTitle('Workspace Demo', 'demo@cronosheet.local'), 'CronoSheet');
  assert.equal(
    formatShowcaseBrandTitle('user.alias+cronosheetapp3', 'user.alias+cronosheetapp3@example.com'),
    'CronoSheet',
  );
  assert.equal(formatShowcaseBrandTitle('', 'user@example.com'), 'CronoSheet');
});

test('needsNameOnboarding detects missing or email-derived names in Firebase mode only', () => {
  assert.equal(
    needsNameOnboarding('user.alias+cronosheetapp3', 'user.alias+cronosheetapp3@example.com', 'firebase'),
    true,
  );
  assert.equal(needsNameOnboarding('Utente', 'test@example.com', 'firebase'), true);
  assert.equal(needsNameOnboarding('', 'test@example.com', 'firebase'), true);
  assert.equal(needsNameOnboarding('Orso', 'orso.demo@example.com', 'firebase'), false);
  assert.equal(needsNameOnboarding('Workspace Demo', 'demo@cronosheet.local', 'demo'), false);
});

test('isGenericOrEmailDerivedName and suggestOnboardingName handle full names vs aliases', () => {
  assert.equal(isGenericOrEmailDerivedName('Mario Rossi', 'mario.rossi@example.com'), false);
  assert.equal(suggestOnboardingName('Mario Rossi', 'mario.rossi@example.com'), 'Mario');
  assert.equal(
    suggestOnboardingName('user.alias+test', 'user.alias+test@example.com'),
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
