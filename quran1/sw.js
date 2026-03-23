/**
 * Quran Studio — Service Worker v2
 * Caches static assets and API responses for offline use
 */

const CACHE_NAME = 'quran-studio-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/styles.css',
  '/assets/js/api.js',
  '/assets/js/storage.js',
  '/assets/js/ui.js',
  '/assets/js/audio.js',
  '/assets/js/search.js',
  '/assets/js/main.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.warn('[SW] Could not cache all static assets');
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  const allowedOrigins = [
    'cdn.islamic.network',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'api.alquran.cloud',
  ];

  const isAllowed = allowedOrigins.some((o) => url.hostname.includes(o));
  if (url.origin !== location.origin && !isAllowed) return;

  // API calls: network first, cache fallback
  if (url.hostname.includes('api.alquran.cloud')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Audio CDN: cache first for faster playback, network fallback
  if (url.hostname.includes('cdn.islamic.network')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => null);
      })
    );
    return;
  }

  // Fonts & static assets: cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
