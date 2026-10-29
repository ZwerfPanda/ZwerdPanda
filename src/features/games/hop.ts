import type { PetFood } from '../../data/types';

/*
 * Coco's hop-race: Coco runs through the garden, hops over flower pots,
 * little fences and puddles, and eats her treats on the way. One run, one
 * score: how far she got, plus everything she ate.
 *
 * The world in game units: the ground is at y = 0 and up is positive. Things
 * have a world x; on screen they're at x − distance, while Coco stays at
 * COCO_X and the world scrolls past her.
 */

export const COCO_X = 70;
export const COCO_W = 44;
export const COCO_H = 38;
/** A little forgiveness: the hitbox is smaller than the drawing. */
const HIT_IN = 7;

export const START_SPEED = 230;
export const MAX_SPEED = 540;
const SPEED_UP = 5.5;
const GRAVITY = 2100;
/** While the finger stays down on the way up, she floats a bit longer. */
const GRAVITY_HELD = 1150;
export const JUMP_V = 640;
const DOUBLE_V = 540;

export type ObstacleKind = 'pot' | 'fence' | 'puddle' | 'pots';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  w: number;
  h: number;
}

export interface Treat {
  id: number;
  food: PetFood;
  x: number;
  y: number;
  eaten: boolean;
}

/** How big a treat is (wide and tall). */
export const TREAT = 28;

export const TREAT_POINTS: Partial<Record<PetFood, number>> = {
  carrot: 10,
  apple: 10,
  banana: 15,
  strawberry: 25,
};

export interface HopState {
  t: number;
  speed: number;
  distance: number;
  y: number;
  vy: number;
  /** Jumps used since she last touched the ground (two at most). */
  jumps: number;
  obstacles: Obstacle[];
  treats: Treat[];
  /** World x where the next thing appears. */
  nextAt: number;
  treatPoints: number;
  eaten: number;
  over: boolean;
  /** What hit her, for the ending. */
  hit?: ObstacleKind;
  seq: number;
}

export type HopEvent = 'hop' | 'double' | 'land' | 'eat' | 'crash' | 'splash';

export const SIZES: Record<ObstacleKind, { w: number; h: number }> = {
  pot: { w: 26, h: 30 },
  fence: { w: 36, h: 40 },
  puddle: { w: 64, h: 5 },
  pots: { w: 54, h: 30 },
};

export function newRun(): HopState {
  return {
    t: 0,
    speed: START_SPEED,
    distance: 0,
    y: 0,
    vy: 0,
    jumps: 0,
    obstacles: [],
    treats: [],
    nextAt: 520,
    treatPoints: 0,
    eaten: 0,
    over: false,
    seq: 0,
  };
}

/** Metres run (game units are small: 40 to a metre). */
export const metres = (distance: number) => Math.floor(distance / 40);
export const hopScore = (s: Pick<HopState, 'distance' | 'treatPoints'>) =>
  metres(s.distance) + s.treatPoints;

/** Jumping: from the ground, or once more in the air. */
export function jump(s: HopState): { state: HopState; event: HopEvent | null } {
  if (s.over) return { state: s, event: null };
  if (s.y <= 0 && s.jumps === 0) return { state: { ...s, vy: JUMP_V, jumps: 1 }, event: 'hop' };
  if (s.jumps === 1) return { state: { ...s, vy: DOUBLE_V, jumps: 2 }, event: 'double' };
  return { state: s, event: null };
}

const FOODS: PetFood[] = ['carrot', 'carrot', 'carrot', 'apple', 'banana', 'strawberry'];

