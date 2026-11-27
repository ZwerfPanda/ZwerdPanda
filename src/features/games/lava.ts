/*
 * De vloer is lava: little hoppers bounce up from platform to platform by
 * themselves — you only steer left and right — while the lava rises from
 * below, faster and faster.
 *
 * The tower is built from little set pieces (stairs, zigzags, spring towers,
 * crumbly ladders, sliding bridges, blinking grids) that get meaner the
 * higher you go, with a golden rest stop every 100 m. Up there the lava spits
 * fireballs and space has less gravity. Power-ups: a rocket, a shield that
 * saves you from the lava once, a magnet for hearts, a feather to float and
 * ice that freezes the lava for a bit. Now and then there's a real 🎟️ ticket.
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
export type PowerKind = 'rocket' | 'shield' | 'magnet' | 'feather' | 'freeze';
export type ItemKind = 'heart' | 'ticket' | PowerKind;

export const POWERS: Record<PowerKind, { emoji: string; name: string; secs: number; color: string }> = {
  rocket: { emoji: '🚀', name: 'Raket', secs: 2.2, color: '#ff8a1f' },
  shield: { emoji: '🛡️', name: 'Schild', secs: 0, color: '#5ff3ff' },
  magnet: { emoji: '🧲', name: 'Magneet', secs: 9, color: '#ff5f6d' },
  feather: { emoji: '🪶', name: 'Veertje', secs: 7, color: '#c9a8ff' },
  freeze: { emoji: '❄️', name: 'IJslava', secs: 5, color: '#7fd0ff' },
};

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
  /** A golden rest stop (every 100 m). */
  check?: number;
}

export interface Item {
  id: number;
  x: number;
  y: number;
  kind: ItemKind;
  taken: boolean;
}

export interface Fireball {
  id: number;
  x: number;
  y: number;
  vy: number;
  alive: boolean;
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
  tickets: number;
  /** How hard you steer: -1 all the way left … 1 all the way right. */
  input: number;
  diedAt: number | null;
  /** When it last bounced (for squash and stretch). */
  bounced: number;
  face: number;
  power: PowerKind | null;
  powerUntil: number;
  shield: boolean;
  /** Knocked by a fireball (for a little spin). */
  hurt: number;
}

export interface World {
  seed: number;
  rnd: number;
  t: number;
  lava: number;
  cam: number;
  nextY: number;
  nextId: number;
  nextItem: number;
  nextTicket: number;
  nextCheck: number;
  nextFire: number;
  frozenUntil: number;
  plats: Plat[];
  items: Item[];
  fireballs: Fireball[];
  players: Hopper[];
  zone: number;
  checks: number;
  over: boolean;
  acc: number;
}

export type LavaEvent =
  | { type: 'bounce'; who: string; kind: Kind; x: number; y: number }
  | { type: 'spring'; who: string; x: number; y: number }
  | { type: 'item'; who: string; kind: ItemKind; x: number; y: number }
  | { type: 'stomp'; who: string; on: string; x: number; y: number }
  | { type: 'saved'; who: string; x: number; y: number }
  | { type: 'burn'; who: string; x: number; y: number }
  | { type: 'spit'; x: number; y: number }
  | { type: 'die'; who: string; x: number; y: number }
  | { type: 'check'; m: number }
  | { type: 'zone'; zone: number }
  | { type: 'over' };

