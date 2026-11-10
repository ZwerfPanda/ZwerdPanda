/*
 * Beer pong: six red cups in a triangle at the other end of the table.
 * Swipe up to throw (length is power, direction is aim); two balls a turn,
 * both in and you get them back. A ball can bounce off the table once and
 * still drop in. Whoever clears the other's cups first wins.
 *
 * Metres: x to the side, y up from the table top, z away from you.
 */

export type Side = 'you' | 'partner';
export const CUPS = 6;
export const BALLS_PER_TURN = 2;
export const CUP_R = 0.046;
export const CUP_H = 0.12;
export const BALL_R = 0.02;
export const TABLE = { half: 0.31, end: 2.45 };
export const RELEASE = { y: 0.36, z: 0 };
const G = 9.8;

/** Where each cup stands: back row of three, then two, then one at the front. */
export const RACK: { x: number; z: number }[] = [
  { x: -0.095, z: 2.33 },
  { x: 0, z: 2.33 },
  { x: 0.095, z: 2.33 },
  { x: -0.0475, z: 2.247 },
  { x: 0.0475, z: 2.247 },
  { x: 0, z: 2.165 },
];

export interface Flight {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  bounced: boolean;
  t: number;
}

export type Landing = { cup: number } | { cup: null; why: 'short' | 'long' | 'side' | 'rim' };

/** Turn a swipe into a ball in the air. `power` 1 is about the middle of the rack. */
export function launch(power: number, aim: number): Flight {
  const p = Math.max(0.4, Math.min(1.5, power));
  const vz = 3.0 * p;
  return {
    x: 0,
    y: RELEASE.y,
    z: RELEASE.z,
    vx: (Math.abs(aim) < 0.04 ? 0 : Math.max(-1, Math.min(1, aim)) * 0.35) * vz,
    vy: 3.35 * p,
    vz,
    bounced: false,
    t: 0,
  };
}

/**
 * One step of the ball. Returns where it ended up once it's done: in a cup
 * (that's still standing), or a miss.
 */
export function fly(
  f: Flight,
  dt: number,
  standing: boolean[],
  rng: () => number = Math.random,
): { flight: Flight; landed?: Landing; rim?: boolean } {
  let b = { ...f };
  const n = 4;
  let rim = false;
  for (let k = 0; k < n; k++) {
    const h = dt / n;
    const prevY = b.y;
    b = {
      ...b,
      x: b.x + b.vx * h,
      y: b.y + b.vy * h,
      z: b.z + b.vz * h,
      vy: b.vy - G * h,
      t: b.t + h,
    };
    // down through the height of the cups' rims
    if (prevY >= CUP_H && b.y < CUP_H && b.vy < 0) {
      for (let i = 0; i < CUPS; i++) {
        if (!standing[i]) continue;
        const d = Math.hypot(b.x - RACK[i].x, b.z - RACK[i].z);
        if (d < CUP_R - BALL_R * 0.3) return { flight: b, landed: { cup: i } };
        if (d < CUP_R + BALL_R) {
          rim = true;
          // round and round the rim… in or out
          if (rng() < 0.4) return { flight: b, landed: { cup: i }, rim };
          const away = Math.atan2(b.z - RACK[i].z, b.x - RACK[i].x);
          b = { ...b, vx: Math.cos(away) * 0.8, vz: Math.sin(away) * 0.8, vy: 0.9 };
        }
      }
    }
    // the table: one bounce, then it's gone
    if (b.y < BALL_R && b.vy < 0) {
      const onTable = Math.abs(b.x) < TABLE.half && b.z < TABLE.end;
      if (!onTable)
        return {
          flight: b,
          landed: { cup: null, why: Math.abs(b.x) >= TABLE.half ? 'side' : 'long' },
          rim,
        };
      // landing among the cups' feet: knocked away
      const inRack = RACK.some(
        (c, i) => standing[i] && Math.hypot(b.x - c.x, b.z - c.z) < CUP_R + BALL_R,
      );
      if (b.bounced || inRack) {
        const why = b.z < RACK[5].z - CUP_R ? 'short' : rim ? 'rim' : 'long';
        return { flight: b, landed: { cup: null, why }, rim };
      }
      b = { ...b, y: BALL_R, vy: -b.vy * 0.55, vx: b.vx * 0.85, vz: b.vz * 0.8, bounced: true };
    }
    if (b.z > TABLE.end + 0.4 || b.t > 3)
      return { flight: b, landed: { cup: null, why: 'long' }, rim };
  }
  return { flight: b, rim };
}

