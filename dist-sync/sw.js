/*
 * Our Little Universe — service worker.
 *
 * Keeps the app shell available offline:
 * - pages: network first, falling back to the cached page when offline
 * - scripts, styles, fonts, icons: served from cache, refreshed in the background
 * Only same-origin GET requests are touched; embedded players (Spotify,
 * YouTube) and anything else pass straight through. Our photos never travel
 * through here — they live in IndexedDB on the device.
 */

// Both placeholders are filled in at build time (see vite.config.ts).
const CACHE = 'olu-b92a5ac4b3';
const BUILT = /*__PRECACHE__*/ [];
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  ...BUILT,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Settings that may be edited on the server: always try the network first.
  if (url.pathname.endsWith('/universe-config.json')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const refresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || refresh;
    }),
  );
});

// A notification from the other phone (through our push function). It shows
// even with the app closed; while the app is open and in view, the app itself
// already shows what happened, so the banner is left out.
self.addEventListener('push', (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = { title: event.data ? event.data.text() : '' };
  }
  const title = String(message.title || 'Our Little Universe ♡').slice(0, 80);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const watching = windows.some((w) => w.visibilityState === 'visible' && w.focused);
      // Turns and games: the app is already showing them.
      if (watching && (message.kind === 'turn' || message.kind === 'match')) return undefined;
      return self.registration.showNotification(title, {
        body: String(message.body || '').slice(0, 160),
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: String(message.tag || message.kind || 'olu'),
        renotify: true,
        data: { url: typeof message.url === 'string' ? message.url : './' },
      });
    }),
  );
});

// Tapping one of our notifications opens the app (or brings it to the front)
// at the place it's about.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const win of windows) {
        if ('focus' in win) {
          win.navigate?.(target);
          return win.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
