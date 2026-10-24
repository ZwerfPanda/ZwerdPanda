import { getContent, getPrefs, updateContent } from './store';
import type {
  AppContent,
  CocoContent,
  MediaSource,
  MiniMe,
  OurList,
  Person,
  Profile,
  SurpriseContent,
  UsContent,
} from './types';
import { deleteMedia, listMediaIds } from '../lib/media';
import { restorePointMediaIds } from './restorePoints';
import { getHerPrivate } from './herPrivate';
import { contentMediaIds } from '../sync/merge';

/** Collections that hold a list of items with ids. */
export type CollectionKey =
  | 'milestones'
  | 'memories'
  | 'letters'
  | 'dreams'
  | 'capsules'
  | 'songs'
  | 'flowers'
  | 'coupons'
  | 'datePlans';
type ItemOf<K extends CollectionKey> = AppContent[K][number];

export function upsertItem<K extends CollectionKey>(
  key: K,
  item: ItemOf<K>,
  position: 'start' | 'end' = 'end',
) {
  updateContent((c) => {
    const list = c[key] as ItemOf<K>[];
    const index = list.findIndex((existing) => existing.id === item.id);
    let next: ItemOf<K>[];
    if (index >= 0) {
      next = list.slice();
      next[index] = item;
    } else {
      next = position === 'start' ? [item, ...list] : [...list, item];
    }
    return { ...c, [key]: next };
  });
}

export function patchItem<K extends CollectionKey>(key: K, id: string, patch: Partial<ItemOf<K>>) {
  updateContent((c) => {
    const list = c[key] as ItemOf<K>[];
    if (!list.some((item) => item.id === id)) return c;
    return { ...c, [key]: list.map((item) => (item.id === id ? { ...item, ...patch } : item)) };
  });
}

export function removeItem(key: CollectionKey, id: string) {
  updateContent((c) => {
    const list = c[key] as { id: string }[];
    return { ...c, [key]: list.filter((item) => item.id !== id) };
  });
}

/** Restores a removed item at its old position (used by "Undo" toasts). */
export function restoreItem<K extends CollectionKey>(key: K, item: ItemOf<K>, index: number) {
  updateContent((c) => {
    const list = (c[key] as ItemOf<K>[]).filter((existing) => existing.id !== item.id);
    list.splice(Math.min(index, list.length), 0, item);
    return { ...c, [key]: list };
  });
}

export function moveItem(key: CollectionKey, id: string, delta: -1 | 1) {
  updateContent((c) => {
    const list = (c[key] as { id: string }[]).slice();
    const from = list.findIndex((item) => item.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= list.length) return c;
    [list[from], list[to]] = [list[to], list[from]];
    return { ...c, [key]: list };
  });
}

export function toggleFavorite(key: 'milestones' | 'memories' | 'songs', id: string) {
  updateContent((c) => {
    const list = c[key] as { id: string; favorite: boolean }[];
    return {
      ...c,
      [key]: list.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)),
    };
  });
}

export function updateProfile(patch: Partial<Profile>) {
  updateContent((c) => ({ ...c, profile: { ...c.profile, ...patch } }));
}

export function updateSurprises(patch: Partial<SurpriseContent>) {
  updateContent((c) => ({ ...c, surprises: { ...c.surprises, ...patch } }));
}

export function updateCoco(patch: Partial<CocoContent>) {
  updateContent((c) => ({ ...c, coco: { ...c.coco, ...patch } }));
}

export function setAlbums(albums: AppContent['albums']) {
  updateContent((c) => {
    const valid = new Set(albums.map((a) => a.id));
    return {
      ...c,
      albums,
      memories: c.memories.map((m) =>
        m.albumIds.every((a) => valid.has(a))
          ? m
          : { ...m, albumIds: m.albumIds.filter((a) => valid.has(a)) },
      ),
    };
  });
}

export function countSamples(c: AppContent): number {
  return (
    c.milestones.filter((m) => m.isSample).length +
    c.memories.filter((m) => m.isSample).length +
    c.letters.filter((l) => l.isSample).length +
    c.dreams.filter((d) => d.isSample).length
  );
}

export function removeSampleContent() {
  updateContent((c) => ({
    ...c,
    milestones: c.milestones.filter((m) => !m.isSample),
    memories: c.memories.filter((m) => !m.isSample),
    letters: c.letters.filter((l) => !l.isSample),
    dreams: c.dreams.filter((d) => !d.isSample),
  }));
}

export type SampleKind = 'milestones' | 'memories' | 'letters' | 'dreams';

/** Clears the starter items of one page; things we edited are ours and stay. */
export function removeSamplesOf(kind: SampleKind) {
  updateContent((c) => ({
    ...c,
    [kind]: (c[kind] as { isSample?: boolean }[]).filter((item) => !item.isSample),
  }));
}

// --- Media bookkeeping --------------------------------------------------------

function addSource(ids: Set<string>, source: MediaSource | undefined) {
  if (source?.type === 'local') ids.add(source.mediaId);
}

export function referencedMediaIds(c: AppContent = getContent()): Set<string> {
  // Exactly what the sync sends, so the two lists can never drift apart.
  const ids = new Set<string>(contentMediaIds(c));
  // Her private wishes keep their photos too, even though they're not shared.
  getHerPrivate().bucket.forEach((b) => addSource(ids, b.media));
  const soundtrack = getPrefs().customSoundtrackId;
  if (soundtrack) ids.add(soundtrack);
  return ids;
}

const ORPHANS_KEY = 'olu:orphans:v1';
/** How long a photo nothing uses is kept, so it can still be found again. */
export const KEEP_UNUSED_DAYS = 30;

function readOrphans(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(ORPHANS_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

/** Photos stored on this phone that nothing in our universe uses right now. */
export async function unusedLocalMedia(): Promise<string[]> {
  const used = referencedMediaIds();
  // Photos a restore point still points at are kept too.
  (await restorePointMediaIds().catch(() => new Set<string>())).forEach((id) => used.add(id));
  return (await listMediaIds()).filter((mediaId) => !used.has(mediaId));
}

/**
 * Tidies up stored files nothing points at any more (e.g. a photo picked in
 * a form that was then cancelled) — but only once they've been unused for a
 * whole month, so a photo that went missing can always be found again in
 * Instellingen first. Runs once at start-up.
 */
export async function cleanupOrphanMedia(): Promise<number> {
  const unused = await unusedLocalMedia();
  const since = readOrphans();
  const now = Date.now();
  const next: Record<string, string> = {};
  const expired: string[] = [];
  for (const mediaId of unused) {
    const first = since[mediaId] ?? new Date(now).toISOString();
    if (now - Date.parse(first) > KEEP_UNUSED_DAYS * 86_400_000) expired.push(mediaId);
    else next[mediaId] = first;
  }
  await Promise.all(expired.map((mediaId) => deleteMedia(mediaId)));
  try {
    localStorage.setItem(ORPHANS_KEY, JSON.stringify(next));
  } catch {
    // Without storage we simply never delete anything.
  }
  return expired.length;
}

export function updateUs(recipe: (us: UsContent) => UsContent) {
  updateContent((c) => ({ ...c, us: recipe(c.us) }));
}

export function updateMini(who: Person, patch: Partial<MiniMe>) {
  updateUs((us) => ({ ...us, [who]: { ...us[who], ...patch } }));
}

export function updateLists(recipe: (lists: OurList[]) => OurList[]) {
  updateContent((c) => ({ ...c, lists: recipe(c.lists) }));
}
