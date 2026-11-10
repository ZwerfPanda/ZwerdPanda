import { describe, expect, it } from 'vitest';
import { cocoMove, fadingNext, isFull, newTtt, normalizeTtt, place, winLine } from './ttt';
import {
  boxesOf,
  cocoEdge,
  count,
  draw,
  freeEdges,
  newDots,
  normalizeDots,
  winnerOf,
} from './dots';
import { WORDS, judge, letterHints, roundWords, wordPoints } from './lingo';
import { RIM, cocoHoops, hoopX, newHoops, shoot, step, MOVING_FROM, THREES_FROM } from './hoops';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import { carryForward } from '../../sync/merge';

const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('boter kaas en eieren', () => {
  it('finds three in a row and a full board', () => {
    let s = newTtt();
    for (const [i, who] of [
      [0, 'you'],
      [3, 'partner'],
      [1, 'you'],
      [4, 'partner'],
      [2, 'you'],
    ] as const)
      s = place(s, i, who)!;
    expect(winLine(s.cells)).toEqual([0, 1, 2]);
    expect(place(s, 8, 'partner')).toBeNull(); // the game is over
    expect(isFull(newTtt())).toBe(false);
  });

  it('in the fading variant your oldest piece goes after three', () => {
    let s = newTtt(true);
    s = place(s, 0, 'you')!;
    s = place(s, 4, 'partner')!;
    s = place(s, 1, 'you')!;
    s = place(s, 8, 'partner')!;
    s = place(s, 6, 'you')!;
    s = place(s, 5, 'partner')!;
    expect(fadingNext(s, 'you')).toBe(0);
    s = place(s, 7, 'you')!;
    expect(s.cells[0]).toBeNull();
    expect(s.cells.filter((c) => c === 'you')).toHaveLength(3);
    expect(isFull(s)).toBe(false);
  });

  it('Coco takes a win, and blocks yours', () => {
    let s = newTtt();
    s = place(s, 0, 'partner')!;
    s = place(s, 3, 'you')!;
    s = place(s, 1, 'partner')!;
    s = place(s, 4, 'you')!;
    expect(cocoMove(s, 'partner', () => 0.99)).toBe(2); // win
    let t = newTtt();
    t = place(t, 0, 'you')!;
    t = place(t, 4, 'partner')!;
    t = place(t, 1, 'you')!;
    expect(cocoMove(t, 'partner', () => 0.99)).toBe(2); // block
  });

  it('a board from the other phone is cleaned up', () => {
    const s = normalizeTtt({ cells: ['you', 'x', null, 'partner'], order: [0, 9, 3, 1], fade: 1 });
    expect(s.cells.slice(0, 4)).toEqual(['you', null, null, 'partner']);
    expect(s.order).toEqual([0, 3]);
    expect(s.fade).toBe(true);
  });
});

describe('kamertje verhuren', () => {
  it('closing a box makes it yours (and you go again)', () => {
    let s = newDots(3);
    // box 0: top h0, bottom h3, left v0, right v1
    s = draw(s, { dir: 'h', i: 0 }, 'you')!.state;
    s = draw(s, { dir: 'h', i: 3 }, 'partner')!.state;
    s = draw(s, { dir: 'v', i: 0 }, 'you')!.state;
    const out = draw(s, { dir: 'v', i: 1 }, 'partner')!;
    expect(out.closed).toBe(1);
    expect(out.state.boxes[0]).toBe('partner');
    expect(draw(out.state, { dir: 'v', i: 1 }, 'you')).toBeNull();
    expect(boxesOf(3, { dir: 'v', i: 1 })).toEqual([0, 1]);
  });

  it('a whole game ends with a winner, and Coco never gives a free box away early', () => {
    let s = newDots(3);
    let turn: 'you' | 'partner' = 'you';
    const rng = seq([0.1, 0.7, 0.4, 0.9, 0.2]);
    let guard = 0;
    while (!winnerOf(s) && guard++ < 100) {
      const e = cocoEdge(s, rng)!;
      const out = draw(s, e, turn)!;
      s = out.state;
      if (!out.closed) turn = turn === 'you' ? 'partner' : 'you';
    }
    expect(freeEdges(s)).toHaveLength(0);
    expect(count(s, 'you') + count(s, 'partner')).toBe(9);
    expect(winnerOf(s)).not.toBeNull();
    // Coco closes a box when one is waiting
    let t = newDots(3);
    for (const e of [
      { dir: 'h', i: 0 },
      { dir: 'h', i: 3 },
      { dir: 'v', i: 0 },
    ] as const)
      t = draw(t, e, 'you')!.state;
    expect(cocoEdge(t, () => 0.5)).toEqual({ dir: 'v', i: 1 });
  });

  it('cleans up a board from the other phone', () => {
    const s = normalizeDots({ n: 99, h: ['you'] });
    expect(s.n).toBe(5);
    expect(s.h).toHaveLength(30);
    expect(s.h[0]).toBe('you');
  });
});

