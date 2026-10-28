import { CARE_DAYS_LIMIT, CHAT_LIMIT, PET_LOG_LIMIT } from '../data/normalize';
import { CONTENT_SCHEMA, createDefaultContent } from '../data/defaults';
import { pickArchive } from '../data/archive';
import type {
  AppContent,
  GamesArchive,
  CocoPet,
  GameId,
  MatchKind,
  VaultLock,
  HerSpace,
  OurList,
  StarHunt,
  UsContent,
} from '../data/types';

/**
 * Merging two people's edits.
 *
 * `base` is the last copy both devices agreed on, `local` is this device now,
 * `remote` is what the other device saved meanwhile. Items are matched by id,
 * so both of you can add, edit and delete different things at the same time
 * and nothing is lost. If you both edited the very same item, it is merged
 * field by field: each of your changes stays, photos added on either phone
 * are kept, and only where you both changed the same field does this
 * device's version win (it's the one being saved right now).
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
    if (base !== undefined && stableEqual(remote, base)) return local; // only we changed it
    return mergeItem(base, local, remote); // both did: keep both sets of changes
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

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * A list of photos changed on both phones: keep what either added, drop what
 * either removed (a three-way set merge, in this device's order).
 */
function mergeMedia(base: unknown[], local: unknown[], remote: unknown[]): unknown[] {
  const key = stableStringify;
  const b = new Set(base.map(key));
  const l = new Set(local.map(key));
  const r = new Set(remote.map(key));
  const keep = (k: string) => (b.has(k) ? l.has(k) && r.has(k) : l.has(k) || r.has(k));
  const out: unknown[] = [];
  const seen = new Set<string>();
  for (const m of [...local, ...remote]) {
    const k = key(m);
    if (!seen.has(k) && keep(k)) {
      out.push(m);
      seen.add(k);
    }
  }
  return out;
}

/**
 * The same item edited on both phones: take each side's changes field by
 * field, keep photos from both, and let this device win only where both
 * changed the same field.
 */
