import { describe, expect, it } from 'vitest';
import {
  COCO_W,
  COCO_X,
  MAX_SPEED,
  START_SPEED,
  cocoRun,
  hopScore,
  jump,
  newRun,
  seeded,
  step,
  type HopState,
} from './hop';

const DT = 1 / 60;

/** Runs for `seconds`; `pilot` decides when to hop. */
function run(seconds: number, seed: number, pilot: (s: HopState) => boolean) {
  const rng = seeded(seed);
  let s = newRun();
  const events: string[] = [];
  for (let i = 0; i < seconds * 60 && !s.over; i++) {
    if (pilot(s)) {
      const j = jump(s);
      s = j.state;
      if (j.event) events.push(j.event);
    }
    const out = step(s, DT, false, rng);
    s = out.state;
    events.push(...out.events);
  }
  return { s, events };
}

/** Hops just before the next obstacle. */
const autopilot = (s: HopState) => {
  const front = s.distance + COCO_X + COCO_W;
  const next = s.obstacles.find((o) => o.x + o.w > s.distance + COCO_X);
  return !!next && s.y === 0 && next.x - front < s.speed * 0.09 && next.x - front > 0;
};

describe('Coco’s hop-race', () => {
  it('without hopping, Coco runs into something soon', () => {
    const { s, events } = run(30, 1, () => false);
    expect(s.over).toBe(true);
    expect(events.some((e) => e === 'crash' || e === 'splash')).toBe(true);
    expect(s.t).toBeLessThan(10);
  });

  it('every garden can be cleared: hopping in time, she runs a whole minute', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { s } = run(60, seed, autopilot);
      expect(s.over, `seed ${seed}`).toBe(false);
      expect(s.t).toBeGreaterThan(59);
    }
  });

  it('gets faster, up to a limit', () => {
    const { s } = run(90, 3, autopilot);
    expect(s.speed).toBeGreaterThan(START_SPEED);
    expect(s.speed).toBeLessThanOrEqual(MAX_SPEED);
  });

  it('treats on the way count, and the score is metres plus treats', () => {
    const { s, events } = run(60, 2, autopilot);
    expect(events).toContain('eat');
    expect(s.treatPoints).toBeGreaterThan(0);
    expect(hopScore(s)).toBe(Math.floor(s.distance / 40) + s.treatPoints);
  });

  it('one hop from the ground, one more in the air, then no more', () => {
    let s = newRun();
    const a = jump(s);
    expect(a.event).toBe('hop');
    s = step(a.state, DT, false).state;
    const b = jump(s);
    expect(b.event).toBe('double');
    expect(jump(b.state).event).toBeNull();
  });

  it('holding on makes the hop higher', () => {
    const peak = (held: boolean) => {
      let s = jump(newRun()).state;
      let top = 0;
      for (let i = 0; i < 90; i++) {
        s = step(s, DT, held, () => 0.99).state;
        top = Math.max(top, s.y);
      }
      return top;
    };
    expect(peak(true)).toBeGreaterThan(peak(false) * 1.3);
  });

  it('Coco’s own run lands in a fair range', () => {
    const rng = seeded(9);
    for (let i = 0; i < 200; i++) {
      const n = cocoRun(rng);
      expect(n).toBeGreaterThanOrEqual(140);
      expect(n).toBeLessThanOrEqual(680);
    }
  });
});
