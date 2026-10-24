import { describe, expect, it } from 'vitest';
import { normalizeContent } from '../../data/normalize';
import type { AppContent, GameResult } from '../../data/types';
import { ticketBalance, ticketsEarned, tournament } from './tickets';
import { cocoPick, deck, facesFrom } from './memory';
import { PUCK_R, RINK_H, startRink, step, clampPaddle, cocoTarget } from './hockey';

const r = (p: Partial<GameResult>): GameResult => ({
  id: Math.random().toString(36),
  game: 'uno',
  players: ['you', 'partner'],
  winner: 'you',
  at: '2026-10-05T10:00:00.000Z',
  ...p,
});
const base = (): AppContent => normalizeContent({});

describe('arcade tickets', () => {
  it('pays for each potje we play against each other, more for a win', () => {
    const c = base();
    c.games.results = [r({ winner: 'you' }), r({ winner: 'partner' }), r({ winner: 'draw' })];
    expect(ticketsEarned(c, 'you')).toBe(10 + 4 + 6);
    expect(ticketsEarned(c, 'partner')).toBe(4 + 10 + 6);
  });

  it('does not pay for games against Coco', () => {
    const c = base();
    c.games.results = [
      r({ game: 'memory', players: ['you', 'coco'], winner: 'you' }),
      r({ game: 'hockey', players: ['partner', 'coco'], winner: 'coco' }),
      r({ game: 'c4', players: ['you', 'partner'], winner: 'you' }),
    ];
    // Only the you-vs-partner game counts.
    expect(ticketsEarned(c, 'you')).toBe(10);
    expect(ticketsEarned(c, 'partner')).toBe(4);
  });

  it('spending a prize from the other comes off the balance', () => {
    const c = base();
    c.games.results = Array.from({ length: 10 }, () => r({ winner: 'partner' }));
    c.coupons = [
      {
        id: 'c1',
        title: 'Bubble tea',
        emoji: '🧋',
        price: 60,
        from: 'you',
        wonAt: '2026-10-06T10:00:00.000Z',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
      {
        id: 'c2',
        title: 'Film',
        emoji: '🎬',
        price: 30,
        from: 'you',
        createdAt: '2026-10-01T10:00:00.000Z',
      },
    ];
    expect(ticketBalance(c, 'partner')).toBe(100 - 60);
    // His own coupons never cost him anything.
    expect(ticketBalance(c, 'you')).toBe(40);
  });
});

describe('champion of the month', () => {
  it('counts only games against each other, per month', () => {
    const months = tournament([
      r({ winner: 'you', at: '2026-09-02T10:00:00.000Z' }),
      r({ winner: 'you', at: '2026-09-03T10:00:00.000Z' }),
      r({ winner: 'partner', at: '2026-09-04T10:00:00.000Z' }),
      r({ winner: 'partner', at: '2026-10-04T10:00:00.000Z' }),
      r({ players: ['you', 'coco'], winner: 'coco', at: '2026-10-04T10:00:00.000Z' }),
    ]);
    expect(months[0]).toMatchObject({ month: '2026-10', you: 0, partner: 1, champion: 'partner' });
    expect(months[1]).toMatchObject({ month: '2026-09', you: 2, partner: 1, champion: 'you' });
  });
});

describe('memory', () => {
  it('deals pairs, topping up with our emoji when photos are few', () => {
    const faces = facesFrom(base(), 8, () => 0.3);
    expect(faces).toHaveLength(8);
    const cards = deck(faces, () => 0.4);
    expect(cards).toHaveLength(16);
    for (const f of faces) expect(cards.filter((c) => c.key === f.key)).toHaveLength(2);
  });

  it('lets Coco take a pair she remembers', () => {
    const cards = deck(
      facesFrom(base(), 4, () => 0.1),
      () => 0.7,
    );
    const pair = cards.filter((c) => c.key === cards[0].key).map((c) => c.id);
    const memory = new Map(pair.map((id) => [id, cards[id].key]));
    const first = cocoPick(cards, new Set(), memory, null);
    expect(pair).toContain(first);
    expect(cocoPick(cards, new Set(), memory, first)).toBe(pair.find((id) => id !== first));
  });
});

describe('air hockey', () => {
  it('scores a goal through the top net for the bottom player', () => {
    const rink = { ...startRink(), puck: { x: 0.5, y: 0.02 }, vel: { x: 0, y: -2 } };
    let out = step(rink, 0.05);
    for (let i = 0; i < 5 && out.event !== 'goal-top'; i++) out = step(out.rink, 0.05);
    expect(out.event).toBe('goal-top');
    expect(out.rink.score).toEqual([1, 0]);
  });

  it('bounces off the end wall next to the goal', () => {
    const rink = { ...startRink(), puck: { x: 0.08, y: PUCK_R + 0.01 }, vel: { x: 0, y: -2 } };
    const out = step(rink, 0.02);
    expect(out.rink.vel.y).toBeGreaterThan(0);
  });

  it('keeps paddles on their own half', () => {
    expect(clampPaddle({ x: 0.5, y: 0.1 }, 0).y).toBeGreaterThan(RINK_H / 2);
    expect(clampPaddle({ x: 0.5, y: 1.5 }, 1).y).toBeLessThan(RINK_H / 2);
  });

  it('a paddle sends the puck away', () => {
    const rink = startRink();
    rink.puck = { x: 0.5, y: rink.paddles[0].y - 0.1 };
    rink.paddleVel[0] = { x: 0, y: -2 };
    const out = step(rink, 0.016);
    expect(out.event).toBe('hit');
    expect(out.rink.vel.y).toBeLessThan(0);
  });

  it('Coco goes for a puck on her side', () => {
    const rink = { ...startRink(), puck: { x: 0.3, y: 0.5 } };
    expect(cocoTarget(rink).x).toBeLessThan(0.5);
  });
});
