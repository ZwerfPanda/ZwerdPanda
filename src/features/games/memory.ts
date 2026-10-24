import type { AppContent, MediaSource } from '../../data/types';

export interface Face {
  /** Same key = a pair. */
  key: string;
  media?: MediaSource;
  emoji?: string;
}

export interface Card extends Face {
  id: number;
}

/** Little things that are ours, for when there aren't enough photos yet. */
const FALLBACK = ['🐰', '🍵', '🧋', '💅', '🎤', '🚆', '🌷', '🎳'];

/** Our own photos (memories, chapters, bouquets) — topped up with emoji when needed. */
export function facesFrom(c: AppContent, pairs: number, random = Math.random): Face[] {
  const photos = new Map<string, MediaSource>();
  const add = (m: MediaSource | undefined) => {
    if (m?.type === 'local' && m.kind === 'image') photos.set(m.mediaId, m);
  };
  c.memories.forEach((m) => add(m.media));
  c.milestones.forEach((m) => m.media.forEach(add));
  c.flowers.forEach((b) => add(b.media));
  const picked = [...photos.entries()]
    .sort(() => random() - 0.5)
    .slice(0, pairs)
    .map(([key, media]) => ({ key, media }));
  const emoji = [...FALLBACK]
    .sort(() => random() - 0.5)
    .slice(0, pairs - picked.length)
    .map((e) => ({ key: `emoji-${e}`, emoji: e }));
  return [...picked, ...emoji];
}

/** Two of each face, shuffled. */
export function deck(faces: Face[], random = Math.random): Card[] {
  const cards = faces.flatMap((f) => [f, f]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((f, id) => ({ ...f, id }));
}

/**
 * Coco's turn. She remembers cards she has seen (not perfectly), takes a pair
 * she knows, and otherwise turns an unknown card — finishing a pair if she can.
 */
export function cocoPick(
  cards: Card[],
  matched: Set<number>,
  memory: Map<number, string>,
  first: number | null,
  random = Math.random,
): number {
  const open = cards.filter((c) => !matched.has(c.id) && c.id !== first);
  const known = (id: number) => memory.get(id);
  if (first !== null) {
    const key = cards[first].key;
    const mate = open.find((c) => known(c.id) === key);
    if (mate) return mate.id;
  } else {
    const seen = new Map<string, number>();
    for (const c of open) {
      const k = known(c.id);
      if (!k) continue;
      if (seen.has(k)) return seen.get(k)!;
      seen.set(k, c.id);
    }
  }
  const unknown = open.filter((c) => !memory.has(c.id));
  const pool = unknown.length ? unknown : open;
  return pool[Math.floor(random() * pool.length)].id;
}
