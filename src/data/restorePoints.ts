import { useSyncExternalStore } from 'react';
import type { AppContent, MediaSource } from './types';
import { normalizeContent } from './normalize';
import { getContent, onBeforeReplace, onContentChanged } from './store';
import {
  getHerPrivate,
  normalizeHerPrivate,
  onHerPrivateChanged,
  type HerPrivate,
} from './herPrivate';

/**
 * Restore points: copies of all our words, lists and photo references that
 * this phone keeps by itself, automatically — every hour while we're busy,
 * once a day, and always right before something replaces everything at once
 * (the other phone's changes, a backup being put back). Whatever goes wrong,
 * there is a recent copy to bring things back from.
 *
 * They live in their own IndexedDB database on this phone, apart from the
 * live content, and the photos they point at are never tidied away.
 */

export interface RestorePoint {
  id: string;
  at: string;
  reason: string;
  summary: string;
  /** How much it holds, to compare at a glance. */
  counts: Record<string, number>;
  content: string;
  /**
   * Her private things ("alleen voor mij"), only on her own phone. They stay
   * on that phone: restore points never leave it.
   */
  herPrivate?: string;
}

export type RestorePointInfo = Omit<RestorePoint, 'content' | 'herPrivate'> & {
  hasPrivate: boolean;
};

const DB_NAME = 'our-little-universe-history';
const STORE = 'points';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Every snapshot of the last two days, then one a day for three months. */
const KEEP_ALL_FOR = 2 * DAY;
const KEEP_DAILY_FOR = 90 * DAY;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Geen opslag voor herstelpunten in deze browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Herstelpunten openen lukte niet.'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error ?? new Error('Fout bij de herstelpunten.'));
        tx.onabort = () => reject(tx.error ?? new Error('Herstelpunten onderbroken.'));
      }),
  );
}

/* --------------------------------------------------------------- counting */

const plural = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;

function mediaIn(c: AppContent): MediaSource[] {
  return [
    ...c.milestones.flatMap((m) => m.media),
    ...c.memories.map((m) => m.media),
    ...c.dreams.flatMap((d) => (d.media ? [d.media] : [])),
    ...(c.coco.portrait ? [c.coco.portrait] : []),
    ...c.her.bucket.flatMap((b) => (b.media ? [b.media] : [])),
    ...c.museum.stops.flatMap((s) => s.media),
  ];
}

/** Singular and plural for each kind of thing we count. */
export const KINDS: Record<string, [string, string]> = {
  hoofdstukken: ['hoofdstuk', 'hoofdstukken'],
  herinneringen: ['herinnering', 'herinneringen'],
  brieven: ['brief', 'brieven'],
  dromen: ['droom', 'dromen'],
  haltes: ['halte', 'haltes'],
  "foto's": ['foto', "foto's"],
  briefjes: ['briefje', 'briefjes'],
  lijstjes: ['lijstje-item', 'lijstje-items'],
};

export const describeCount = (kind: string, n: number) =>
  plural(n, ...(KINDS[kind] ?? [kind, kind]));

export function countContent(c: AppContent): Record<string, number> {
  return {
    hoofdstukken: c.milestones.length,
    herinneringen: c.memories.length,
    brieven: c.letters.length,
    dromen: c.dreams.length,
    haltes: c.museum.stops.length,
    "foto's": mediaIn(c).filter((m) => m.type === 'local').length,
    briefjes: c.her.notes.length,
    lijstjes: c.lists.reduce((n, l) => n + l.items.length, 0),
  };
}

function summarize(counts: Record<string, number>): string {
  return [
    plural(counts["foto's"], 'foto', "foto's"),
    plural(counts.brieven, 'brief', 'brieven'),
    plural(counts.herinneringen, 'herinnering', 'herinneringen'),
    plural(counts.haltes, 'halte', 'haltes'),
  ].join(' · ');
}

/* ---------------------------------------------------------------- saving */

let lastSaved = '';
let lastAt = 0;
const listeners = new Set<() => void>();
let version = 0;
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Takes a restore point now (skipped when nothing changed since the last). */
const privateJson = (): string | undefined => {
  const mine = getHerPrivate();
  return mine.journal.length || mine.bucket.length || mine.goals.length
    ? JSON.stringify(mine)
    : undefined;
};

export async function takeRestorePoint(reason: string, from: AppContent = getContent()) {
  const herPrivate = privateJson();
  const json = JSON.stringify(from);
  if (json + (herPrivate ?? '') === lastSaved) return;
  const counts = countContent(from);
  const point: RestorePoint = {
    id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    reason,
    summary: summarize(counts),
    counts,
    content: json,
    herPrivate,
  };
  try {
    await run('readwrite', (s) => s.put(point));
    lastSaved = json + (herPrivate ?? '');
    lastAt = Date.now();
    bump();
    await prune();
  } catch {
    // A full disk or blocked storage: the live content is untouched.
  }
}

async function prune() {
  const points = await listRestorePoints();
  const now = Date.now();
  const keptDays = new Set<string>();
  const drop: string[] = [];
  // Newest first: keep everything recent, then the newest point of each day.
  for (const p of points) {
    const age = now - Date.parse(p.at);
    if (age <= KEEP_ALL_FOR) continue;
    const day = p.at.slice(0, 10);
    if (age <= KEEP_DAILY_FOR && !keptDays.has(day)) {
      keptDays.add(day);
      continue;
    }
    drop.push(p.id);
  }
  // Even within two days, no more than 60 points.
  const recent = points.filter((p) => now - Date.parse(p.at) <= KEEP_ALL_FOR);
  recent.slice(60).forEach((p) => drop.push(p.id));
  for (const id of drop) await run('readwrite', (s) => s.delete(id));
  if (drop.length) bump();
}

