import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { doc, Firestore, getDocFromServer, getFirestore } from 'firebase/firestore';
import bundledFirebaseConfig from '../../../../firebase-applet-config.json';
import {
  FirebasePublicConfig,
  isFirebasePublicConfigReady,
  normalizeFirebasePublicConfig,
  parseRuntimePublicConfigPayload,
} from './firebase-config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let activeFirebaseConfig: FirebasePublicConfig =
  normalizeFirebasePublicConfig(bundledFirebaseConfig);
let runtimeConfigHydrated = false;
let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let connectionTested = false;

/**
 * Loads environment-specific public Firebase config from the Express server
 * (`/api/public-config`) before the first Firebase client initializes.
 * Enables Staging/Production Firebase App Hosting overrides via FIREBASE_*
 * env vars while keeping firebase-applet-config.json as an automatic fallback
 * for AI Studio, local development, and offline PWA launches.
 */
export async function hydrateFirebaseRuntimeConfig(): Promise<void> {
  if (typeof window === 'undefined' || runtimeConfigHydrated || cachedApp) {
    return;
  }
  runtimeConfigHydrated = true;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch('/api/public-config', {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as unknown;
    const resolved = parseRuntimePublicConfigPayload(payload);
    if (resolved && !cachedApp) {
      activeFirebaseConfig = resolved;
    }
  } catch {
    // Offline PWA launch or static preview: keep bundled fallback silently.
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function isFirebaseConfigured(): boolean {
  return isFirebasePublicConfigReady(activeFirebaseConfig);
}

export function getFirebaseClients(): { app: FirebaseApp; db: Firestore; auth: Auth } | null {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) {
    return null;
  }

  if (!cachedApp) {
    const existing = getApps();
    cachedApp = existing.length > 0 ? existing[0] : initializeApp(activeFirebaseConfig);
    cachedDb = activeFirebaseConfig.firestoreDatabaseId
      ? getFirestore(cachedApp, activeFirebaseConfig.firestoreDatabaseId)
      : getFirestore(cachedApp);
    cachedAuth = getAuth(cachedApp);

    if (!connectionTested) {
      connectionTested = true;
      void testConnection(cachedDb);
    }
  }

  return { app: cachedApp, db: cachedDb!, auth: cachedAuth! };
}

async function testConnection(db: Firestore): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const currentUser = cachedAuth?.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
