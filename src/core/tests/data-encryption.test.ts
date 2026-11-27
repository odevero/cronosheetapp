import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptTextField,
  encryptTextField,
  ENCRYPTION_ALGORITHM,
  generateAes256KeyMaterial,
  importAes256Key,
  isEncryptedEnvelope,
} from '../domain/services/data-encryption';

describe('data-encryption (always-on AES-256-GCM standard)', () => {
  it('generates 256-bit key material and round-trips UTF-8 & emoji text with unique random IVs', async () => {
    assert.equal(ENCRYPTION_ALGORITHM, 'AES-256-GCM');
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

  it('rejects malformed or short AES-256 key material', async () => {
    await assert.rejects(() => importAes256Key('AAAA'), /non valida/i);
    await assert.rejects(() => importAes256Key('too-short'));
  });
});
