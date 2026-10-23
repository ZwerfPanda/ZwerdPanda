import { toast } from '../components/ui/feedback';

/**
 * Registers the service worker that keeps the app shell available offline.
 * Only in production builds — during development it would cache stale code.
 *
 * It also looks for a new version whenever the app comes back to the front,
 * so both our phones run the same app. A new version is offered with a tap,
 * never forced: a letter half-written stays where it is.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update().catch(() => {});
        });
      })
      .catch(() => {
        // Offline support is a bonus; the site works fine without it.
      });
    // A first install takes control without anything changing; only a real update asks.
    const hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      toast('Er is een nieuwe versie van ons universe ✨', {
        action: { label: 'Vernieuwen', run: () => window.location.reload() },
      });
    });
  });
}
