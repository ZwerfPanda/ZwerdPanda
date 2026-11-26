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
  COURSES,
  HOLES,
  courseOf,
  golfScore,
  holePoints,
  holeStars,
  inside,
  isOpen,
  newGolf,
  preview,
  recordHole,
  totalStars,
  nextHole,
  putt,
  step,
  type GolfState,
} from './golf';
import {
  aimAt,
  applyThrow,
  cupsOf,
  fly,
  formation,
  launch,
  newPong,
  normalizePong,
  throwOnce,
  type PongState,
} from './pong';

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
  const at = (course: number, hole: number) => {
    let s = newGolf(course);
    for (let i = 0; i < hole; i++) s = nextHole({ ...s, sunk: true }).state;
    return s;
  };

  it('a soft putt on the first hole stops short', () => {
    const soft = roll(putt(newGolf(), 0, 30));
    expect(soft.sunk).toBe(false);
    expect(soft.strokes[0]).toBe(1);
  });

  it('ten worlds of six holes, every tee and cup on the felt', () => {
    expect(COURSES).toHaveLength(10);
    for (const c of COURSES) {
      expect(c.holes).toHaveLength(6);
      for (const h of c.holes) {
        expect(inside(h, h.tee), `${c.name}: ${h.name} tee`).toBe(true);
        expect(inside(h, h.cup), `${c.name}: ${h.name} cup`).toBe(true);
        if (h.cupMove)
          for (const k of [-1, 1])
            expect(
              inside(h, { x: h.cup.x + h.cupMove.dx * k, y: h.cup.y + h.cupMove.dy * k }),
              `${c.name}: ${h.name} cup slides off the felt`,
            ).toBe(true);
      }
    }
    expect(newGolf(3).ball).toMatchObject(COURSES[3].holes[0].tee);
    expect(courseOf(newGolf(4)).id).toBe('space');
  });

  it('the pond costs a stroke and puts you back', () => {
    let s = at(0, 3);
    expect(HOLES[s.hole].name).toBe('Het vijvertje');
    const from = { ...s.ball };
    s = roll(putt(s, 0, 90));
    expect(s.strokes[s.hole]).toBe(2);
    expect(s.ball.x).toBeCloseTo(from.x);
    expect(s.ball.y).toBeCloseTo(from.y);
  });

  it('a black hole swallows a ball rolled straight at it', () => {
    let s = at(4, 1);
    expect(courseOf(s).holes[s.hole].wells).toHaveLength(1);
    let swallowed = false;
    s = putt(s, 0, 60);
    for (let i = 0; i < 3000 && s.moving; i++) {
      const out = step(s, 1 / 60);
      if (out.events.some((e) => e.type === 'void')) swallowed = true;
      s = out.state;
    }
    expect(swallowed).toBe(true);
    expect(s.strokes[s.hole]).toBe(2);
  });

  it('a portal beams the ball across the wall', () => {
    // Wormgat: straight up into the top-left portal, out at the bottom right
    let s = at(4, 2);
    s = { ...s, ball: { x: 70, y: 200, vx: 0, vy: 0 } };
    let warped = false;
    s = putt(s, 0, 70);
    for (let i = 0; i < 3000 && s.moving; i++) {
      const out = step(s, 1 / 60);
      if (out.events.some((e) => e.type === 'warp')) warped = true;
      s = out.state;
    }
    expect(warped).toBe(true);
    expect(s.ball.x).toBeGreaterThan(160);
  });

  it('a ramp makes the ball fly over the pond', () => {
    let s = at(5, 0);
    let jumped = false;
    let wet = false;
    s = putt(s, 0, 100);
    for (let i = 0; i < 3000 && s.moving; i++) {
      const out = step(s, 1 / 60);
      if (out.events.some((e) => e.type === 'jump')) jumped = true;
      if (out.events.some((e) => e.type === 'water')) wet = true;
      s = out.state;
    }
    expect(jumped).toBe(true);
    expect(wet).toBe(false);
    expect(s.ball.y).toBeLessThan(195);
  });

  it('a button opens its gate', () => {
    let s = at(5, 1);
    s = { ...s, ball: { x: 65, y: 380, vx: 0, vy: 0 } };
    let clicked = false;
    s = putt(s, 0, 30);
    for (let i = 0; i < 3000 && s.moving; i++) {
      const out = step(s, 1 / 60);
      if (out.events.some((e) => e.type === 'click')) clicked = true;
      s = out.state;
    }
    expect(clicked).toBe(true);
    expect(s.open).toEqual([0]);
    expect(nextHole(s).state.open).toEqual([]);
  });

  it('stars per hole, best strokes remembered, the bonus world opens with stars', () => {
    expect(holeStars(1, 3)).toBe(3);
    expect(holeStars(2, 3)).toBe(3);
    expect(holeStars(3, 3)).toBe(2);
    expect(holeStars(4, 3)).toBe(1);
    expect(holeStars(6, 3)).toBe(0);
    let p = recordHole({}, COURSES[0], 0, 3);
    p = recordHole(p, COURSES[0], 0, 4);
    expect(p.park).toEqual([3]);
    p = recordHole(p, COURSES[0], 2, 2);
    expect(p.park).toEqual([3, 0, 2]);
    expect(totalStars(p)).toBe(1 + 3);
    expect(isOpen(p, COURSES[5])).toBe(false);
    const all = Object.fromEntries(COURSES.filter((c) => !c.unlock).map((c) => [c.id, c.holes.map(() => 1)]));
    expect(isOpen(all, COURSES[5])).toBe(true);
  });

  it('the aiming guide follows the real ball and stops after the first bounce', () => {
    const pts = preview(newGolf(), 0, 60);
    expect(pts.length).toBeGreaterThan(3);
    expect(pts[pts.length - 1].y).toBeLessThan(pts[0].y);
    expect(preview(newGolf(), 0, 1)).toEqual([]);
  });

  it('points: fewer strokes is more, per course', () => {
    expect(holePoints(1, 3)).toBe(60);
    expect(holePoints(3, 3)).toBe(40);
    expect(holePoints(7, 3)).toBe(0);
    expect(golfScore({ strokes: [2, 3] })).toBe(40 + 40);
    expect(golfScore({ strokes: [2, 2], course: 2 })).toBe(40 + 40);
  });
});