/** The next bit of garden: an obstacle, maybe with a treat above or after it. */
function spawn(s: HopState, rng: () => number): HopState {
  const at = s.distance + 460; // just off the right edge
  const r = rng();
  const late = s.speed > 340;
  const kind: ObstacleKind =
    r < 0.4 ? 'pot' : r < 0.62 ? 'fence' : r < 0.82 ? 'puddle' : late ? 'pots' : 'pot';
  const { w, h } = SIZES[kind];
  // The gap to the next one: shorter as she gets faster, but always jumpable.
  const airTime = (2 * JUMP_V) / GRAVITY;
  const minGap = Math.max(170, s.speed * airTime * 0.9);
  const gap = minGap + rng() * (230 + 120 * (1 - s.speed / MAX_SPEED));
  let seq = s.seq;
  const obstacles = [...s.obstacles, { id: ++seq, kind, x: at, w, h }];
  const treats = [...s.treats];
  const t = rng();
  if (t < 0.45) {
    // a treat right above it: only for whoever hops
    const food = FOODS[Math.floor(rng() * FOODS.length)];
    treats.push({
      id: ++seq,
      food,
      x: at + w / 2 - TREAT / 2,
      y: h + 46 + rng() * 30,
      eaten: false,
    });
  } else if (t < 0.8) {
    // a little row on the ground after it, with room to land and hop again
    const room = Math.floor((gap - 130) / 34);
    const n = Math.min(4, room, 2 + Math.floor(rng() * 3));
    for (let i = 0; i < n; i++)
      treats.push({ id: ++seq, food: 'carrot', x: at + w + 60 + i * 34, y: 2, eaten: false });
  }
  return { ...s, obstacles, treats, seq, nextAt: at + w + gap - 460 };
}

const overlaps = (ax: number, aw: number, bx: number, bw: number) => ax < bx + bw && bx < ax + aw;

/** One step of the run. `held`: the finger (or key) is still down. */
export function step(
  s: HopState,
  dt: number,
  held: boolean,
  rng: () => number = Math.random,
): { state: HopState; events: HopEvent[] } {
  if (s.over) return { state: s, events: [] };
  const events: HopEvent[] = [];
  const d = Math.min(dt, 0.05);
  let next: HopState = { ...s, t: s.t + d };
  next.speed = Math.min(MAX_SPEED, s.speed + SPEED_UP * d);
  next.distance = s.distance + next.speed * d;

  // up and down
  const g = held && s.vy > 0 ? GRAVITY_HELD : GRAVITY;
  let vy = s.vy - g * d;
  let y = s.y + s.vy * d - (g * d * d) / 2;
  if (y <= 0) {
    if (s.y > 0) events.push('land');
    y = 0;
    vy = 0;
    next.jumps = 0;
  }
  next.y = y;
  next.vy = vy;

  if (next.distance >= next.nextAt) next = spawn(next, rng);

  // what she runs into (Coco's hitbox, in world x)
  const cx = next.distance + COCO_X + HIT_IN;
  const cw = COCO_W - HIT_IN * 2;
  for (const o of next.obstacles) {
    if (!overlaps(cx, cw, o.x, o.w)) continue;
    if (o.kind === 'puddle' ? next.y <= 1 : next.y < o.h - 4) {
      next = { ...next, over: true, hit: o.kind };
      events.push(o.kind === 'puddle' ? 'splash' : 'crash');
      return { state: next, events };
    }
  }

  // what she eats
  let ate = false;
  const treats = next.treats.map((tr) => {
    if (tr.eaten) return tr;
    const hitX = overlaps(next.distance + COCO_X, COCO_W, tr.x, TREAT);
    const hitY = tr.y < next.y + COCO_H + 6 && tr.y + TREAT > next.y;
    if (!hitX || !hitY) return tr;
    ate = true;
    next.treatPoints += TREAT_POINTS[tr.food] ?? 10;
    next.eaten += 1;
    return { ...tr, eaten: true };
  });
  if (ate) events.push('eat');

  // forget what's far behind
  const behind = next.distance - 120;
  next.treats = treats.filter((tr) => tr.x > behind);
  next.obstacles = next.obstacles.filter((o) => o.x + o.w > behind);
  return { state: next, events };
}

/** Coco's own run, when you play against her: she knows the garden well. */
export function cocoRun(rng: () => number = Math.random): number {
  const base = 140 + rng() * 260;
  const lucky = rng() < 0.2 ? 120 + rng() * 160 : 0;
  return Math.round(base + lucky);
}

/** A seeded random, so a run can be replayed in tests. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
