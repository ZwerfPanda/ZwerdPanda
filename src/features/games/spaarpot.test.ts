import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import type { AppContent, GameResult } from '../../data/types';
import { mergeContent } from '../../sync/merge';
import { headToHead } from './gameStats';
import {
  FOLD_AT,
  WEEK_GOAL,
  arcadeTally,
  foldResults,
  liveResults,
  ticketsEarned,
  tournament,
} from './tickets';

/** A game every ~3 hours from mid-2025 on, alternating winners, some against Coco. */
function history(n: number): GameResult[] {
  const start = Date.parse('2025-06-02T08:00:00Z');
  return Array.from({ length: n }, (_, i) => {
    const coco = i % 7 === 0;
    return {
      id: coco ? `result-${i}` : `match-${i}`,
      game: (['uno', 'c4', 'kwartet', 'bingo'] as const)[i % 4],
      players: coco ? ['you', 'coco'] : ['you', 'partner'],
      winner: i % 11 === 0 ? 'draw' : i % 3 === 0 ? 'partner' : 'you',
      at: new Date(start + i * 3 * 3_600_000).toISOString(),
    };
  });
}

const withHistory = (results: GameResult[]): AppContent => {
  const c = createDefaultContent();
  return { ...c, games: { ...c.games, results } };
};

describe('the spaarpot', () => {
  const before = withHistory(history(FOLD_AT + 400));
  const after = foldResults(before);

  it('makes the list shorter, in whole weeks', () => {
    expect(after.games.results.length).toBeLessThan(before.games.results.length);
    expect(after.games.results.length).toBeGreaterThanOrEqual(1000);
    expect(after.games.archive?.upTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('loses nothing: tickets, head-to-head, months, weekly challenges', () => {
    for (const who of ['you', 'partner'] as const)
      expect(ticketsEarned(after, who)).toBe(ticketsEarned(before, who));
    expect(headToHead(after.games, 'all', 'you', 'partner')).toEqual(
      headToHead(before.games, 'all', 'you', 'partner'),
    );
    expect(headToHead(after.games, 'uno', 'you', 'coco')).toEqual(
      headToHead(before.games, 'uno', 'you', 'coco'),
    );
    expect(tournament(after.games)).toEqual(tournament(before.games));
    expect(arcadeTally(after).weeks).toBe(arcadeTally(before).weeks);
    expect(arcadeTally(before).weeks).toBeGreaterThan(10);
    expect(WEEK_GOAL).toBe(5);
  });

  it('folds the same way twice, and never counts a result twice', () => {
    expect(foldResults(after)).toBe(after);
    // A phone that still has the old results merges with one that folded.
    const merged = mergeContent(before, before, after);
    expect(liveResults(merged.games).length).toBe(after.games.results.length);
    expect(ticketsEarned(merged, 'you')).toBe(ticketsEarned(before, 'you'));
    // An old result coming back from somewhere doesn't count again.
    const stale = {
      ...after,
      games: {
        ...after.games,
        results: [...before.games.results.slice(0, 50), ...after.games.results],
      },
    };
    expect(ticketsEarned(stale, 'partner')).toBe(ticketsEarned(before, 'partner'));
  });

  it('survives saving and loading', () => {
    const again = normalizeContent(JSON.parse(JSON.stringify(after)));
    expect(again.games.archive).toEqual(after.games.archive);
    expect(ticketsEarned(again, 'you')).toBe(ticketsEarned(before, 'you'));
  });

  it('keeps going when it fills up again', () => {
    const more = history(FOLD_AT + 400 + 900).slice(FOLD_AT + 400);
    const grown = {
      ...after,
      games: { ...after.games, results: [...after.games.results, ...more] },
    };
    const all = withHistory(history(FOLD_AT + 400 + 900));
    const twice = foldResults(grown);
    expect(twice.games.archive!.upTo > after.games.archive!.upTo).toBe(true);
    expect(ticketsEarned(twice, 'you')).toBe(ticketsEarned(all, 'you'));
    expect(headToHead(twice.games, 'all', 'you', 'partner')).toEqual(
      headToHead(all.games, 'all', 'you', 'partner'),
    );
  });
});