export async function listRestorePoints(): Promise<RestorePointInfo[]> {
  const all = await run<RestorePoint[]>('readonly', (s) => s.getAll());
  return all
    .map(({ content: _content, herPrivate, ...info }) => ({
      ...info,
      hasPrivate: Boolean(herPrivate),
    }))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function readRestorePoint(id: string): Promise<AppContent | null> {
  const point = await run<RestorePoint | undefined>('readonly', (s) => s.get(id));
  if (!point) return null;
  try {
    return normalizeContent(JSON.parse(point.content));
  } catch {
    return null;
  }
}

export async function readRestorePointPrivate(id: string): Promise<HerPrivate | null> {
  const point = await run<RestorePoint | undefined>('readonly', (s) => s.get(id));
  if (!point?.herPrivate) return null;
  try {
    return normalizeHerPrivate(JSON.parse(point.herPrivate));
  } catch {
    return null;
  }
}

/** How many of her private things are in `old` but not here now. */
export function privateMissing(now: HerPrivate, old: HerPrivate): number {
  return (['journal', 'bucket', 'goals'] as const).reduce(
    (n, kind) => n + old[kind].filter((o) => !now[kind].some((c) => c.id === o.id)).length,
    0,
  );
}

/** Photos any restore point still points at: those are never tidied away. */
export async function restorePointMediaIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const all = await run<RestorePoint[]>('readonly', (s) => s.getAll());
  for (const p of all) {
    for (const match of `${p.content}${p.herPrivate ?? ''}`.matchAll(/"mediaId":"([^"]+)"/g))
      ids.add(match[1]);
  }
  return ids;
}

export function useRestorePointsVersion(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
    () => version,
  );
}

/* ------------------------------------------------------ bringing it back */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const hasIds = (v: unknown): v is Obj[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => isObj(x) && typeof x.id === 'string');
const key = (v: unknown) => JSON.stringify(v);

/**
 * Brings back from an older copy everything that's missing now — deleted
 * letters, lost photos, removed stops — without undoing or overwriting
 * anything that changed since. Nothing is ever removed.
 */
export function addMissing<T>(current: T, old: T): T {
  if (Array.isArray(current) && Array.isArray(old)) {
    if (hasIds(old) || hasIds(current)) {
      const now = current as Obj[];
      const byId = new Map(now.map((x) => [x.id as string, x]));
      const result: Obj[] = now.map((item) => {
        const before = (old as Obj[]).find((o) => o.id === item.id);
        return before ? addMissing(item, before) : item;
      });
      (old as Obj[]).forEach((item, index) => {
        if (byId.has(item.id as string)) return;
        // Put it back near where it was.
        const prev = (old as Obj[])[index - 1];
        const at = prev ? result.findIndex((r) => r.id === prev.id) + 1 : 0;
        result.splice(at > 0 ? at : Math.min(index, result.length), 0, item);
      });
      return result as T;
    }
    // Lists of photos: bring back the ones that went missing.
    const media = old.filter(
      (m) => isObj(m) && m.type === 'local' && !current.some((c) => key(c) === key(m)),
    );
    return (media.length ? [...current, ...media] : current) as T;
  }
  if (isObj(current) && isObj(old)) {
    const out: Obj = { ...current };
    for (const k of Object.keys(old)) {
      if (k in current) out[k] = addMissing(current[k], old[k]);
    }
    return out as T;
  }
  return current;
}

/** What `addMissing` would bring back, per kind. */
export function whatsMissing(current: AppContent, old: AppContent): Record<string, number> {
  const merged = addMissing(current, old);
  const a = countContent(current);
  const b = countContent(merged);
  return Object.fromEntries(
    Object.keys(b)
      .map((k) => [k, b[k] - a[k]] as const)
      .filter(([, n]) => n > 0),
  );
}

/* ------------------------------------------------------------ automatic */

let installed = false;

/**
 * Starts the automatic restore points: one at start-up, one every hour while
 * things change, and one right before anything replaces everything at once.
 */
export function installRestorePoints() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  void takeRestorePoint('Bij het openen');
  const hourly = () => {
    if (Date.now() - lastAt > HOUR) void takeRestorePoint('Automatisch (elk uur)');
  };
  // Whenever something disappears here (a letter deleted, samples removed…),
  // keep the copy from just before — even if it was written a minute ago.
  let previous = getContent();
  let previousCounts = countContent(previous);
  onContentChanged((source) => {
    const now = getContent();
    const counts = countContent(now);
    const lost = Object.keys(counts).some((k) => counts[k] < previousCounts[k]);
    if (lost && source === 'local') {
      void takeRestorePoint('Vlak voordat er iets werd weggehaald', previous);
    } else {
      hourly();
    }
    previous = now;
    previousCounts = counts;
  });
  onHerPrivateChanged(hourly);
  onBeforeReplace((current, next, source) => {
    if (source !== 'remote') {
      void takeRestorePoint('Vlak voor het terugzetten', current);
      return;
    }
    // From the other phone: keep a copy whenever something would disappear.
    const now = countContent(current);
    const after = countContent(next);
    if (Object.keys(now).some((k) => after[k] < now[k])) {
      void takeRestorePoint('Vlak voordat de andere telefoon iets weghaalde', current);
    } else if (Date.now() - lastAt > HOUR) {
      void takeRestorePoint('Automatisch (elk uur)', current);
    }
  });
}
