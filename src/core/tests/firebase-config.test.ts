import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isFirebasePublicConfigReady,
  parseRuntimePublicConfigPayload,
  resolveFirebasePublicConfig,
} from '../adapters/firebase/firebase-config';

const DEV_FALLBACK = {
  projectId: 'cronosheetapp',
  appId: '1:111:web:dev',
  apiKey: 'AIzaDevKeyPlaceholder1234567890',
  authDomain: 'cronosheetapp.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-dev-db',
  storageBucket: 'cronosheetapp.firebasestorage.app',
  messagingSenderId: '111',
  measurementId: '',
  oAuthClientId: '111-dev.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

test('resolveFirebasePublicConfig falls back to bundled JSON when no env vars are set', () => {
  const result = resolveFirebasePublicConfig({}, DEV_FALLBACK);
  assert.equal(result.source, 'file');
  assert.equal(result.config.projectId, 'cronosheetapp');
  assert.equal(result.config.firestoreDatabaseId, 'ai-studio-dev-db');
  assert.equal(isFirebasePublicConfigReady(result.config), true);
});

test('resolveFirebasePublicConfig supports Firebase App Hosting FIREBASE_WEBAPP_CONFIG and clears stale dev DB ID when switching project', () => {
  const result = resolveFirebasePublicConfig(
    {
      FIREBASE_WEBAPP_CONFIG: JSON.stringify({
        projectId: 'cronosheet-prod',
        appId: '1:222:web:prod',
        apiKey: 'AIzaProdKeyPlaceholder123456789',
        authDomain: 'cronosheet-prod.firebaseapp.com',
        storageBucket: 'cronosheet-prod.firebasestorage.app',
        messagingSenderId: '222',
      }),
    },
    DEV_FALLBACK,
  );

  assert.equal(result.source, 'webapp-config');
  assert.equal(result.config.projectId, 'cronosheet-prod');
  assert.equal(result.config.apiKey, 'AIzaProdKeyPlaceholder123456789');
  // Must NOT inherit the AI Studio dev database ID when switching to a different project
  assert.equal(result.config.firestoreDatabaseId, '');
});

test('resolveFirebasePublicConfig gives explicit FIREBASE_* env vars highest precedence', () => {
  const result = resolveFirebasePublicConfig(
    {
      FIREBASE_WEBAPP_CONFIG: JSON.stringify({
        projectId: 'cronosheet-staging',
        apiKey: 'AIzaStagingKeyPlaceholder12345',
      }),
      FIREBASE_PROJECT_ID: 'cronosheet-prod',
      FIREBASE_API_KEY: 'AIzaExplicitProdKey12345678901',
      FIREBASE_AUTH_DOMAIN: 'cronosheet-prod.firebaseapp.com',
      FIREBASE_DATABASE_ID: 'prod-eu-db',
    },
    DEV_FALLBACK,
  );

  assert.equal(result.source, 'env');
  assert.equal(result.config.projectId, 'cronosheet-prod');
  assert.equal(result.config.apiKey, 'AIzaExplicitProdKey12345678901');
  assert.equal(result.config.authDomain, 'cronosheet-prod.firebaseapp.com');
  assert.equal(result.config.firestoreDatabaseId, 'prod-eu-db');
});

test('resolveFirebasePublicConfig handles (default) sentinel and malformed JSON safely', () => {
  const sentinel = resolveFirebasePublicConfig(
    { FIREBASE_DATABASE_ID: '(default)' },
    DEV_FALLBACK,
  );
  assert.equal(sentinel.source, 'env');
  assert.equal(sentinel.config.firestoreDatabaseId, '');

  const malformed = resolveFirebasePublicConfig(
    { FIREBASE_WEBAPP_CONFIG: '{broken-json' },
    DEV_FALLBACK,
  );
  assert.equal(malformed.source, 'file');
  assert.equal(malformed.config.projectId, 'cronosheetapp');
});

test('isFirebasePublicConfigReady rejects placeholders and parseRuntimePublicConfigPayload validates shape', () => {
  assert.equal(
    isFirebasePublicConfigReady({
      ...DEV_FALLBACK,
      projectId: 'remixed-project-id',
    }),
    false,
  );

  const valid = parseRuntimePublicConfigPayload({
    firebase: {
      projectId: 'cronosheet-prod',
      apiKey: 'AIzaValidRuntimeKey1234567890',
      authDomain: 'cronosheet-prod.firebaseapp.com',
      appId: '1:222:web:prod',
      unexpectedSecret: 'ignored',
    },
  });
  assert.ok(valid);
  assert.equal(valid.projectId, 'cronosheet-prod');
  assert.equal('unexpectedSecret' in valid, false);

  assert.equal(parseRuntimePublicConfigPayload(null), null);
  assert.equal(parseRuntimePublicConfigPayload({ firebase: { projectId: '' } }), null);
});
