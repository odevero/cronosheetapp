import { UserMfaSecurity } from '../domain/entities/models';
import {
  buildOtpAuthUri,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  verifyTotpCode,
} from '../domain/services/totp';

export interface MfaEnrollmentDraft {
  readonly secret: string;
  readonly otpAuthUri: string;
  readonly backupCodes: readonly string[];
}

export interface MfaVerificationResult {
  readonly ok: boolean;
  readonly method: 'totp' | 'backup_code' | null;
  readonly remainingBackupCodeHashes?: readonly string[];
}

export function createMfaEnrollmentDraft(accountLabel: string): MfaEnrollmentDraft {
  const secret = generateTotpSecret(20);
  const otpAuthUri = buildOtpAuthUri(accountLabel, secret, 'CronoSheet');
  const backupCodes = generateBackupCodes(8);
  return { secret, otpAuthUri, backupCodes };
}

export async function finalizeMfaEnrollment(
  ownerId: string,
  draft: MfaEnrollmentDraft,
  verificationCode: string,
  nowMs: number = Date.now(),
): Promise<{ ok: boolean; config?: UserMfaSecurity }> {
  const valid = await verifyTotpCode(draft.secret, verificationCode, nowMs, 1);
  if (!valid) {
    return { ok: false };
  }

  const backupCodeHashes = await Promise.all(draft.backupCodes.map((c) => hashBackupCode(c)));
  return {
    ok: true,
    config: {
      ownerId,
      totpEnabled: true,
      totpSecret: draft.secret,
      backupCodeHashes,
      enrolledAtIso: new Date(nowMs).toISOString(),
    },
  };
}

export async function verifyMfaChallenge(
  config: UserMfaSecurity,
  inputCode: string,
  nowMs: number = Date.now(),
): Promise<MfaVerificationResult> {
  const trimmed = inputCode.trim();
  if (!trimmed || !config.totpEnabled || !config.totpSecret) {
    return { ok: false, method: null };
  }

  // First try 6-digit TOTP
  if (/^\d{6}$/.test(trimmed.replace(/\s+/g, ''))) {
    const validTotp = await verifyTotpCode(config.totpSecret, trimmed, nowMs, 1);
    if (validTotp) {
      return { ok: true, method: 'totp' };
    }
  }

  // Fallback: single-use recovery backup code
  const candidateHash = await hashBackupCode(trimmed);
  const idx = config.backupCodeHashes.indexOf(candidateHash);
  if (idx !== -1) {
    const remaining = config.backupCodeHashes.filter((_, i) => i !== idx);
    return {
      ok: true,
      method: 'backup_code',
      remainingBackupCodeHashes: remaining,
    };
  }

  return { ok: false, method: null };
}
