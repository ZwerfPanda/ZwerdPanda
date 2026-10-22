/**
 * Registers the service worker that keeps the app shell available offline.
 * Only in production builds — during development it would cache stale code.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Offline support is a bonus; the site works fine without it.
    });
  });
}
