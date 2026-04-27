const STATIC_CACHE = 'pdrprep-static-v1';
const RUNTIME_CACHE = 'pdrprep-runtime-v1';
const QUESTIONS_CACHE = 'pdrprep-questions-v1';
const IMAGE_CACHE = 'pdrprep-images-v1';

const APP_SHELL = ['/', '/index.html', '/logo-wordmark.png', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const allowed = [STATIC_CACHE, RUNTIME_CACHE, QUESTIONS_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => !allowed.includes(key)).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

async function staleWhileRevalidate(request, cacheName) {
  const url = new URL(request.url);
  const canCache = url.protocol === 'http:' || url.protocol === 'https:';
  if (!canCache) {
    return fetch(request);
  }
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || networkPromise;
}

async function cacheFirst(request, cacheName) {
  const url = new URL(request.url);
  const canCache = url.protocol === 'http:' || url.protocol === 'https:';
  if (!canCache) {
    return fetch(request);
  }
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isQuestionApi = /\/questions(?:\/random)?/.test(url.pathname) || /\/sections$/.test(url.pathname);
  const isQuestionImage = url.pathname.includes('/images/questions_img/');
  const isStaticAsset = request.destination === 'style' || request.destination === 'script' || request.destination === 'document';

  if (isQuestionImage) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  if (isQuestionApi) {
    event.respondWith(staleWhileRevalidate(request, QUESTIONS_CACHE));
    return;
  }

  if (isStaticAsset) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
  }
});