describe('beer pong', () => {
  const ten = formation(10);

  it('a throw aimed at a cup drops into it; way off misses', () => {
    for (let i = 0; i < ten.length; i++) {
      const t = aimAt(ten[i]);
      expect(throwOnce(t.power, t.aim, ten).cup, `cup ${i}`).toBe(i);
    }
    const wide = throwOnce(1, 0.3, ten);
    expect(wide.cup).toBeNull();
    if (wide.cup === null) expect(wide.why).toBe('right');
    const long = throwOnce(1.4, 0, ten);
    expect(long.cup).toBeNull();
    if (long.cup === null) expect(['long', 'rim', 'wall']).toContain(long.why);
  });

  it('flies the same in big or small steps (so the other phone sees the same ball)', () => {
    const t = aimAt(ten[4]);
    let f = launch(t.power + 0.004, t.aim - 0.01);
    let acc = 0;
    let landed;
    for (let i = 0; i < 2000 && !landed; i++) {
      const out = fly(f, i % 3 === 0 ? 1 / 30 : 1 / 144, ten, acc);
      f = out.flight;
      acc = out.acc;
      landed = out.landed;
    }
    expect(landed).toEqual(throwOnce(t.power + 0.004, t.aim - 0.01, ten));
  });

  it('two hits give the balls back, a bounce shot takes two cups', () => {
    let r = applyThrow(newPong(), 'you', 1);
    expect(r.state.cups.partner).toHaveLength(9);
    r = applyThrow(r.state, 'you', 4);
    expect(r.ballsBack).toBe(true);
    expect(r.state.balls).toBe(2);
    const b = applyThrow(newPong(), 'you', { cup: 0, bounce: true });
    expect(b.state.cups.partner).toHaveLength(8);
    expect(b.news).toContain('bounce');
    const miss = applyThrow(newPong(), 'you', null);
    expect(miss.state.balls).toBe(1);
    expect(miss.state.last?.hit).toEqual([]);
  });

  it('three in a row and you are on fire: keep throwing until you miss', () => {
    let s = newPong();
    s = applyThrow(s, 'you', 0).state;
    s = applyThrow(s, 'you', 0).state; // balls back
    const third = applyThrow(s, 'you', 0);
    expect(third.news).toContain('fire');
    expect(third.state.fire).toBe('you');
    const fourth = applyThrow(third.state, 'you', 0);
    expect(fourth.turnOver).toBe(false);
    expect(fourth.state.balls).toBe(third.state.balls);
    const out = applyThrow(fourth.state, 'you', null);
    expect(out.state.fire).toBeUndefined();
  });

  it('at six cups the rack is tidied into a triangle', () => {
    let s: PongState = { ...newPong(), cups: { ...newPong().cups, partner: newPong().cups.partner.slice(0, 7) } };
    s = applyThrow(s, 'you', 6).state; // 6 left, one ball still to go
    const r = applyThrow(s, 'you', null);
    expect(r.news).toContain('rerack');
    expect(cupsOf(r.state, 'partner')).toHaveLength(6);
    expect(cupsOf(r.state, 'partner').map((c) => c.z.toFixed(2))).toEqual(
      formation(6).map((c) => c.z.toFixed(2)),
    );
  });

  it('the last cup gives the other one last chance: a miss ends it, all in is overtime', () => {
    const last: PongState = {
      ...newPong(6),
      cups: { you: newPong(6).cups.you.slice(0, 2), partner: newPong(6).cups.partner.slice(0, 1) },
    };
    const r = applyThrow(last, 'you', 0);
    expect(r.won).toBe(false);
    expect(r.turnOver).toBe(true);
    expect(r.state.redemption).toBe('partner');
    // partner makes one, then misses: you win
    const one = applyThrow(r.state, 'partner', 0);
    expect(one.turnOver).toBe(false);
    const end = applyThrow(one.state, 'partner', null);
    expect(end.won).toBe(true);
    expect(end.state.winner).toBe('you');
    // or partner makes both: overtime, three cups each
    const both = applyThrow(one.state, 'partner', 0);
    expect(both.news).toContain('redeemed');
    expect(both.state.overtime).toBe(true);
    expect(both.state.cups.you).toHaveLength(3);
    expect(both.state.cups.partner).toHaveLength(3);
  });

  it('reads an older six-cup game', () => {
    const old = normalizePong({ racks: { you: [false, true, true, true, true, true], partner: [] } });
    expect(old.cups.you).toHaveLength(5);
    expect(old.cups.partner).toHaveLength(6);
    expect(normalizePong(undefined).cups.you).toHaveLength(10);
  });
});
