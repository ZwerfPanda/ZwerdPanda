/*
 * Minigolf: six holes seen from above. Pull back from the ball like a
 * slingshot and let go; walls bounce, sand slows you down, water costs a
 * stroke, a windmill and a sliding log get in the way. Fewer strokes is
 * more points: (par + 4 − strokes) × 10 per hole, at most 7 strokes.
 *
 * Course units: 300 wide, 480 tall, y down.
 */

export const W = 300;
export const H = 480;
export const BALL_R = 6;
export const CUP_R = 10;
export const MAX_STROKES = 7;
export const MAX_SPEED = 620;

type P = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export interface Hole {
  name: string;
  emoji: string;
  par: number;
  tee: P;
  cup: P;
  /** Closed outlines: the course's edge and solid bits inside it. */
  walls: P[][];
  water?: Rect[];
  sand?: Rect[];
  /** A windmill: blades turning round this centre. */
  mill?: { x: number; y: number; len: number; speed: number };
  /** A log sliding left and right. */
  slider?: { y: number; w: number; h: number; from: number; to: number; speed: number };
}

const box = (x: number, y: number, w: number, h: number): P[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

export const HOLES: Hole[] = [
  {
    name: 'De oprit',
    emoji: '🌷',
    par: 2,
    tee: { x: 150, y: 420 },
    cup: { x: 150, y: 80 },
    walls: [
      box(70, 30, 160, 430),
      box(128, 230, 44, 30),
      box(70, 140, 50, 22),
      box(180, 140, 50, 22),
    ],
  },
  {
    name: 'Hoekje om',
    emoji: '↪️',
    par: 3,
    tee: { x: 70, y: 420 },
    cup: { x: 235, y: 80 },
    walls: [
      [
        { x: 20, y: 460 },
        { x: 120, y: 460 },
        { x: 120, y: 160 },
        { x: 280, y: 160 },
        { x: 280, y: 30 },
        { x: 20, y: 30 },
      ],
    ],
  },
  {
    name: 'De windmolen',
    emoji: '🌬️',
    par: 3,
    tee: { x: 150, y: 430 },
    cup: { x: 150, y: 70 },
    walls: [box(60, 25, 180, 440), box(60, 230, 55, 40), box(185, 230, 55, 40)],
    mill: { x: 150, y: 250, len: 52, speed: 1.6 },
  },
  {
    name: 'Het vijvertje',
    emoji: '🦆',
    par: 3,
    tee: { x: 150, y: 435 },
    cup: { x: 150, y: 60 },
    walls: [box(25, 20, 250, 450)],
    water: [{ x: 70, y: 170, w: 160, h: 150 }],
  },
  {
    name: 'De zandbak',
    emoji: '🏖️',
    par: 3,
    tee: { x: 60, y: 430 },
    cup: { x: 230, y: 75 },
    walls: [
      box(25, 25, 250, 440),
      [
        { x: 25, y: 300 },
        { x: 170, y: 250 },
        { x: 170, y: 270 },
        { x: 25, y: 320 },
      ],
      [
        { x: 275, y: 170 },
        { x: 130, y: 210 },
        { x: 130, y: 190 },
        { x: 275, y: 150 },
      ],
    ],
    sand: [
      { x: 180, y: 40, w: 90, h: 30 },
      { x: 190, y: 100, w: 80, h: 40 },
    ],
  },
  {
    name: 'Coco’s hol',
    emoji: '🐰',
    par: 3,
    tee: { x: 150, y: 430 },
    cup: { x: 150, y: 75 },
    walls: [box(45, 25, 210, 440), box(45, 300, 70, 25), box(185, 300, 70, 25)],
    slider: { y: 170, w: 80, h: 22, from: 50, to: 250, speed: 0.9 },
  },
];

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GolfState {
  hole: number;
  ball: Ball;
  /** Where the last shot was taken from (water puts you back here). */
  lastRest: P;
  strokes: number[];
  t: number;
  moving: boolean;
  sunk: boolean;
  over: boolean;
}

export type GolfEvent =
  | { type: 'wall' }
  | { type: 'water' }
  | { type: 'sunk'; strokes: number; par: number }
  | { type: 'lip' }
  | { type: 'max' }
  | { type: 'end' };

export const newGolf = (): GolfState => ({
  hole: 0,
  ball: { ...HOLES[0].tee, vx: 0, vy: 0 },
  lastRest: { ...HOLES[0].tee },
  strokes: [0],
  t: 0,
  moving: false,
  sunk: false,
  over: false,
});

/** The windmill's blades right now, as segments. */
export function bladesAt(h: Hole, t: number): [P, P][] {
  if (!h.mill) return [];
  const { x, y, len, speed } = h.mill;
  return [0, 1, 2, 3].map((k) => {
    const a = t * speed + (k * Math.PI) / 2;
    return [
      { x: x + Math.cos(a) * 8, y: y + Math.sin(a) * 8 },
      { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len },
    ];
  });
}

export function sliderAt(h: Hole, t: number): Rect | null {
  if (!h.slider) return null;
  const { y, w, h: hh, from, to, speed } = h.slider;
  const k = (Math.sin(t * speed) + 1) / 2;
  return { x: from + (to - from - w) * k, y, w, h: hh };
}

const segs = (poly: P[]): [P, P][] => poly.map((p, i) => [p, poly[(i + 1) % poly.length]]);
const inRect = (p: P, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

/** All the solid edges of a hole at time t. */
export function edgesAt(h: Hole, t: number): [P, P][] {
  const out = h.walls.flatMap(segs);
  out.push(...bladesAt(h, t));
  const s = sliderAt(h, t);
  if (s) out.push(...segs(box(s.x, s.y, s.w, s.h)));
  return out;
}

function bounce(b: Ball, [a, c]: [P, P]): Ball | null {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const k = Math.max(0, Math.min(1, ((b.x - a.x) * dx + (b.y - a.y) * dy) / len2));
  const px = a.x + dx * k;
  const py = a.y + dy * k;
  const ox = b.x - px;
  const oy = b.y - py;
  const d = Math.hypot(ox, oy);
  if (d >= BALL_R || d === 0) return null;
  const nx = ox / d;
  const ny = oy / d;
  const vn = b.vx * nx + b.vy * ny;
  const push = BALL_R - d + 0.01;
  if (vn >= 0) return { ...b, x: b.x + nx * push, y: b.y + ny * push };
  return {
    x: b.x + nx * push,
    y: b.y + ny * push,
    vx: (b.vx - 1.8 * vn * nx) * 0.92,
    vy: (b.vy - 1.8 * vn * ny) * 0.92,
  };
}

/** Pull back `dx, dy` (from the ball to your finger) and let go. */
export function putt(s: GolfState, dx: number, dy: number): GolfState {
  if (s.moving || s.sunk || s.over) return s;
  const len = Math.hypot(dx, dy);
  if (len < 6) return s;
  const speed = Math.min(MAX_SPEED, len * 4.2);
  const strokes = [...s.strokes];
  strokes[s.hole] += 1;
  return {
    ...s,
    strokes,
    moving: true,
    lastRest: { x: s.ball.x, y: s.ball.y },
    ball: { ...s.ball, vx: (-dx / len) * speed, vy: (-dy / len) * speed },
  };
}

/** Time passes: the ball rolls, bounces, sinks — and the windmill turns. */
export function step(s: GolfState, dt: number): { state: GolfState; events: GolfEvent[] } {
  if (s.over) return { state: s, events: [] };
  const events: GolfEvent[] = [];
  const h = HOLES[s.hole];
  const d = Math.max(0, Math.min(dt, 0.05));
  let next: GolfState = { ...s, t: s.t + d };
  if (!s.moving) return { state: next, events };
  let b = { ...s.ball };
  const n = 6;
  let hitWall = false;
  for (let k = 0; k < n; k++) {
    const h2 = d / n;
    const sandy = (h.sand ?? []).some((r) => inRect(b, r));
    const speed = Math.hypot(b.vx, b.vy);
    // rolling friction: a little drag, a little steady slowing
    const slow =
      Math.max(0, speed - (sandy ? 900 : 95) * h2) * Math.exp(-(sandy ? 3.2 : 0.55) * h2);
    const f = speed > 0 ? slow / speed : 0;
    b = { x: b.x + b.vx * f * h2, y: b.y + b.vy * f * h2, vx: b.vx * f, vy: b.vy * f };
    for (const e of edgesAt(h, next.t)) {
      const out = bounce(b, e);
      if (out) {
        if (Math.hypot(b.vx, b.vy) > 60) hitWall = true;
        b = out;
      }
    }
    // the cup: slow enough falls in, too fast rolls over the lip
    const toCup = Math.hypot(b.x - h.cup.x, b.y - h.cup.y);
    const v = Math.hypot(b.vx, b.vy);
    if (toCup < CUP_R - 2) {
      if (v < 330) {
        const strokes = next.strokes[next.hole];
        events.push({ type: 'sunk', strokes, par: h.par });
        return {
          state: {
            ...next,
            ball: { x: h.cup.x, y: h.cup.y, vx: 0, vy: 0 },
            moving: false,
            sunk: true,
          },
          events,
        };
      }
      // a fast ball over the hole bends a little
      b = { ...b, vx: b.vx * 0.86 + (h.cup.x - b.x) * 2, vy: b.vy * 0.86 + (h.cup.y - b.y) * 2 };
      if (!events.some((e) => e.type === 'lip')) events.push({ type: 'lip' });
    }
    if ((h.water ?? []).some((r) => inRect(b, r))) {
      events.push({ type: 'water' });
      const strokes = [...next.strokes];
      strokes[next.hole] += 1;
      const back = next.lastRest;
      return {
        state: { ...next, strokes, ball: { ...back, vx: 0, vy: 0 }, moving: false },
        events: maxed(next.hole, strokes, events),
      };
    }
  }
  if (hitWall) events.push({ type: 'wall' });
  const stopped = Math.hypot(b.vx, b.vy) < 6;
  next = { ...next, ball: stopped ? { ...b, vx: 0, vy: 0 } : b, moving: !stopped };
  if (stopped) return { state: next, events: maxed(next.hole, next.strokes, events) };
  return { state: next, events };
}

function maxed(hole: number, strokes: number[], events: GolfEvent[]): GolfEvent[] {
  return strokes[hole] >= MAX_STROKES ? [...events, { type: 'max' }] : events;
}

/** On to the next hole (or the end). */
export function nextHole(s: GolfState): { state: GolfState; events: GolfEvent[] } {
  const strokes = [...s.strokes];
  strokes[s.hole] = Math.min(MAX_STROKES, strokes[s.hole]);
  if (s.hole + 1 >= HOLES.length)
    return { state: { ...s, strokes, over: true, moving: false }, events: [{ type: 'end' }] };
  const hole = s.hole + 1;
  const tee = HOLES[hole].tee;
  return {
    state: {
      ...s,
      hole,
      strokes: [...strokes, 0],
      ball: { ...tee, vx: 0, vy: 0 },
      lastRest: { ...tee },
      moving: false,
      sunk: false,
    },
    events: [],
  };
}

export const holePoints = (strokes: number, par: number) => Math.max(0, par + 4 - strokes) * 10;
export const golfScore = (s: Pick<GolfState, 'strokes'>) =>
  s.strokes.reduce(
    (n, k, i) => n + (k > 0 ? holePoints(Math.min(MAX_STROKES, k), HOLES[i].par) : 0),
    0,
  );
export const totalStrokes = (s: Pick<GolfState, 'strokes'>) =>
  s.strokes.reduce((n, k) => n + Math.min(MAX_STROKES, k), 0);

export function holeWord(strokes: number, par: number): string {
  if (strokes === 1) return 'Hole in one! 🎉';
  const d = strokes - par;
  return d <= -2
    ? 'Eagle! 🦅'
    : d === -1
      ? 'Birdie! 🐦'
      : d === 0
        ? 'Par ⛳'
        : d === 1
          ? 'Bogey'
          : `+${d}`;
}

/** Coco's round: she putts with her nose, a stroke or so over par. */
export function cocoGolf(rng: () => number = Math.random): number {
  return HOLES.reduce((n, h) => {
    const r = rng();
    const strokes =
      r < 0.08 ? 1 : r < 0.3 ? h.par - 1 || 1 : r < 0.65 ? h.par : r < 0.9 ? h.par + 1 : h.par + 2;
    return n + holePoints(strokes, h.par);
  }, 0);
}

export const isInRect = inRect;
