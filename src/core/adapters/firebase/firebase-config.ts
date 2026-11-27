export interface FirebasePublicConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId: string;
  oAuthClientId: string;
  recaptchaSiteKey: string;
}

export type FirebaseConfigSource = 'env' | 'webapp-config' | 'file';

export interface ResolvedFirebasePublicConfig {
  config: FirebasePublicConfig;
  source: FirebaseConfigSource;
}

export type EnvRecord = Readonly<Record<string, string | undefined>>;

function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeFirebasePublicConfig(
  raw: Partial<Record<keyof FirebasePublicConfig, unknown>> | null | undefined,
): FirebasePublicConfig {
  return {
    projectId: readTrimmedString(raw?.projectId),
    appId: readTrimmedString(raw?.appId),
    apiKey: readTrimmedString(raw?.apiKey),
    authDomain: readTrimmedString(raw?.authDomain),
    firestoreDatabaseId: readTrimmedString(raw?.firestoreDatabaseId),
    storageBucket: readTrimmedString(raw?.storageBucket),
    messagingSenderId: readTrimmedString(raw?.messagingSenderId),
    measurementId: readTrimmedString(raw?.measurementId),
    oAuthClientId: readTrimmedString(raw?.oAuthClientId),
    recaptchaSiteKey: readTrimmedString(raw?.recaptchaSiteKey),
  };
}

export function isFirebasePublicConfigReady(config: FirebasePublicConfig | null | undefined): boolean {
  if (!config) {
    return false;
  }
  return Boolean(
    config.projectId &&
      config.projectId !== 'remixed-project-id' &&
      config.apiKey,
  );
}

function parseWebAppConfigJson(rawJson: string | undefined): Partial<FirebasePublicConfig> | null {
  if (!rawJson || !rawJson.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    const result: Partial<FirebasePublicConfig> = {};
    if (typeof parsed['projectId'] === 'string') result.projectId = parsed['projectId'].trim();
    if (typeof parsed['appId'] === 'string') result.appId = parsed['appId'].trim();
    if (typeof parsed['apiKey'] === 'string') result.apiKey = parsed['apiKey'].trim();
    if (typeof parsed['authDomain'] === 'string') result.authDomain = parsed['authDomain'].trim();
    if (typeof parsed['firestoreDatabaseId'] === 'string') {
      result.firestoreDatabaseId = parsed['firestoreDatabaseId'].trim();
    }
    if (typeof parsed['storageBucket'] === 'string') result.storageBucket = parsed['storageBucket'].trim();
    if (typeof parsed['messagingSenderId'] === 'string') {
      result.messagingSenderId = parsed['messagingSenderId'].trim();
    }
    if (typeof parsed['measurementId'] === 'string') result.measurementId = parsed['measurementId'].trim();
    if (typeof parsed['oAuthClientId'] === 'string') result.oAuthClientId = parsed['oAuthClientId'].trim();
    if (typeof parsed['recaptchaSiteKey'] === 'string') {
      result.recaptchaSiteKey = parsed['recaptchaSiteKey'].trim();
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

function readExplicitEnvOverrides(env: EnvRecord): {
  overrides: Partial<FirebasePublicConfig>;
  hasAny: boolean;
} {
  const overrides: Partial<FirebasePublicConfig> = {};
  const map: [keyof FirebasePublicConfig, string][] = [
    ['projectId', 'FIREBASE_PROJECT_ID'],
    ['appId', 'FIREBASE_APP_ID'],
    ['apiKey', 'FIREBASE_API_KEY'],
    ['authDomain', 'FIREBASE_AUTH_DOMAIN'],
    ['firestoreDatabaseId', 'FIREBASE_DATABASE_ID'],
    ['storageBucket', 'FIREBASE_STORAGE_BUCKET'],
    ['messagingSenderId', 'FIREBASE_MESSAGING_SENDER_ID'],
    ['measurementId', 'FIREBASE_MEASUREMENT_ID'],
    ['oAuthClientId', 'FIREBASE_OAUTH_CLIENT_ID'],
    ['recaptchaSiteKey', 'FIREBASE_RECAPTCHA_SITE_KEY'],
  ];

  let hasAny = false;
  for (const [field, envKey] of map) {
    const raw = env[envKey];
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      // Allow explicit "(default)" sentinel for firestoreDatabaseId to target the default DB
      if (field === 'firestoreDatabaseId' && trimmed === '(default)') {
        overrides.firestoreDatabaseId = '';
        hasAny = true;
      } else if (trimmed.length > 0) {
        overrides[field] = trimmed;
        hasAny = true;
      }
    }
  }

  return { overrides, hasAny };
}

/**
 * Resolves the public Firebase Web App config using strict precedence:
 * 1. Explicit FIREBASE_* environment variables (e.g. apphosting.production.yaml)
 * 2. FIREBASE_WEBAPP_CONFIG JSON (auto-injected by Firebase App Hosting)
 * 3. Bundled firebase-applet-config.json fallback (AI Studio / local dev)
 *
 * When switching to a different projectId via env vars without an explicit
 * FIREBASE_DATABASE_ID, firestoreDatabaseId automatically clears to '' so
 * the target project's (default) Firestore database is used instead of a
 * stale AI Studio database ID from another project.
 */
export function resolveFirebasePublicConfig(
  env: EnvRecord,
  fallbackRaw: Partial<Record<keyof FirebasePublicConfig, unknown>> | null | undefined,
): ResolvedFirebasePublicConfig {
  const base = normalizeFirebasePublicConfig(fallbackRaw);
  const webAppConfig = parseWebAppConfigJson(env['FIREBASE_WEBAPP_CONFIG']);
  const { overrides: explicitEnv, hasAny: hasExplicitEnv } = readExplicitEnvOverrides(env);

  let merged: FirebasePublicConfig = { ...base };
  let source: FirebaseConfigSource = 'file';

  if (webAppConfig) {
    const switchingProject =
      Boolean(webAppConfig.projectId) && webAppConfig.projectId !== base.projectId;
    merged = {
      ...merged,
      ...webAppConfig,
      firestoreDatabaseId:
        webAppConfig.firestoreDatabaseId !== undefined
          ? webAppConfig.firestoreDatabaseId
          : switchingProject
            ? ''
            : merged.firestoreDatabaseId,
    };
    source = 'webapp-config';
  }

  if (hasExplicitEnv) {
    const switchingProject =
      Boolean(explicitEnv.projectId) && explicitEnv.projectId !== merged.projectId;
    merged = {
      ...merged,
      ...explicitEnv,
      firestoreDatabaseId:
        explicitEnv.firestoreDatabaseId !== undefined
          ? explicitEnv.firestoreDatabaseId
          : switchingProject
            ? ''
            : merged.firestoreDatabaseId,
    };
    source = 'env';
  }

  return { config: merged, source };
}

export function parseRuntimePublicConfigPayload(payload: unknown): FirebasePublicConfig | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const container = payload as { firebase?: unknown };
  if (!container.firebase || typeof container.firebase !== 'object' || Array.isArray(container.firebase)) {
    return null;
  }
  const normalized = normalizeFirebasePublicConfig(
    container.firebase as Partial<Record<keyof FirebasePublicConfig, unknown>>,
  );
  return isFirebasePublicConfigReady(normalized) ? normalized : null;
}
