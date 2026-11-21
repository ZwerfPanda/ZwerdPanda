/*
 * Beer pong: red cups in a triangle at the other end of the table. Swipe up
 * to throw — the length of the swipe is the power, its direction the aim.
 *
 * The ball really flies: gravity and a bit of air drag, it can clip the rim
 * and spin out (or drop in), bounce off the side of a cup, or bounce on the
 * table first — a bounce shot that goes in takes two cups.
 *
 * House rules: two balls a turn, both in = balls back. Three hits in a row
 * and you're on fire 🔥 (you keep throwing until you miss). At 6, 3 and 1
 * cups left the rack is tidied up. Hit the last cup and the other gets one
 * last chance: they keep throwing until they miss — clear all theirs and
 * it's overtime, three cups each.
 *
 * Metres: x to the side, y up from the table top, z away from you.
 */

export type Side = 'you' | 'partner';
export const BALLS_PER_TURN = 2;
export const BALL_R = 0.02;
/** Top (rim) radius, bottom radius and height of a cup. */
export const CUP_R = 0.05;
export const CUP_BASE_R = 0.034;
export const CUP_H = 0.12;
/** Where the beer is: a ball below this inside a cup is in. */
export const BEER_Y = 0.07;
const RIM_T = 0.004;
export const TABLE = { half: 0.31, end: 2.45 };
export const RELEASE = { y: 0.36, z: 0 };
const G = 9.8;
const DRAG = 0.09;
/** Fixed physics step, so every phone flies the same ball the same way. */
export const DT = 1 / 480;
const ELEVATION = (42 * Math.PI) / 180;
const BASE_SPEED = 4.76;

/** A cup on the table: x and z in metres. */
export interface Cup {
  x: number;
  z: number;
}

const SPACING = 0.104;
const ROW = SPACING * 0.866;
const BACK = 2.33;

/** A tight triangle of `n` rows (n=4: ten cups), the point towards you. */
function triangle(rows: number): Cup[] {
  const out: Cup[] = [];
  for (let r = 0; r < rows; r++) {
    const count = rows - r;
    for (let i = 0; i < count; i++)
      out.push({ x: (i - (count - 1) / 2) * SPACING, z: BACK - r * ROW });
  }
  return out;
}

/** How the cups stand after being tidied up, by how many are left. */
export function formation(n: number): Cup[] {
  if (n >= 10) return triangle(4);
  if (n === 6) return triangle(3);
  if (n === 3) return triangle(2);
  if (n === 1) return [{ x: 0, z: BACK }];
  return triangle(4).slice(0, n);
}

export const RACKS = { 10: formation(10), 6: formation(6) } as const;
/** The old six-cup rack (kept for older callers). */
export const RACK: Cup[] = formation(6);

/* ------------------------------------------------------------ the ball */

export interface Flight {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  t: number;
  /** Touched the table (a bounce shot). */
  bounced: boolean;
  /** Touched a cup's rim or side. */
  rim: boolean;
  wall: boolean;
  rolling: boolean;
  /** Where it first came down through the height of the rims. */
  cross?: { x: number; z: number };
}

export type MissWhy = 'short' | 'long' | 'left' | 'right' | 'rim' | 'wall' | 'roll';
export type Near = 'short' | 'long' | 'left' | 'right';
export type Landing =
  | { cup: number; bounce: boolean; rim?: boolean }
  | { cup: null; why: MissWhy; bounce: boolean; near?: Near };
export type Touch = 'rim' | 'wall' | 'table';

/** A throw: `power` 1 is about the middle of a ten-cup rack, `aim` to the side. */
export interface Throw {
  power: number;
  aim: number;
}

export const clampThrow = (t: Throw): Throw => ({
  power: Math.max(0.55, Math.min(1.45, Number.isFinite(t.power) ? t.power : 1)),
  aim: Math.max(-0.35, Math.min(0.35, Number.isFinite(t.aim) ? t.aim : 0)),
});

