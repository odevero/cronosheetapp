export type FeedbackCategory = 'bug' | 'feature' | 'improvement' | 'question';

export type FeedbackSurface = 'landing' | 'showcase' | 'backend' | 'auth';

export interface FeedbackSubmissionInput {
  readonly category: FeedbackCategory;
  readonly title: string;
  readonly description: string;
  readonly contact: string;
  readonly surface: FeedbackSurface;
  readonly website: string; // Honeypot field — must stay empty
}

export interface FeedbackValidationResult {
  readonly valid: boolean;
  readonly isBotHoneypot: boolean;
  readonly errors: readonly string[];
  readonly sanitized: FeedbackSubmissionInput | null;
}

export interface FormattedGitHubIssue {
  readonly title: string;
  readonly body: string;
  readonly labels: readonly string[];
}

export interface GitHubRepoSlug {
  readonly owner: string;
  readonly repo: string;
}

export const FEEDBACK_CATEGORIES: readonly {
  readonly id: FeedbackCategory;
  readonly label: string;
  readonly prefix: string;
  readonly githubLabel: string;
}[] = [
  { id: 'bug', label: 'Segnalazione bug', prefix: '[Bug]', githubLabel: 'bug' },
  { id: 'feature', label: 'Nuova idea', prefix: '[Idea]', githubLabel: 'enhancement' },
  { id: 'improvement', label: 'Miglioramento UX', prefix: '[UX]', githubLabel: 'improvement' },
  { id: 'question', label: 'Domanda / Supporto', prefix: '[Domanda]', githubLabel: 'question' },
];

const VALID_CATEGORIES = new Set<string>(FEEDBACK_CATEGORIES.map((c) => c.id));
const VALID_SURFACES = new Set<string>(['landing', 'showcase', 'backend', 'auth']);

export const FEEDBACK_LIMITS = {
  titleMin: 5,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 3000,
  contactMax: 120,
} as const;

/**
 * Removes ASCII control characters while preserving tabs and newlines when allowed.
 */
export function stripControlChars(value: string, allowNewlines: boolean): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (allowNewlines && (code === 9 || code === 10)) {
      out += value[i];
      continue;
    }
    if (allowNewlines && code === 13) {
      continue; // normalize CRLF to LF
    }
    if (code >= 32 && code !== 127) {
      out += value[i];
    }
  }
  return out;
}

/**
 * Neutralizes accidental GitHub @mentions (e.g. `@user` -> `` `@user` ``)
 * so public feedback cannot ping arbitrary GitHub accounts or teams.
 */
export function neutralizeGitHubMentions(text: string): string {
  return text.replace(/(^|[\s(])@([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})(?:\/[a-zA-Z0-9_-]+)?)/g, '$1`@$2`');
}

export function validateFeedbackInput(raw: unknown): FeedbackValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      valid: false,
      isBotHoneypot: false,
      errors: ['Richiesta non valida.'],
      sanitized: null,
    };
  }

  const record = raw as Record<string, unknown>;
  const rawWebsite = typeof record['website'] === 'string' ? record['website'].trim() : '';
  if (rawWebsite.length > 0) {
    return {
      valid: false,
      isBotHoneypot: true,
      errors: ['Invio bloccato dal controllo anti-spam.'],
      sanitized: null,
    };
  }

  const rawCategory = typeof record['category'] === 'string' ? record['category'].trim() : '';
  const rawTitle = typeof record['title'] === 'string' ? record['title'] : '';
  const rawDescription = typeof record['description'] === 'string' ? record['description'] : '';
  const rawContact = typeof record['contact'] === 'string' ? record['contact'] : '';
  const rawSurface = typeof record['surface'] === 'string' ? record['surface'].trim() : 'landing';

  const title = stripControlChars(rawTitle, false).trim();
  const description = stripControlChars(rawDescription, true).trim();
  const contact = stripControlChars(rawContact, false).trim();
  const surface: FeedbackSurface = VALID_SURFACES.has(rawSurface)
    ? (rawSurface as FeedbackSurface)
    : 'landing';

  const errors: string[] = [];

  if (!VALID_CATEGORIES.has(rawCategory)) {
    errors.push('Seleziona una categoria valida.');
  }

  if (title.length < FEEDBACK_LIMITS.titleMin) {
    errors.push(`Il titolo deve contenere almeno ${FEEDBACK_LIMITS.titleMin} caratteri.`);
  } else if (title.length > FEEDBACK_LIMITS.titleMax) {
    errors.push(`Il titolo non può superare ${FEEDBACK_LIMITS.titleMax} caratteri.`);
  }

  if (description.length < FEEDBACK_LIMITS.descriptionMin) {
    errors.push(`La descrizione deve contenere almeno ${FEEDBACK_LIMITS.descriptionMin} caratteri.`);
  } else if (description.length > FEEDBACK_LIMITS.descriptionMax) {
    errors.push(`La descrizione non può superare ${FEEDBACK_LIMITS.descriptionMax} caratteri.`);
  }

  if (contact.length > FEEDBACK_LIMITS.contactMax) {
    errors.push(`Il contatto non può superare ${FEEDBACK_LIMITS.contactMax} caratteri.`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      isBotHoneypot: false,
      errors,
      sanitized: null,
    };
  }

  return {
    valid: true,
    isBotHoneypot: false,
    errors: [],
    sanitized: {
      category: rawCategory as FeedbackCategory,
      title,
      description,
      contact,
      surface,
      website: '',
    },
  };
}

