/**
 * Pure RFC 6238 TOTP (Time-based One-Time Password) & SHA-256 Backup Code module.
 * Uses the standard Web Crypto API (SubtleCrypto), running identically in browsers and Node.js 20+.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/[\s=-]+/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const ch of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: "${ch}"`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(out);
}

/**
 * Generates a cryptographically strong 160-bit (20-byte) Base32 TOTP secret.
 */
export function generateTotpSecret(byteLength = 20): string {
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  return encodeBase32(bytes);
}

/**
 * Generates an RFC 6238 6-digit TOTP code for a given secret and unix timestamp (ms).
 */
export async function generateTotpCode(
  base32Secret: string,
  timestampMs: number = Date.now(),
  periodSeconds = 30,
  digits = 6,
): Promise<string> {
  const keyBytes = decodeBase32(base32Secret);
  const counter = Math.floor(timestampMs / 1000 / periodSeconds);

  const counterBuf = new ArrayBuffer(8);
  const view = new DataView(counterBuf);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);

  const rawKey = new Uint8Array(keyBytes).buffer;
  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  const signature = await globalThis.crypto.subtle.sign('HMAC', cryptoKey, counterBuf);
  const hmac = new Uint8Array(signature);

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 10 ** digits;
  return String(otp).padStart(digits, '0');
}

/**
 * Verifies a 6-digit TOTP token allowing a ±windowSteps clock drift (default ±1 = ±30s).
 */
export async function verifyTotpCode(
  base32Secret: string,
  candidateCode: string,
  timestampMs: number = Date.now(),
  windowSteps = 1,
  periodSeconds = 30,
): Promise<boolean> {
  const normalized = candidateCode.replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }

  for (let step = -windowSteps; step <= windowSteps; step++) {
    const checkMs = timestampMs + step * periodSeconds * 1000;
    const expected = await generateTotpCode(base32Secret, checkMs, periodSeconds, 6);
    if (constantTimeEqual(expected, normalized)) {
      return true;
    }
  }
  return false;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Builds an otpauth:// URI compatible with Google Authenticator, Authy, 1Password, etc.
 */
export function buildOtpAuthUri(accountLabel: string, secret: string, issuer = 'CronoSheet'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountLabel);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generates human-readable 8-character single-use recovery backup codes (e.g., XXXX-XXXX).
 */
export function generateBackupCodes(count = 8): string[] {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = new Uint8Array(8);
    globalThis.crypto.getRandomValues(buf);
    const raw = Array.from(buf, (b) => chars[b % chars.length]).join('');
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`);
  }
  return codes;
}

/**
 * Hashes a backup code with SHA-256 (hex) before storing in Firestore so plaintext codes are never persisted.
 */
export async function hashBackupCode(code: string): Promise<string> {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const data = new TextEncoder().encode(normalized);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getTotpSecondsRemaining(timestampMs: number = Date.now(), periodSeconds = 30): number {
  const elapsedInWindow = Math.floor(timestampMs / 1000) % periodSeconds;
  return periodSeconds - elapsedInWindow;
}
