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

/** Collections that hold a list of items with ids. */
export type CollectionKey = 'milestones' | 'memories' | 'letters' | 'dreams' | 'capsules' | 'songs';
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

// --- Media bookkeeping --------------------------------------------------------

function addSource(ids: Set<string>, source: MediaSource | undefined) {
  if (source?.type === 'local') ids.add(source.mediaId);
}

export function referencedMediaIds(c: AppContent = getContent()): Set<string> {
  const ids = new Set<string>();
  c.milestones.forEach((m) => m.media.forEach((s) => addSource(ids, s)));
  c.memories.forEach((m) => addSource(ids, m.media));
  c.dreams.forEach((d) => addSource(ids, d.media));
  addSource(ids, c.coco.portrait);
  const soundtrack = getPrefs().customSoundtrackId;
  if (soundtrack) ids.add(soundtrack);
  return ids;
}

/**
 * Deletes stored files nothing points at any more (e.g. a photo picked in a
 * form that was then cancelled). Runs once at start-up, never mid-edit.
 */
export async function cleanupOrphanMedia(): Promise<number> {
  const used = referencedMediaIds();
  const stored = await listMediaIds();
  const orphans = stored.filter((mediaId) => !used.has(mediaId));
  await Promise.all(orphans.map((mediaId) => deleteMedia(mediaId)));
  return orphans.length;
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