/** A whole throw at once (for Coco and for tests). */
export function throwOnce(
  power: number,
  aim: number,
  standing: boolean[],
  rng: () => number = Math.random,
): Landing {
  let f = launch(power, aim);
  for (let i = 0; i < 600; i++) {
    const out = fly(f, 1 / 120, standing, rng);
    f = out.flight;
    if (out.landed) return out.landed;
  }
  return { cup: null, why: 'long' };
}

/* --------------------------------------------------------------- a game */

export interface PongState {
  /** Cups still standing on each side (the side whose cups they are). */
  racks: Record<Side, boolean[]>;
  /** Balls left for whoever's throwing now. */
  balls: number;
  /** Cups hit this turn (two: balls back). */
  hits: number;
  /** The last throw, for the other's screen. */
  last?: { by: Side; cup: number | null };
}

export const newPong = (): PongState => ({
  racks: { you: Array(CUPS).fill(true), partner: Array(CUPS).fill(true) },
  balls: BALLS_PER_TURN,
  hits: 0,
});

export function normalizePong(raw: unknown): PongState {
  const r = (raw ?? {}) as Partial<PongState>;
  const rack = (v: unknown) =>
    Array.from({ length: CUPS }, (_, i) => (Array.isArray(v) ? v[i] !== false : true));
  return {
    racks: { you: rack(r.racks?.you), partner: rack(r.racks?.partner) },
    balls: Number.isInteger(r.balls)
      ? Math.max(0, Math.min(BALLS_PER_TURN, r.balls as number))
      : BALLS_PER_TURN,
    hits: Number.isInteger(r.hits) ? Math.max(0, Math.min(2, r.hits as number)) : 0,
    ...(r.last ? { last: r.last } : {}),
  };
}

const other = (s: Side): Side => (s === 'you' ? 'partner' : 'you');
export const left = (s: PongState, side: Side) => s.racks[side].filter(Boolean).length;

/**
 * `thrower` threw at the other's cups. `turnOver`: the other throws next;
 * `ballsBack`: both went in, two more.
 */
export function applyThrow(
  s: PongState,
  thrower: Side,
  cup: number | null,
): {
  state: PongState;
  turnOver: boolean;
  ballsBack: boolean;
  won: boolean;
} {
  const target = other(thrower);
  const rack = [...s.racks[target]];
  const hit = cup !== null && rack[cup];
  if (hit) rack[cup!] = false;
  const racks = { ...s.racks, [target]: rack } as Record<Side, boolean[]>;
  const hits = s.hits + (hit ? 1 : 0);
  const balls = s.balls - 1;
  const won = rack.every((c) => !c);
  const last = { by: thrower, cup: hit ? cup : null };
  if (won)
    return { state: { racks, balls: 0, hits, last }, turnOver: false, ballsBack: false, won };
  if (balls > 0)
    return { state: { racks, balls, hits, last }, turnOver: false, ballsBack: false, won };
  if (hits >= BALLS_PER_TURN)
    return {
      state: { racks, balls: BALLS_PER_TURN, hits: 0, last },
      turnOver: false,
      ballsBack: true,
      won,
    };
  return {
    state: { racks, balls: BALLS_PER_TURN, hits: 0, last },
    turnOver: true,
    ballsBack: false,
    won,
  };
}

/** Coco's throw: a good arm, a wobbly aim. */
export function cocoThrow(standing: boolean[], rng: () => number = Math.random): number | null {
  const options = standing.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  if (!options.length) return null;
  const aimAt = RACK[options[Math.floor(rng() * options.length)]];
  // what power and aim would land there, roughly, with a wobble
  const power = 1 + (aimAt.z - 2.247) * 1.05 + (rng() - 0.5) * 0.055;
  const aim = aimAt.x / 0.35 / 2.25 + (rng() - 0.5) * 0.04;
  return throwOnce(power, aim, standing, rng).cup;
}

/* -------------------------------------------------------------- drawing */

export const CAMERA = { y: 0.55, back: 0.7, f: 1400, cx: 180, horizon: 60 };
export function project(x: number, y: number, z: number) {
  const depth = z + CAMERA.back;
  const k = CAMERA.f / depth;
  return { x: CAMERA.cx + x * k, y: CAMERA.horizon - (y - CAMERA.y) * k, k };
}
