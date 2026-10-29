import type { PetFood } from '../../data/types';

/*
 * Coco's hop-race: Coco runs from the garden through a flower field, along a
 * canal and into a starry night. She hops over flower pots, fences, puddles
 * and hedgehogs, runs under the bees, eats her treats on the way, and finds
 * a hug (one bump forgiven), a golden carrot (treats come to her) or a star
 * (double points). Treats in a row build a streak that counts double, then
 * triple. One run, one score: metres, plus everything she ate.
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
/** A hedgehog trundles towards her. */
export const HEDGEHOG_SPEED = 45;

export type ObstacleKind = 'pot' | 'fence' | 'puddle' | 'pots' | 'bee' | 'hedgehog';
export type PowerKind = 'hug' | 'magnet' | 'star';

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number;
  /** Bottom edge above the ground (a bee flies; everything else stands). */
  y: number;
  w: number;
  h: number;
  /** Burst by a hug: no longer in the way. */
  gone?: boolean;
}

export interface Treat {
  id: number;
  food: PetFood;
  x: number;
  y: number;
  eaten: boolean;
}

export interface Power {
  id: number;
  kind: PowerKind;
  x: number;
  y: number;
  taken: boolean;
}

/** How big a treat (or a power-up) is, wide and tall. */
export const TREAT = 28;

export const TREAT_POINTS: Partial<Record<PetFood, number>> = {
  carrot: 10,
  apple: 10,
  banana: 15,
  strawberry: 25,
};

export const POWER_SECONDS: Record<Exclude<PowerKind, 'hug'>, number> = { magnet: 7, star: 8 };

/** The four parts of the run, each 300 m; after the night a new day starts. */
export const ZONES = [
  { id: 'tuin', name: 'De tuin', emoji: '🌷' },
  { id: 'bloemen', name: 'Het bloemenveld', emoji: '🌻' },
  { id: 'gracht', name: 'Langs de gracht', emoji: '🚲' },
  { id: 'nacht', name: 'Sterrennacht', emoji: '✨' },
] as const;
export type ZoneId = (typeof ZONES)[number]['id'];
export const ZONE_METRES = 300;
export const zoneAt = (distance: number) =>
  Math.max(0, Math.floor(metres(distance) / ZONE_METRES)) % ZONES.length;

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
  powers: Power[];
  /** World x where the next thing appears. */
  nextAt: number;
  treatPoints: number;
  eaten: number;
  /** Treats in a row (one that slips past starts it over). */
  streak: number;
  bestStreak: number;
  /** A hug: the next bump is forgiven. */
  shield: boolean;
  /** Until when (run time) the power lasts. */
  magnetUntil: number;
  starUntil: number;
  /** After a hug burst: a moment where nothing hurts. */
  safeUntil: number;
  zone: number;
  /** Hedgehogs and bees hopped over or run under. */
  dodged: number;
  over: boolean;
  /** What hit her, for the ending. */
  hit?: ObstacleKind;
  seq: number;
}

export type HopEvent =
  | { type: 'hop' }
  | { type: 'double' }
  | { type: 'land' }
  | { type: 'eat'; food: PetFood; x: number; y: number; points: number; streak: number }
  | { type: 'miss' }
  | { type: 'power'; kind: PowerKind; x: number; y: number }
  | { type: 'hug'; x: number }
  | { type: 'zone'; zone: number }
  | { type: 'crash'; kind: ObstacleKind }
  | { type: 'splash' };

export const SIZES: Record<ObstacleKind, { w: number; h: number; y?: number }> = {
  pot: { w: 26, h: 30 },
  fence: { w: 36, h: 40 },
  puddle: { w: 64, h: 5 },
  pots: { w: 54, h: 30 },
  bee: { w: 26, h: 18, y: 54 },
  hedgehog: { w: 34, h: 22 },
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
    powers: [],
    nextAt: 520,
    treatPoints: 0,
    eaten: 0,
    streak: 0,
    bestStreak: 0,
    shield: false,
    magnetUntil: 0,
    starUntil: 0,
    safeUntil: 0,
    zone: 0,
    dodged: 0,
    over: false,
    seq: 0,
  };
}

/** Metres run (game units are small: 40 to a metre). */
export function metres(distance: number) {
  return Math.floor(distance / 40);
}
export const hopScore = (s: Pick<HopState, 'distance' | 'treatPoints'>) =>
  metres(s.distance) + s.treatPoints;

/** Treats in a row count more: ×2 from 10, ×3 from 25. */
export const streakTimes = (streak: number) => (streak >= 25 ? 3 : streak >= 10 ? 2 : 1);