describe('lingo', () => {
  it('marks letters like the real game, counting doubles right', () => {
    expect(judge('kaart', 'kraan')).toEqual(['right', 'near', 'right', 'near', 'miss']);
    expect(judge('appel', 'appel').every((m) => m === 'right')).toBe(true);
    // only one "e" in the word: the second "e" of the guess is a miss
    expect(judge('eerst', 'beker')).toEqual(['near', 'right', 'near', 'miss', 'miss']);
    expect(letterHints(['kaart'], 'kraan').get('a')).toBe('right');
  });

  it('both of us get the same five words from the same seed', () => {
    expect(roundWords('lingo-abc')).toEqual(roundWords('lingo-abc'));
    expect(new Set(roundWords('lingo-abc')).size).toBe(5);
    expect(WORDS.length).toBeGreaterThan(250);
    expect(WORDS.every((w) => /^[a-z]{5}$/.test(w) && !w.includes('ij'))).toBe(true);
  });

  it('fewer tries and quicker is more points', () => {
    expect(wordPoints(1, 0)).toBe(120);
    expect(wordPoints(5, 100)).toBe(20);
    expect(wordPoints(null, 1)).toBe(0);
  });
});

describe('basketbal', () => {
  const fly = (power: number, aim = 0, t = 0) => {
    let s = { ...newHoops(), t };
    s = shoot(s, power, aim);
    const events: string[] = [];
    for (let i = 0; i < 400 && s.balls.some((b) => !b.done); i++) {
      const out = step(s, 1 / 60, () => 0.99);
      s = out.state;
      out.events.forEach((e) => events.push(e.type));
    }
    return { s, events };
  };

  it('a good throw goes in, a weak one falls short', () => {
    const good = fly(1);
    expect(good.s.score).toBe(3); // 2 + swish
    expect(good.s.swishes).toBe(1);
    const weak = fly(0.6);
    expect(weak.s.score).toBe(0);
    expect(weak.events).toContain('miss');
  });

  it('the last 15 seconds count 3, and the hoop moves halfway', () => {
    expect(fly(1, 0, MOVING_FROM - 3).s.score).toBe(3); // 2 + swish
    expect(hoopX(MOVING_FROM - 1)).toBe(0);
    expect(Math.abs(hoopX(MOVING_FROM + 1))).toBeGreaterThan(0.3);
    // thrown so the swaying hoop is straight ahead when the ball arrives
    const back = MOVING_FROM + (4 * Math.PI) / 1.35 - 0.8;
    expect(back).toBeGreaterThan(THREES_FROM);
    expect(fly(1, 0, back).s.score).toBeGreaterThanOrEqual(3);
  });

  it('the round ends after 45 seconds', () => {
    let s = newHoops();
    let ended = false;
    for (let i = 0; i < 60 * 50 && !s.over; i++) {
      const out = step(s, 1 / 60);
      s = out.state;
      if (out.events.some((e) => e.type === 'end')) ended = true;
    }
    expect(ended && s.over).toBe(true);
    expect(shoot(s, 1, 0)).toBe(s);
    expect(RIM.y).toBeGreaterThan(2);
    const coco = cocoHoops(seq([0.3, 0.6, 0.1]));
    expect(coco).toBeGreaterThan(10);
  });
});

describe('the new games on two phones', () => {
  it('an older app keeps our new games when it syncs', () => {
    const ours = createDefaultContent();
    ours.games.results.push({
      id: 'r1',
      game: 'dots',
      players: ['you', 'partner'],
      winner: 'you',
      at: '2026-11-10T10:00:00.000Z',
    });
    ours.games.scores.push({
      id: 's1',
      game: 'hoops',
      who: 'partner',
      score: 44,
      at: '2026-11-10T10:00:00.000Z',
    });
    const shared = createDefaultContent();
    const out = carryForward(shared, ours, 15);
    expect(out.games.results.map((r) => r.game)).toContain('dots');
    expect(out.games.scores.map((s) => s.game)).toContain('hoops');
    const n = normalizeContent(out);
    expect(n.games.results.map((r) => r.game)).toContain('dots');
  });
});
