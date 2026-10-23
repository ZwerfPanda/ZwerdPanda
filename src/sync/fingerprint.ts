import type { AppContent } from '../data/types';
import { normalizeContent } from '../data/normalize';
import { stableStringify } from './merge';

/**
 * A short code for everything we share. Two phones with the same code see
 * exactly the same universe — every letter, photo, chapter and score. The
 * phones' own sync reports are left out, so reporting doesn't change it.
 */
export function fingerprint(content: AppContent): string {
  // Read the way any phone reads it, so a leftover `false` vs a missing field doesn't count.
  const { syncReports: _reports, ...shared } = normalizeContent(content);
  const text = stableStringify(shared);
  // cyrb53: small, fast and spreads well; this is a check, not security.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = ((h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'))
    .slice(0, 8)
    .toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

/** What's in it, so two phones can compare at a glance. */
export function contentCounts(c: AppContent) {
  return {
    hoofdstukken: c.milestones.length,
    herinneringen: c.memories.length,
    brieven: c.letters.filter((l) => l.status === 'shared').length,
    dromen: c.dreams.length,
    liedjes: c.songs.length,
    museumstops: c.museum.stops.length,
    lijstjes: c.lists.reduce((n, l) => n + l.items.length, 0),
    spelletjes: c.games.results.length,
  };
}
