export const DISPLAY_NAME_LIMITS = {
  min: 2,
  max: 50,
} as const;

const GENERIC_PLACEHOLDER_NAMES = new Set(['utente', 'workspace demo', 'demo', 'guest', 'user']);

export function normalizeDisplayName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/\s+/g, ' ').trim();
}

export function isGenericOrEmailDerivedName(
  displayName: string | null | undefined,
  email?: string | null,
): boolean {
  const clean = normalizeDisplayName(displayName);
  if (clean.length < DISPLAY_NAME_LIMITS.min) return true;

  const lower = clean.toLowerCase();
  if (GENERIC_PLACEHOLDER_NAMES.has(lower)) return true;

  if (email) {
    const emailLower = email.trim().toLowerCase();
    const localPart = emailLower.split('@')[0] ?? '';
    if (lower === emailLower || (localPart.length > 0 && lower === localPart)) {
      return true;
    }
  }

  return false;
}

export function needsNameOnboarding(
  displayName: string | null | undefined,
  email: string | null | undefined,
  mode: 'firebase' | 'demo',
): boolean {
  if (mode === 'demo') return false;
  return isGenericOrEmailDerivedName(displayName, email);
}

export function suggestOnboardingName(
  displayName: string | null | undefined,
  email?: string | null,
): string {
  if (isGenericOrEmailDerivedName(displayName, email)) {
    return '';
  }
  const clean = normalizeDisplayName(displayName);
  const firstToken = clean.split(' ')[0] ?? '';
  return firstToken.slice(0, DISPLAY_NAME_LIMITS.max);
}

export function validateDisplayName(raw: string): {
  readonly valid: boolean;
  readonly sanitized: string;
  readonly error: string | null;
} {
  const sanitized = normalizeDisplayName(raw);
  if (sanitized.length < DISPLAY_NAME_LIMITS.min) {
    return {
      valid: false,
      sanitized,
      error: `Inserisci almeno ${DISPLAY_NAME_LIMITS.min} caratteri per il tuo nome.`,
    };
  }
  if (sanitized.length > DISPLAY_NAME_LIMITS.max) {
    return {
      valid: false,
      sanitized: sanitized.slice(0, DISPLAY_NAME_LIMITS.max),
      error: `Il nome non può superare ${DISPLAY_NAME_LIMITS.max} caratteri.`,
    };
  }
  return { valid: true, sanitized, error: null };
}

/**
 * Formats the main Showcase heading with personality:
 * "CronoSheet di <Nome>" when a real personal name is available,
 * falling back cleanly to "CronoSheet" otherwise.
 */
export function formatShowcaseBrandTitle(
  displayName: string | null | undefined,
  email?: string | null,
): string {
  if (isGenericOrEmailDerivedName(displayName, email)) {
    return 'CronoSheet';
  }
  const clean = normalizeDisplayName(displayName);
  return `CronoSheet di ${clean}`;
}