/** Turn a throw into a ball in the air. */
export function launch(power: number, aim: number): Flight {
  const t = clampThrow({ power, aim });
  const speed = BASE_SPEED * t.power;
  const flat = speed * Math.cos(ELEVATION);
  const norm = Math.sqrt(1 + t.aim * t.aim);
  return {
    x: 0,
    y: RELEASE.y,
    z: RELEASE.z,
    vx: (flat * t.aim) / norm,
    vy: speed * Math.sin(ELEVATION),
    vz: flat / norm,
    t: 0,
    bounced: false,
    rim: false,
    wall: false,
    rolling: false,
  };
}

const cupRadiusAt = (y: number) =>
  CUP_BASE_R + (CUP_R - CUP_BASE_R) * Math.max(0, Math.min(1, y / CUP_H));

/** Which way it was off from the nearest cup. */
function nearOf(f: Flight, cups: Cup[]): Near | undefined {
  const at = f.cross ?? { x: f.x, z: f.z };
  let best: Cup | null = null;
  let d = Infinity;
  for (const c of cups) {
    const dd = Math.hypot(c.x - at.x, c.z - at.z);
    if (dd < d) {
      d = dd;
      best = c;
    }
  }
  if (!best) return undefined;
  const dx = at.x - best.x;
  const dz = at.z - best.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx < 0 ? 'left' : 'right';
  return dz < 0 ? 'short' : 'long';
}

const miss = (f: Flight, cups: Cup[]): Landing => ({
  cup: null,
  why: why(f, cups),
  bounce: f.bounced,
  near: nearOf(f, cups),
});

function why(f: Flight, cups: Cup[]): MissWhy {
  if (f.rim) return 'rim';
  if (f.wall) return 'wall';
  const at = f.cross ?? { x: f.x, z: f.z };
  if (!cups.length) return 'long';
  const xs = cups.map((c) => c.x);
  const zs = cups.map((c) => c.z);
  const front = Math.min(...zs) - CUP_R;
  const back = Math.max(...zs) + CUP_R;
  const left = Math.min(...xs) - CUP_R;
  const right = Math.max(...xs) + CUP_R;
  // which way it was furthest off
  const offX = at.x < left ? left - at.x : at.x > right ? at.x - right : 0;
  const offZ = at.z < front ? front - at.z : at.z > back ? at.z - back : 0;
  if (offX > offZ) return at.x < left ? 'left' : 'right';
  if (f.rolling && offZ === 0) return 'roll';
  return at.z < (front + back) / 2 ? 'short' : 'long';
}

