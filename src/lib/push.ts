import { getSyncConfig, getSyncEngine } from '../sync/sync';
import { updatePrefs } from '../data/store';

/*
 * Notifications that reach the other phone even when the app is closed, through
 * our own push function (supabase/functions/push). This phone signs up once;
 * after that, a move in a game or an "ik denk aan je" from the other one
 * arrives as a real notification.
 *
 * On an iPhone this only works for the app on the home screen (iOS 16.4+).
 */

export type PushKind = 'turn' | 'match' | 'ping' | 'news';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export type PushSupport = 'ok' | 'install-first' | 'unsupported';

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
  if (isIos() && !standalone()) return 'install-first';
  if (!('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  return 'ok';
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const config = getSyncConfig();
  const engine = getSyncEngine();
  const space = engine?.getState().spaceId;
  const token = await engine?.accessToken();
  if (!config || !space || !token) throw new Error('Zet eerst Samen aan (inloggen en koppelen).');
  let res: Response;
  try {
    res = await fetch(`${config.url}/functions/v1/push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: config.anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, space }),
    });
  } catch {
    throw new Error('Geen verbinding met de server.');
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 404)
    throw new Error(
      'De meldingen-functie staat nog niet op Supabase (zie Instellingen → Meldingen).',
    );
  if (!res.ok) throw new Error(json.error ?? `De server gaf een fout (${res.status}).`);
  return json;
}

const keyBytes = (b64: string) => {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function registration() {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) throw new Error('De app is nog niet helemaal geladen. Probeer het zo nog eens.');
  return reg;
}

/** Is this phone signed up right now? */
export async function pushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'ok') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(await reg?.pushManager.getSubscription()) && Notification.permission === 'granted';
}

export async function enablePush(): Promise<void> {
  if (pushSupport() === 'install-first')
    throw new Error(
      'Zet de app eerst op je beginscherm (Delen → Zet op beginscherm) en open hem daarvandaan.',
    );
  if (pushSupport() !== 'ok') throw new Error('Deze browser kan geen meldingen ontvangen.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted')
    throw new Error(
      'Meldingen staan uit voor deze app. Zet ze aan in de instellingen van je telefoon.',
    );
  const { publicKey } = await call<{ publicKey: string }>({ op: 'key' });
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  // Signed up with another key before: start over.
  if (sub) {
    const had = sub.options.applicationServerKey;
    const now = keyBytes(publicKey);
    if (!had || new Uint8Array(had).join() !== now.join()) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  sub ??= await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: keyBytes(publicKey),
  });
  await call({ op: 'subscribe', subscription: sub.toJSON() });
  updatePrefs({ notify: true });
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await call({ op: 'unsubscribe', endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
}

/** The last time each tag was sent, so quick moves don't buzz every few seconds. */
const lastSent = new Map<string, number>();

/**
 * Tells the other phone. Never in the way: without Samen, the function or a
 * connection it just doesn't happen.
 */
export function notifyOther(
  kind: PushKind,
  message: { title: string; body?: string; url?: string; tag?: string },
  quietFor = 0,
) {
  const tag = message.tag ?? kind;
  const now = Date.now();
  if (quietFor && now - (lastSent.get(tag) ?? 0) < quietFor) return;
  lastSent.set(tag, now);
  if (!getSyncConfig() || !getSyncEngine()?.getState().spaceId) return;
  void call({ op: 'send', kind, ...message, tag }).catch(() => undefined);
}
