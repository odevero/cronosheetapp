import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOtpAuthUri,
  decodeBase32,
  encodeBase32,
  generateTotpCode,
  verifyTotpCode,
} from '../domain/services/totp';
import {
  createMfaEnrollmentDraft,
  finalizeMfaEnrollment,
  verifyMfaChallenge,
} from '../usecases/mfa-usecases';

test('Base32 encode/decode round-trip matches RFC 4648', () => {
  const raw = new TextEncoder().encode('12345678901234567890');
  const encoded = encodeBase32(raw);
  assert.equal(encoded, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  assert.deepEqual(decodeBase32(encoded), raw);
});

test('RFC 6238 SHA-1 TOTP test vector (t = 59s -> 287082)', async () => {
  // Official RFC 6238 Appendix B test secret "12345678901234567890"
  const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const code = await generateTotpCode(rfcSecret, 59_000, 30, 6);
  assert.equal(code, '287082');
});

test('TOTP verification accepts current & ±1 window step and rejects invalid codes', async () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const nowMs = 1_700_000_000_000;
  const current = await generateTotpCode(secret, nowMs);
  const prevStep = await generateTotpCode(secret, nowMs - 30_000);
  const farStep = await generateTotpCode(secret, nowMs - 120_000);

  assert.equal(await verifyTotpCode(secret, current, nowMs), true);
  assert.equal(await verifyTotpCode(secret, prevStep, nowMs), true);
  assert.equal(await verifyTotpCode(secret, farStep, nowMs), false);
  assert.equal(await verifyTotpCode(secret, '000000', nowMs), false);
  assert.equal(await verifyTotpCode(secret, 'abc123', nowMs), false);
});

test('MFA enrollment and backup code consumption flow works end-to-end', async () => {
  const nowMs = 1_750_000_000_000;
  const draft = createMfaEnrollmentDraft('utente@example.com');
  assert.equal(draft.backupCodes.length, 8);
  assert.match(draft.otpAuthUri, /^otpauth:\/\/totp\/CronoSheet:/);

  const validCode = await generateTotpCode(draft.secret, nowMs);
  const enrolled = await finalizeMfaEnrollment('user-1', draft, validCode, nowMs);
  assert.equal(enrolled.ok, true);
  assert.ok(enrolled.config);
  assert.equal(enrolled.config.backupCodeHashes.length, 8);

  // Verify TOTP challenge
  const totpChallenge = await verifyMfaChallenge(enrolled.config, validCode, nowMs);
  assert.equal(totpChallenge.ok, true);
  assert.equal(totpChallenge.method, 'totp');

  // Verify single-use backup code challenge
  const backupChallenge = await verifyMfaChallenge(enrolled.config, draft.backupCodes[0], nowMs);
  assert.equal(backupChallenge.ok, true);
  assert.equal(backupChallenge.method, 'backup_code');
  assert.equal(backupChallenge.remainingBackupCodeHashes?.length, 7);

  // Consumed backup code cannot be reused
  const updatedConfig = {
    ...enrolled.config,
    backupCodeHashes: backupChallenge.remainingBackupCodeHashes ?? [],
  };
  const replay = await verifyMfaChallenge(updatedConfig, draft.backupCodes[0], nowMs);
  assert.equal(replay.ok, false);
  assert.equal(buildOtpAuthUri('a@b.it', 'JBSWY3DPEHPK3PXP').includes('issuer=CronoSheet'), true);
});