/** One fixed step of the ball among these cups. */
function tick(b: Flight, cups: Cup[], touches: Touch[]): Landing | null {
  const h = DT;
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
  const drag = 1 - DRAG * sp * h;
  b.vx *= drag;
  b.vz *= drag;
  b.vy = b.vy * drag - (b.rolling ? 0 : G * h);
  const prevY = b.y;
  b.x += b.vx * h;
  b.y += b.vy * h;
  b.z += b.vz * h;
  b.t += h;
  if (!b.cross && prevY >= CUP_H && b.y < CUP_H && b.vy < 0) b.cross = { x: b.x, z: b.z };

  for (let i = 0; i < cups.length; i++) {
    const c = cups[i];
    const ox = b.x - c.x;
    const oz = b.z - c.z;
    const d = Math.sqrt(ox * ox + oz * oz);
    if (d > CUP_R + BALL_R + 0.01) continue;
    const ux = d > 1e-6 ? ox / d : 1;
    const uz = d > 1e-6 ? oz / d : 0;
    // the rim: a thin ring round the top
    {
      const px = c.x + ux * CUP_R;
      const pz = c.z + uz * CUP_R;
      const vx = b.x - px;
      const vy = b.y - CUP_H;
      const vz = b.z - pz;
      const dist = Math.sqrt(vx * vx + vy * vy + vz * vz);
      const min = BALL_R + RIM_T;
      if (dist < min && dist > 1e-9) {
        const nx = vx / dist;
        const ny = vy / dist;
        const nz = vz / dist;
        const vn = b.vx * nx + b.vy * ny + b.vz * nz;
        b.x = px + nx * min;
        b.y = CUP_H + ny * min;
        b.z = pz + nz * min;
        if (vn < 0) {
          const e = 0.35;
          b.vx = (b.vx - (1 + e) * vn * nx) * 0.94;
          b.vy = (b.vy - (1 + e) * vn * ny) * 0.94;
          b.vz = (b.vz - (1 + e) * vn * nz) * 0.94;
          if (!b.rim) touches.push('rim');
          b.rim = true;
          b.rolling = false;
        }
      }
    }
    // the side of the cup, outside or (on the way down) inside
    if (b.y > -BALL_R && b.y < CUP_H) {
      const r = cupRadiusAt(b.y);
      const dd = Math.sqrt((b.x - c.x) ** 2 + (b.z - c.z) ** 2);
      if (dd >= r && dd < r + BALL_R) {
        const vn = b.vx * ux + b.vz * uz;
        b.x = c.x + ux * (r + BALL_R);
        b.z = c.z + uz * (r + BALL_R);
        if (vn < 0) {
          b.vx = (b.vx - 1.4 * vn * ux) * 0.9;
          b.vz = (b.vz - 1.4 * vn * uz) * 0.9;
          if (!b.wall) touches.push('wall');
          b.wall = true;
        }
      } else if (dd < r && dd > r - BALL_R && b.y > BEER_Y) {
        const vn = b.vx * ux + b.vz * uz;
        b.x = c.x + ux * (r - BALL_R);
        b.z = c.z + uz * (r - BALL_R);
        if (vn > 0) {
          b.vx = (b.vx - 1.3 * vn * ux) * 0.85;
          b.vz = (b.vz - 1.3 * vn * uz) * 0.85;
        }
      }
      if (dd < r && b.y < BEER_Y) return { cup: i, bounce: b.bounced, rim: b.rim };
    }
  }

  // the table
  const onTable = Math.abs(b.x) < TABLE.half && b.z > -0.1 && b.z < TABLE.end;
  if (onTable && b.y < BALL_R && prevY >= BALL_R - 0.002) {
    if (b.vy < 0) {
      if (!b.bounced) touches.push('table');
      b.bounced = true;
      b.y = BALL_R;
      if (-b.vy < 0.35) {
        b.vy = 0;
        b.rolling = true;
      } else b.vy = -b.vy * 0.6;
      b.vx *= 0.93;
      b.vz *= 0.93;
    }
  }
  if (b.rolling) {
    if (!onTable) b.rolling = false;
    else {
      b.y = BALL_R;
      const k = Math.max(0, 1 - 0.9 * h);
      b.vx *= k;
      b.vz *= k;
      if (Math.hypot(b.vx, b.vz) < 0.08) return miss(b, cups);
    }
  }
  if (b.y < -0.5 || b.z > TABLE.end + 0.6 || b.t > 5)
    return miss(b, cups);
  return null;
}

/**
 * The ball flies on for `dt` seconds (in fixed steps; `acc` carries what's
 * left over). Returns where it ended up once it's done.
 */
export function fly(
  f: Flight,
  dt: number,
  cups: Cup[],
  acc = 0,
): { flight: Flight; landed?: Landing; touches: Touch[]; acc: number } {
  const b = { ...f };
  const touches: Touch[] = [];
  let left = acc + dt;
  while (left >= DT) {
    left -= DT;
    const out = tick(b, cups, touches);
    if (out) return { flight: b, landed: out, touches, acc: 0 };
  }
  return { flight: b, touches, acc: left };
}

/** A whole throw at once (for Coco and for tests). */
export function throwOnce(power: number, aim: number, cups: Cup[]): Landing {
  const b = launch(power, aim);
  const touches: Touch[] = [];
  for (let i = 0; i < 5 * 480 + 10; i++) {
    const out = tick(b, cups, touches);
    if (out) return out;
  }
  return { cup: null, why: 'long', bounce: false };
}

