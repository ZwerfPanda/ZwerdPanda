import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import type { AppContent, GameResult } from '../../data/types';
import { MEDALS, medalStats, weekProgress, wonMedals } from './medals';
import { FOLD_AT, foldResults, ticketsEarned } from './tickets';

const game = (i: number, at: string, winner: GameResult['winner'], g = 'kwartet'): GameResult =>
  ({ id: `match-${i}`, game: g, players: ['you', 'partner'], winner, at }) as GameResult;
const content = (results: GameResult[]): AppContent => {
  const c = createDefaultContent();
  return { ...c, games: { ...c.games, results } };
};

describe('medals', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T12:00:00+01:00')); // a Friday
  });
  afterEach(() => vi.useRealTimers());

  it('starts with none, then the first game together and the first win', () => {
    expect(wonMedals(medalStats(content([])))).toEqual([]);
    const c = content([game(1, '2026-10-27T18:00:00Z', 'partner')]);
    expect(wonMedals(medalStats(c))).toEqual(['samen-1', 'win-1:partner']);
  });

  it('a week with five games together is the weekly challenge, with its bonus', () => {
    const week = ['26', '27', '28', '29', '30'].map((d, i) =>
      game(i, `2026-10-${d}T10:00:00Z`, i % 2 ? 'you' : 'partner'),
    );
    expect(weekProgress(content(week.slice(0, 3)))).toMatchObject({ played: 3, done: false });
    const c = content(week);
    expect(weekProgress(c)).toMatchObject({ played: 5, done: true });
    expect(wonMedals(medalStats(c))).toContain('week-1');
    // A game against Coco doesn't count for it.
    const coco = {
      ...game(9, '2026-10-30T11:00:00Z', 'you'),
      id: 'result-9',
      players: ['you', 'coco'],
    };
    expect(weekProgress(content([...week.slice(0, 4), coco as GameResult])).played).toBe(4);
    // Lose, win, lose on Wednesday (×2), win, lose — each +4 for a long game — and the weekly 20.
    expect(ticketsEarned(c, 'you')).toBe(8 + 14 + 16 + 14 + 8 + 20);
  });

  it('keeps every medal when old games go into the spaarpot', () => {
    const start = Date.parse('2025-01-06T10:00:00Z');
    const results = Array.from({ length: FOLD_AT + 300 }, (_, i) =>
      game(
        i,
        new Date(start + i * 4 * 3_600_000).toISOString(),
        i % 3 ? 'you' : 'partner',
        (['kwartet', 'uno', 'bingo', 'zeeslag', 'c4', 'memory', 'hockey'] as const)[i % 7],
      ),
    );
    const before = wonMedals(medalStats(content(results)));
    const folded = foldResults(content(results));
    expect(folded.games.results.length).toBeLessThan(results.length);
    expect(wonMedals(medalStats(folded)).sort()).toEqual(before.sort());
    expect(before).toContain('samen-1000');
    expect(before).toContain('allround:you');
    expect(before).toContain('maand:you');
  });

  it('every medal has a unique id and a goal', () => {
    expect(new Set(MEDALS.map((m) => m.id)).size).toBe(MEDALS.length);
    for (const m of MEDALS) expect(m.goal).toBeGreaterThan(0);
  });
});
