import { useMemo } from 'react';
import { getHer, updateHerPrivateItems, updateHerSpace, useHer, useHerPrivateItems, useHerTest } from './herStore';
import { getAuthor, useMe } from '../../data/people';
import type { BucketItem, Goal, HerMood, HerSpace, JournalEntry } from '../../data/types';

/**
 * Her things live in one of two places: shared with the universe, or — when
 * she marks them "alleen voor mij" — only on her own phone. These helpers keep
 * each item in exactly one of the two, so moving it is just saving it.
 */

export interface HerItems {
  journal: JournalEntry;
  bucket: BucketItem;
  goals: Goal;
}
export type HerKind = keyof HerItems;

const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

const ORDER: { [K in HerKind]: (a: HerItems[K], b: HerItems[K]) => number } = {
  journal: (a, b) => newestFirst(a.date, b.date) || newestFirst(a.createdAt, b.createdAt),
  bucket: (a, b) => Number(a.done) - Number(b.done) || newestFirst(a.createdAt, b.createdAt),
  goals: (a, b) => Number(a.done) - Number(b.done) || newestFirst(a.createdAt, b.createdAt),
};

export function useHerItems<K extends HerKind>(kind: K): HerItems[K][] {
  const shared = useHer((h) => h[kind]) as HerItems[K][];
  const mine = useHerPrivateItems()[kind] as HerItems[K][];
  return useMemo(() => [...shared, ...mine].sort(ORDER[kind]), [shared, mine, kind]);
}

type Item = { id: string; private?: boolean };

const upsert = <T extends Item>(items: T[], item: T): T[] =>
  items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [item, ...items];

export function saveHerItem<K extends HerKind>(kind: K, item: HerItems[K]) {
  const isPrivate = Boolean(item.private);
  const sharedCopy = { ...item, private: undefined };
  updateHerSpace((h) => {
    const list = h[kind] as Item[];
    const next = isPrivate ? list.filter((i) => i.id !== item.id) : upsert(list, sharedCopy);
    return next === list ? h : { ...h, [kind]: next };
  });
  updateHerPrivateItems((p) => {
    const list = p[kind] as Item[];
    return {
      ...p,
      [kind]: isPrivate
        ? upsert(list, { ...item, private: true })
        : list.filter((i) => i.id !== item.id),
    };
  });
}

export function removeHerItem(kind: HerKind, id: string) {
  updateHerSpace((h) => ({ ...h, [kind]: (h[kind] as Item[]).filter((i) => i.id !== id) }));
  updateHerPrivateItems((p) => ({ ...p, [kind]: (p[kind] as Item[]).filter((i) => i.id !== id) }));
}

export { getHer, useHer };

export function updateHer(patch: Partial<Omit<HerSpace, HerKind>>) {
  updateHerSpace((h) => ({ ...h, ...patch }));
}

/**
 * Once this phone is known to be his, her corner is read-only here: he can
 * look at what she shares, never change it.
 */
export function useIsHerVisitor(): boolean {
  const me = useMe();
  const testing = useHerTest();
  return !testing && me === 'you' && getAuthor() !== undefined;
}

export const MOODS: Record<HerMood, { emoji: string; label: string }> = {
  happy: { emoji: '😊', label: 'Blij' },
  loved: { emoji: '🥰', label: 'Loved' },
  calm: { emoji: '😌', label: 'Rustig' },
  excited: { emoji: '🤩', label: 'Excited' },
  tired: { emoji: '😴', label: 'Moe' },
  sad: { emoji: '🥺', label: 'Verdrietig' },
  stressed: { emoji: '😵‍💫', label: 'Gestrest' },
};

export const JOURNAL_PROMPTS = [
  'Waar was ik vandaag dankbaar voor?',
  'Wat gaf me vandaag energie?',
  'Iets kleins waar ik trots op ben…',
  'Hoe voel ik me echt, eerlijk gezegd?',
  'Wat heb ik deze week nodig?',
  'Een herinnering die me laat glimlachen…',
  'Drie dingen waar ik blij van word…',
  'Wat zou ik tegen mezelf van vorig jaar zeggen?',
  'Mijn perfecte zondag ziet eruit als…',
  'Iets wat ik wil loslaten…',
];

/** "instagram.com" for a link, to show where it goes. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
