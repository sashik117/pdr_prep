// DrivePrep keeps this tiny service worker only to retire older cached builds.
// It does not cache application files, so fresh deployments do not show stale chunks or white screens.
const CACHE_PREFIX = 'pdrprep-';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', () => {
  // Intentionally let the browser/network handle every request.
});
