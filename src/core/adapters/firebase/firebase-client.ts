import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { doc, Firestore, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../../../firebase-applet-config.json';

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

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let connectionTested = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig &&
      firebaseConfig.projectId &&
      firebaseConfig.projectId !== 'remixed-project-id' &&
      firebaseConfig.apiKey,
  );
}

export function getFirebaseClients(): { app: FirebaseApp; db: Firestore; auth: Auth } | null {
  if (typeof window === 'undefined' || !isFirebaseConfigured()) {
    return null;
  }

  if (!cachedApp) {
    const existing = getApps();
    cachedApp = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
    cachedDb = getFirestore(cachedApp, firebaseConfig.firestoreDatabaseId);
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
