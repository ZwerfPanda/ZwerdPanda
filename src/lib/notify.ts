import { getContent, getPrefs, onContentChanged, updatePrefs } from '../data/store';
import { getMe, nameOf, otherPerson } from '../data/people';
import { newSince } from '../features/home/WhatsNew';
import { todayIso } from './dates';

/**
 * Little notifications on this phone: when the other one adds something
 * (it arrives through the sync), and when a sealed letter's day has come.
 * They show while the app is open or running in the background; a
 * notification on a phone where the app is fully closed would need a
 * server that pushes, which this app doesn't have.
 *
 * The app icon also gets a badge with how many new things there are.
 */

const SEEN_KEY = 'olu:notified-at:v1';
const LETTERS_KEY = 'olu:notified-letters:v1';

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Only used to avoid telling the same thing twice.
  }
};

export const notificationsSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window;

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

/** Asks once; returns whether we may show notifications now. */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  const result =
    Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  const ok = result === 'granted';
  updatePrefs({ notify: ok });
  if (ok) write(SEEN_KEY, new Date().toISOString());
  return ok;
}

async function show(title: string, body: string, url: string) {
  if (!getPrefs().notify || notificationPermission() !== 'granted') return;
  const options: NotificationOptions = {
    body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: `olu-${url}`,
    data: { url },
  };
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Some browsers only allow notifications from the service worker.
  }
}

function updateBadge(count: number) {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  } catch {
    // Badges are a nicety.
  }
}

/** New things from the other person since we last told about them. */
function checkNew() {
  const content = getContent();
  const from = otherPerson(getMe());
  const since = read(SEEN_KEY) ?? new Date().toISOString();
  const things = newSince(content, from, since);
  updateBadge(things.length);
  if (!things.length) return;
  write(SEEN_KEY, new Date().toISOString());
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  const name = nameOf(from, content.profile);
  void show(`Nieuw van ${name} ♡`, things.map((t) => t.label).join(' · '), `#${things[0].path}`);
}

/** Sealed letters whose day is today: told once. */
function checkLetters() {
  const today = todayIso();
  const told = new Set((read(LETTERS_KEY) ?? '').split(',').filter(Boolean));
  const opening = getContent().letters.filter(
    (l) =>
      l.status === 'shared' &&
      l.lock.type === 'date' &&
      l.lock.until <= today &&
      !l.readAt &&
      !told.has(l.id),
  );
  if (!opening.length) return;
  opening.forEach((l) => told.add(l.id));
  write(LETTERS_KEY, [...told].slice(-200).join(','));
  const first = opening[0];
  void show(
    'Er is een brief opengegaan 💌',
    `“Open when ${first.occasion}” mag nu open.`,
    '#/letters',
  );
}

let installed = false;

export function installNotifications() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  onContentChanged((source) => {
    if (source === 'remote') checkNew();
  });
  const onVisible = () => {
    if (document.visibilityState === 'visible') checkLetters();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.setTimeout(checkLetters, 3000);
  // Letters can open at midnight while the app keeps running.
  window.setInterval(checkLetters, 15 * 60_000);
}
