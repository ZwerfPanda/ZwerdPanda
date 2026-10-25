import { useSyncExternalStore } from 'react';
import { getContent, onContentChanged, replaceContent } from '../data/store';
import { restorePointMediaIds } from '../data/restorePoints';
import { normalizeContent } from '../data/normalize';
import { setMe } from '../data/people';
import { getMedia, retryMissingMedia, setRemoteMediaSource } from '../lib/media';
import { SyncEngine, type EngineDeps } from './engine';
import { reportAfterSync } from './report';
import { clearDeviceConfig, resolveSyncConfig, saveDeviceConfig, type SyncConfig } from './config';
import type { SyncState } from './types';
import { connectLive } from './live';

/**
 * The app-wide connection to the shared universe. With no server configured
 * it stays 'off' and everything works locally exactly as before.
 */

const OFF: SyncState = {
  phase: 'off',
  account: null,
  spaceId: null,
  members: [],
  invites: [],
  owner: null,
  lastSyncedAt: null,
  pendingChanges: false,
  uploading: 0,
  error: null,
  recovery: false,
};

let engine: SyncEngine | null = null;
let config: SyncConfig | null = null;
let state: SyncState = { ...OFF, phase: 'starting' };
let unsubscribeEngine: (() => void) | null = null;
const listeners = new Set<() => void>();

function setState(next: SyncState) {
  state = next;
  // Whoever created the universe is `you`; the other signed-in person is `partner`.
  if (next.account && next.owner)
    setMe(sameEmail(next.account.email, next.owner) ? 'you' : 'partner');
  listeners.forEach((listener) => listener());
  if (engine && next.phase === 'synced' && !next.pendingChanges) void reportAfterSync(engine);
}

/** Email addresses don't care about capitals or stray spaces. */
export function sameEmail(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function safeStorage(): EngineDeps['storage'] {
  try {
    localStorage.getItem('');
    return localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    };
  }
}

const deps: EngineDeps = {
  getContent,
  applyRemote: (content) => replaceContent(content, 'remote'),
  onLocalChange: (listener) => onContentChanged((source) => source === 'local' && listener()),
  normalize: normalizeContent,
  getLocalMedia: async (id) => (await getMedia(id).catch(() => undefined))?.blob ?? null,
  setRemoteMediaSource,
  retryMissingMedia,
  keepMedia: restorePointMediaIds,
  storage: safeStorage(),
  watchConnectivity: (wake) => {
    const onVisible = () => document.visibilityState === 'visible' && wake();
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', onVisible);
    };
  },
};

/** The server code, tried twice (a flaky connection, or a just-updated app). */
async function loadBackend() {
  try {
    return await import('./supabaseBackend');
  } catch {
    await new Promise((r) => setTimeout(r, 800));
    return import('./supabaseBackend');
  }
}

/** True when the sync engine couldn't start at all (not just signed out). */
export function syncFailedToStart(): boolean {
  return !engine && state.phase === 'error';
}

export async function startSync() {
  stopSync();
  config = await resolveSyncConfig();
  if (!config) {
    setState(OFF);
    return;
  }
  try {
    const { createSupabaseBackend } = await loadBackend();
    engine = new SyncEngine(createSupabaseBackend(config), deps);
    const offState = engine.subscribe(() => setState(engine!.getState()));
    const offLive = connectLive(engine);
    unsubscribeEngine = () => {
      offState();
      offLive();
    };
    setState(engine.getState());
    await engine.start();
  } catch (error) {
    setState({
      ...OFF,
      phase: 'error',
      error: error instanceof Error ? error.message : 'Syncen starten lukte niet.',
    });
  }
}

function stopSync() {
  unsubscribeEngine?.();
  unsubscribeEngine = null;
  engine?.stop();
  engine = null;
}

export function getSyncEngine(): SyncEngine | null {
  return engine;
}

export function getSyncConfig(): SyncConfig | null {
  return config;
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

/** Connects this device to a Supabase project pasted into Settings. */
export async function connectThisDevice(url: string, anonKey: string) {
  saveDeviceConfig(url, anonKey);
  await startSync();
}

export async function forgetThisDevicesServer() {
  await engine?.signOut().catch(() => undefined);
  clearDeviceConfig();
  await startSync();
}

/** Before erasing this device: stop syncing so the shared copy stays untouched. */
export async function disconnectBeforeReset() {
  if (engine && state.phase !== 'off') await engine.signOut().catch(() => undefined);
}

export function isSharing(): boolean {
  return Boolean(state.spaceId);
}
