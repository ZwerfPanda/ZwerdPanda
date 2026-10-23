import type { AppContent, MediaSource } from '../../data/types';
import { DATE_IDEAS } from '../us/lines';

export type PrizeKind = 'memory' | 'reason' | 'star' | 'dream' | 'date' | 'chapter';

export interface Prize {
  id: string;
  kind: PrizeKind;
  title: string;
  text: string;
  media?: MediaSource;
}

export const PRIZE_STYLE: Record<PrizeKind, { icon: string; color: string; label: string }> = {
  memory: { icon: '📸', color: '#7fc8ff', label: 'Een herinnering' },
  chapter: { icon: '📖', color: '#ffd75e', label: 'Uit ons verhaal' },
  reason: { icon: '💌', color: '#ff8cc0', label: 'Een reden waarom' },
  star: { icon: '⭐', color: '#ffe680', label: 'Een sterretje' },
  dream: { icon: '✨', color: '#b07bff', label: 'Een droom van ons' },
  date: { icon: '🍓', color: '#5dff9a', label: 'Date-idee' },
};

/** Everything that can be in the machine: our own things plus date ideas. */
export function prizePool(c: AppContent): Prize[] {
  const pool: Prize[] = [];
  for (const m of c.memories) {
    if (!m.caption.trim()) continue;
    pool.push({
      id: `memory-${m.id}`,
      kind: 'memory',
      title: m.caption,
      text: [m.location, m.note].filter(Boolean).join(' · '),
      media: m.media,
    });
  }
  for (const s of c.milestones) {
    if (s.future || !s.title.trim()) continue;
    pool.push({
      id: `chapter-${s.id}`,
      kind: 'chapter',
      title: s.title,
      text: s.dateLabel ?? '',
      media: s.media[0],
    });
  }
  c.surprises.reasons.forEach((r, i) => {
    if (r.trim()) pool.push({ id: `reason-${i}`, kind: 'reason', title: r, text: '' });
  });
  for (const s of c.surprises.stars) {
    if (s.text.trim()) pool.push({ id: `star-${s.id}`, kind: 'star', title: s.text, text: '' });
  }
  for (const d of c.dreams) {
    if (d.status === 'done' || !d.title.trim()) continue;
    pool.push({ id: `dream-${d.id}`, kind: 'dream', title: d.title, text: d.description ?? '' });
  }
  DATE_IDEAS.forEach((idea, i) => {
    pool.push({ id: `date-${i}`, kind: 'date', title: idea, text: '' });
  });
  return pool;
}

/** A fresh machine: a mix of kinds, so there's always a date idea or two. */
export function fillMachine(pool: Prize[], count: number, random = Math.random): Prize[] {
  const shuffled = [...pool].sort(() => random() - 0.5);
  const dates = shuffled.filter((p) => p.kind === 'date').slice(0, 3);
  const rest = shuffled.filter((p) => p.kind !== 'date');
  return [...dates, ...rest].slice(0, count).sort(() => random() - 0.5);
}

/**
 * Whether the claw holds on. Closer to the middle of a capsule is better,
 * and even a good grab can slip once in a while — it's an arcade.
 */
export function grabs(offset: number, random = Math.random): 'miss' | 'slip' | 'win' {
  const d = Math.abs(offset);
  if (d > 7) return 'miss';
  const hold = d < 2.5 ? 0.85 : d < 5 ? 0.6 : 0.3;
  const roll = random();
  if (roll < hold) return 'win';
  return roll < hold + 0.25 ? 'slip' : 'miss';
}
