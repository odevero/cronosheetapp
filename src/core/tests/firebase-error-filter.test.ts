import assert from 'node:assert/strict';
import test from 'node:test';
import { isFirebasePopupAssertionRace } from '../domain/services/firebase-error-filter';

test('isFirebasePopupAssertionRace matches exact Firebase _PopupOperation assertion error', () => {
  const err = new Error('INTERNAL ASSERTION FAILED: Pending promise was never set');
  assert.equal(isFirebasePopupAssertionRace(err), true);
  assert.equal(
    isFirebasePopupAssertionRace(
      '@firebase/auth: Auth (13.4.0): INTERNAL ASSERTION FAILED: Pending promise was never set',
    ),
    true,
  );
  assert.equal(
    isFirebasePopupAssertionRace({
      rejection: new Error('INTERNAL ASSERTION FAILED: Pending promise was never set'),
    }),
    true,
  );
});

test('isFirebasePopupAssertionRace does not swallow unrelated errors', () => {
  assert.equal(isFirebasePopupAssertionRace(new Error('Missing or insufficient permissions.')), false);
  assert.equal(isFirebasePopupAssertionRace(new Error('INTERNAL ASSERTION FAILED: Other bug')), false);
  assert.equal(isFirebasePopupAssertionRace(new Error('auth/popup-closed-by-user')), false);
  assert.equal(isFirebasePopupAssertionRace(null), false);
  assert.equal(isFirebasePopupAssertionRace(undefined), false);
  assert.equal(isFirebasePopupAssertionRace({}), false);
});
