import { describe, expect, it } from 'vitest';
import { IDEAL_FLICK, dartLanding, scoreAt, swayAt } from './darts';
import { LANE_RIGHT, rack, simulate, standingCount } from './bowlingPhysics';

/** A repeatable "random". */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

describe('throwing a dart', () => {
  const still = { x: 0, y: 0 };
  const bull = { x: 0, y: 0 };

  it('needs a good flick: pointing at the bullseye is not enough', () => {
    const good = dartLanding(bull, still, { speed: IDEAL_FLICK, slant: 0 }, seeded(1));
    expect(good.power).toBe('good');
    expect(Math.hypot(good.x, good.y)).toBeLessThan(0.11);
    const soft = dartLanding(bull, still, { speed: IDEAL_FLICK * 0.6, slant: 0 }, seeded(1));
    expect(soft.power).toBe('soft');
    expect(soft.y).toBeGreaterThan(0.3); // dropped well below the bull
    const hard = dartLanding(bull, still, { speed: IDEAL_FLICK * 1.5, slant: 0 }, seeded(1));
    expect(hard.power).toBe('hard');
    expect(hard.y).toBeLessThan(-0.3);
    const crooked = dartLanding(bull, still, { speed: IDEAL_FLICK, slant: 0.4 }, seeded(1));
    expect(crooked.x).toBeGreaterThan(0.15);
  });

  it('lands where the hand swayed to when it let go', () => {
    const swayed = dartLanding(
      bull,
      { x: 0.08, y: -0.05 },
      { speed: IDEAL_FLICK, slant: 0 },
      () => 0.5,
    );
    expect(swayed.x).toBeCloseTo(0.08, 1);
    expect(swayed.y).toBeCloseTo(-0.05, 1);
  });

  it('sways more the longer you hold', () => {
    const most = (from: number, to: number) => {
      let m = 0;
      for (let t = from; t < to; t += 0.01) m = Math.max(m, Math.hypot(swayAt(t).x, swayAt(t).y));
      return m;
    };
    expect(most(4, 6)).toBeGreaterThan(most(0, 1.4) * 1.5);
  });

  it('makes random-ish flicks at the bull score far less than the old point-and-tap', () => {
    const rng = seeded(5);
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const speed = IDEAL_FLICK * (0.7 + rng() * 0.6);
      const land = dartLanding(bull, swayAt(rng() * 3), { speed, slant: (rng() - 0.5) * 0.3 }, rng);
      total += scoreAt(land.x, land.y).score;
    }
    expect(total / 300).toBeLessThan(25);
  });
});

describe('bowling pins', () => {
  it('stand a foot apart and fill the end of the lane', () => {
    const pins = rack();
    expect(pins).toHaveLength(10);
    const xs = pins.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(55);
    expect(Math.max(...xs)).toBeLessThan(LANE_RIGHT);
  });

  it('a gutter ball takes none, a pocket ball usually all', () => {
    expect(
      standingCount(simulate({ x: 84, speed: 1, angle: 0.05, spin: 0 }, rack(), seeded(2)).pins),
    ).toBe(10);
    let strikes = 0;
    for (let i = 0; i < 40; i++) {
      const w = simulate({ x: 53, speed: 0.95, angle: 0, spin: 0 }, rack(), seeded(10 + i));
      if (standingCount(w.pins) === 0) strikes++;
    }
    expect(strikes).toBeGreaterThan(15);
  });

  it('a gentle tap makes a pin rock, not fall', () => {
    const w = simulate(
      { x: 50 + 4.15 + 7.3 - 0.3, speed: 0.12, angle: 0, spin: 0 },
      rack(),
      seeded(3),
    );
    expect(standingCount(w.pins)).toBe(10);
  });

  it('is never a strike every time', () => {
    const rng = seeded(7);
    let strikes = 0;
    for (let i = 0; i < 200; i++) {
      const w = simulate(
        {
          x: 50 + (rng() - 0.5) * 24,
          speed: 0.6 + rng() * 0.8,
          angle: (rng() - 0.5) * 0.08,
          spin: (rng() - 0.5) * 1.2,
        },
        rack(),
        rng,
      );
      if (standingCount(w.pins) === 0) strikes++;
    }
    expect(strikes / 200).toBeGreaterThan(0.1);
    expect(strikes / 200).toBeLessThan(0.45);
  });
});
