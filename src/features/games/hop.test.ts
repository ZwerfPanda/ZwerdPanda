import { describe, expect, it } from 'vitest';
import {
  COCO_W,
  COCO_X,
  HEDGEHOG_SPEED,
  MAX_SPEED,
  START_SPEED,
  ZONES,
  cocoRun,
  hopScore,
  jump,
  newRun,
  seeded,
  step,
  streakTimes,
  type HopEvent,
  type HopState,
} from './hop';

const DT = 1 / 60;

/** Runs for `seconds`; `pilot` decides when to hop. */
function run(seconds: number, seed: number, pilot: (s: HopState) => boolean, from = newRun()) {
  const rng = seeded(seed);
  let s = from;
  const events: HopEvent[] = [];
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

/** Hops just before whatever's on the ground ahead; stays down for bees. */
const autopilot = (s: HopState) => {
  const front = s.distance + COCO_X + COCO_W;
  const next = s.obstacles.find((o) => !o.gone && o.x + o.w > s.distance + COCO_X);
  if (!next || next.kind === 'bee' || s.y > 0) return false;
  const closing = s.speed + (next.kind === 'hedgehog' ? HEDGEHOG_SPEED : 0);
  const gap = next.x - front;
  return gap > 0 && gap < closing * 0.09;
};

/** A run that starts further along (bees and hedgehogs come later). */
const startAt = (m: number): HopState => ({
  ...newRun(),
  distance: m * 40,
  nextAt: m * 40 + 200,
  speed: 360,
  zone: Math.floor(m / 300) % 4,
});

describe('Coco’s hop-race', () => {
  it('without hopping, Coco runs into something soon', () => {
    const { s, events } = run(30, 1, () => false);
    expect(s.over).toBe(true);
    expect(events.some((e) => e.type === 'crash' || e.type === 'splash')).toBe(true);
    expect(s.t).toBeLessThan(10);
  });

  it('every garden can be cleared: hopping in time, she runs a whole minute', () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { s } = run(60, seed, autopilot);
      expect(s.over, `seed ${seed}`).toBe(false);
      expect(s.t).toBeGreaterThan(59);
    }
  });

  it('further on too: bees to run under and hedgehogs coming at her', () => {
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const { s, events } = run(70, seed, autopilot, startAt(560));
      expect(s.over, `seed ${seed}: hit ${s.hit}`).toBe(false);
      expect(s.dodged).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'zone')).toBe(true);
    }
  });

  it('hopping under a bee is a bump', () => {
    let s = startAt(400);
    s = {
      ...s,
      obstacles: [{ id: 1, kind: 'bee', x: s.distance + COCO_X + 40, y: 54, w: 26, h: 18 }],
      nextAt: s.distance + 5000,
    };
    s = jump(s).state;
    const { s: end } = run(1, 1, () => false, s);
    expect(end.over).toBe(true);
    expect(end.hit).toBe('bee');
  });

  it('a hug forgives one bump', () => {
    let s = { ...newRun(), shield: true, nextAt: 99999 };
    s = { ...s, obstacles: [{ id: 1, kind: 'pot', x: COCO_X + 60, y: 0, w: 26, h: 30 }] };
    const { s: end, events } = run(2, 1, () => false, s);
    expect(end.over).toBe(false);
    expect(end.shield).toBe(false);
    expect(events.some((e) => e.type === 'hug')).toBe(true);
  });

  it('power-ups: the golden carrot pulls treats in, the star doubles them', () => {
    const base = { ...newRun(), nextAt: 99999 };
    const treats = [{ id: 1, food: 'strawberry' as const, x: COCO_X + 120, y: 80, eaten: false }];
    const plain = run(1, 1, () => false, { ...base, treats }).s;
    expect(plain.eaten).toBe(0);
    const pulled = run(1, 1, () => false, { ...base, treats, magnetUntil: 10 }).s;
    expect(pulled.eaten).toBe(1);
    const star = run(1, 1, () => false, { ...base, treats, magnetUntil: 10, starUntil: 10 }).s;
    expect(star.treatPoints).toBe(pulled.treatPoints * 2);
  });

  it('treats in a row count more, and a missed one starts over', () => {
    expect([1, 9, 10, 24, 25, 40].map(streakTimes)).toEqual([1, 1, 2, 2, 3, 3]);
    const row = Array.from({ length: 11 }, (_, i) => ({
      id: i + 1,
      food: 'carrot' as const,
      x: COCO_X + 80 + i * 34,
      y: 2,
      eaten: false,
    }));
    const { s } = run(2, 1, () => false, { ...newRun(), nextAt: 99999, treats: row });
    expect(s.eaten).toBe(11);
    expect(s.treatPoints).toBe(9 * 10 + 2 * 20);
    expect(s.bestStreak).toBe(11);
    const skip = [{ ...row[0], y: 120 }, { ...row[3] }];
    const missed = run(2, 1, () => false, { ...newRun(), nextAt: 99999, streak: 7, treats: skip });
    expect(missed.events.some((e) => e.type === 'miss')).toBe(true);
    expect(missed.s.streak).toBe(1);
  });

  it('gets faster, up to a limit, through every part of the run', () => {
    const { s, events } = run(150, 3, autopilot);
    expect(s.speed).toBeGreaterThan(START_SPEED);
    expect(s.speed).toBeLessThanOrEqual(MAX_SPEED);
    const zones = events.filter((e) => e.type === 'zone').map((e) => (e as { zone: number }).zone);
    expect(zones.slice(0, 3)).toEqual([1, 2, 3]);
    expect(ZONES).toHaveLength(4);
  });

  it('treats on the way count, and the score is metres plus treats', () => {
    const { s, events } = run(60, 2, autopilot);
    expect(events.some((e) => e.type === 'eat')).toBe(true);
    expect(s.treatPoints).toBeGreaterThan(0);
    expect(hopScore(s)).toBe(Math.floor(s.distance / 40) + s.treatPoints);
  });

  it('one hop from the ground, one more in the air, then no more', () => {
    let s = newRun();
    const a = jump(s);
    expect(a.event?.type).toBe('hop');
    s = step(a.state, DT, false).state;
    const b = jump(s);
    expect(b.event?.type).toBe('double');
    expect(jump(b.state).event).toBeNull();
  });

  it('holding on makes the hop higher', () => {
    const peak = (held: boolean) => {
      let s = { ...jump(newRun()).state, nextAt: 99999 };
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
      expect(n).toBeGreaterThanOrEqual(220);
      expect(n).toBeLessThanOrEqual(1100);
    }
  });
});
