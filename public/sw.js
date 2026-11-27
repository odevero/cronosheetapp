/* CronoSheet Lightweight PWA Service Worker */
const CACHE_NAME = 'cronosheet-shell-v1';
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/icons/pwa-192x192.png',
  '/icons/pwa-512x512.png',
  '/apple-touch-icon.png',
];

const STATIC_EXT_PATTERN = /\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?|webmanifest)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((staleKey) => caches.delete(staleKey)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept cross-origin traffic (Firebase Auth, Firestore, Google Fonts, GitHub API)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Never intercept API endpoints, Firebase Auth helpers, or Vite dev internals
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/__/auth/') ||
    url.pathname.startsWith('/__/firebase/') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/@vite/')
  ) {
    return;
  }

  // Navigation requests: Network-First with cached offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/')),
        ),
    );
    return;
  }

  // Static shell assets: Stale-While-Revalidate
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/images/') ||
    STATIC_EXT_PATTERN.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          const networkPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
                cache.put(request, networkResponse.clone()).catch(() => undefined);
              }
              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || networkPromise;
        }),
      ),
    );
  }
});