export const ZONES = [
  { at: 0, name: 'De kelder', emoji: '🏚️', sky: ['#2a1a18', '#120a0a'] },
  { at: 80, name: 'De vulkaan', emoji: '🌋', sky: ['#5a1a10', '#1e0806'] },
  { at: 200, name: 'De wolken', emoji: '☁️', sky: ['#7fc8ff', '#ffb38a'] },
  { at: 380, name: 'De ruimte', emoji: '🚀', sky: ['#0d0b26', '#2b1650'] },
  { at: 600, name: 'De zon', emoji: '☀️', sky: ['#ffd75e', '#ff6a1f'] },
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
const between = (w: World, a: number, b: number) => a + rand(w) * (b - a);

export const seedOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

/* ---------------------------------------------------------- the tower */

/** How hard it is at this height: 0 at the bottom, 1 from 600 m up. */
export const difficulty = (y: number) => Math.min(1, meters(y) / 600);

function addPlat(w: World, x: number, y: number, width: number, kind: Kind, phase?: number) {
  const half = width / 2;
  const p: Plat = {
    id: w.nextId++,
    x: Math.max(half + 4, Math.min(W - half - 4, x)),
    y,
    w: width,
    kind,
    x0: 0,
    amp: 0,
    speed: 0,
    phase: phase ?? rand(w) * Math.PI * 2,
    hit: null,
    gone: false,
  };
  p.x0 = p.x;
  if (kind === 'move') {
    p.amp = Math.max(25, Math.min(p.x - half - 4, W - p.x - half - 4, between(w, 50, 120)));
    p.speed = between(w, 0.9, 2.1) + difficulty(y) * 0.8;
  }
  w.plats.push(p);
  return p;
}

/** A normal-ish gap between rows (always within one bounce). */
const gap = (w: World, y: number) => 62 + difficulty(y) * 95 + rand(w) * 30;
const widthAt = (w: World, y: number) => 92 - difficulty(y) * 42 + rand(w) * 16;

/** Mostly normal, more mean ones the higher you get. */
function anyKind(w: World, y: number): Kind {
  const m = meters(y);
  const d = difficulty(y);
  const r = rand(w);
  const pMove = m > 40 ? 0.08 + 0.2 * d : 0;
  const pCrumble = m > 15 ? 0.1 + 0.25 * d : 0;
  return r < 0.04 ? 'spring' : r < 0.04 + pMove ? 'move' : r < 0.04 + pMove + pCrumble ? 'crumble' : 'normal';
}

type Piece = (w: World, y: number) => number;

/** One or two platforms on a row. */
const scatter: Piece = (w, y) => {
  const d = difficulty(y);
  const xs: number[] = [];
  const count = rand(w) < 0.55 - 0.45 * d ? 2 : 1;
  for (let k = 0; k < count; k++) {
    const width = widthAt(w, y);
    let x = width / 2 + 6 + rand(w) * (W - width - 12);
    if (xs.some((o) => Math.abs(o - x) < width + 10)) x = ((x + W / 2) % (W - width)) + width / 2;
    xs.push(x);
    addPlat(w, x, y + (k ? (rand(w) - 0.5) * 30 : 0), width, anyKind(w, y));
  }
  return y + gap(w, y);
};

/** A staircase up to one side. */
const stairs: Piece = (w, y) => {
  const n = 4 + Math.floor(rand(w) * 3);
  const dir = rand(w) < 0.5 ? 1 : -1;
  let x = dir > 0 ? between(w, 50, 110) : between(w, 250, 310);
  for (let i = 0; i < n; i++) {
    addPlat(w, x, y, 70 - difficulty(y) * 15, i % 3 === 2 && difficulty(y) > 0.3 ? 'crumble' : 'normal');
    x += dir * between(w, 50, 75);
    y += 55 + difficulty(y) * 45;
  }
  return y + 20;
};

/** Left, right, left, right. */
const zigzag: Piece = (w, y) => {
  const n = 5;
  let side = rand(w) < 0.5 ? 0 : 1;
  for (let i = 0; i < n; i++) {
    const x = side ? between(w, 270, 315) : between(w, 45, 90);
    addPlat(w, x, y, 74 - difficulty(y) * 20, difficulty(y) > 0.35 && i === 2 ? 'move' : 'normal');
    side = 1 - side;
    y += gap(w, y) * 0.9;
  }
  return y;
};

/** A spring, then a big gap only the spring gets you over. */
const springTower: Piece = (w, y) => {
  const x = between(w, 70, 290);
  addPlat(w, x, y, 80, 'spring');
  // a little one to its side, so you can go round if you missed it
  addPlat(w, (x + W / 2) % (W - 80) + 40, y + 70, 64, 'crumble');
  const top = y + between(w, 300, 380);
  addPlat(w, between(w, 70, 290), top, 110, 'normal');
  return top + gap(w, top);
};

/** A column of crumbly ones: keep going, don't look back. */
const crumbleLadder: Piece = (w, y) => {
  const x = between(w, 80, 280);
  for (let i = 0; i < 5; i++) {
    addPlat(w, x + between(w, -35, 35), y, 66, 'crumble');
    y += between(w, 72, 96);
  }
  return y + 20;
};

/** Sliding platforms, one above the other. */
const bridge: Piece = (w, y) => {
  for (let i = 0; i < 3; i++) {
    addPlat(w, between(w, 100, 260), y, 76 - difficulty(y) * 14, 'move');
    y += between(w, 85, 115);
  }
  return y + 20;
};

const BLINK_ON = 2.1;
const BLINK_ALL = 3.3;
/** Rows of blinking glass, in turns: one of each row is always there. */
const blinkGrid: Piece = (w, y) => {
  const base = rand(w) * BLINK_ALL;
  for (let i = 0; i < 3; i++) {
    const shift = i * 0.7;
    addPlat(w, between(w, 50, 140), y, 70, 'blink', base + shift);
    addPlat(w, between(w, 220, 310), y + 12, 70, 'blink', base + shift + BLINK_ALL / 2);
    y += between(w, 95, 125);
  }
  return y + 10;
};

const PIECES: { piece: Piece; from: number; weight: (d: number) => number }[] = [
  { piece: scatter, from: 0, weight: () => 3 },
  { piece: stairs, from: 10, weight: () => 1.2 },
  { piece: zigzag, from: 25, weight: () => 1 },
  { piece: springTower, from: 30, weight: () => 0.6 },
  { piece: crumbleLadder, from: 50, weight: (d) => 0.6 + d },
  { piece: bridge, from: 70, weight: (d) => 0.5 + d },
  { piece: blinkGrid, from: 140, weight: (d) => 0.4 + d },
];

function pickPiece(w: World, y: number): Piece {
  const m = meters(y);
  const d = difficulty(y);
  const ok = PIECES.filter((p) => m >= p.from);
  const total = ok.reduce((n, p) => n + p.weight(d), 0);
  let r = rand(w) * total;
  for (const p of ok) {
    r -= p.weight(d);
    if (r <= 0) return p.piece;
  }
  return scatter;
}

const POWER_LIST: PowerKind[] = ['rocket', 'shield', 'magnet', 'feather', 'freeze'];

/** Something to pick up, floating just above a platform. */
function addItem(w: World, kind: ItemKind, near: Plat) {
  w.items.push({ id: w.nextId++, x: near.x, y: near.y + 34, kind, taken: false });
}

/** Build the tower up to `top`. */
function grow(w: World, top: number) {
  while (w.nextY < top) {
    const y = w.nextY;
    // a golden rest stop every 100 m: wide, safe, a moment to breathe
    if (meters(y) >= w.nextCheck) {
      const p = addPlat(w, W / 2, y, 240, 'normal');
      p.check = w.nextCheck;
      w.nextCheck += 100;
      w.nextY = y + gap(w, y);
      continue;
    }
    const from = w.plats.length;
    w.nextY = pickPiece(w, y)(w, y);
    const fresh = w.plats.slice(from).filter((p) => p.kind !== 'blink');
    if (!fresh.length) continue;
    const spot = fresh[Math.floor(rand(w) * fresh.length)];
    if (w.nextY >= w.nextTicket) {
      addItem(w, 'ticket', spot);
      w.nextTicket = w.nextY + between(w, 450, 800);
    } else if (w.nextY >= w.nextItem) {
      addItem(w, POWER_LIST[Math.floor(rand(w) * POWER_LIST.length)], spot);
      w.nextItem = w.nextY + between(w, 380, 620);
    } else if (rand(w) < 0.22) addItem(w, 'heart', spot);
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
    nextItem: 500,
    nextTicket: 700,
    nextCheck: 100,
    nextFire: 6,
    frozenUntil: 0,
    plats: [],
    items: [],
    fireballs: [],
    players: [],
    zone: 0,
    checks: 0,
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
      tickets: 0,
      input: 0,
      diedAt: null,
      bounced: 0,
      face: i ? -1 : 1,
      power: null,
      powerUntil: 0,
      shield: false,
      hurt: -9,
    }),
  );
  grow(w, 900);
  return w;
}

