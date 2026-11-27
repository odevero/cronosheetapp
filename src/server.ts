import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import bundledFirebaseConfig from '../firebase-applet-config.json';
import {resolveFirebasePublicConfig} from './core/adapters/firebase/firebase-config';
import {
  createSlidingWindowRateLimiter,
  formatFeedbackAsGitHubIssue,
  parseGitHubRepoSlug,
  validateFeedbackInput,
} from './core/domain/services/feedback-issue';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

const feedbackRateLimiter = createSlidingWindowRateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
  maxKeys: 1000,
});

function extractClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Exposes strictly the public Firebase Web App client config resolved from
 * environment variables (FIREBASE_* or Firebase App Hosting FIREBASE_WEBAPP_CONFIG)
 * with firebase-applet-config.json as fallback. Never returns server secrets.
 */
app.get('/api/public-config', (_req, res) => {
  const resolved = resolveFirebasePublicConfig(process.env, bundledFirebaseConfig);
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    firebase: resolved.config,
    source: resolved.source,
  });
});

/**
 * Hardened Feedback -> GitHub Issues proxy route.
 * Keeps GITHUB_FEEDBACK_TOKEN strictly on the server, applies rate limiting,
 * honeypot filtering, strict payload validation, and repo slug allowlisting.
 */
app.post('/api/feedback', express.json({limit: '16kb'}), async (req, res) => {
  if (req.headers['x-requested-with'] !== 'CronoSheet') {
    res.status(403).json({
      ok: false,
      code: 'FORBIDDEN',
      message: 'Richiesta non autorizzata.',
    });
    return;
  }

  const clientIp = extractClientIp(req);
  const rate = feedbackRateLimiter.check(clientIp);
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    res.status(429).json({
      ok: false,
      code: 'RATE_LIMITED',
      message: `Troppi invii recenti. Riprova tra ${Math.ceil(rate.retryAfterSeconds / 60)} minuti.`,
    });
    return;
  }

  const validation = validateFeedbackInput(req.body);
  if (validation.isBotHoneypot) {
    res.status(400).json({
      ok: false,
      code: 'SPAM_BLOCKED',
      message: 'Invio bloccato dal controllo anti-spam.',
    });
    return;
  }

  if (!validation.valid || !validation.sanitized) {
    res.status(400).json({
      ok: false,
      code: 'VALIDATION_ERROR',
      message: validation.errors[0] ?? 'Compila correttamente i campi richiesti.',
      errors: validation.errors,
    });
    return;
  }

  const formatted = formatFeedbackAsGitHubIssue(validation.sanitized, {
    submittedAtIso: new Date().toISOString(),
    appVersion: 'CronoSheet v1',
  });

  const token = process.env['GITHUB_FEEDBACK_TOKEN']?.trim();
  const repoSlug = parseGitHubRepoSlug(process.env['GITHUB_FEEDBACK_REPO']);

  if (!token || !repoSlug) {
    res.status(503).json({
      ok: false,
      code: 'NOT_CONFIGURED',
      message:
        'Il repository GitHub per il feedback non è ancora stato collegato nei Secrets del server. Puoi copiare il testo già pronto e incollarlo su GitHub.',
      formattedIssue: formatted,
    });
    return;
  }

  const endpoint = `https://api.github.com/repos/${repoSlug.owner}/${repoSlug.repo}/issues`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'CronoSheet-Feedback/1.0',
    'Content-Type': 'application/json',
  };

  try {
    let ghResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: formatted.title,
        body: formatted.body,
        labels: formatted.labels,
      }),
    });

    // If custom labels are rejected on a fresh repository, retry once without labels
    if (ghResponse.status === 422) {
      ghResponse = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: formatted.title,
          body: formatted.body,
        }),
      });
    }

    if (!ghResponse.ok) {
      console.error(`GitHub Issues API responded with HTTP ${ghResponse.status}`);
      res.status(502).json({
        ok: false,
        code: 'UPSTREAM_ERROR',
        message:
          'Impossibile pubblicare la Issue su GitHub in questo momento. Puoi copiare il testo qui sotto e riprovare più tardi.',
        formattedIssue: formatted,
      });
      return;
    }

    const created = (await ghResponse.json()) as {
      number?: unknown;
      html_url?: unknown;
    };
    const issueNumber = typeof created.number === 'number' ? created.number : null;
    const rawUrl = typeof created.html_url === 'string' ? created.html_url : '';
    const safeUrl = rawUrl.startsWith('https://github.com/') ? rawUrl : null;

    res.status(201).json({
      ok: true,
      issueNumber,
      issueUrl: safeUrl,
    });
  } catch {
    console.error('GitHub Issues API network error while creating feedback issue');
    res.status(502).json({
      ok: false,
      code: 'UPSTREAM_ERROR',
      message:
        'Errore di rete durante l’invio a GitHub. Puoi copiare il testo qui sotto e riprovare.',
      formattedIssue: formatted,
    });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Service-Worker-Allowed', '/');
      } else if (filePath.endsWith('.webmanifest')) {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
