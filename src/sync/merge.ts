import { CHAT_LIMIT, PET_LOG_LIMIT } from '../data/normalize';
import type { AppContent, CocoPet, HerSpace, OurList, StarHunt, UsContent } from '../data/types';

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

const earliest = (a: string | undefined, b: string | undefined) =>
  !a ? b : !b ? a : a < b ? a : b;

const later = (a: string | undefined, b: string | undefined) => (!a ? b : !b ? a : a > b ? a : b);

/** Both sides' increments count (two people feeding Coco both earn love). */
const addUp = (base: number, local: number, remote: number) =>
  Math.max(0, base + (local - base) + (remote - base));

/**
 * Coco's care: the most recent time wins for "last fed/cuddled/…", counters
 * add both people's progress, and the care log keeps everyone's entries.
 */
export function mergePet(base: CocoPet, local: CocoPet, remote: CocoPet): CocoPet {
  const fields = mergeFields(base, local, remote);
  const tricks: CocoPet['tricks'] = {};
  const names = new Set([
    ...Object.keys(base.tricks),
    ...Object.keys(local.tricks),
    ...Object.keys(remote.tricks),
  ]) as Set<keyof CocoPet['tricks']>;
  for (const trick of names) {
    const value = addUp(
      base.tricks[trick] ?? 0,
      local.tricks[trick] ?? 0,
      remote.tricks[trick] ?? 0,
    );
    tricks[trick] = Math.min(100, value);
  }
  const treats =
    local.treats.date === remote.treats.date
      ? {
          date: local.treats.date,
          count: addUp(
            base.treats.date === local.treats.date ? base.treats.count : 0,
            local.treats.count,
            remote.treats.count,
          ),
        }
      : local.treats.date > remote.treats.date
        ? local.treats
        : remote.treats;
  return {
    ...fields,
    fedAt: later(local.fedAt, remote.fedAt),
    hayAt: later(local.hayAt, remote.hayAt),
    pettedAt: later(local.pettedAt, remote.pettedAt),
    playedAt: later(local.playedAt, remote.playedAt),
    groomedAt: later(local.groomedAt, remote.groomedAt),
    treats,
    bond: addUp(base.bond, local.bond, remote.bond),
    tricks,
    log: mergeList(base.log, local.log, remote.log)
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, PET_LOG_LIMIT),
  };
}

/** Lists: the lists themselves by id, and the items inside each list by id too. */
export function mergeLists(base: OurList[], local: OurList[], remote: OurList[]): OurList[] {
  const strip = (l: OurList) => ({ ...l, items: [] });
  const merged = mergeList(base.map(strip), local.map(strip), remote.map(strip));
  const find = (all: OurList[], id: string) => all.find((l) => l.id === id)?.items ?? [];
  return merged.map((l) => ({
    ...l,
    items: mergeList(find(base, l.id), find(local, l.id), find(remote, l.id)),
  }));
}

export function mergeUs(base: UsContent, local: UsContent, remote: UsContent): UsContent {
  return {
    you: mergeFields(base.you, local.you, remote.you),
    partner: mergeFields(base.partner, local.partner, remote.partner),
    petNames: mergeList(base.petNames, local.petNames, remote.petNames),
    chat: mergeList(base.chat, local.chat, remote.chat)
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, CHAT_LIMIT),
  };
}

/** Her corner: her settings field by field, and her things item by item. */
export function mergeHer(base: HerSpace, local: HerSpace, remote: HerSpace): HerSpace {
  return {
    ...mergeFields(base, local, remote),
    journal: mergeList(base.journal, local.journal, remote.journal),
    bucket: mergeList(base.bucket, local.bucket, remote.bucket),
    goals: mergeList(base.goals, local.goals, remote.goals),
    music: mergeList(base.music, local.music, remote.music),
    notes: mergeList(base.notes, local.notes, remote.notes),
  };
}

/** A star found on either phone stays found (the earliest find counts). */
export function mergeHunt(base: StarHunt, local: StarHunt, remote: StarHunt): StarHunt {
  const found = { ...remote.found };
  for (const [star, find] of Object.entries(local.found)) {
    if (!found[star] || find.at < found[star].at) found[star] = find;
  }
  return { found, reward: mergeFields(base, local, remote).reward };
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
    playlists: mergeList(base.playlists, local.playlists, remote.playlists),
    surprises: {
      ...mergeFields(base.surprises, local.surprises, remote.surprises),
      stars: mergeList(base.surprises.stars, local.surprises.stars, remote.surprises.stars),
    },
    coco: {
      ...mergeFields(base.coco, local.coco, remote.coco),
      facts: mergeList(base.coco.facts, local.coco.facts, remote.coco.facts),
      notes: mergeList(base.coco.notes, local.coco.notes, remote.coco.notes),
    },
    pet: mergePet(base.pet, local.pet, remote.pet),
    countdowns: mergeList(base.countdowns, local.countdowns, remote.countdowns),
    welcome: mergeFields(base.welcome, local.welcome, remote.welcome),
    lists: mergeLists(base.lists, local.lists, remote.lists),
    us: mergeUs(base.us, local.us, remote.us),
    her: mergeHer(base.her, local.her, remote.her),
    hunt: mergeHunt(base.hunt, local.hunt, remote.hunt),
    museum: {
      stops: mergeList(base.museum.stops, local.museum.stops, remote.museum.stops),
      foundAt: earliest(local.museum.foundAt, remote.museum.foundAt),
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
    playlists: addPlain(local.playlists, remote.playlists),
    coco: { ...remote.coco, notes: addPlain(local.coco.notes, remote.coco.notes) },
    countdowns: addPlain(local.countdowns, remote.countdowns),
    hunt: mergeHunt(remote.hunt, local.hunt, remote.hunt),
    museum: {
      stops: addPlain(local.museum.stops, remote.museum.stops),
      foundAt: earliest(local.museum.foundAt, remote.museum.foundAt),
    },
    her: {
      ...remote.her,
      journal: addPlain(local.her.journal, remote.her.journal),
      bucket: addPlain(local.her.bucket, remote.her.bucket),
      goals: addPlain(local.her.goals, remote.her.goals),
      music: addPlain(local.her.music, remote.her.music),
      notes: addPlain(local.her.notes, remote.her.notes),
    },
    lists: addPlain(
      local.lists.filter((l) => l.items.length > 0 || !remote.lists.some((r) => r.id === l.id)),
      remote.lists,
    ),
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
  content.her.bucket.forEach((b) => add(b.media));
  content.museum.stops.forEach((s) => s.media.forEach(add));
  return [...ids];
}
