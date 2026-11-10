/*
 * Basketbal, the arcade way: 45 seconds, as many baskets as you can. Swipe
 * up to shoot: how far you swipe is how hard, the direction is where it
 * goes. Halfway the hoop starts to move; the last 15 seconds a basket is
 * worth 3. Three in a row and you're on fire (+1 each); a swish is +1 too.
 *
 * Metres: x to the side, y up, z away from you. You throw from z = 0.
 */

export const ROUND_SECONDS = 45;
export const MOVING_FROM = 22;
export const THREES_FROM = ROUND_SECONDS - 15;
export const FIRE_AT = 3;

export const G = 9.8;
export const RELEASE = { y: 1.2, z: 0 };
export const RIM = { y: 2.6, z: 4, r: 0.23 };
export const BOARD = { z: RIM.z + 0.32, top: 3.5, half: 0.75 };
export const BALL_R = 0.12;

export interface Ball {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds in the air. */
  age: number;
  /** Through the hoop (or off the rim and out). */
  result?: 'swish' | 'in' | 'rim' | 'miss';
  /** Has already touched rim or board (no swish any more). */
  touched: boolean;
  done: boolean;
}

export interface HoopsState {
  t: number;
  balls: Ball[];
  score: number;
  made: number;
  shots: number;
  streak: number;
  bestStreak: number;
  swishes: number;
  seq: number;
  over: boolean;
}

export type HoopsEvent =
  | { type: 'score'; points: number; swish: boolean; fire: boolean; x: number }
  | { type: 'rim' }
  | { type: 'board' }
  | { type: 'miss'; why: 'short' | 'long' | 'left' | 'right' }
  | { type: 'moving' }
  | { type: 'threes' }
  | { type: 'end' };

export const newHoops = (): HoopsState => ({
  t: 0,
  balls: [],
  score: 0,
  made: 0,
  shots: 0,
  streak: 0,
  bestStreak: 0,
  swishes: 0,
  seq: 0,
  over: false,
});

/** Where the hoop is, side to side: still at first, then swaying. */
export const hoopX = (t: number) =>
  t < MOVING_FROM ? 0 : Math.sin((t - MOVING_FROM) * 1.35) * 0.55;

export const onFire = (s: HoopsState) => s.streak >= FIRE_AT;

/**
 * A throw. `power` 1 is just right for the hoop straight ahead; `aim` is the
 * sideways part of the swipe as a fraction of the upward part.
 */
export function shoot(s: HoopsState, power: number, aim: number): HoopsState {
  if (s.over) return s;
  if (s.balls.filter((b) => !b.done && b.age < 0.28).length) return s;
  const p = Math.max(0.3, Math.min(1.6, power));
  const vz = 5 * p;
  const vy = 5.67 * p;
  const ball: Ball = {
    id: s.seq + 1,
    x: 0,
    y: RELEASE.y,
    z: RELEASE.z,
    // A swipe is never perfectly straight: a little sideways counts as straight.
    vx: (Math.abs(aim) < 0.05 ? 0 : Math.max(-1.2, Math.min(1.2, aim)) * 0.4) * vz,
    vy,
    vz,
    age: 0,
    touched: false,
    done: false,
  };
  return { ...s, seq: s.seq + 1, shots: s.shots + 1, balls: [...s.balls, ball].slice(-6) };
}

function pointsFor(s: HoopsState, swish: boolean) {
  const base = s.t >= THREES_FROM ? 3 : 2;
  return base + (onFire(s) ? 1 : 0) + (swish ? 1 : 0);
}