/* ----------------------------------------------------------- platforms */

export function platX(p: Plat, t: number) {
  return p.kind === 'move' ? p.x0 + Math.sin(t * p.speed + p.phase) * p.amp : p.x;
}

/** Blinking ones: there, or not (and about to go when `warn`). */
export function blinkState(p: Plat, t: number): { on: boolean; warn: boolean } {
  if (p.kind !== 'blink') return { on: true, warn: false };
  const k = (((t + p.phase) % BLINK_ALL) + BLINK_ALL) % BLINK_ALL;
  return { on: k < BLINK_ON, warn: k > BLINK_ON - 0.6 && k < BLINK_ON };
}

/** Crumbling ones fall a moment after you bounce on them. */
export const CRUMBLE = 0.3;
export const solid = (p: Plat, t: number) =>
  !p.gone && blinkState(p, t).on && !(p.hit !== null && t - p.hit > CRUMBLE);

export const powered = (p: Hopper, kind: PowerKind, t: number) => p.power === kind && t < p.powerUntil;
export const frozen = (w: World) => w.t < w.frozenUntil;

/* -------------------------------------------------------------- a step */

/** How fast the lava climbs now (units a second). */
export function lavaSpeed(w: World): number {
  if (frozen(w)) return 0;
  const top = Math.max(...w.players.map((p) => p.best), 0);
  const base = Math.min(170, 38 + w.t * 0.9 + difficulty(top) * 60);
  // never lag too far behind: it catches up when it's off the screen
  // (after a short head start, so you can find your feet)
  const behind = w.cam - 40 - w.lava;
  return base + (behind > 0 && w.t > 4 ? Math.min(320, behind * 2.5) : 0);
}

