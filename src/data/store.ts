import { useCallback, useRef, useSyncExternalStore } from 'react';
import { createDefaultContent, defaultPreferences } from './defaults';
import { normalizeContent, normalizePreferences } from './normalize';
import type { AppContent, Preferences } from './types';

/**
 * Where content is persisted.
 *
 * Today this is the browser's localStorage, so everything stays on this device.
 * A shared backend (e.g. Supabase with two invited accounts) can implement the
 * same interface later; the rest of the app only talks to the store below.
 */
export interface ContentAdapter {
  load(): unknown;
  save(content: AppContent): void;
  clear(): void;
}

const CONTENT_KEY = 'olu:content:v1';
const PREFS_KEY = 'olu:prefs:v1';

function safeStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = '__olu_probe__';
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

const storage = typeof window !== 'undefined' ? safeStorage() : null;

export const localContentAdapter: ContentAdapter = {
  load() {
    const raw = storage?.getItem(CONTENT_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  save(content) {
    if (!storage) throw new Error('Storage is unavailable in this browser mode.');
    storage.setItem(CONTENT_KEY, JSON.stringify(content));
  },
  clear() {
    storage?.removeItem(CONTENT_KEY);
  },
};

export const storageAvailable = storage !== null;

// --- Content store ------------------------------------------------------------

const adapter: ContentAdapter = localContentAdapter;

function loadInitialContent(): AppContent {
  const raw = adapter.load();
  return raw ? normalizeContent(raw) : createDefaultContent();
}

let content: AppContent = loadInitialContent();
const contentListeners = new Set<() => void>();
const errorListeners = new Set<(message: string) => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function persistSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flushContent, 200);
}

export function flushContent() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    adapter.save(content);
  } catch (error) {
    const quota = error instanceof DOMException && error.name === 'QuotaExceededError';
    const message = quota
      ? 'This browser’s storage is full, so the last change could not be saved.'
      : 'Changes can’t be saved in this browser mode (private browsing?).';
    errorListeners.forEach((listener) => listener(message));
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushContent);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushContent();
  });
}

export function getContent(): AppContent {
  return content;
}

/** Applies an immutable update and schedules a save. */
export function updateContent(recipe: (current: AppContent) => AppContent) {
  const next = recipe(content);
  if (next === content) return;
  content = next;
  contentListeners.forEach((listener) => listener());
  persistSoon();
}

export function replaceContent(next: AppContent) {
  content = next;
  contentListeners.forEach((listener) => listener());
  flushContent();
}

function subscribeContent(listener: () => void) {
  contentListeners.add(listener);
  return () => contentListeners.delete(listener);
}

export function onPersistError(listener: (message: string) => void): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

/** Subscribes a component to a slice of content. Selectors should return stored references. */
export function useContent<T>(selector: (c: AppContent) => T): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const getSnapshot = useCallback(() => selectorRef.current(content), []);
  return useSyncExternalStore(subscribeContent, getSnapshot, getSnapshot);
}

// --- Preferences (per device) ------------------------------------------------

function loadPrefs(): Preferences {
  const raw = storage?.getItem(PREFS_KEY);
  if (!raw) return { ...defaultPreferences };
  try {
    return normalizePreferences(JSON.parse(raw));
  } catch {
    return { ...defaultPreferences };
  }
}

let prefs: Preferences = loadPrefs();
const prefListeners = new Set<() => void>();

export function getPrefs(): Preferences {
  return prefs;
}

export function updatePrefs(patch: Partial<Preferences>) {
  prefs = { ...prefs, ...patch };
  prefListeners.forEach((listener) => listener());
  try {
    storage?.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Preferences are a convenience; losing one is harmless.
  }
}

function subscribePrefs(listener: () => void) {
  prefListeners.add(listener);
  return () => prefListeners.delete(listener);
}

export function usePrefs(): Preferences {
  return useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
}

export function resetAllLocalData() {
  adapter.clear();
  storage?.removeItem(PREFS_KEY);
  content = createDefaultContent();
  prefs = { ...defaultPreferences };
  contentListeners.forEach((listener) => listener());
  prefListeners.forEach((listener) => listener());
  flushContent();
}
