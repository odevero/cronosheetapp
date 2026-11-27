import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptTextField,
  encryptTextField,
  ENCRYPTION_ALGORITHM,
  generateAes256KeyMaterial,
  getCurrentYearMonth,
  getEncryptionSwitchQuota,
  importAes256Key,
  isEncryptedEnvelope,
  MAX_ENCRYPTION_SWITCHES_PER_MONTH,
} from '../domain/services/data-encryption';
import { UserEncryptionSecurity } from '../domain/entities/models';

describe('data-encryption (AES-256-GCM standard)', () => {
  it('generates 256-bit key material and round-trips UTF-8 & emoji text with unique random IVs', async () => {
    const keyMaterial = generateAes256KeyMaterial();
    assert.ok(keyMaterial.length >= 42 && keyMaterial.length <= 48);

    const key = await importAes256Key(keyMaterial);
    const original = 'correre 5km ogni mattina 🏃‍♂️ — caffè & libertà';

    const c1 = await encryptTextField(original, key);
    const c2 = await encryptTextField(original, key);

    assert.ok(isEncryptedEnvelope(c1));
    assert.ok(isEncryptedEnvelope(c2));
    assert.notEqual(c1, original);
    assert.notEqual(c1, c2, 'Each encryption must use a fresh 96-bit IV');

    const d1 = await decryptTextField(c1, key);
    const d2 = await decryptTextField(c2, key);
    assert.equal(d1, original);
    assert.equal(d2, original);
  });

  it('passes through empty strings and legacy unencrypted plaintext without error', async () => {
    const key = await importAes256Key(generateAes256KeyMaterial());

    assert.equal(await encryptTextField('', key), '');
    assert.equal(await encryptTextField('plain text', null), 'plain text');
    assert.equal(await decryptTextField('', key), '');
    assert.equal(await decryptTextField('legacy plaintext', key), 'legacy plaintext');
    assert.equal(await decryptTextField('legacy plaintext', null), 'legacy plaintext');
  });

  it('does not double-encrypt an already-encrypted envelope', async () => {
    const key = await importAes256Key(generateAes256KeyMaterial());
    const once = await encryptTextField('learn Spanish', key);
    const twice = await encryptTextField(once, key);
    assert.equal(twice, once);
    assert.equal(await decryptTextField(twice, key), 'learn Spanish');
  });

  it('enforces max 2 encryption mode switches per calendar month and resets on new month', () => {
    assert.equal(MAX_ENCRYPTION_SWITCHES_PER_MONTH, 2);
    assert.match(getCurrentYearMonth(new Date('2026-11-26T12:00:00Z')), /^2026-11$/);

    // No config yet -> 0/2 used
    const fresh = getEncryptionSwitchQuota(null, '2026-11');
    assert.deepEqual(fresh, {
      used: 0,
      remaining: 2,
      limit: 2,
      month: '2026-11',
      canSwitch: true,
    });

    const oneSwitch: UserEncryptionSecurity = {
      ownerId: 'u1',
      enabled: true,
      algorithm: ENCRYPTION_ALGORITHM,
      keyMaterial: 'abc',
      switchesMonth: '2026-11',
      switchesThisMonth: 1,
      enabledAtIso: '2026-11-01T00:00:00Z',
    };
    const afterOne = getEncryptionSwitchQuota(oneSwitch, '2026-11');
    assert.equal(afterOne.used, 1);
    assert.equal(afterOne.remaining, 1);
    assert.equal(afterOne.canSwitch, true);

    const twoSwitches: UserEncryptionSecurity = { ...oneSwitch, switchesThisMonth: 2 };
    const afterTwo = getEncryptionSwitchQuota(twoSwitches, '2026-11');
    assert.equal(afterTwo.used, 2);
    assert.equal(afterTwo.remaining, 0);
    assert.equal(afterTwo.canSwitch, false);

    // Next month resets quota cleanly to 0/2
    const nextMonth = getEncryptionSwitchQuota(twoSwitches, '2026-12');
    assert.equal(nextMonth.used, 0);
    assert.equal(nextMonth.remaining, 2);
    assert.equal(nextMonth.canSwitch, true);
  });
});
