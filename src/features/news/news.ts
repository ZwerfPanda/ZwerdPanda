import { useSyncExternalStore } from 'react';
import { CHANGELOG, unseenChanges, type ChangeEntry } from '../../data/changelog';

/**
 * Which updates this phone has seen, so "Wat is er nieuw?" shows up once after
 * each update. Kept per device: it's only about what this screen has shown.
 */

const KEY = 'olu:news-seen:v1';
const listeners = new Set<() => void>();

function readSeen(): string | null {
  try {
    const seen = localStorage.getItem(KEY);
    if (seen !== null) return seen;
    // A phone that's new to the app has nothing to catch up on.
    if (localStorage.getItem('olu:content:v1') === null && CHANGELOG[0]) {
      localStorage.setItem(KEY, CHANGELOG[0].id);
      return CHANGELOG[0].id;
    }
    return null;
  } catch {
    return CHANGELOG[0]?.id ?? null;
  }
}

let seen: string | null = typeof window !== 'undefined' ? readSeen() : null;
/** Opened by hand from the menu: everything, newest first. */
let browsing = false;
let version = 0;

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

export function markNewsSeen() {
  seen = CHANGELOG[0]?.id ?? seen;
  browsing = false;
  try {
    if (seen) localStorage.setItem(KEY, seen);
  } catch {
    // Storage blocked: it may show once more next time.
  }
  emit();
}

export function openNews() {
  browsing = true;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useNews(): { entries: ChangeEntry[]; browsing: boolean } {
  useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
  return browsing
    ? { entries: CHANGELOG, browsing: true }
    : { entries: unseenChanges(seen), browsing: false };
}
