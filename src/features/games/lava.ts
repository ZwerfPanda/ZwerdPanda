/*
 * De vloer is lava: little hoppers bounce up from platform to platform by
 * themselves — you only steer left and right — while the lava rises from
 * below, faster and faster. Platforms crumble, slide and blink away; springs
 * launch you; hearts are worth points. Two can play at once on one phone (and
 * jump on each other's heads), or race Coco, or play the same tower apart.
 *
 * World units: 360 wide, y goes UP (height). Ten units are a metre.
 */

export const W = 360;
export const R = 14;
export const G = 1500;
export const JUMP = 840;
export const SPRING = 1350;
const MAX_VX = 310;
const ACC = 2600;
const STEP = 1 / 240;

export type Kind = 'normal' | 'crumble' | 'move' | 'blink' | 'spring';

export interface Plat {
  id: number;
  x: number;
  y: number;
  w: number;
  kind: Kind;
  /** Moving ones: centre, how far either way, how fast. */
  x0: number;
  amp: number;
  speed: number;
  phase: number;
  /** Crumbling: when it was jumped on. */
  hit: number | null;
  gone: boolean;
}

export interface Heart {
  id: number;
  x: number;
  y: number;
  taken: boolean;
}

export interface Hopper {
  who: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  /** Highest point reached. */
  best: number;
  hearts: number;
  /** -1 left, 0 nothing, 1 right. */
  input: number;
  diedAt: number | null;
  /** When it last bounced (for squash and stretch). */
  bounced: number;
  face: number;
}

export interface World {
  seed: number;
  rnd: number;
  t: number;
  lava: number;
  cam: number;
  nextY: number;
  nextId: number;
  plats: Plat[];
  hearts: Heart[];
  players: Hopper[];
  zone: number;
  over: boolean;
  acc: number;
}

export type LavaEvent =
  | { type: 'bounce'; who: string; kind: Kind; x: number; y: number }
  | { type: 'spring'; who: string; x: number; y: number }
  | { type: 'heart'; who: string; x: number; y: number }
  | { type: 'stomp'; who: string; on: string; x: number; y: number }
  | { type: 'die'; who: string; x: number; y: number }
  | { type: 'zone'; zone: number }
  | { type: 'over' };

export const ZONES = [
  { at: 0, name: 'De kelder', emoji: '🏚️', sky: ['#2a1a18', '#120a0a'], rock: '#3b2a24' },
  { at: 80, name: 'De vulkaan', emoji: '🌋', sky: ['#5a1a10', '#1e0806'], rock: '#4a2016' },
  { at: 200, name: 'De wolken', emoji: '☁️', sky: ['#7fc8ff', '#ffb38a'], rock: '#ffffff' },
  { at: 380, name: 'De ruimte', emoji: '🚀', sky: ['#0d0b26', '#2b1650'], rock: '#3d3a8c' },
  { at: 600, name: 'De zon', emoji: '☀️', sky: ['#ffd75e', '#ff6a1f'], rock: '#ffb347' },
] as const;

export const meters = (y: number) => Math.max(0, Math.floor(y / 10));
export const zoneAt = (m: number) => {
  let z = 0;
  ZONES.forEach((zz, i) => {
    if (m >= zz.at) z = i;
  });
  return z;
};
export const score = (p: Pick<Hopper, 'best' | 'hearts'>) => meters(p.best) + p.hearts * 5;

/* ----------------------------------------------------------- randomness */