function mergeItem<T>(base: T | undefined, local: T, remote: T): T {
  if (!isObject(local) || !isObject(remote)) return local;
  const b: Record<string, unknown> = isObject(base) ? base : {};
  const out: Record<string, unknown> = { ...remote };
  for (const k of new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(b)])) {
    const lv = local[k];
    const rv = remote[k];
    const bv = b[k];
    const weChanged = !stableEqual(lv, bv);
    const theyChanged = !stableEqual(rv, bv);
    if (k === 'media' && Array.isArray(lv) && Array.isArray(rv) && weChanged && theyChanged) {
      out[k] = mergeMedia(Array.isArray(bv) ? bv : [], lv, rv);
    } else if (weChanged || !theyChanged) {
      out[k] = lv;
    }
  }
  return out as T;
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
    cleanedAt: later(local.cleanedAt, remote.cleanedAt),
    treats,
    bond: addUp(base.bond, local.bond, remote.bond),
    manners: Math.min(100, addUp(base.manners, local.manners, remote.manners)),
    handled: [...new Set([...local.handled, ...remote.handled])].slice(-40),
    // What one of us put in her room stays in it.
    decor: [...new Set([...local.decor, ...remote.decor])],
    tricks,
    log: mergeList(base.log, local.log, remote.log)
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, PET_LOG_LIMIT),
    // A day either of us cared for her stays a care day.
    careDays: [...new Set([...local.careDays, ...remote.careDays])].sort().slice(-CARE_DAYS_LIMIT),
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
    ideas: mergeList(base.ideas, local.ideas, remote.ideas),
    // Her saved sets and his hearts on them merge per set, so neither undoes the other.
    nails: {
      current: mergeFields(base, local, remote).nails.current,
      saved: mergeList(base.nails.saved, local.nails.saved, remote.nails.saved),
      sent: mergeList(base.nails.sent ?? [], local.nails.sent ?? [], remote.nails.sent ?? []),
    },
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
    schema: CONTENT_SCHEMA,
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
    games: {
      matches: mergeList(base.games.matches, local.games.matches, remote.games.matches),
      scores: mergeList(base.games.scores, local.games.scores, remote.games.scores),
      results: mergeList(base.games.results, local.games.results, remote.games.results),
      ...withArchive(pickArchive(local.games.archive, remote.games.archive)),
    },
    studio: {
      records: mergeList(base.studio.records, local.studio.records, remote.studio.records),
      listens: mergeList(base.studio.listens, local.studio.listens, remote.studio.listens),
    },
    karaoke: {
      songs: mergeList(base.karaoke.songs, local.karaoke.songs, remote.karaoke.songs),
      takes: mergeList(base.karaoke.takes, local.karaoke.takes, remote.karaoke.takes),
    },
    quiz: {
      custom: mergeList(base.quiz.custom, local.quiz.custom, remote.quiz.custom),
      answers: mergeList(base.quiz.answers, local.quiz.answers, remote.quiz.answers),
    },
    museum: {
      stops: mergeList(base.museum.stops, local.museum.stops, remote.museum.stops),
      foundAt: earliest(local.museum.foundAt, remote.museum.foundAt),
    },
    syncReports: {
      you: newest(local.syncReports.you, remote.syncReports.you),
      partner: newest(local.syncReports.partner, remote.syncReports.partner),
    },
    flowers: mergeList(base.flowers, local.flowers, remote.flowers),
    coupons: mergeList(base.coupons, local.coupons, remote.coupons),
    pings: mergeList(base.pings, local.pings, remote.pings).slice(-60),
    daily: mergeList(base.daily, local.daily, remote.daily),
    datePlans: mergeList(base.datePlans, local.datePlans, remote.datePlans),
    agenda: mergeList(base.agenda, local.agenda, remote.agenda),
    cinema: {
      films: mergeList(base.cinema.films, local.cinema.films, remote.cinema.films),
      ratings: mergeList(base.cinema.ratings, local.cinema.ratings, remote.cinema.ratings),
      nights: mergeList(base.cinema.nights, local.cinema.nights, remote.cinema.nights),
    },
    texts: mergeList(base.texts, local.texts, remote.texts),
    vault: {
      // The lock is set once; whichever phone set it first keeps it.
      lock: earliestLock(local.vault.lock, remote.vault.lock),
      items: mergeList(base.vault.items, local.vault.items, remote.vault.items),
      categories: mergeList(base.vault.categories, local.vault.categories, remote.vault.categories),
    },
  };
}

const earliestLock = (a?: VaultLock, b?: VaultLock) =>
  !a ? b : !b ? a : a.createdAt <= b.createdAt ? a : b;

/** The more recent of two reports (each phone only writes its own). */
function newest<T extends { at: string }>(a?: T, b?: T): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return a.at >= b.at ? a : b;
}

/**
 * A device joining the shared universe for the first time: the shared copy
 * wins, and anything this device created itself (not starter samples) is
 * added on top so nothing written before connecting is lost.
 */
