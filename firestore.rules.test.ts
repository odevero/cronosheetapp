import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const rulesPath = resolve(process.cwd(), 'firestore.rules');
const blueprintPath = resolve(process.cwd(), 'firebase-blueprint.json');

test('firestore.rules enforces global default-deny catch-all as first rule', () => {
  const rules = readFileSync(rulesPath, 'utf8');
  assert.match(rules, /rules_version\s*=\s*'2';/);
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces email_verified on writes and strict ownerId matching', () => {
  const rules = readFileSync(rulesPath, 'utf8');
  assert.match(rules, /request\.auth\.token\.email_verified == true/);
  assert.match(rules, /data\.ownerId == request\.auth\.uid/);
  assert.match(rules, /resource\.data\.ownerId == request\.auth\.uid/);
});

test('firestore.rules enforces blueprint maxLength and regex constraints on all collections', () => {
  const rules = readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(readFileSync(blueprintPath, 'utf8'));

  assert.equal(blueprint.entities.GoalEntry.properties.title.maxLength, 1024);
  assert.equal(blueprint.entities.GoalEntry.properties.notes.maxLength, 4096);
  assert.equal(blueprint.entities.MemoNote.properties.nextStep.maxLength, 2048);
  assert.equal(blueprint.entities.RoadmapItem.properties.text.maxLength, 1536);

  assert.match(rules, /data\.title\.size\(\) <= 1024/);
  assert.match(rules, /data\.notes\.size\(\) <= 4096/);
  assert.match(rules, /data\.nextStep\.size\(\) <= 2048/);
  assert.match(rules, /data\.text\.size\(\) <= 1536/);
  assert.match(rules, /id\.matches\('\^\[a-zA-Z0-9_\\\\-\]\+\$'\)/);
});

test('firestore.rules protects all blueprint collections including security/encryption with validation helpers and immutability', () => {
  const rules = readFileSync(rulesPath, 'utf8');
  for (const helper of [
    'isValidUserProfile',
    'isValidMfaSecurity',
    'isValidEncryptionSecurity',
    'isValidGoalEntry',
    'isValidMemoNote',
    'isValidRoadmapItem',
  ]) {
    assert.ok(rules.includes(`function ${helper}`), `Missing validation helper ${helper}`);
  }
  assert.match(rules, /match \/security\/\{securityDocId\}/);
  assert.match(rules, /securityDocId == 'encryption'/);
  assert.match(rules, /data\.switchesThisMonth <= 2/);
  assert.match(rules, /data\.algorithm == 'AES-256-GCM'/);
  assert.match(rules, /allow list: if false;/);
  assert.match(rules, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rules, /incoming\(\)\.updatedAt == request\.time/);
  assert.match(rules, /incoming\(\)\.ownerId == existing\(\)\.ownerId/);
  assert.match(rules, /incoming\(\)\.createdAt == existing\(\)\.createdAt/);
  assert.match(rules, /exists\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\/goals\/\$\(incoming\(\)\.goalId\)\)/);
  assert.match(rules, /backupCodeHashes\.size\(\) <= 10/);
});
