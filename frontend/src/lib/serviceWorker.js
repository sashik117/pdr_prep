export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  const cleanupServiceWorkers = () => {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister();
      });
    }).catch(() => {
      // Ignore cleanup errors; the app should still work as a normal website.
    });

    if ('caches' in window) {
      caches.keys().then((keys) => {
        keys.forEach((key) => {
          if (key.startsWith('pdrprep-')) void caches.delete(key);
        });
      }).catch(() => {
        // Cache cleanup is best effort.
      });
    }
  };

  window.addEventListener('load', () => {
    cleanupServiceWorkers();
  });
}
