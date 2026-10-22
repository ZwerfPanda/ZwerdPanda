import type { AppContent } from '../data/types';

/**
 * Merging two people's edits.
 *
 * `base` is the last copy both devices agreed on, `local` is this device now,
 * `remote` is what the other device saved meanwhile. Items are matched by id,
 * so both of you can add, edit and delete different things at the same time
 * and nothing is lost. If you both edited the very same item, this device's
 * version wins (it's the one being saved right now).
 */

type WithId = { id: string };

/** Key-order independent equality (the database doesn't keep JSON key order). */
export function stableEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

function byId<T extends WithId>(list: T[]): Map<string, T> {
  return new Map(list.map((item) => [item.id, item]));
}

function resolveItem<T>(
  base: T | undefined,
  local: T | undefined,
  remote: T | undefined,
): T | undefined {
  if (local !== undefined && remote !== undefined) {
    if (stableEqual(local, remote)) return local;
    if (base !== undefined && stableEqual(local, base)) return remote; // only they changed it
    return local; // only we changed it, or both did (we win)
  }
  if (local !== undefined) {
    if (base === undefined) return local; // we added it
    return stableEqual(local, base) ? undefined : local; // they deleted it (keep it if we edited it)
  }
  if (remote !== undefined) {
    if (base === undefined) return remote; // they added it
    return stableEqual(remote, base) ? undefined : remote; // we deleted it (keep it if they edited it)
  }
  return undefined;
}

/** Did `next` keep the relative order of the items it shares with `prev`? */
function sameOrder<T extends WithId>(prev: T[], next: T[]): boolean {
  const nextIds = new Set(next.map((i) => i.id));
  const prevIds = new Set(prev.map((i) => i.id));
  const a = prev.filter((i) => nextIds.has(i.id)).map((i) => i.id);
  const b = next.filter((i) => prevIds.has(i.id)).map((i) => i.id);
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function mergeList<T extends WithId>(base: T[], local: T[], remote: T[]): T[] {
  const B = byId(base);
  const L = byId(local);
  const R = byId(remote);
  const kept = new Map<string, T>();
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const value = resolveItem(B.get(id), L.get(id), R.get(id));
    if (value !== undefined) kept.set(id, value);
  }

  // Keep whoever's reordering happened; if they didn't reorder, ours stands.
  const primary = sameOrder(base, remote) ? local : remote;
  const secondary = primary === local ? remote : local;
  const result: T[] = [];
  const placed = new Set<string>();
  for (const item of primary) {
    const value = kept.get(item.id);
    if (value && !placed.has(item.id)) {
      result.push(value);
      placed.add(item.id);
    }
  }
  // Items only the other side has go right after their neighbour there.
  secondary.forEach((item, index) => {
    const value = kept.get(item.id);
    if (!value || placed.has(item.id)) return;
    let position = 0;
    for (let j = index - 1; j >= 0; j--) {
      const at = result.findIndex((r) => r.id === secondary[j].id);
      if (at >= 0) {
        position = at + 1;
        break;
      }
    }
    result.splice(position, 0, value);
    placed.add(item.id);
  });
  return result;
}

/** Field by field: take ours where we changed it, theirs otherwise. */
function mergeFields<T extends object>(base: T, local: T, remote: T): T {
  const out = { ...remote } as Record<string, unknown>;
  const b = base as Record<string, unknown>;
  const l = local as Record<string, unknown>;
  for (const key of new Set([...Object.keys(l), ...Object.keys(b)])) {
    if (!stableEqual(l[key], b[key])) out[key] = l[key];
  }
  return out as T;
}

export function mergeContent(base: AppContent, local: AppContent, remote: AppContent): AppContent {
  return {
    version: 1,
    profile: mergeFields(base.profile, local.profile, remote.profile),
    milestones: mergeList(base.milestones, local.milestones, remote.milestones),
    albums: mergeList(base.albums, local.albums, remote.albums),
    memories: mergeList(base.memories, local.memories, remote.memories),
    letters: mergeList(base.letters, local.letters, remote.letters),
    dreams: mergeList(base.dreams, local.dreams, remote.dreams),
    capsules: mergeList(base.capsules, local.capsules, remote.capsules),
    songs: mergeList(base.songs, local.songs, remote.songs),
    surprises: {
      ...mergeFields(base.surprises, local.surprises, remote.surprises),
      stars: mergeList(base.surprises.stars, local.surprises.stars, remote.surprises.stars),
    },
    coco: {
      ...mergeFields(base.coco, local.coco, remote.coco),
      facts: mergeList(base.coco.facts, local.coco.facts, remote.coco.facts),
      notes: mergeList(base.coco.notes, local.coco.notes, remote.coco.notes),
    },
  };
}

/**
 * A device joining the shared universe for the first time: the shared copy
 * wins, and anything this device created itself (not starter samples) is
 * added on top so nothing written before connecting is lost.
 */
export function mergeFirstJoin(local: AppContent, remote: AppContent): AppContent {
  const add = <T extends WithId & { isSample?: boolean }>(mine: T[], shared: T[]): T[] => {
    const ids = new Set(shared.map((i) => i.id));
    const extra = mine.filter((i) => !i.isSample && !ids.has(i.id));
    return [...extra, ...shared];
  };
  const addPlain = <T extends WithId>(mine: T[], shared: T[]): T[] => {
    const ids = new Set(shared.map((i) => i.id));
    return [...shared, ...mine.filter((i) => !ids.has(i.id))];
  };
  return {
    ...remote,
    milestones: (() => {
      const ids = new Set(remote.milestones.map((m) => m.id));
      const extra = local.milestones.filter((m) => !m.isSample && !ids.has(m.id));
      const futureAt = remote.milestones.findIndex((m) => m.future);
      const list = remote.milestones.slice();
      list.splice(futureAt >= 0 ? futureAt : list.length, 0, ...extra);
      return list;
    })(),
    albums: addPlain(local.albums, remote.albums),
    memories: add(local.memories, remote.memories),
    letters: add(local.letters, remote.letters),
    dreams: add(local.dreams, remote.dreams),
    capsules: addPlain(local.capsules, remote.capsules),
    songs: addPlain(local.songs, remote.songs),
    coco: { ...remote.coco, notes: addPlain(local.coco.notes, remote.coco.notes) },
  };
}

/** Every photo/clip id the content points at. */
export function contentMediaIds(content: AppContent): string[] {
  const ids = new Set<string>();
  const add = (source: { type: string; mediaId?: string } | undefined) => {
    if (source?.type === 'local' && source.mediaId) ids.add(source.mediaId);
  };
  content.milestones.forEach((m) => m.media.forEach(add));
  content.memories.forEach((m) => add(m.media));
  content.dreams.forEach((d) => add(d.media));
  add(content.coco.portrait);
  return [...ids];
}