/** Time passes: the balls fly, hit, fall through or miss. */
export function step(
  s: HoopsState,
  dt: number,
  rng: () => number = Math.random,
): { state: HoopsState; events: HoopsEvent[] } {
  if (s.over) return { state: s, events: [] };
  const events: HoopsEvent[] = [];
  const d = Math.max(0, Math.min(dt, 0.05));
  const t = s.t + d;
  let next: HoopsState = { ...s, t };
  if (s.t < MOVING_FROM && t >= MOVING_FROM) events.push({ type: 'moving' });
  if (s.t < THREES_FROM && t >= THREES_FROM) events.push({ type: 'threes' });
  const hx = hoopX(t);
  const balls: Ball[] = [];
  for (const old of s.balls) {
    if (old.done) {
      balls.push(old);
      continue;
    }
    // A few small steps, so a fast ball can't jump past the rim.
    let b = { ...old };
    const n = 4;
    for (let k = 0; k < n && !b.done; k++) {
      const h = d / n;
      const prevY = b.y;
      const prevZ = b.z;
      b = {
        ...b,
        x: b.x + b.vx * h,
        y: b.y + b.vy * h,
        z: b.z + b.vz * h,
        vy: b.vy - G * h,
        age: b.age + h,
      };
      // the backboard
      if (
        prevZ < BOARD.z - BALL_R &&
        b.z >= BOARD.z - BALL_R &&
        b.y > RIM.y - 0.05 &&
        b.y < BOARD.top &&
        Math.abs(b.x - hx) < BOARD.half
      ) {
        b = { ...b, z: BOARD.z - BALL_R, vz: -b.vz * 0.45, vx: b.vx * 0.7, touched: true };
        events.push({ type: 'board' });
      }
      // down through the rim's height
      if (prevY >= RIM.y && b.y < RIM.y && b.vy < 0 && !b.result) {
        const dist = Math.hypot(b.x - hx, b.z - RIM.z);
        if (dist < RIM.r - BALL_R * 0.15) {
          const clean = !b.touched && dist < RIM.r * 0.55;
          b = { ...b, result: clean ? 'swish' : 'in', vx: 0, vz: 0, x: hx, z: RIM.z };
        } else if (dist < RIM.r + BALL_R) {
          // on the rim: it rattles… in or out
          events.push({ type: 'rim' });
          if (rng() < 0.45)
            b = { ...b, result: 'in', touched: true, vx: 0, vz: 0, x: hx, z: RIM.z };
          else {
            const away = Math.atan2(b.z - RIM.z, b.x - hx);
            b = {
              ...b,
              result: 'rim',
              touched: true,
              vy: 1.6,
              vx: Math.cos(away) * 1.8,
              vz: Math.sin(away) * 1.8,
            };
          }
        }
        if (b.result === 'in' || b.result === 'swish') {
          const swish = b.result === 'swish';
          const streak = next.streak + 1;
          const fireBefore = onFire(next);
          const points = pointsFor({ ...next, streak: fireBefore ? next.streak : 0 }, swish);
          next = {
            ...next,
            score: next.score + points,
            made: next.made + 1,
            streak,
            bestStreak: Math.max(next.bestStreak, streak),
            swishes: next.swishes + (swish ? 1 : 0),
          };
          events.push({ type: 'score', points, swish, fire: streak >= FIRE_AT, x: hx });
        }
      }
      // the floor: this ball is done
      if (b.y < BALL_R && b.vy < 0) {
        if (!b.result) {
          const why =
            b.z < RIM.z - RIM.r ? 'short' : b.z > BOARD.z ? 'long' : b.x < hx ? 'left' : 'right';
          b = { ...b, result: 'miss' };
          events.push({ type: 'miss', why });
        }
        if (b.result === 'miss' || b.result === 'rim') next = { ...next, streak: 0 };
        b = { ...b, y: BALL_R, done: true };
      }
      if (b.age > 4) b = { ...b, done: true };
    }
    balls.push(b);
  }
  next = { ...next, balls: balls.filter((b) => !b.done || b.age < 4.6).slice(-6) };
  if (t >= ROUND_SECONDS && !next.balls.some((b) => !b.done)) {
    next = { ...next, t: ROUND_SECONDS, over: true };
    events.push({ type: 'end' });
  } else if (t >= ROUND_SECONDS) next = { ...next, t: ROUND_SECONDS };
  return { state: next, events };
}

/** Is the clock still running (you may shoot)? */
export const canShoot = (s: HoopsState) => !s.over && s.t < ROUND_SECONDS;

/** Coco at the hoop machine: her paws are quick but not always straight. */
export function cocoHoops(rng: () => number = Math.random): number {
  let score = 0;
  let streak = 0;
  const shots = 28 + Math.floor(rng() * 10);
  for (let i = 0; i < shots; i++) {
    const t = (i / shots) * ROUND_SECONDS;
    const chance = t < MOVING_FROM ? 0.55 : 0.4;
    if (rng() < chance) {
      streak++;
      score += (t >= THREES_FROM ? 3 : 2) + (streak > FIRE_AT ? 1 : 0) + (rng() < 0.3 ? 1 : 0);
    } else streak = 0;
  }
  return score;
}

/** Where a point lands on screen (a simple camera behind the shooter). */
export const CAMERA = { y: 1.6, back: 2.5, f: 1020, cx: 180, horizon: 307 };
export function project(x: number, y: number, z: number) {
  const depth = z + CAMERA.back;
  const k = CAMERA.f / depth;
  return { x: CAMERA.cx + x * k, y: CAMERA.horizon - (y - CAMERA.y) * k, k };
}