/** Where a throw first comes down through rim height, with no cups in the way. */
export function crossing(power: number, aim: number): { x: number; z: number } {
  const b = launch(power, aim);
  const touches: Touch[] = [];
  for (let i = 0; i < 5 * 480 && !b.cross; i++) tick(b, [], touches);
  return b.cross ?? { x: b.x, z: b.z };
}

/** The throw that drops straight into a cup at (x, z). */
export function aimAt(c: Cup): Throw {
  const aim = c.x / c.z;
  let lo = 0.55;
  let hi = 1.45;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (crossing(mid, aim).z < c.z) lo = mid;
    else hi = mid;
  }
  return { power: (lo + hi) / 2, aim };
}

/* --------------------------------------------------------------- a game */

/** A cup as it travels through the sync: millimetres. */
type CupMm = [number, number];
const toMm = (c: Cup): CupMm => [Math.round(c.x * 1000), Math.round(c.z * 1000)];
const fromMm = ([x, z]: CupMm): Cup => ({ x: x / 1000, z: z / 1000 });

export interface LastThrow {
  by: Side;
  /** How many throws there have been (to notice a new one). */
  n: number;
  throw: Throw;
  /** The cups it was thrown at, before. */
  before: CupMm[];
  /** Which of those it took (two for a bounce shot). */
  hit: number[];
  bounce: boolean;
}

export interface PongState {
  /** Cups still standing on each side (the side whose cups they are). */
  cups: Record<Side, CupMm[]>;
  size: 6 | 10;
  /** Balls left for whoever's throwing now. */
  balls: number;
  /** Cups hit this turn (two: balls back). */
  hits: number;
  /** Hits in a row, per thrower. */
  streak: Record<Side, number>;
  /** On fire: keeps throwing until a miss. */
  fire?: Side;
  /** Their last cup is gone: this side throws until they miss. */
  redemption?: Side;
  overtime?: boolean;
  /** The game is over and this side won. */
  winner?: Side;
  last?: LastThrow;
  throws: number;
}

export const newPong = (size: 6 | 10 = 10): PongState => ({
  cups: { you: formation(size).map(toMm), partner: formation(size).map(toMm) },
  size,
  balls: BALLS_PER_TURN,
  hits: 0,
  streak: { you: 0, partner: 0 },
  throws: 0,
});

export const cupsOf = (s: PongState, side: Side): Cup[] => s.cups[side].map(fromMm);
export const left = (s: PongState, side: Side) => s.cups[side].length;
export const beforeCups = (l: LastThrow): Cup[] => l.before.map(fromMm);

const OLD_SIX = [
  { x: -0.095, z: 2.33 },
  { x: 0, z: 2.33 },
  { x: 0.095, z: 2.33 },
  { x: -0.0475, z: 2.247 },
  { x: 0.0475, z: 2.247 },
  { x: 0, z: 2.165 },
];

export function normalizePong(raw: unknown): PongState {
  const r = (raw ?? {}) as Partial<PongState> & { racks?: Record<string, unknown> };
  const size: 6 | 10 = r.size === 6 ? 6 : r.racks ? 6 : 10;
  const rack = (side: Side): CupMm[] => {
    const v = (r.cups as Record<string, unknown> | undefined)?.[side];
    if (Array.isArray(v))
      return v
        .filter(
          (c): c is CupMm =>
            Array.isArray(c) && c.length === 2 && c.every((n) => typeof n === 'number' && Number.isFinite(n)),
        )
        .slice(0, 10);
    // an older game: six booleans
    const old = r.racks?.[side];
    if (Array.isArray(old)) return OLD_SIX.filter((_, i) => old[i] !== false).map(toMm);
    return formation(size).map(toMm);
  };
  const side = (v: unknown): Side | undefined => (v === 'you' || v === 'partner' ? v : undefined);
  const int = (v: unknown, lo: number, hi: number, d: number) =>
    Number.isInteger(v) ? Math.max(lo, Math.min(hi, v as number)) : d;
  const st = (r.streak ?? {}) as Partial<Record<Side, number>>;
  const out: PongState = {
    cups: { you: rack('you'), partner: rack('partner') },
    size,
    balls: int(r.balls, 0, BALLS_PER_TURN, BALLS_PER_TURN),
    hits: int(r.hits, 0, 10, 0),
    streak: { you: int(st.you, 0, 99, 0), partner: int(st.partner, 0, 99, 0) },
    throws: int(r.throws, 0, 1e6, 0),
  };
  if (side(r.fire)) out.fire = side(r.fire);
  if (side(r.redemption)) out.redemption = side(r.redemption);
  if (side(r.winner)) out.winner = side(r.winner);
  if (r.overtime) out.overtime = true;
  const l = r.last as Partial<LastThrow> | undefined;
  if (l && side(l.by) && l.throw && Array.isArray(l.before) && Array.isArray(l.hit))
    out.last = {
      by: side(l.by)!,
      n: int(l.n, 0, 1e6, 0),
      throw: clampThrow(l.throw),
      before: l.before as CupMm[],
      hit: l.hit.filter((i) => Number.isInteger(i)),
      bounce: Boolean(l.bounce),
    };
  return out;
}