function tick(w: World, events: LavaEvent[]) {
  const h = STEP;
  w.t += h;
  for (const p of w.players) {
    if (!p.alive) continue;
    // steering: quick to speed up, a little slide
    const input = Math.max(-1, Math.min(1, p.input || 0));
    if (Math.abs(input) > 0.05) {
      p.vx += input * ACC * h;
      p.face = Math.sign(input);
      const top = MAX_VX * Math.max(0.35, Math.abs(input));
      p.vx = Math.max(-top, Math.min(top, p.vx));
    } else p.vx *= Math.exp(-7 * h);
    const prevBottom = p.y - R;
    const rocket = powered(p, 'rocket', w.t);
    if (rocket) p.vy = Math.max(p.vy, 950);
    else {
      const space = zoneAt(meters(p.y)) === 3 ? 0.78 : 1;
      const feather = powered(p, 'feather', w.t) && p.vy < 0 ? 0.42 : 1;
      p.vy -= G * space * feather * h;
    }
    p.x += p.vx * h;
    p.y += p.vy * h;
    // round the sides: out one side, in the other
    if (p.x < -R) p.x += W + 2 * R;
    if (p.x > W + R) p.x -= W + 2 * R;
    // landing on a platform (only on the way down)
    if (p.vy < 0 && !rocket) {
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
    // things to pick up (the magnet pulls hearts and tickets in)
    for (const it of w.items) {
      if (it.taken) continue;
      const dx = p.x - it.x;
      const dy = p.y - it.y;
      const d = Math.hypot(dx, dy);
      if (powered(p, 'magnet', w.t) && (it.kind === 'heart' || it.kind === 'ticket') && d < 170 && d > 1) {
        it.x += (dx / d) * 380 * h;
        it.y += (dy / d) * 380 * h;
      }
      if (d > R + 14) continue;
      it.taken = true;
      if (it.kind === 'heart') p.hearts++;
      else if (it.kind === 'ticket') p.tickets++;
      else if (it.kind === 'shield') p.shield = true;
      else if (it.kind === 'freeze') w.frozenUntil = w.t + POWERS.freeze.secs;
      else {
        p.power = it.kind;
        p.powerUntil = w.t + POWERS[it.kind].secs;
      }
      events.push({ type: 'item', who: p.who, kind: it.kind, x: it.x, y: it.y });
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
  // from the volcano up, the lava spits fireballs
  if (w.zone >= 1 && !frozen(w) && w.t >= w.nextFire) {
    const d = difficulty(w.cam + 300);
    const target = w.players.filter((p) => p.alive)[Math.floor(rand(w) * w.players.length)] ?? w.players[0];
    const x = Math.max(20, Math.min(W - 20, target.x + between(w, -90, 90)));
    // just enough to reach a bit above the lower edge of the screen
    const reach = Math.max(260, w.cam - w.lava + between(w, 150, 330));
    w.fireballs.push({ id: w.nextId++, x, y: w.lava, vy: Math.sqrt(2 * G * reach), alive: true });
    events.push({ type: 'spit', x, y: w.lava });
    w.nextFire = w.t + between(w, 3.2, 5.5) - d * 1.8;
  }
  for (const f of w.fireballs) {
    if (!f.alive) continue;
    f.vy -= G * h;
    f.y += f.vy * h;
    if (f.y < w.lava - 30 && f.vy < 0) f.alive = false;
    for (const p of w.players) {
      if (!p.alive || !f.alive || Math.hypot(p.x - f.x, p.y - f.y) > R + 9) continue;
      f.alive = false;
      if (powered(p, 'rocket', w.t)) continue;
      if (p.shield) {
        p.shield = false;
        events.push({ type: 'saved', who: p.who, x: p.x, y: p.y });
        continue;
      }
      p.vy = Math.min(p.vy, -380);
      p.vx += (p.x < f.x ? -1 : 1) * 200;
      p.hurt = w.t;
      events.push({ type: 'burn', who: p.who, x: p.x, y: p.y });
    }
  }
  // the lava
  w.lava += lavaSpeed(w) * h;
  for (const p of w.players)
    if (p.alive && p.y - R * 0.5 < w.lava) {
      if (p.shield) {
        // the bubble pops and throws you right back up
        p.shield = false;
        p.y = w.lava + R;
        p.vy = SPRING * 1.05;
        p.bounced = w.t;
        events.push({ type: 'saved', who: p.who, x: p.x, y: w.lava });
        continue;
      }
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
  w.items = w.items.filter((it) => it.y > w.lava - 200 && !it.taken);
  w.fireballs = w.fireballs.filter((f) => f.alive);
  const top = Math.max(0, ...w.players.map((p) => p.best));
  const z = zoneAt(meters(top));
  if (z > w.zone) {
    w.zone = z;
    events.push({ type: 'zone', zone: z });
  }
  const checks = Math.floor(meters(top) / 100);
  if (checks > w.checks) {
    w.checks = checks;
    events.push({ type: 'check', m: checks * 100 });
  }
  if (!alive.length && !w.over) {
    w.over = true;
    events.push({ type: 'over' });
  }
  return events;
}

/* --------------------------------------------------------------- Coco */

/**
 * Coco steers (from -1 to 1): on the way down, towards the nearest platform
 * below her; on the way up, towards a good one above — or a goodie. A rabbit,
 * not a robot: she's a bit slow to react and sometimes picks a crumbly one.
 */
export function cocoSteer(w: World, i: number, wobble = 0): number {
  const p = w.players[i];
  if (!p.alive) return 0;
  const reach = (p.vy * p.vy) / (2 * G);
  let best: { x: number } | null = null;
  let bestScore = -Infinity;
  for (const pl of w.plats) {
    if (!solid(pl, w.t)) continue;
    const dy = pl.y - (p.y - R);
    if (p.vy < 0 ? dy > 0 || dy < -260 : dy > reach - 10 || dy < -200) continue;
    const dx = Math.abs(platX(pl, w.t) - p.x);
    const wrap = Math.min(dx, W - dx);
    const s =
      (p.vy < 0 ? -dy * 0.2 : dy) -
      wrap * 0.9 +
      (pl.kind === 'spring' ? 80 : 0) -
      (pl.kind === 'blink' ? 60 : 0) +
      (pl.check ? 40 : 0);
    if (s > bestScore) {
      bestScore = s;
      best = { x: platX(pl, w.t) };
    }
  }
  // a goodie she can reach on this jump is worth a little detour
  if (p.vy > 0)
    for (const it of w.items) {
      const dy = it.y - p.y;
      if (it.taken || dy < 0 || dy > reach - 20) continue;
      if (Math.abs(it.x - p.x) < 100) best = { x: it.x };
    }
  if (!best) return 0;
  let dx = best.x + wobble - p.x;
  if (dx > W / 2) dx -= W;
  if (dx < -W / 2) dx += W;
  return Math.max(-1, Math.min(1, dx / 30));
}
