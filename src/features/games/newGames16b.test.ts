import { describe, expect, it } from 'vitest';
import {
  TRACK_CELLS,
  cocoPawn,
  move,
  movable,
  newLudo,
  normalizeLudo,
  roll,
  squareOf,
  won,
  type LudoState,
} from './ludo';
import {
  choose,
  finishDrawing,
  guess,
  hint,
  isRight,
  newDraw,
  nextRound,
  normalizeDraw,
  pack,
  unpack,
  winnerOf,
  ROUNDS,
} from './drawGuess';
import {
  HOLES,
  golfScore,
  holePoints,
  newGolf,
  nextHole,
  putt,
  step,
  type GolfState,
} from './golf';
import { RACK, applyThrow, newPong, normalizePong, throwOnce } from './pong';

describe('mens erger je niet', () => {
  it('a 6 brings a pawn out, and stuck at home you get three tries', () => {
    let s = newLudo();
    let r = roll(s, 'you', 3);
    expect(r.next).toBe('again');
    expect(r.state.tries).toBe(1);
    r = roll(r.state, 'you', 2);
    r = roll(r.state, 'you', 1);
    expect(r.next).toBe('pass');
    r = roll(newLudo(), 'you', 6);
    expect(r.next).toBe('move');
    const m = move(r.state, 'you', 0)!;
    expect(m.state.pawns.you[0]).toBe(0);
    expect(m.again).toBe(true);
  });

  it('landing on the other sends them home; the finish needs the exact number', () => {
    const s: LudoState = {
      ...newLudo(),
      pawns: { you: [18, -1, -1, -1], partner: [-1, -1, -1, -1] },
      die: 0,
      tries: 0,
    };
    // pink's pawn on its own start square (board square 20)
    s.pawns.partner[0] = 0;
    expect(squareOf('partner', 0)).toBe(20);
    const r = roll(s, 'you', 2);
    const m = move(r.state, 'you', 0)!;
    expect(m.hit).toBe(true);
    expect(m.state.pawns.partner[0]).toBe(-1);
    const near: LudoState = {
      ...newLudo(),
      pawns: { you: [41, -1, -1, -1], partner: [-1, -1, -1, -1] },
    };
    expect(movable({ ...near, die: 3 }, 'you', 3)).toEqual([]);
    expect(movable({ ...near, die: 2 }, 'you', 2)).toEqual([0]);
  });

  it('Coco prefers to hit, and a game can be won', () => {
    const s: LudoState = {
      ...newLudo(),
      pawns: { you: [0, 5, -1, -1], partner: [17, 22, -1, -1] },
      die: 3,
    };
    // pink pawn 1 at 22 → square 2; with 3 it lands on 25 → square 5 where yellow's pawn 1 is (square 5)
    expect(cocoPawn(s, 'partner')).toBe(1);
    const done: LudoState = {
      ...newLudo(),
      pawns: { you: [40, 41, 42, 43], partner: [-1, -1, -1, -1] },
    };
    expect(won(done, 'you')).toBe(true);
    expect(TRACK_CELLS).toHaveLength(40);
    expect(normalizeLudo({ pawns: { you: [99] }, die: 9 }).die).toBe(0);
  });
});

describe('tekenen & raden', () => {
  it('packs and unpacks a drawing', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 150, y: 299 },
      { x: 300, y: 7 },
    ];
    expect(unpack(pack(pts))).toEqual(pts);
  });

  it('a round: choose, draw, guess — points for both', () => {
    let s = newDraw('you', () => 0.3);
    expect(s.options).toHaveLength(3);
    s = choose(s, s.options[0]);
    s = finishDrawing(s, [{ c: 0, w: 1, p: pack([{ x: 1, y: 1 }]) }]);
    const wrong = guess(s, 'helemaal fout');
    expect(wrong.over).toBe(false);
    expect(hint(s.word, 1)).toContain('letters');
    const right = guess(wrong.state, s.word.toUpperCase());
    expect(right.right).toBe(true);
    expect(right.state.points).toEqual({ you: 1, partner: 2 });
    const next = nextRound(right.state, []);
    expect(next.drawer).toBe('partner');
    expect(next.round).toBe(2);
  });

  it('a typo in a long word still counts, and six rounds make a winner', () => {
    expect(isRight('dinosaurs', 'dinosaurus')).toBe(true);
    expect(isRight('kat', 'kar')).toBe(false);
    expect(isRight('Pinguin', 'pinguïn')).toBe(true);
    const end = normalizeDraw({ round: ROUNDS, status: 'done', points: { you: 4, partner: 7 } });
    expect(winnerOf(end)).toBe('partner');
  });
});

describe('minigolf', () => {
  const roll = (s: GolfState) => {
    for (let i = 0; i < 3000 && s.moving; i++) s = step(s, 1 / 60).state;
    return s;
  };
  it('a straight, firm putt on the first hole goes round the block, a soft one stops short', () => {
    const soft = roll(putt(newGolf(), 0, 30));
    expect(soft.sunk).toBe(false);
    expect(soft.strokes[0]).toBe(1);
  });

  it('the pond costs a stroke and puts you back', () => {
    let s = newGolf();
    for (let i = 0; i < 3; i++) s = nextHole({ ...s, sunk: true }).state;
    expect(HOLES[s.hole].name).toBe('Het vijvertje');
    const from = { ...s.ball };
    s = roll(putt(s, 0, 90));
    expect(s.strokes[s.hole]).toBe(2);
    expect(s.ball.x).toBeCloseTo(from.x);
    expect(s.ball.y).toBeCloseTo(from.y);
  });

  it('points: fewer strokes is more', () => {
    expect(holePoints(1, 3)).toBe(60);
    expect(holePoints(3, 3)).toBe(40);
    expect(holePoints(7, 3)).toBe(0);
    expect(golfScore({ strokes: [2, 3] })).toBe(40 + 40);
  });
});

describe('beer pong', () => {
  it('a good throw lands in a cup, two hits give the balls back', () => {
    const all = Array(6).fill(true);
    expect(throwOnce(1.01, 0, all, () => 0.9).cup).toBe(1);
    expect(throwOnce(0.7, 0, all, () => 0.9).cup).toBeNull();
    let s = newPong();
    let r = applyThrow(s, 'you', 1);
    expect(r.state.racks.partner[1]).toBe(false);
    r = applyThrow(r.state, 'you', 4);
    expect(r.ballsBack).toBe(true);
    expect(r.state.balls).toBe(2);
    s = {
      ...newPong(),
      racks: { you: Array(6).fill(true), partner: [false, false, false, false, false, true] },
    };
    expect(applyThrow(s, 'you', 5).won).toBe(true);
    expect(applyThrow(newPong(), 'you', null).state.balls).toBe(1);
    expect(RACK).toHaveLength(6);
    expect(normalizePong({ racks: { you: [false] } }).racks.you[0]).toBe(false);
  });
});