const other = (s: Side): Side => (s === 'you' ? 'partner' : 'you');

/** At 6, 3 and 1 cups the rack is tidied up into a neat shape. */
function tidy(rack: CupMm[], size: number): CupMm[] {
  const n = rack.length;
  if (n !== 6 && n !== 3 && n !== 1) return rack;
  if (n === 6 && size === 6) return rack;
  return formation(n).map(toMm);
}

export type PongNews =
  | 'hit'
  | 'bounce'
  | 'miss'
  | 'fire'
  | 'fireOut'
  | 'ballsBack'
  | 'lastCup'
  | 'redeemed'
  | 'rerack';

export interface ThrowResult {
  state: PongState;
  /** The other throws next. */
  turnOver: boolean;
  /** Both went in: two more. */
  ballsBack: boolean;
  /** The game is over; `state.winner` says who won. */
  won: boolean;
  news: PongNews[];
}

/** The nearest other cup to cup `i` (a bounce shot takes it too). */
function partnerCup(rack: CupMm[], i: number): number | null {
  let best: number | null = null;
  let d = Infinity;
  for (let j = 0; j < rack.length; j++) {
    if (j === i) continue;
    const dd = Math.hypot(rack[j][0] - rack[i][0], rack[j][1] - rack[i][1]);
    if (dd < d) {
      d = dd;
      best = j;
    }
  }
  return best;
}

/**
 * `thrower` threw at the other's cups and the ball landed so. (`thrown` is
 * the throw itself, so the other phone can watch it fly.)
 */
