import type { HerSpace, NailSet } from '../../data/types';

type Nails = HerSpace['nails'];

/** A bare nail, after the remover — not a colour she chose. */
const BARE = '#e9c3b0';

export interface GallerySet {
  /** The saved set's id, or the id of the "sent" entry (sent copies share one set id). */
  key: string;
  set: NailSet;
  at: string;
  sent: boolean;
}

/** Every set in her gallery: the ones she kept and the ones she sent him. */
export function gallerySets(nails: Nails): GallerySet[] {
  return [
    ...nails.saved.map((set) => ({ key: set.id, set, at: set.savedAt ?? '', sent: false })),
    ...(nails.sent ?? []).map((s) => ({ key: s.id, set: s.set, at: s.at, sent: true })),
  ];
}

/** Her newest set: the last one she saved or sent. */
export function newestSet(nails: Nails): NailSet | null {
  let best: { set: NailSet; at: string } | null = null;
  for (const item of gallerySets(nails)) {
    if (item.at && (!best || item.at > best.at)) best = item;
  }
  return best?.set ?? null;
}

/** The colour most of the nails have (the thumb wins a tie). */
export function mainColor(set: NailSet): string | null {
  const counts = new Map<string, number>();
  for (const raw of set.colors) {
    const c = raw.toLowerCase();
    if (c !== BARE) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [c, n] of counts) if (!best || n > counts.get(best)!) best = c;
  return best;
}

/** Coco's bow: the main colour of her newest set, or null for the usual pink. */
export const bowColor = (nails: Nails): string | null => {
  const set = newestSet(nails);
  return set ? mainColor(set) : null;
};

const channels = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** The knot in the middle: a bit darker, or lighter on a dark bow. */
export function knotColor(hex: string): string {
  const [r, g, b] = channels(hex);
  const light = r * 0.3 + g * 0.59 + b * 0.11 > 90;
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(light ? v * 0.8 : v + (255 - v) * 0.3))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Set of the month: the one he gave a heart most recently this month. Null
 * when he hasn't picked one yet this month.
 */
export function setOfTheMonth(nails: Nails, now = new Date()): GallerySet | null {
  const thisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  let best: GallerySet | null = null;
  for (const item of gallerySets(nails)) {
    const loved = item.set.loved;
    if (!loved || !thisMonth(loved)) continue;
    if (!best || loved > best.set.loved!) best = item;
  }
  return best;
}

/** Gives (or takes back) his heart on a saved or sent set. */
export function toggleLove(nails: Nails, key: string, at: string): Nails {
  const flip = (set: NailSet): NailSet => ({ ...set, loved: set.loved ? undefined : at });
  return {
    ...nails,
    saved: nails.saved.map((set) => (set.id === key ? flip(set) : set)),
    sent: nails.sent?.map((s) => (s.id === key ? { ...s, set: flip(s.set) } : s)),
  };
}