export function formatFeedbackAsGitHubIssue(
  input: FeedbackSubmissionInput,
  meta: { readonly submittedAtIso: string; readonly appVersion?: string },
): FormattedGitHubIssue {
  const categoryMeta =
    FEEDBACK_CATEGORIES.find((c) => c.id === input.category) ?? FEEDBACK_CATEGORIES[1];

  const issueTitle = `${categoryMeta.prefix} ${input.title}`;
  const safeDescription = neutralizeGitHubMentions(input.description);
  const safeContact = input.contact ? neutralizeGitHubMentions(input.contact) : 'Anonimo';

  const lines: string[] = [
    '### Descrizione',
    '',
    safeDescription,
    '',
    '---',
    '',
    '### Dettagli invio',
    `- **Categoria:** ${categoryMeta.label}`,
    `- **Sezione app:** \`${input.surface}\``,
    `- **Contatto opzionale:** ${safeContact}`,
    `- **Versione:** ${meta.appVersion ?? 'CronoSheet v1'}`,
    `- **Data (UTC):** ${meta.submittedAtIso}`,
  ];

  return {
    title: issueTitle,
    body: lines.join('\n'),
    labels: ['feedback', categoryMeta.githubLabel],
  };
}

/**
 * Strictly validates an `owner/repo` slug from environment configuration
 * to prevent SSRF or URL path manipulation.
 */
export function parseGitHubRepoSlug(raw: string | undefined): GitHubRepoSlug | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const match = /^([a-zA-Z0-9][a-zA-Z0-9-]{0,38})\/([a-zA-Z0-9._-]{1,100})$/.exec(trimmed);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2];
  if (repo === '.' || repo === '..' || repo.includes('..')) {
    return null;
  }
  return { owner, repo };
}

export interface RateLimitCheckResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface SlidingWindowRateLimiter {
  check(key: string): RateLimitCheckResult;
  reset(): void;
}

export function createSlidingWindowRateLimiter(options: {
  readonly maxRequests: number;
  readonly windowMs: number;
  readonly maxKeys?: number;
  readonly now?: () => number;
}): SlidingWindowRateLimiter {
  const maxKeys = options.maxKeys ?? 1000;
  const now = options.now ?? (() => Date.now());
  const buckets = new Map<string, number[]>();

  return {
    check(key: string): RateLimitCheckResult {
      const currentTime = now();
      const cutoff = currentTime - options.windowMs;

      // Bound memory growth under high-cardinality IP traffic
      if (!buckets.has(key) && buckets.size >= maxKeys) {
        for (const [existingKey, timestamps] of buckets) {
          const fresh = timestamps.filter((t) => t > cutoff);
          if (fresh.length === 0) {
            buckets.delete(existingKey);
          } else {
            buckets.set(existingKey, fresh);
          }
        }
        if (buckets.size >= maxKeys) {
          const oldestKey = buckets.keys().next().value;
          if (oldestKey !== undefined) {
            buckets.delete(oldestKey);
          }
        }
      }

      const prev = buckets.get(key) ?? [];
      const active = prev.filter((t) => t > cutoff);

      if (active.length >= options.maxRequests) {
        const oldest = active[0];
        const retryAfterMs = Math.max(1000, oldest + options.windowMs - currentTime);
        buckets.set(key, active);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
        };
      }

      active.push(currentTime);
      buckets.set(key, active);
      return {
        allowed: true,
        remaining: Math.max(0, options.maxRequests - active.length),
        retryAfterSeconds: 0,
      };
    },
    reset(): void {
      buckets.clear();
    },
  };
}
