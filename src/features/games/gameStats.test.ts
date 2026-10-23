import { describe, expect, it } from 'vitest';
import { normalizeContent } from '../../data/normalize';
import type { AppContent, GameResult } from '../../data/types';
import { cocoGameTalk, gameBrag, headToHead } from './gameStats';
import { cocoColumn, drop, emptyBoard, type Cell } from './c4';
import { cocoRolls, landing, powerOf } from './Skeeball';
import { cocoGame } from './Bowling';
import { totalScore } from './bowlingScore';

const result = (r: Partial<GameResult>): GameResult => ({
  id: Math.random().toString(36),
  game: 'uno',
  players: ['you', 'partner'],
  winner: 'you',
  at: '2026-01-01T00:00:00.000Z',
  ...r,
});

const withResults = (results: GameResult[]): AppContent => {
  const c = normalizeContent({});
  return { ...c, games: { ...c.games, results } };
};

describe('game stats', () => {
  it('counts wins between two players only', () => {
    const results = [
      result({ winner: 'you' }),
      result({ winner: 'you' }),
      result({ winner: 'partner' }),
      result({ winner: 'draw' }),
      result({ players: ['you', 'coco'], winner: 'coco' }),
      result({ game: 'c4', winner: 'partner' }),
    ];
    expect(headToHead(results, 'uno', 'you', 'partner')).toEqual({ a: 2, b: 1, draws: 1 });
    expect(headToHead(results, 'all', 'you', 'partner')).toEqual({ a: 2, b: 2, draws: 1 });
    expect(headToHead(results, 'uno', 'you', 'coco')).toEqual({ a: 0, b: 1, draws: 0 });
  });

  it('lets the one who leads brag, with real numbers', () => {
    const c = withResults([
      result({ winner: 'partner' }),
      result({ winner: 'partner' }),
      result({ winner: 'partner' }),
      result({ winner: 'you' }),
    ]);
    const brag = gameBrag(c, () => 0);
    expect(brag?.leader).toBe('partner');
    expect(brag?.text).toContain('UNO-queen');
    expect(brag?.text).toContain('3 keer');
  });

  it('has nothing to brag about before anyone played', () => {
    expect(gameBrag(withResults([]), () => 0)).toBeNull();
  });

  it('makes Coco remember how she did', () => {
    const c = withResults([
      result({ players: ['you', 'coco'], winner: 'coco' }),
      result({ players: ['you', 'coco'], winner: 'coco' }),
    ]);
    expect(cocoGameTalk(c, 'you', 'Lief', () => 0)).toBe(
      'Ik heb je al 2 keer verslagen met UNO 🐰👑',
    );
    expect(cocoGameTalk(c, 'partner', 'Lief', () => 0.9)).toBeNull();
  });
});

describe('Coco plays', () => {
  it('takes a win at 4 op een rij', () => {
    let board: Cell[] = emptyBoard();
    for (const col of [0, 1, 2]) board = drop(board, col, 'partner')!;
    expect(cocoColumn(board, 'partner', 'you', () => 0.99)).toBe(3);
  });

  it('blocks your win at 4 op een rij', () => {
    let board: Cell[] = emptyBoard();
    for (const col of [2, 3, 4]) board = drop(board, col, 'you')!;
    expect([1, 5]).toContain(cocoColumn(board, 'partner', 'you', () => 0.99));
  });

  it('bowls a full, legal game', () => {
    const frames = cocoGame(() => 0.5);
    expect(frames).toHaveLength(10);
    const total = totalScore(frames);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(300);
  });

  it('throws nine skeeballs that score like real holes', () => {
    const rolls = cocoRolls(() => 0.5);
    expect(rolls).toHaveLength(9);
    for (const r of rolls) expect([0, 10, 20, 30, 40, 50, 100]).toContain(r);
    expect(landing(0.1, 0).value).toBe(0);
    expect(landing(0.28, 0).value).toBe(20);
  });

  it('lets a normal firm swipe reach the top holes', () => {
    expect(landing(powerOf(0.25), 0).value).toBe(20);
    expect(landing(powerOf(0.4), 0).value).toBe(30);
    expect(landing(powerOf(0.75), 0).value).toBe(40);
    expect(landing(powerOf(1.05), 0).value).toBe(50);
    expect(landing(powerOf(1.15), -0.85).value).toBe(100);
  });
});