export function applyThrow(
  s: PongState,
  thrower: Side,
  landing: Landing | number | null,
  thrown: Throw = { power: 1, aim: 0 },
): ThrowResult {
  const l: Landing =
    typeof landing === 'number'
      ? { cup: landing, bounce: false }
      : landing === null
        ? { cup: null, why: 'short', bounce: false }
        : landing;
  const target = other(thrower);
  const before = s.cups[target];
  const hit: number[] = [];
  if (l.cup !== null && l.cup >= 0 && l.cup < before.length) {
    hit.push(l.cup);
    if (l.bounce) {
      const p = partnerCup(before, l.cup);
      if (p !== null) hit.push(p);
    }
  }
  const news: PongNews[] = [];
  const rack = before.filter((_, i) => !hit.includes(i));
  const throws = s.throws + 1;
  const last: LastThrow = {
    by: thrower,
    n: throws,
    throw: clampThrow(thrown),
    before,
    hit,
    bounce: hit.length > 1,
  };
  const scored = hit.length > 0;
  if (scored) news.push(l.bounce && hit.length > 1 ? 'bounce' : 'hit');
  else news.push('miss');
  const streak = { ...s.streak, [thrower]: scored ? s.streak[thrower] + 1 : 0 };
  let cups = { ...s.cups, [target]: rack } as Record<Side, CupMm[]>;
  const base = { ...s, cups, streak, last, throws, hits: s.hits + (scored ? 1 : 0) };

  // a last chance: throw until you miss
  if (s.redemption === thrower) {
    if (!scored) {
      const winner = target;
      return {
        state: { ...base, redemption: undefined, fire: undefined, winner, balls: 0 },
        turnOver: false,
        ballsBack: false,
        won: true,
        news,
      };
    }
    if (rack.length === 0) {
      // all of them! overtime: three cups each, the other throws
      news.push('redeemed');
      cups = { you: formation(3).map(toMm), partner: formation(3).map(toMm) };
      return {
        state: {
          ...base,
          cups,
          redemption: undefined,
          fire: undefined,
          overtime: true,
          balls: BALLS_PER_TURN,
          hits: 0,
          streak: { you: 0, partner: 0 },
        },
        turnOver: true,
        ballsBack: false,
        won: false,
        news,
      };
    }
    return {
      state: { ...base, balls: BALLS_PER_TURN },
      turnOver: false,
      ballsBack: false,
      won: false,
      news,
    };
  }

  // their last cup: they get one last chance
  if (rack.length === 0) {
    news.push('lastCup');
    return {
      state: {
        ...base,
        fire: undefined,
        redemption: target,
        balls: BALLS_PER_TURN,
        hits: 0,
        cups: { ...cups, [thrower]: tidy(cups[thrower], s.size) },
      },
      turnOver: true,
      ballsBack: false,
      won: false,
      news,
    };
  }

  let fire = s.fire;
  if (scored && streak[thrower] >= 3 && fire !== thrower) {
    fire = thrower;
    news.push('fire');
  }
  if (!scored && s.fire === thrower) {
    fire = undefined;
    news.push('fireOut');
  }
  const free = scored && s.fire === thrower;
  const balls = free ? s.balls : s.balls - 1;
  if (balls > 0)
    return {
      state: { ...base, fire, balls },
      turnOver: false,
      ballsBack: false,
      won: false,
      news,
    };

  const tidied = { you: tidy(cups.you, s.size), partner: tidy(cups.partner, s.size) };
  if (tidied[target] !== cups[target] || tidied[thrower] !== cups[thrower]) news.push('rerack');
  if (base.hits >= BALLS_PER_TURN && scored) {
    news.push('ballsBack');
    return {
      state: { ...base, cups: tidied, fire, balls: BALLS_PER_TURN, hits: 0 },
      turnOver: false,
      ballsBack: true,
      won: false,
      news,
    };
  }
  return {
    state: { ...base, cups: tidied, fire, balls: BALLS_PER_TURN, hits: 0 },
    turnOver: true,
    ballsBack: false,
    won: false,
    news,
  };
}

/** Coco's throw: a good arm, a wobbly aim. Returns the throw itself. */
export function cocoThrow(cups: Cup[], rng: () => number = Math.random): Throw {
  if (!cups.length) return { power: 1, aim: 0 };
  // she goes for the front cups a bit more often
  const sorted = [...cups].sort((a, b) => a.z - b.z);
  const pick = sorted[Math.floor(Math.pow(rng(), 1.4) * sorted.length)];
  const ideal = aimAt(pick);
  const gauss = () => (rng() + rng() + rng() - 1.5) / 1.5;
  return clampThrow({
    power: ideal.power + gauss() * 0.05,
    aim: ideal.aim + gauss() * 0.045,
  });
}

/* -------------------------------------------------------------- drawing */

/** A camera behind your end of the table, a little above, looking down. */
export const CAMERA = { y: 1.2, back: 0.8, pitch: 0.3, f: 1400, cx: 180, cy: 200 };
const COS = Math.cos(CAMERA.pitch);
const SIN = Math.sin(CAMERA.pitch);
export function project(x: number, y: number, z: number) {
  const Y = y - CAMERA.y;
  const Z = z + CAMERA.back;
  const depth = Z * COS - Y * SIN;
  const up = Y * COS + Z * SIN;
  const k = CAMERA.f / depth;
  return { x: CAMERA.cx + x * k, y: CAMERA.cy - up * k, k };
}
