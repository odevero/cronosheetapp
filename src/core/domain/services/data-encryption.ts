/**
 * Industry-standard AES-256-GCM application-level encryption for CronoSheet user data.
 * Uses Web Crypto API (native browser & Node 20+ crypto.subtle) with a random 96-bit IV per write.
 * Ciphertext envelope format: "enc:v1:<base64url-iv>:<base64url-ciphertext-with-tag>"
 */

export const ENCRYPTION_PREFIX = 'enc:v1:';
export const ENCRYPTION_ALGORITHM = 'AES-256-GCM';
export const MAX_ENCRYPTION_SWITCHES_PER_MONTH = 2;

export interface EncryptionQuotaStatus {
  readonly month: string; // YYYY-MM
  readonly used: number;
  readonly limit: number;
  readonly remaining: number;
  readonly canSwitch: boolean;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API (crypto.subtle) non disponibile in questo contesto.');
  }
  return subtle;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const b64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

export function isEncryptedEnvelope(value: string): boolean {
  if (!value.startsWith(ENCRYPTION_PREFIX)) return false;
  const rest = value.slice(ENCRYPTION_PREFIX.length);
  const parts = rest.split(':');
  return parts.length === 2 && parts[0].length >= 12 && parts[1].length >= 16;
}

export function generateAes256KeyMaterial(): string {
  const raw = new Uint8Array(32);
  globalThis.crypto.getRandomValues(raw);
  return bytesToBase64Url(raw);
}

export async function importAes256Key(keyMaterial: string): Promise<CryptoKey> {
  const rawBytes = base64UrlToBytes(keyMaterial.trim());
  if (rawBytes.byteLength !== 32) {
    throw new Error('Chiave di crittografia AES-256 non valida.');
  }
  return getSubtleCrypto().importKey(
    'raw',
    rawBytes as BufferSource,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptTextField(
  plaintext: string,
  key: CryptoKey | null,
): Promise<string> {
  if (!key) return plaintext;
  if (plaintext === '') return '';
  if (isEncryptedEnvelope(plaintext)) return plaintext;

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuffer = await getSubtleCrypto().encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );
  const cipherBytes = new Uint8Array(cipherBuffer);
  return `${ENCRYPTION_PREFIX}${bytesToBase64Url(iv)}:${bytesToBase64Url(cipherBytes)}`;
}

export async function decryptTextField(
  storedValue: string,
  key: CryptoKey | null,
): Promise<string> {
  if (!storedValue) return '';
  if (!isEncryptedEnvelope(storedValue)) return storedValue;
  if (!key) return storedValue;

  const rest = storedValue.slice(ENCRYPTION_PREFIX.length);
  const [ivB64, cipherB64] = rest.split(':');
  try {
    const iv = base64UrlToBytes(ivB64);
    const cipherBytes = base64UrlToBytes(cipherB64);
    const plainBuffer = await getSubtleCrypto().decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource,
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    return storedValue;
  }
}

export function getCurrentYearMonth(now: Date = new Date()): string {
  const y = String(now.getUTCFullYear()).padStart(4, '0');
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getEncryptionSwitchQuota(
  config: { readonly switchesMonth: string; readonly switchesThisMonth: number } | null | undefined,
  currentYearMonth: string = getCurrentYearMonth(),
): EncryptionQuotaStatus {
  const sameMonth = config?.switchesMonth === currentYearMonth;
  const used = sameMonth ? Math.max(0, Math.trunc(config?.switchesThisMonth ?? 0)) : 0;
  const remaining = Math.max(0, MAX_ENCRYPTION_SWITCHES_PER_MONTH - used);
  return {
    month: currentYearMonth,
    used,
    limit: MAX_ENCRYPTION_SWITCHES_PER_MONTH,
    remaining,
    canSwitch: remaining > 0,
  };
}