/** mulberry32: small, fast and the same on every phone. */
function rand(w: World): number {
  w.rnd = (w.rnd + 0x6d2b79f5) | 0;
  let t = w.rnd;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* ---------------------------------------------------------- the tower */

/** How hard it is at this height: 0 at the bottom, 1 from 600 m up. */
export const difficulty = (y: number) => Math.min(1, meters(y) / 600);

function addPlat(w: World, x: number, y: number, width: number, kind: Kind) {
  const p: Plat = {
    id: w.nextId++,
    x,
    y,
    w: width,
    kind,
    x0: x,
    amp: 0,
    speed: 0,
    phase: rand(w) * Math.PI * 2,
    hit: null,
    gone: false,
  };
  if (kind === 'move') {
    p.amp = Math.min(x - width / 2 - 4, W - x - width / 2 - 4, 50 + rand(w) * 70);
    p.amp = Math.max(25, p.amp);
    p.speed = 0.9 + rand(w) * 1.2 + difficulty(y) * 0.8;
  }
  w.plats.push(p);
  return p;
}

/** Build the tower up to `top`. */
function grow(w: World, top: number) {
  while (w.nextY < top) {
    const y = w.nextY;
    const d = difficulty(y);
    const m = meters(y);
    const count = rand(w) < 0.55 - 0.45 * d ? 2 : 1;
    const xs: number[] = [];
    for (let k = 0; k < count; k++) {
      const width = 92 - d * 42 + rand(w) * 16;
      let x = width / 2 + 6 + rand(w) * (W - width - 12);
      if (xs.some((o) => Math.abs(o - x) < width + 10)) x = (x + W / 2) % (W - width) + width / 2;
      xs.push(x);
      const r = rand(w);
      const pBlink = m > 120 ? 0.05 + 0.15 * d : 0;
      const pMove = m > 40 ? 0.08 + 0.22 * d : 0;
      const pCrumble = m > 15 ? 0.1 + 0.25 * d : 0;
      const kind: Kind =
        r < 0.05
          ? 'spring'
          : r < 0.05 + pBlink
            ? 'blink'
            : r < 0.05 + pBlink + pMove
              ? 'move'
              : r < 0.05 + pBlink + pMove + pCrumble
                ? 'crumble'
                : 'normal';
      const p = addPlat(w, x, y + (k ? (rand(w) - 0.5) * 30 : 0), width, kind);
      // a blinking one always has a (crumbly) friend nearby, so there's a way up
      if (kind === 'blink')
        addPlat(w, (x + W / 2) % (W - 70) + 35, y + 10, 70, d > 0.5 ? 'crumble' : 'normal');
      if (kind === 'normal' && rand(w) < 0.12)
        w.hearts.push({ id: w.nextId++, x: p.x, y: p.y + 34, taken: false });
    }
    w.nextY += 62 + d * 95 + rand(w) * 30;
  }
}

export function newWorld(seed: number, who: string[]): World {
  const w: World = {
    seed,
    rnd: seed | 0,
    t: 0,
    lava: -380,
    cam: 0,
    nextY: 120,
    nextId: 1,
    plats: [],
    hearts: [],
    players: [],
    zone: 0,
    over: false,
    acc: 0,
  };
  // the floor you start on
  w.plats.push({
    id: 0,
    x: W / 2,
    y: 20,
    w: W,
    kind: 'normal',
    x0: W / 2,
    amp: 0,
    speed: 0,
    phase: 0,
    hit: null,
    gone: false,
  });
  who.forEach((id, i) =>
    w.players.push({
      who: id,
      x: who.length === 1 ? W / 2 : 110 + i * 140,
      y: 20 + R,
      vx: 0,
      vy: JUMP,
      alive: true,
      best: 0,
      hearts: 0,
      input: 0,
      diedAt: null,
      bounced: 0,
      face: i ? -1 : 1,
    }),
  );
  grow(w, 900);
  return w;
}

/* ----------------------------------------------------------- platforms */

export function platX(p: Plat, t: number) {
  return p.kind === 'move' ? p.x0 + Math.sin(t * p.speed + p.phase) * p.amp : p.x;
}

const BLINK_ON = 2.1;
const BLINK_ALL = 3.3;
/** Blinking ones: there, or not (and about to go when `warn`). */
export function blinkState(p: Plat, t: number): { on: boolean; warn: boolean } {
  if (p.kind !== 'blink') return { on: true, warn: false };
  const k = (t + p.phase) % BLINK_ALL;
  return { on: k < BLINK_ON, warn: k > BLINK_ON - 0.6 && k < BLINK_ON };
}

/** Crumbling ones fall a moment after you bounce on them. */
export const CRUMBLE = 0.3;
export const solid = (p: Plat, t: number) =>
  !p.gone && blinkState(p, t).on && !(p.hit !== null && t - p.hit > CRUMBLE);

/* -------------------------------------------------------------- a step */

/** How fast the lava climbs now (units a second). */
export function lavaSpeed(w: World): number {
  const top = Math.max(...w.players.map((p) => p.best), 0);
  const base = Math.min(170, 38 + w.t * 0.9 + difficulty(top) * 60);
  // never lag too far behind: it catches up when it's off the screen
  // (after a short head start, so you can find your feet)
  const behind = w.cam - 10 - w.lava;
  return base + (behind > 0 && w.t > 3 ? Math.min(700, behind * 4) : 0);
}

function tick(w: World, events: LavaEvent[]) {
  const h = STEP;
  w.t += h;
  for (const p of w.players) {
    if (!p.alive) continue;
    // steering: quick to speed up, a little slide
    if (p.input) {
      p.vx += p.input * ACC * h;
      p.face = p.input;
    } else p.vx *= Math.exp(-7 * h);
    p.vx = Math.max(-MAX_VX, Math.min(MAX_VX, p.vx));
    const prevBottom = p.y - R;
    p.vy -= G * h;
    p.x += p.vx * h;
    p.y += p.vy * h;
    // round the sides: out one side, in the other
    if (p.x < -R) p.x += W + 2 * R;
    if (p.x > W + R) p.x -= W + 2 * R;
    // landing on a platform (only on the way down)
    if (p.vy < 0) {
      const bottom = p.y - R;
      for (const pl of w.plats) {
        if (!solid(pl, w.t)) continue;
        if (prevBottom < pl.y - 1 || bottom > pl.y) continue;
        const px = platX(pl, w.t);
        if (Math.abs(p.x - px) > pl.w / 2 + R * 0.55) continue;
        p.y = pl.y + R;
        p.vy = pl.kind === 'spring' ? SPRING : JUMP;
        p.bounced = w.t;
        if (pl.kind === 'crumble' && pl.hit === null) pl.hit = w.t;
        events.push(
          pl.kind === 'spring'
            ? { type: 'spring', who: p.who, x: p.x, y: pl.y }
            : { type: 'bounce', who: p.who, kind: pl.kind, x: p.x, y: pl.y },
        );
        break;
      }
    }
    if (p.y > p.best) p.best = p.y;
    for (const hr of w.hearts)
      if (!hr.taken && Math.hypot(hr.x - p.x, hr.y - p.y) < R + 12) {
        hr.taken = true;
        p.hearts++;
        events.push({ type: 'heart', who: p.who, x: hr.x, y: hr.y });
      }
  }
  // jumping on each other's heads
  for (const a of w.players)
    for (const b of w.players) {
      if (a === b || !a.alive || !b.alive || a.vy >= 0) continue;
      if (a.y < b.y + R * 0.6) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > R * 2) continue;
      a.vy = JUMP * 1.08;
      a.bounced = w.t;
      b.vy = Math.min(b.vy, -260);
      events.push({ type: 'stomp', who: a.who, on: b.who, x: b.x, y: b.y + R });
    }
  // the lava
  w.lava += lavaSpeed(w) * h;
  for (const p of w.players)
    if (p.alive && p.y - R * 0.5 < w.lava) {
      p.alive = false;
      p.diedAt = w.t;
      events.push({ type: 'die', who: p.who, x: p.x, y: w.lava });
    }
  for (const pl of w.plats) if (pl.hit !== null && w.t - pl.hit > CRUMBLE + 1) pl.gone = true;
}

