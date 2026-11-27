import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSlidingWindowRateLimiter,
  formatFeedbackAsGitHubIssue,
  neutralizeGitHubMentions,
  parseGitHubRepoSlug,
  validateFeedbackInput,
} from '../domain/services/feedback-issue';

test('validateFeedbackInput accepts valid feedback and trims whitespace', () => {
  const res = validateFeedbackInput({
    category: 'feature',
    title: '  Esportazione JSON  ',
    description: '  Sarebbe comodo esportare tutto il foglio anche in JSON.  ',
    contact: '  @odevero  ',
    surface: 'backend',
    website: '',
  });

  assert.equal(res.valid, true);
  assert.equal(res.isBotHoneypot, false);
  assert.equal(res.errors.length, 0);
  assert.deepEqual(res.sanitized, {
    category: 'feature',
    title: 'Esportazione JSON',
    description: 'Sarebbe comodo esportare tutto il foglio anche in JSON.',
    contact: '@odevero',
    surface: 'backend',
    website: '',
  });
});

test('validateFeedbackInput rejects empty or too-short fields', () => {
  const res = validateFeedbackInput({
    category: 'invalid',
    title: 'Hi',
    description: 'short',
    contact: '',
    surface: 'landing',
    website: '',
  });

  assert.equal(res.valid, false);
  assert.equal(res.isBotHoneypot, false);
  assert.equal(res.errors.length, 3);
  assert.equal(res.sanitized, null);
});

test('validateFeedbackInput flags non-empty honeypot as bot spam', () => {
  const res = validateFeedbackInput({
    category: 'bug',
    title: 'Titolo valido per test',
    description: 'Descrizione abbastanza lunga da superare il minimo.',
    contact: '',
    surface: 'landing',
    website: 'https://spam.example.com',
  });

  assert.equal(res.valid, false);
  assert.equal(res.isBotHoneypot, true);
  assert.equal(res.sanitized, null);
});

test('neutralizeGitHubMentions escapes @user mentions without mangling emails', () => {
  const input = 'Ciao @octocat e @org/team, scrivimi a test@example.com o (@admin).';
  const output = neutralizeGitHubMentions(input);
  assert.equal(
    output,
    'Ciao `@octocat` e `@org/team`, scrivimi a test@example.com o (`@admin`).',
  );
});

test('formatFeedbackAsGitHubIssue creates prefixed title, markdown body, and labels', () => {
  const formatted = formatFeedbackAsGitHubIssue(
    {
      category: 'bug',
      title: 'Data errata su bisestili',
      description: 'Provato con @someone il 29/02/2024 e il conto salta.',
      contact: 'mario@example.com',
      surface: 'showcase',
      website: '',
    },
    { submittedAtIso: '2026-11-26T10:00:00.000Z' },
  );

  assert.equal(formatted.title, '[Bug] Data errata su bisestili');
  assert.deepEqual(formatted.labels, ['feedback', 'bug']);
  assert.match(formatted.body, /`@someone`/);
  assert.match(formatted.body, /mario@example\.com/);
  assert.match(formatted.body, /`showcase`/);
});

test('parseGitHubRepoSlug accepts clean owner/repo and rejects unsafe values', () => {
  assert.deepEqual(parseGitHubRepoSlug('odevero/cronosheet'), {
    owner: 'odevero',
    repo: 'cronosheet',
  });
  assert.deepEqual(parseGitHubRepoSlug('  odevero/crono-sheet.v1  '), {
    owner: 'odevero',
    repo: 'crono-sheet.v1',
  });
  assert.equal(parseGitHubRepoSlug(undefined), null);
  assert.equal(parseGitHubRepoSlug(''), null);
  assert.equal(parseGitHubRepoSlug('https://github.com/odevero/cronosheet'), null);
  assert.equal(parseGitHubRepoSlug('odevero/..'), null);
  assert.equal(parseGitHubRepoSlug('odevero/foo/bar'), null);
  assert.equal(parseGitHubRepoSlug('../etc/passwd'), null);
});

test('createSlidingWindowRateLimiter enforces limits and recovers after window', () => {
  let clock = 1_000_000;
  const limiter = createSlidingWindowRateLimiter({
    maxRequests: 2,
    windowMs: 60_000,
    maxKeys: 10,
    now: () => clock,
  });

  const r1 = limiter.check('1.2.3.4');
  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);

  const r2 = limiter.check('1.2.3.4');
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);

  const r3 = limiter.check('1.2.3.4');
  assert.equal(r3.allowed, false);
  assert.equal(r3.retryAfterSeconds, 60);

  // Different IP is unaffected
  assert.equal(limiter.check('5.6.7.8').allowed, true);

  // After window elapses, first IP can submit again
  clock += 61_000;
  const r4 = limiter.check('1.2.3.4');
  assert.equal(r4.allowed, true);
  assert.equal(r4.remaining, 1);
});
