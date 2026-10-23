import { useSyncExternalStore } from 'react';
import type { BucketItem, Goal, JournalEntry } from './types';
import { normalizeBucketItem, normalizeGoal, normalizeJournalEntry } from './normalize';

/**
 * Her private things: journal pages, wishes and goals she marks "alleen voor
 * mij". They are kept apart from our content on purpose — never synced, never
 * part of the shared universe — so they exist only on the phone she wrote
 * them on (and in a backup she makes there herself).
 */

export interface HerPrivate {
  journal: JournalEntry[];
  bucket: BucketItem[];
  goals: Goal[];
}

const KEY = 'olu:her-private:v1';
const EMPTY: HerPrivate = { journal: [], bucket: [], goals: [] };
const listeners = new Set<() => void>();

function list<T>(v: unknown, fn: (item: unknown, i: number) => T | null): T[] {
  return Array.isArray(v) ? v.map(fn).filter((x): x is T => x !== null) : [];
}

export function normalizeHerPrivate(raw: unknown): HerPrivate {
  if (typeof raw !== 'object' || raw === null) return { ...EMPTY };
  const r = raw as Record<string, unknown>;
  const mark = <T extends { private?: boolean }>(items: T[]) =>
    items.map((i) => ({ ...i, private: true }));
  return {
    journal: mark(list(r.journal, normalizeJournalEntry)),
    bucket: mark(list(r.bucket, normalizeBucketItem)),
    goals: mark(list(r.goals, normalizeGoal)),
  };
}

function load(): HerPrivate {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalizeHerPrivate(JSON.parse(raw)) : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

let state: HerPrivate = typeof window !== 'undefined' ? load() : { ...EMPTY };

export function getHerPrivate(): HerPrivate {
  return state;
}

/** Calls back whenever her private things change on this phone. */
export function onHerPrivateChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateHerPrivate(recipe: (current: HerPrivate) => HerPrivate) {
  state = recipe(state);
  listeners.forEach((l) => l());
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked; the page says so where storage is shown.
  }
}

export function clearHerPrivate() {
  state = { ...EMPTY };
  listeners.forEach((l) => l());
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

export function useHerPrivate(): HerPrivate {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}