/** Jumping: from the ground, or once more in the air. */
export function jump(s: HopState): { state: HopState; event: HopEvent | null } {
  if (s.over) return { state: s, event: null };
  if (s.y <= 0 && s.jumps === 0)
    return { state: { ...s, vy: JUMP_V, jumps: 1 }, event: { type: 'hop' } };
  if (s.jumps === 1) return { state: { ...s, vy: DOUBLE_V, jumps: 2 }, event: { type: 'double' } };
  return { state: s, event: null };
}

const FOODS: PetFood[] = ['carrot', 'carrot', 'carrot', 'apple', 'banana', 'strawberry'];

function pickKind(s: HopState, rng: () => number): ObstacleKind {
  const m = metres(s.distance);
  const late = s.speed > 340;
  // bees from the flower field on, hedgehogs from the canal on
  const r = rng();
  if (m > 260 && r < 0.14) return 'bee';
  if (m > 560 && r < 0.26) return 'hedgehog';
  const q = rng();
  return q < 0.4 ? 'pot' : q < 0.62 ? 'fence' : q < 0.82 ? 'puddle' : late ? 'pots' : 'pot';
}

/** The next bit of the run: an obstacle, maybe a treat or a power-up with it. */
function spawn(s: HopState, rng: () => number): HopState {
  const kind = pickKind(s, rng);
  const { w, h, y = 0 } = SIZES[kind];
  // A hedgehog comes towards her, so it starts a little further off; a bee
  // too, so she's back on the ground before she's under it.
  const at = s.distance + 460 + (kind === 'hedgehog' ? s.speed * 0.25 : kind === 'bee' ? 110 : 0);
  // The gap to the next one: shorter as she gets faster, but always jumpable.
  const airTime = (2 * JUMP_V) / GRAVITY;
  const minGap = Math.max(170, s.speed * airTime * 0.9) + (kind === 'bee' ? 60 : 0);
  const gap = minGap + rng() * (230 + 120 * (1 - s.speed / MAX_SPEED));
  let seq = s.seq;
  const obstacles = [...s.obstacles, { id: ++seq, kind, x: at, y, w, h }];
  const treats = [...s.treats];
  const powers = [...s.powers];
  const t = rng();
  if (kind === 'bee') {
    // under a bee: a carrot trail on the ground, for whoever stays down
    for (let i = 0; i < 3; i++)
      treats.push({ id: ++seq, food: 'carrot', x: at - 30 + i * 30, y: 2, eaten: false });
  } else if (t < 0.1) {
    // now and then a power-up, high above: hop for it
    const kinds: PowerKind[] = s.shield ? ['magnet', 'star'] : ['hug', 'magnet', 'star'];
    const k = kinds[Math.floor(rng() * kinds.length)];
    powers.push({ id: ++seq, kind: k, x: at + w / 2 - TREAT / 2, y: h + 60, taken: false });
  } else if (t < 0.5) {
    // a treat right above it: only for whoever hops
    const food = FOODS[Math.floor(rng() * FOODS.length)];
    treats.push({
      id: ++seq,
      food,
      x: at + w / 2 - TREAT / 2,
      y: h + 46 + rng() * 30,
      eaten: false,
    });
  } else if (t < 0.85) {
    // a little row on the ground after it, with room to land and hop again
    const room = Math.floor((gap - 130) / 34);
    const n = Math.min(4, room, 2 + Math.floor(rng() * 3));
    for (let i = 0; i < n; i++)
      treats.push({ id: ++seq, food: 'carrot', x: at + w + 60 + i * 34, y: 2, eaten: false });
  }
  return { ...s, obstacles, treats, powers, seq, nextAt: at + w + gap - 460 };
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
  // (a first frame can come with a timestamp just before ours: never step back)
  const d = Math.max(0, Math.min(dt, 0.05));
  let next: HopState = { ...s, t: s.t + d };
  next.speed = Math.min(MAX_SPEED, s.speed + SPEED_UP * d);
  next.distance = s.distance + next.speed * d;

  // up and down
  const g = held && s.vy > 0 ? GRAVITY_HELD : GRAVITY;
  let vy = s.vy - g * d;
  let y = s.y + s.vy * d - (g * d * d) / 2;
  if (y <= 0) {
    if (s.y > 0) events.push({ type: 'land' });
    y = 0;
    vy = 0;
    next.jumps = 0;
  }
  next.y = y;
  next.vy = vy;

  // a new part of the run
  const zone = zoneAt(next.distance);
  if (zone !== s.zone) {
    next.zone = zone;
    events.push({ type: 'zone', zone });
  }

  if (next.distance >= next.nextAt) next = spawn(next, rng);

  // hedgehogs trundle, bees bob
  next.obstacles = next.obstacles.map((o) =>
    o.kind === 'hedgehog'
      ? { ...o, x: o.x - HEDGEHOG_SPEED * d }
      : o.kind === 'bee'
        ? { ...o, y: 54 + Math.sin(next.t * 6 + o.id) * 4 }
        : o,
  );

  // what she runs into (Coco's hitbox, in world x)
  const cx = next.distance + COCO_X + HIT_IN;
  const cw = COCO_W - HIT_IN * 2;
  const cTop = next.y + COCO_H - 4;
  if (next.t >= next.safeUntil) {
    for (const o of next.obstacles) {
      if (o.gone || !overlaps(cx, cw, o.x, o.w)) continue;
      const hits =
        o.kind === 'puddle'
          ? next.y <= 1
          : o.kind === 'bee'
            ? cTop > o.y + 3 && next.y < o.y + o.h - 3
            : next.y < o.h - 4;
      if (!hits) continue;
      if (next.shield) {
        // a hug: the bump is forgiven, the thing in the way is gone
        next = {
          ...next,
          shield: false,
          safeUntil: next.t + 1,
          obstacles: next.obstacles.map((x) => (x.id === o.id ? { ...x, gone: true } : x)),
        };
        events.push({ type: 'hug', x: o.x });
        break;
      }
      next = { ...next, over: true, hit: o.kind };
      events.push(o.kind === 'puddle' ? { type: 'splash' } : { type: 'crash', kind: o.kind });
      return { state: next, events };
    }
  }

  // the golden carrot pulls treats in
  const magnet = next.t < next.magnetUntil;
  const cocoMid = next.distance + COCO_X + COCO_W / 2;
  if (magnet)
    next.treats = next.treats.map((tr) => {
      const dx = cocoMid - (tr.x + TREAT / 2);
      if (tr.eaten || dx < -260 || dx > 40) return tr;
      const pull = Math.min(1, d * 7);
      return { ...tr, x: tr.x + dx * pull, y: tr.y + (next.y + 10 - tr.y) * pull };
    });

  // what she eats
  const doubled = next.t < next.starUntil;
  const treats = next.treats.map((tr) => {
    if (tr.eaten) return tr;
    const hitX = overlaps(next.distance + COCO_X, COCO_W, tr.x, TREAT);
    const hitY = tr.y < next.y + COCO_H + 6 && tr.y + TREAT > next.y;
    if (!hitX || !hitY) return tr;
    next.streak += 1;
    next.bestStreak = Math.max(next.bestStreak, next.streak);
    const points = (TREAT_POINTS[tr.food] ?? 10) * streakTimes(next.streak) * (doubled ? 2 : 1);
    next.treatPoints += points;
    next.eaten += 1;
    events.push({ type: 'eat', food: tr.food, x: tr.x, y: tr.y, points, streak: next.streak });
    return { ...tr, eaten: true };
  });

  // and the power-ups she catches
  next.powers = next.powers.map((p) => {
    if (p.taken) return p;
    const hitX = overlaps(next.distance + COCO_X, COCO_W, p.x, TREAT);
    const hitY = p.y < next.y + COCO_H + 6 && p.y + TREAT > next.y;
    if (!hitX || !hitY) return p;
    if (p.kind === 'hug') next.shield = true;
    if (p.kind === 'magnet') next.magnetUntil = next.t + POWER_SECONDS.magnet;
    if (p.kind === 'star') next.starUntil = next.t + POWER_SECONDS.star;
    events.push({ type: 'power', kind: p.kind, x: p.x, y: p.y });
    return { ...p, taken: true };
  });

  // forget what's far behind (a treat that slipped past ends the streak)
  const behind = next.distance - 120;
  const passedBy = next.distance + COCO_X - TREAT;
  if (treats.some((tr) => !tr.eaten && tr.x < passedBy && tr.x >= passedBy - next.speed * d)) {
    if (next.streak > 0) events.push({ type: 'miss' });
    next.streak = 0;
  }
  const dodged = next.obstacles.filter(
    (o) =>
      (o.kind === 'bee' || o.kind === 'hedgehog') &&
      !o.gone &&
      o.x + o.w <= cx &&
      o.x + o.w > cx - (next.speed + HEDGEHOG_SPEED) * d,
  ).length;
  next.dodged += dodged;
  next.treats = treats.filter((tr) => tr.x > behind);
  next.powers = next.powers.filter((p) => p.x > behind);
  next.obstacles = next.obstacles.filter((o) => o.x + o.w > behind);
  return { state: next, events };
}

/** Coco's own run, when you play against her: she knows the garden well. */
export function cocoRun(rng: () => number = Math.random): number {
  const base = 220 + rng() * 380;
  const lucky = rng() < 0.2 ? 200 + rng() * 300 : 0;
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