export function mergeFirstJoin(
  local: AppContent,
  remote: AppContent,
  starter: AppContent = createDefaultContent(),
): AppContent {
  // An item both phones have (a starter stop, a starter chapter…): merge what
  // each did to it since it was new, so photos added before connecting stay.
  const both = <T extends WithId>(mine: T[], shared: T[], start: T[] = []): T[] => {
    const L = byId(mine);
    const S = byId(start);
    return shared.map((item) => {
      const l = L.get(item.id);
      return l ? (resolveItem(S.get(item.id), l, item) ?? item) : item;
    });
  };
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
      const list = both(local.milestones, remote.milestones, starter.milestones);
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
    games: {
      matches: addPlain(local.games.matches, remote.games.matches),
      scores: addPlain(local.games.scores, remote.games.scores),
      results: addPlain(local.games.results, remote.games.results),
      ...withArchive(pickArchive(local.games.archive, remote.games.archive)),
    },
    studio: {
      records: addPlain(local.studio.records, remote.studio.records),
      listens: addPlain(local.studio.listens, remote.studio.listens),
    },
    karaoke: {
      songs: addPlain(local.karaoke.songs, remote.karaoke.songs),
      takes: addPlain(local.karaoke.takes, remote.karaoke.takes),
    },
    quiz: {
      custom: addPlain(local.quiz.custom, remote.quiz.custom),
      answers: addPlain(local.quiz.answers, remote.quiz.answers),
    },
    museum: {
      stops: addPlain(
        local.museum.stops,
        both(local.museum.stops, remote.museum.stops, starter.museum.stops),
      ),
      foundAt: earliest(local.museum.foundAt, remote.museum.foundAt),
    },
    her: {
      ...remote.her,
      journal: addPlain(local.her.journal, remote.her.journal),
      bucket: addPlain(local.her.bucket, remote.her.bucket),
      goals: addPlain(local.her.goals, remote.her.goals),
      music: addPlain(local.her.music, remote.her.music),
      notes: addPlain(local.her.notes, remote.her.notes),
      ideas: addPlain(local.her.ideas, remote.her.ideas),
    },
    flowers: addPlain(local.flowers, remote.flowers),
    coupons: addPlain(local.coupons, remote.coupons),
    daily: addPlain(local.daily, remote.daily),
    datePlans: addPlain(local.datePlans, remote.datePlans),
    agenda: addPlain(local.agenda, remote.agenda),
    cinema: {
      films: addPlain(local.cinema.films, remote.cinema.films),
      ratings: addPlain(local.cinema.ratings, remote.cinema.ratings),
      nights: addPlain(local.cinema.nights, remote.cinema.nights),
    },
    texts: addPlain(local.texts, remote.texts),
    vault: {
      lock: earliestLock(local.vault.lock, remote.vault.lock),
      // Our things only travel when they were locked with the shared password.
      items:
        !local.vault.lock || local.vault.lock.salt === remote.vault.lock?.salt || !remote.vault.lock
          ? addPlain(local.vault.items, remote.vault.items)
          : remote.vault.items,
      categories:
        !local.vault.lock || local.vault.lock.salt === remote.vault.lock?.salt || !remote.vault.lock
          ? addPlain(local.vault.categories, remote.vault.categories)
          : remote.vault.categories,
    },
    lists: addPlain(
      local.lists.filter((l) => l.items.length > 0 || !remote.lists.some((r) => r.id === l.id)),
      remote.lists,
    ),
  };
}

/* --------------------------------------------- an older app on the other phone */

/**
 * Which shape of our content the app that saved it knew. The marker came a
 * little after shape 2 itself, so without it: content that has the flower
 * shop is shape 2, anything older is shape 1.
 */
export function writerSchema(raw: unknown): number {
  if (!isObject(raw)) return 1;
  if (typeof raw.schema === 'number') return raw.schema;
  return 'flowers' in raw ? 2 : 1;
}

const GAMES_SINCE_2: readonly GameId[] = ['memory', 'hockey'];
const MATCHES_SINCE_5: readonly MatchKind[] = ['memory', 'darts'];
const MATCHES_SINCE_7: readonly MatchKind[] = ['skeeball', 'bowling', 'bingo', 'kwartet'];
const GAMES_SINCE_7: readonly GameId[] = ['bingo', 'kwartet'];

/**
 * Content saved by an older app is missing whatever that app didn't know yet.
 * That isn't the other phone deleting it, so those parts are kept as we had
 * them (`ours`: the last copy we agreed on). Everything the older app does
 * know about stays exactly as it saved it.
 */
const withArchive = (archive: GamesArchive | undefined) => (archive ? { archive } : {});

