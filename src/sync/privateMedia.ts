import { useSyncExternalStore } from 'react';
import { getMedia, retryMissingMedia, setSealedUploads } from '../lib/media';
import { kvStore } from './kvStore';
import { exportRawKey, importRawKey } from './sealed';
import type { KeyStore, PrivateMedia, PrivateStatus } from './sealedMedia';

/**
 * The app's side of sealed photos: our key on this phone (in IndexedDB, next
 * to the photos themselves — never in localStorage, never on the server
 * unlocked), and what the settings card shows.
 */

export const phoneKeyStore: KeyStore = {
  async load(space) {
    const raw = await kvStore.getItem(`olu-media-key:${space}`);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { raw: string; code: string };
    return { key: await importRawKey(saved.raw), code: saved.code };
  },
  async save(space, key, code) {
    await kvStore.setItem(
      `olu-media-key:${space}`,
      JSON.stringify({ raw: await exportRawKey(key), code }),
    );
  },
};

export interface PrivateState {
  /** null: no shared universe (or still checking). */
  status: PrivateStatus | null;
  /** Photos still plain on the server. */
  oldLeft: number;
  sealing: { done: number; of: number } | null;
}

let pm: PrivateMedia | null = null;
let space: string | null = null;
let afterChange: (() => void) | null = null;
let state: PrivateState = { status: null, oldLeft: 0, sealing: null };
const listeners = new Set<() => void>();
let checking: Promise<void> | null = null;

function set(next: Partial<PrivateState>) {
  state = { ...state, ...next };
  setSealedUploads(state.status === 'on');
  listeners.forEach((l) => l());
}

/** Called by the sync connection when it (re)starts or the universe changes. */
export function attachPrivateMedia(
  next: PrivateMedia | null,
  spaceId: string | null,
  onKeyReady: () => void,
) {
  if (next === pm && spaceId === space) return;
  pm = next;
  space = spaceId;
  afterChange = onKeyReady;
  set({ status: null, oldLeft: 0, sealing: null });
  void refreshPrivateMedia();
}

let lastFullCheck = 0;

/**
 * After every sync: is it on yet (the other phone may have just switched it
 * on), and are there plain photos left to seal (an older app on the other
 * phone may have sent some)? When all is sealed, that second look is only
 * done every ten minutes.
 */
export function checkPrivateMediaAfterSync() {
  if (state.status === 'on' && state.oldLeft === 0 && Date.now() - lastFullCheck < 600_000) return;
  void refreshPrivateMedia();
}

export function refreshPrivateMedia(): Promise<void> {
  if (!pm || !space) return Promise.resolve();
  lastFullCheck = Date.now();
  checking ??= (async () => {
    try {
      const status = await pm!.status(space!);
      set({ status });
      if (status === 'on') {
        const oldLeft = await pm!.oldCount(space!);
        set({ oldLeft });
        if (oldLeft > 0) await sealOldNow();
      }
    } catch {
      // Offline: we'll look again next time.
    } finally {
      checking = null;
    }
  })();
  return checking;
}

async function sealOldNow() {
  if (!pm || !space || state.sealing) return;
  set({ sealing: { done: 0, of: state.oldLeft } });
  try {
    const result = await pm.sealOld(
      space,
      async (id) => (await getMedia(id).catch(() => undefined))?.blob ?? null,
      (done, of) => set({ sealing: { done, of } }),
    );
    set({ oldLeft: result.left });
  } finally {
    set({ sealing: null });
  }
}

/** The first phone: make our key. Returns the code to write down. */
export async function enablePrivateMedia(): Promise<string> {
  if (!pm || !space) throw new Error('Verbind eerst samen.');
  const code = await pm.enable(space);
  set({ status: 'on' });
  afterChange?.();
  void refreshPrivateMedia();
  return code;
}

/** The other phone: our code unlocks our key. */
export async function joinPrivateMedia(code: string): Promise<boolean> {
  if (!pm || !space) return false;
  const ok = await pm.join(space, code);
  if (!ok) return false;
  set({ status: 'on' });
  // Photos that couldn't open before can now; held uploads can go.
  retryMissingMedia();
  afterChange?.();
  void refreshPrivateMedia();
  return true;
}

export async function privateMediaCode(): Promise<string | null> {
  return pm && space ? pm.code(space) : null;
}

export function usePrivateMedia(): PrivateState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
