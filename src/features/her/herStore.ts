import { useSyncExternalStore } from 'react';
import { getContent, updateContent, useContent } from '../../data/store';
import {
  getHerPrivate,
  normalizeHerPrivate,
  updateHerPrivate,
  useHerPrivate,
  type HerPrivate,
} from '../../data/herPrivate';
import { normalizeHer } from '../../data/normalize';
import type { HerSpace } from '../../data/types';

/**
 * Her corner, as the page sees it. Normally that is the real thing: the
 * shared part of our content plus her private things on her phone.
 *
 * On his phone there is also a quiet "try it as her" mode, so he can check
 * that everything in her corner works. It runs on a copy kept only on his
 * phone: nothing in it syncs, nothing reaches her, and her private things are
 * never in it (they only exist on her phone). Stopping it throws the copy away.
 */

interface Sandbox {
  her: HerSpace;
  private: HerPrivate;
}

const KEY = 'olu:her-test:v1';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): Sandbox | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Sandbox>;
    return { her: normalizeHer(parsed.her), private: normalizeHerPrivate(parsed.private) };
  } catch {
    return null;
  }
}

let sandbox: Sandbox | null = typeof window !== 'undefined' ? load() : null;

function persist() {
  try {
    if (sandbox) localStorage.setItem(KEY, JSON.stringify(sandbox));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage full or blocked; the test copy then lasts until reload.
  }
}

function setSandbox(next: Sandbox | null) {
  sandbox = next;
  persist();
  emit();
}

const freshCopy = (): Sandbox => ({
  her: normalizeHer(JSON.parse(JSON.stringify(getContent().her))),
  private: normalizeHerPrivate({}),
});

export function startHerTest() {
  setSandbox(freshCopy());
}

export function resetHerTest() {
  if (sandbox) setSandbox(freshCopy());
}

export function stopHerTest() {
  setSandbox(null);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => sandbox;

/** True while he is trying her corner as her, on his phone. */
export function useHerTest(): boolean {
  return useSyncExternalStore(subscribe, snapshot, snapshot) !== null;
}

/** Read part of her corner, from the test copy while testing. */
export function useHer<T>(select: (her: HerSpace) => T): T {
  const real = useContent((c) => select(c.her));
  const test = useSyncExternalStore(subscribe, snapshot, snapshot);
  return test ? select(test.her) : real;
}

export function getHer(): HerSpace {
  return sandbox ? sandbox.her : getContent().her;
}

export function updateHerSpace(recipe: (her: HerSpace) => HerSpace) {
  if (sandbox) {
    const her = recipe(sandbox.her);
    if (her !== sandbox.her) setSandbox({ ...sandbox, her });
    return;
  }
  updateContent((c) => {
    const her = recipe(c.her);
    return her === c.her ? c : { ...c, her };
  });
}

export function useHerPrivateItems(): HerPrivate {
  const real = useHerPrivate();
  const test = useSyncExternalStore(subscribe, snapshot, snapshot);
  return test ? test.private : real;
}

export function getHerPrivateItems(): HerPrivate {
  return sandbox ? sandbox.private : getHerPrivate();
}

export function updateHerPrivateItems(recipe: (current: HerPrivate) => HerPrivate) {
  if (sandbox) setSandbox({ ...sandbox, private: recipe(sandbox.private) });
  else updateHerPrivate(recipe);
}