export function carryForward(shared: AppContent, ours: AppContent, writer: number): AppContent {
  if (writer >= CONTENT_SCHEMA) return shared;
  let out = shared;
  // Schema 10 added the music room.
  if (writer < 10) out = { ...out, studio: ours.studio };
  // Schema 9 added the karaoke room.
  if (writer < 9) out = { ...out, karaoke: ours.karaoke };
  // Schema 8 added the arcade's spaarpot; an older app saves without it.
  if (writer < 8) {
    const archive = pickArchive(out.games.archive, ours.games.archive);
    out = { ...out, games: { ...out.games, ...withArchive(archive) } };
  }
  // Schema 7 added duels for skeeball and bowling, bingo and kwartet.
  if (writer < 7) {
    const matches = new Set(out.games.matches.map((m) => m.id));
    const results = new Set(out.games.results.map((r) => r.id));
    out = {
      ...out,
      games: {
        ...out.games,
        matches: [
          ...out.games.matches,
          ...ours.games.matches.filter(
            (m) => MATCHES_SINCE_7.includes(m.kind) && !matches.has(m.id),
          ),
        ],
        results: [
          ...out.games.results,
          ...ours.games.results.filter((r) => GAMES_SINCE_7.includes(r.game) && !results.has(r.id)),
        ],
      },
    };
  }
  // Schema 6 added the things in Coco's room (and the diary lines about them).
  if (writer < 6) {
    const known = new Set(shared.pet.log.map((e) => e.id));
    out = {
      ...out,
      pet: {
        ...out.pet,
        decor: ours.pet.decor,
        log: [
          ...out.pet.log,
          ...ours.pet.log.filter((e) => e.action === 'decor' && !known.has(e.id)),
        ]
          .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
          .slice(0, PET_LOG_LIMIT),
      },
    };
  }
  // Schema 5 added Memory and darts on two phones (and our secret place).
  if (writer < 5) {
    out = { ...out, vault: ours.vault };
    const known = new Set(shared.games.matches.map((m) => m.id));
    const kept = ours.games.matches.filter(
      (m) => MATCHES_SINCE_5.includes(m.kind) && !known.has(m.id),
    );
    out = { ...out, games: { ...out.games, matches: [...out.games.matches, ...kept] } };
  }
  // Schema 4 added our cinema and his own wording for texts.
  if (writer < 4) out = { ...out, cinema: ours.cinema, texts: ours.texts };
  // Schema 3 added our shared agenda; an older app saves without it.
  if (writer < 3) out = { ...out, agenda: ours.agenda };
  if (writer >= 2) return out;
  const base = out;
  const savedLove = new Map(ours.her.nails.saved.map((s) => [s.id, s.loved]));
  const sentLove = new Map((ours.her.nails.sent ?? []).map((s) => [s.id, s.set.loved]));
  const results = new Set(base.games.results.map((r) => r.id));
  return {
    ...base,
    flowers: ours.flowers,
    coupons: ours.coupons,
    pings: ours.pings,
    daily: ours.daily,
    datePlans: ours.datePlans,
    her: {
      ...base.her,
      ideas: ours.her.ideas,
      nails: {
        ...base.her.nails,
        saved: base.her.nails.saved.map((s) => ({ ...s, loved: savedLove.get(s.id) })),
        sent: base.her.nails.sent?.map((s) => ({
          ...s,
          set: { ...s.set, loved: sentLove.get(s.id) },
        })),
      },
    },
    pet: {
      ...base.pet,
      careDays: [...new Set([...base.pet.careDays, ...ours.pet.careDays])]
        .sort()
        .slice(-CARE_DAYS_LIMIT),
    },
    games: {
      ...base.games,
      results: [
        ...base.games.results,
        ...ours.games.results.filter((r) => GAMES_SINCE_2.includes(r.game) && !results.has(r.id)),
      ],
    },
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
  // Voice messages travel the same way photos do.
  const voice = (v: { mediaId: string } | undefined) => v && ids.add(v.mediaId);
  content.letters.forEach((l) => voice(l.voice));
  content.studio.records.forEach((r) => {
    voice(r.audio);
    add(r.cover);
  });
  content.karaoke.songs.forEach((s) => voice(s.track));
  content.karaoke.takes.forEach((t) => {
    t.voices.forEach(voice);
    voice(t.mix);
  });
  content.museum.stops.forEach((s) => voice(s.voice));
  content.her.notes.forEach((n) => voice(n.voice));
  content.flowers.forEach((b) => add(b.media));
  content.cinema.films.forEach((f) => {
    add(f.video);
    add(f.poster);
  });
  // Our secret place travels encrypted.
  content.vault.items.forEach((v) => {
    ids.add(v.media);
    if (v.thumb) ids.add(v.thumb);
  });
  return [...ids];
}