/** Time passes. Returns what happened. */
export function step(w: World, dt: number): LavaEvent[] {
  const events: LavaEvent[] = [];
  if (w.over) return events;
  w.acc += Math.max(0, Math.min(0.05, dt));
  while (w.acc >= STEP) {
    w.acc -= STEP;
    tick(w, events);
  }
  // the camera follows whoever's highest (and never goes down)
  const alive = w.players.filter((p) => p.alive);
  if (alive.length) {
    const target = Math.max(...alive.map((p) => p.y)) - 200;
    if (target > w.cam) w.cam += (target - w.cam) * Math.min(1, dt * 5);
  }
  grow(w, w.cam + 1200);
  // forget what's deep in the lava
  w.plats = w.plats.filter((p) => p.y > w.lava - 200);
  w.hearts = w.hearts.filter((hr) => hr.y > w.lava - 200 && !hr.taken);
  const top = Math.max(0, ...w.players.map((p) => p.best));
  const z = zoneAt(meters(top));
  if (z > w.zone) {
    w.zone = z;
    events.push({ type: 'zone', zone: z });
  }
  if (!alive.length && !w.over) {
    w.over = true;
    events.push({ type: 'over' });
  }
  return events;
}

/* --------------------------------------------------------------- Coco */

/**
 * Coco steers: on the way down, towards the nearest platform below her; on
 * the way up, towards a good one above. A rabbit, not a robot: she's a bit
 * slow to react and sometimes picks a crumbly one.
 */
export function cocoSteer(w: World, i: number, wobble = 0): number {
  const p = w.players[i];
  if (!p.alive) return 0;
  const reach = (p.vy * p.vy) / (2 * G);
  let best: Plat | null = null;
  let bestScore = -Infinity;
  for (const pl of w.plats) {
    if (!solid(pl, w.t)) continue;
    const dy = pl.y - (p.y - R);
    if (p.vy < 0 ? dy > 0 || dy < -260 : dy > reach - 10 || dy < -200) continue;
    const dx = Math.abs(platX(pl, w.t) - p.x);
    const wrap = Math.min(dx, W - dx);
    const s = (p.vy < 0 ? -dy * 0.2 : dy) - wrap * 0.9 + (pl.kind === 'spring' ? 80 : 0) - (pl.kind === 'blink' ? 60 : 0);
    if (s > bestScore) {
      bestScore = s;
      best = pl;
    }
  }
  if (!best) return 0;
  let dx = platX(best, w.t) + wobble - p.x;
  if (dx > W / 2) dx -= W;
  if (dx < -W / 2) dx += W;
  return Math.abs(dx) < 10 ? 0 : Math.sign(dx);
}
