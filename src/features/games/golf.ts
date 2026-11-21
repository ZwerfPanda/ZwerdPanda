/*
 * Minigolf: five little worlds of six holes each, seen from above. Pull back
 * from the ball like a slingshot and let go. Walls bounce, sand slows you
 * down, ice speeds you up, water costs a stroke, bumpers kick, arrows push,
 * hills roll you down, portals beam you across and black holes pull you in.
 * Fewer strokes is more points: (par + 4 − strokes) × 10 per hole, at most
 * 7 strokes.
 *
 * Course units: 300 wide, 480 tall, y down.
 */

export const W = 300;
export const H = 480;
export const BALL_R = 6;
export const CUP_R = 10;
export const MAX_STROKES = 7;
export const MAX_SPEED = 620;
/** How far you can pull back (course units) for a full-power putt. */
export const PULL = MAX_SPEED / 4.2;
export const PORTAL_R = 13;
export const HOLES_PER_COURSE = 6;

type P = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
/** A zone that pushes: a hill (always) or arrows on the felt (a boost). */
export type Push = Rect & { ax: number; ay: number };

export interface Mill {
  x: number;
  y: number;
  len: number;
  speed: number;
  /** How many blades (default 4). */
  blades?: number;
}

export interface Slider {
  /** Sliding left and right at this y… */
  y: number;
  w: number;
  h: number;
  from: number;
  to: number;
  speed: number;
  /** …or, `vertical`, up and down at x = `y` between `from` and `to`. */
  vertical?: boolean;
  phase?: number;
}

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
  ice?: Rect[];
  /** Hills: a steady roll in one direction (stronger than friction). */
  slopes?: Push[];
  /** Arrow pads: a short, hard shove. */
  boosts?: Push[];
  /** Round posts that kick the ball back harder than it came. */
  bumpers?: { x: number; y: number; r: number }[];
  /** Pairs of portals: in at `a`, out at `b`, same speed and direction. */
  portals?: { a: P; b: P }[];
  /** Black holes: pull the ball in; right in the middle costs a stroke. */
  wells?: { x: number; y: number; r: number; pull: number }[];
  mills?: Mill[];
  sliders?: Slider[];
}

export type ThemeId = 'park' | 'beach' | 'candy' | 'ice' | 'space';

export interface Course {
  id: string;
  name: string;
  emoji: string;
  theme: ThemeId;
  blurb: string;
  /** The whole course is a bit slippery (ice) or not. */
  glide?: number;
  holes: Hole[];
}

const box = (x: number, y: number, w: number, h: number): P[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

const poly = (...xy: number[]): P[] => {
  const out: P[] = [];
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i], y: xy[i + 1] });
  return out;
};

/** A regular n-gon (for round-ish obstacles that are still walls). */
const ngon = (cx: number, cy: number, r: number, n: number, turn = 0): P[] =>
  Array.from({ length: n }, (_, k) => {
    const a = turn + (k / n) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });

/* ------------------------------------------------------------- 1. park */

const PARK: Hole[] = [
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
    walls: [poly(20, 460, 120, 460, 120, 160, 280, 160, 280, 30, 20, 30)],
  },
  {
    name: 'De windmolen',
    emoji: '🌬️',
    par: 3,
    tee: { x: 150, y: 430 },
    cup: { x: 150, y: 70 },
    walls: [box(60, 25, 180, 440), box(60, 230, 55, 40), box(185, 230, 55, 40)],
    mills: [{ x: 150, y: 250, len: 52, speed: 1.6 }],
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
      poly(25, 300, 170, 250, 170, 270, 25, 320),
      poly(275, 170, 130, 210, 130, 190, 275, 150),
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
    sliders: [{ y: 170, w: 80, h: 22, from: 50, to: 250, speed: 0.9 }],
  },
];

/* ------------------------------------------------------------ 2. beach */

const BEACH: Hole[] = [
  {
    name: 'Strandballen',
    emoji: '🏐',
    par: 2,
    tee: { x: 150, y: 425 },
    cup: { x: 150, y: 75 },
    walls: [box(55, 30, 190, 430)],
    bumpers: [
      { x: 150, y: 190, r: 15 },
      { x: 100, y: 270, r: 13 },
      { x: 200, y: 270, r: 13 },
    ],
    sand: [{ x: 60, y: 120, w: 50, h: 40 }],
  },
  {
    name: 'De pier',
    emoji: '🪵',
    par: 3,
    tee: { x: 150, y: 435 },
    cup: { x: 150, y: 60 },
    walls: [box(25, 20, 250, 450)],
    water: [
      { x: 25, y: 300, w: 150, h: 70 },
      { x: 125, y: 170, w: 150, h: 70 },
    ],
  },
  {
    name: 'Krabbenkanaal',
    emoji: '🦀',
    par: 3,
    tee: { x: 60, y: 425 },
    cup: { x: 240, y: 70 },
    walls: [poly(25, 460, 100, 460, 100, 240, 275, 240, 275, 25, 175, 25, 175, 160, 25, 160)],
    boosts: [{ x: 110, y: 170, w: 60, h: 60, ax: 520, ay: 0 }],
    sliders: [{ y: 186, w: 34, h: 34, from: 180, to: 270, speed: 1.1 }],
  },
  {
    name: 'Zandkasteel',
    emoji: '🏰',
    par: 3,
    tee: { x: 150, y: 435 },
    cup: { x: 150, y: 165 },
    walls: [
      box(30, 25, 240, 445),
      // the castle: walls round the cup, the gate at the top
      poly(95, 110, 130, 110, 130, 125, 110, 125, 110, 220, 190, 220, 190, 125, 170, 125, 170, 110, 205, 110, 205, 235, 95, 235),
    ],
    sand: [
      { x: 40, y: 260, w: 220, h: 40 },
      { x: 220, y: 40, w: 45, h: 60 },
    ],
  },
  {
    name: 'Eb en vloed',
    emoji: '🌊',
    par: 3,
    tee: { x: 150, y: 435 },
    cup: { x: 150, y: 70 },
    walls: [box(40, 25, 220, 445)],
    water: [{ x: 40, y: 200, w: 85, h: 90 }, { x: 175, y: 200, w: 85, h: 90 }],
    sliders: [{ y: 120, w: 70, h: 20, from: 45, to: 255, speed: 1.2 }],
  },
  {
    name: 'De vuurtoren',
    emoji: '🗼',
    par: 4,
    tee: { x: 60, y: 435 },
    cup: { x: 60, y: 70 },
    walls: [
      box(25, 25, 250, 445),
      box(25, 330, 190, 22),
      box(85, 175, 190, 22),
    ],
    mills: [{ x: 150, y: 262, len: 44, speed: -1.3, blades: 3 }],
    water: [{ x: 30, y: 210, w: 40, h: 100 }],
  },
];

/* ------------------------------------------------------------ 3. candy */

const CANDY: Hole[] = [
  {
    name: 'Gombalgang',
    emoji: '🍬',
    par: 2,
    tee: { x: 150, y: 430 },
    cup: { x: 150, y: 70 },
    walls: [box(45, 25, 210, 440)],
    bumpers: [
      { x: 95, y: 150, r: 12 },
      { x: 150, y: 150, r: 12 },
      { x: 205, y: 150, r: 12 },
      { x: 122, y: 230, r: 12 },
      { x: 178, y: 230, r: 12 },
      { x: 95, y: 310, r: 12 },
      { x: 205, y: 310, r: 12 },
    ],
  },
  {
    name: 'Lollylift',
    emoji: '🍭',
    par: 2,
    tee: { x: 75, y: 420 },
    cup: { x: 225, y: 75 },
    walls: [box(25, 25, 250, 440), box(150, 25, 18, 300), box(25, 200, 125, 18)],
    portals: [{ a: { x: 87, y: 260 }, b: { x: 225, y: 290 } }],
  },
  {
    name: 'Chocoladeberg',
    emoji: '🍫',
    par: 3,
    tee: { x: 150, y: 435 },
    cup: { x: 150, y: 70 },
    walls: [box(45, 25, 210, 445), box(45, 120, 70, 20), box(185, 120, 70, 20)],
    slopes: [{ x: 45, y: 160, w: 210, h: 160, ax: 0, ay: 170 }],
  },
  {
    name: 'Suikerspin',
    emoji: '🍥',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 60 },
    walls: [box(50, 25, 200, 445)],
    mills: [
      { x: 110, y: 300, len: 46, speed: 1.8 },
      { x: 190, y: 170, len: 46, speed: -1.5 },
    ],
  },
  {
    name: 'Dropdoolhof',
    emoji: '⚫',
    par: 4,
    tee: { x: 60, y: 435 },
    cup: { x: 240, y: 60 },
    walls: [
      box(25, 25, 250, 445),
      box(25, 370, 180, 18),
      box(95, 280, 180, 18),
      box(25, 190, 180, 18),
      box(95, 100, 180, 18),
    ],
    boosts: [{ x: 215, y: 300, w: 55, h: 60, ax: 0, ay: -420 }],
  },
  {
    name: 'De taart',
    emoji: '🎂',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 55 },
    walls: [
      poly(90, 25, 210, 25, 270, 90, 270, 400, 210, 465, 90, 465, 30, 400, 30, 90),
      ngon(150, 250, 42, 10),
    ],
    bumpers: [
      { x: 70, y: 150, r: 11 },
      { x: 230, y: 150, r: 11 },
    ],
    sliders: [{ y: 360, w: 60, h: 18, from: 40, to: 260, speed: 1 }],
  },
];

/* -------------------------------------------------------------- 4. ice */

const ICE: Hole[] = [
  {
    name: 'De glijbaan',
    emoji: '🛷',
    par: 2,
    tee: { x: 150, y: 430 },
    cup: { x: 150, y: 90 },
    walls: [box(80, 25, 140, 440), box(80, 150, 50, 18), box(170, 150, 50, 18)],
    sand: [{ x: 85, y: 30, w: 130, h: 26 }],
  },
  {
    name: 'Sneeuwballen',
    emoji: '⛄',
    par: 3,
    tee: { x: 70, y: 430 },
    cup: { x: 230, y: 70 },
    walls: [box(30, 25, 240, 440)],
    bumpers: [
      { x: 150, y: 250, r: 22 },
      { x: 85, y: 160, r: 14 },
      { x: 215, y: 340, r: 14 },
      { x: 200, y: 140, r: 12 },
    ],
  },
  {
    name: 'Het wak',
    emoji: '🧊',
    par: 3,
    tee: { x: 150, y: 435 },
    cup: { x: 150, y: 70 },
    walls: [box(30, 25, 240, 445)],
    water: [
      { x: 95, y: 180, w: 110, h: 120 },
      { x: 30, y: 120, w: 50, h: 50 },
      { x: 220, y: 120, w: 50, h: 50 },
    ],
    sand: [{ x: 110, y: 40, w: 80, h: 20 }],
  },
  {
    name: 'Pinguïnpad',
    emoji: '🐧',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 60 },
    walls: [box(45, 25, 210, 445)],
    sliders: [
      { y: 300, w: 60, h: 22, from: 50, to: 250, speed: 1.3 },
      { y: 160, w: 60, h: 22, from: 50, to: 250, speed: 1.1, phase: 2 },
    ],
  },
  {
    name: 'Lawine',
    emoji: '🏔️',
    par: 3,
    tee: { x: 60, y: 90 },
    cup: { x: 70, y: 405 },
    walls: [box(25, 25, 250, 445), box(25, 230, 170, 20)],
    slopes: [{ x: 25, y: 25, w: 250, h: 205, ax: 0, ay: 110 }],
    boosts: [{ x: 205, y: 140, w: 65, h: 70, ax: 0, ay: 450 }],
    bumpers: [{ x: 160, y: 385, r: 16 }],
    water: [{ x: 90, y: 280, w: 70, h: 40 }],
  },
  {
    name: 'De iglo',
    emoji: '🛖',
    par: 3,
    tee: { x: 60, y: 440 },
    cup: { x: 150, y: 130 },
    walls: [
      box(25, 25, 250, 445),
      // the igloo round the cup, door at the bottom
      poly(90, 205, 90, 110, 120, 75, 180, 75, 210, 110, 210, 205, 170, 205, 170, 190, 195, 190, 195, 115, 175, 92, 125, 92, 105, 115, 105, 190, 130, 190, 130, 205),
    ],
    mills: [{ x: 150, y: 300, len: 50, speed: 1.2 }],
    portals: [{ a: { x: 240, y: 440 }, b: { x: 150, y: 245 } }],
  },
];

/* ------------------------------------------------------------ 5. space */

const SPACE: Hole[] = [
  {
    name: 'Lancering',
    emoji: '🚀',
    par: 2,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 60 },
    walls: [box(90, 25, 120, 445), box(90, 200, 35, 20), box(175, 200, 35, 20)],
    boosts: [{ x: 120, y: 280, w: 60, h: 70, ax: 0, ay: -700 }],
    sand: [{ x: 95, y: 30, w: 110, h: 12 }],
  },
  {
    name: 'Zwart gat',
    emoji: '🕳️',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 70 },
    walls: [box(30, 25, 240, 445)],
    wells: [{ x: 150, y: 250, r: 95, pull: 900 }],
  },
  {
    name: 'Wormgat',
    emoji: '🌀',
    par: 2,
    tee: { x: 70, y: 430 },
    cup: { x: 230, y: 70 },
    walls: [box(25, 25, 250, 445), box(140, 25, 20, 445)],
    portals: [
      { a: { x: 70, y: 90 }, b: { x: 230, y: 420 } },
      { a: { x: 105, y: 250 }, b: { x: 200, y: 160 } },
    ],
  },
  {
    name: 'Asteroïden',
    emoji: '☄️',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 55 },
    walls: [box(35, 25, 230, 445)],
    sliders: [
      { y: 330, w: 44, h: 44, from: 40, to: 260, speed: 1.4 },
      { y: 220, w: 44, h: 44, from: 40, to: 260, speed: -1.1 },
      { y: 120, w: 44, h: 44, from: 40, to: 260, speed: 1.7, phase: 1 },
    ],
  },
  {
    name: 'Satelliet',
    emoji: '🛰️',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 90 },
    walls: [box(30, 25, 240, 445)],
    mills: [{ x: 150, y: 240, len: 62, speed: 1.1, blades: 2 }],
    bumpers: [
      { x: 70, y: 150, r: 14 },
      { x: 230, y: 150, r: 14 },
      { x: 70, y: 330, r: 14 },
      { x: 230, y: 330, r: 14 },
    ],
  },
  {
    name: 'Maanlanding',
    emoji: '🌙',
    par: 4,
    tee: { x: 60, y: 440 },
    cup: { x: 230, y: 70 },
    walls: [box(25, 25, 250, 445), box(25, 300, 180, 20), box(95, 160, 180, 20)],
    wells: [{ x: 210, y: 380, r: 60, pull: 650 }],
    portals: [{ a: { x: 245, y: 250 }, b: { x: 60, y: 120 } }],
    sliders: [{ y: 80, w: 20, h: 50, from: 100, to: 200, speed: 1.2 }],
  },
];

export const COURSES: Course[] = [
  { id: 'park', name: 'Het park', emoji: '🌳', theme: 'park', blurb: 'Windmolen & vijver', holes: PARK },
  { id: 'beach', name: 'Het strand', emoji: '🏖️', theme: 'beach', blurb: 'Zee, zand en een vuurtoren', holes: BEACH },
  { id: 'candy', name: 'Snoepland', emoji: '🍭', theme: 'candy', blurb: 'Gombal-bumpers & portalen', holes: CANDY },
  { id: 'ice', name: 'IJspaleis', emoji: '❄️', theme: 'ice', blurb: 'Glad! De bal glijdt ver door', glide: 0.35, holes: ICE },
  { id: 'space', name: 'De ruimte', emoji: '🪐', theme: 'space', blurb: 'Zwarte gaten en wormgaten', holes: SPACE },
];

/** The first course's holes (kept for older callers). */
export const HOLES = PARK;

export const courseOf = (s: Pick<GolfState, 'course'>): Course =>
  COURSES[Math.max(0, Math.min(COURSES.length - 1, s.course ?? 0))];
export const holeOf = (s: Pick<GolfState, 'course' | 'hole'>): Hole => courseOf(s).holes[s.hole];
export const courseIndex = (id: unknown) => {
  const i = COURSES.findIndex((c) => c.id === id);
  return i < 0 ? 0 : i;
};
export const coursePar = (c: Course) => c.holes.reduce((n, h) => n + h.par, 0);

/* ------------------------------------------------------------ the game */

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GolfState {
  course: number;
  hole: number;
  ball: Ball;
  /** Where the last shot was taken from (water puts you back here). */
  lastRest: P;
  strokes: number[];
  t: number;
  /** Time this shot has been rolling (a ball that never settles is stopped). */
  rolling: number;
  moving: boolean;
  sunk: boolean;
  over: boolean;
  /** Just came out of a portal: it only works again once you've left it. */
  warped?: number;
}

export type GolfEvent =
  | { type: 'wall' }
  | { type: 'bump' }
  | { type: 'boost' }
  | { type: 'warp' }
  | { type: 'water'; at: P }
  | { type: 'void'; at: P }
  | { type: 'out' }
  | { type: 'sunk'; strokes: number; par: number }
  | { type: 'lip' }
  | { type: 'max' }
  | { type: 'end' };

export const newGolf = (course = 0): GolfState => {
  const c = Math.max(0, Math.min(COURSES.length - 1, course));
  const tee = COURSES[c].holes[0].tee;
  return {
    course: c,
    hole: 0,
    ball: { ...tee, vx: 0, vy: 0 },
    lastRest: { ...tee },
    strokes: [0],
    t: 0,
    rolling: 0,
    moving: false,
    sunk: false,
    over: false,
  };
};

/** A windmill's blades right now, as segments. */
export function millBlades(m: Mill, t: number): [P, P][] {
  const n = m.blades ?? 4;
  return Array.from({ length: n }, (_, k) => {
    const a = t * m.speed + (k * Math.PI * 2) / n;
    return [
      { x: m.x + Math.cos(a) * 8, y: m.y + Math.sin(a) * 8 },
      { x: m.x + Math.cos(a) * m.len, y: m.y + Math.sin(a) * m.len },
    ];
  });
}

export const bladesAt = (h: Hole, t: number): [P, P][] =>
  (h.mills ?? []).flatMap((m) => millBlades(m, t));

export function sliderRect(sl: Slider, t: number): Rect {
  const k = (Math.sin(t * sl.speed + (sl.phase ?? 0)) + 1) / 2;
  if (sl.vertical) return { x: sl.y, y: sl.from + (sl.to - sl.from - sl.h) * k, w: sl.w, h: sl.h };
  return { x: sl.from + (sl.to - sl.from - sl.w) * k, y: sl.y, w: sl.w, h: sl.h };
}

export const slidersAt = (h: Hole, t: number): Rect[] =>
  (h.sliders ?? []).map((sl) => sliderRect(sl, t));

/** The first slider (kept for older callers). */
export const sliderAt = (h: Hole, t: number): Rect | null => slidersAt(h, t)[0] ?? null;

const segs = (pl: P[]): [P, P][] => pl.map((p, i) => [p, pl[(i + 1) % pl.length]]);
const inRect = (p: P, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export function inPoly(p: P, pl: P[]) {
  let c = false;
  for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) {
    const a = pl[i];
    const b = pl[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** The ball's centre is on the felt: inside the edge, outside every block. */
export function inside(h: Hole, p: P) {
  const [outer, ...blocks] = h.walls;
  return inPoly(p, outer) && !blocks.some((bl) => inPoly(p, bl));
}

const staticEdges = new WeakMap<Hole, [P, P][]>();
/** All the solid edges of a hole at time t. */
export function edgesAt(h: Hole, t: number): [P, P][] {
  let fixed = staticEdges.get(h);
  if (!fixed) {
    fixed = h.walls.flatMap(segs);
    staticEdges.set(h, fixed);
  }
  const out = [...fixed, ...bladesAt(h, t)];
  for (const s of slidersAt(h, t)) out.push(...segs(box(s.x, s.y, s.w, s.h)));
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
    rolling: 0,
    lastRest: { x: s.ball.x, y: s.ball.y },
    ball: { ...s.ball, vx: (-dx / len) * speed, vy: (-dy / len) * speed },
  };
}

const TOP_SPEED = MAX_SPEED * 1.35;

function penalty(next: GolfState, kind: 'water' | 'void', events: GolfEvent[], at: P) {
  events.push({ type: kind, at: { x: at.x, y: at.y } });
  const strokes = [...next.strokes];
  strokes[next.hole] += 1;
  const back = next.lastRest;
  return {
    state: {
      ...next,
      strokes,
      ball: { ...back, vx: 0, vy: 0 },
      moving: false,
      warped: undefined,
    },
    events: maxed(next.hole, strokes, events),
  };
}

/** Time passes: the ball rolls, bounces, sinks — and the windmills turn. */
export function step(s: GolfState, dt: number): { state: GolfState; events: GolfEvent[] } {
  if (s.over) return { state: s, events: [] };
  const events: GolfEvent[] = [];
  const course = courseOf(s);
  const h = course.holes[s.hole];
  const d = Math.max(0, Math.min(dt, 0.05));
  let next: GolfState = { ...s, t: s.t + d };
  if (!s.moving) return { state: next, events };
  let b = { ...s.ball };
  let warped = s.warped;
  const n = Math.max(6, Math.ceil((Math.hypot(b.vx, b.vy) * d) / 3));
  let hitWall = false;
  let pushed = false;
  let leaning = false;
  const glide = course.glide ?? 1;
  const add = (ev: 'wall' | 'bump' | 'boost' | 'warp' | 'lip') => {
    if (!events.some((e) => e.type === ev)) events.push({ type: ev });
  };
  for (let k = 0; k < n; k++) {
    const h2 = d / n;
    const t = s.t + (d * (k + 1)) / n;
    const sandy = (h.sand ?? []).some((r) => inRect(b, r));
    const icy = (h.ice ?? []).some((r) => inRect(b, r));
    // hills and arrow pads
    leaning = false;
    for (const sl of h.slopes ?? [])
      if (inRect(b, sl)) {
        b.vx += sl.ax * h2;
        b.vy += sl.ay * h2;
        leaning = true;
      }
    for (const bo of h.boosts ?? [])
      if (inRect(b, bo)) {
        b.vx += bo.ax * h2 * 4;
        b.vy += bo.ay * h2 * 4;
        pushed = true;
      }
    // black holes pull (harder the closer)
    for (const w of h.wells ?? []) {
      const ox = w.x - b.x;
      const oy = w.y - b.y;
      const dist = Math.hypot(ox, oy);
      if (dist < w.r && dist > 0.001) {
        const f = (w.pull * (1 - dist / w.r) + 60) * h2;
        b.vx += (ox / dist) * f;
        b.vy += (oy / dist) * f;
        leaning = true;
      }
      if (dist < 9) return penalty({ ...next, warped }, 'void', events, { x: w.x, y: w.y });
    }
    const speed = Math.hypot(b.vx, b.vy);
    // rolling friction: a little drag, a little steady slowing
    const roll = sandy ? 900 : icy ? 22 : 95 * glide;
    const drag = sandy ? 3.2 : icy ? 0.12 : 0.55 * glide;
    const slow = Math.max(0, Math.min(TOP_SPEED, speed) - roll * h2) * Math.exp(-drag * h2);
    const f = speed > 0 ? slow / speed : 0;
    b = { x: b.x + b.vx * f * h2, y: b.y + b.vy * f * h2, vx: b.vx * f, vy: b.vy * f };
    for (const e of edgesAt(h, t)) {
      const out = bounce(b, e);
      if (out) {
        if (Math.hypot(b.vx, b.vy) > 60) hitWall = true;
        b = out;
      }
    }
    for (const bu of h.bumpers ?? []) {
      const ox = b.x - bu.x;
      const oy = b.y - bu.y;
      const dist = Math.hypot(ox, oy);
      const min = bu.r + BALL_R;
      if (dist < min && dist > 0) {
        const nx = ox / dist;
        const ny = oy / dist;
        const vn = b.vx * nx + b.vy * ny;
        b.x = bu.x + nx * (min + 0.01);
        b.y = bu.y + ny * (min + 0.01);
        if (vn < 0) {
          // a springy kick: back out faster, with at least a little shove
          const out = Math.max(-vn * 1.25, 140);
          b.vx = b.vx - vn * nx + nx * out;
          b.vy = b.vy - vn * ny + ny * out;
          add('bump');
        }
      }
    }
    // portals: in one, out the other
    for (let i = 0; i < (h.portals ?? []).length; i++) {
      const pr = h.portals![i];
      if (warped === i) {
        if (Math.hypot(b.x - pr.b.x, b.y - pr.b.y) > PORTAL_R + BALL_R) warped = undefined;
        continue;
      }
      if (Math.hypot(b.x - pr.a.x, b.y - pr.a.y) < PORTAL_R - 2) {
        b = { ...b, x: pr.b.x, y: pr.b.y };
        warped = i;
        add('warp');
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
            warped: undefined,
          },
          events,
        };
      }
      // a fast ball over the hole bends a little
      b = { ...b, vx: b.vx * 0.86 + (h.cup.x - b.x) * 2, vy: b.vy * 0.86 + (h.cup.y - b.y) * 2 };
      add('lip');
    } else if (toCup < CUP_R + 8 && v < 120) {
      // a slow ball near the cup is drawn in a little (the edge slopes)
      b.vx += (h.cup.x - b.x) * 6 * h2;
      b.vy += (h.cup.y - b.y) * 6 * h2;
    }
    if ((h.water ?? []).some((r) => inRect(b, r)))
      return penalty({ ...next, warped }, 'water', events, b);
  }
  if (!inside(h, b)) {
    // squeezed through a wall somehow: back where you were, no penalty
    events.push({ type: 'out' });
    return {
      state: { ...next, ball: { ...next.lastRest, vx: 0, vy: 0 }, moving: false, warped: undefined },
      events: maxed(next.hole, next.strokes, events),
    };
  }
  if (hitWall) add('wall');
  if (pushed) add('boost');
  const rolling = s.rolling + d;
  const v = Math.hypot(b.vx, b.vy);
  // on a hill or near a black hole the ball only rests against something
  const stopped = (v < 6 && (!leaning || hitWall || v < 1)) || rolling > 14;
  next = {
    ...next,
    rolling,
    warped: stopped ? undefined : warped,
    ball: stopped ? { ...b, vx: 0, vy: 0 } : b,
    moving: !stopped,
  };
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
  const holes = courseOf(s).holes;
  if (s.hole + 1 >= holes.length)
    return { state: { ...s, strokes, over: true, moving: false }, events: [{ type: 'end' }] };
  const hole = s.hole + 1;
  const tee = holes[hole].tee;
  return {
    state: {
      ...s,
      hole,
      strokes: [...strokes, 0],
      ball: { ...tee, vx: 0, vy: 0 },
      lastRest: { ...tee },
      moving: false,
      sunk: false,
      rolling: 0,
      warped: undefined,
    },
    events: [],
  };
}

export const holePoints = (strokes: number, par: number) => Math.max(0, par + 4 - strokes) * 10;
export const golfScore = (s: Pick<GolfState, 'strokes'> & { course?: number }) => {
  const holes = COURSES[s.course ?? 0]?.holes ?? HOLES;
  return s.strokes.reduce(
    (n, k, i) => n + (k > 0 && holes[i] ? holePoints(Math.min(MAX_STROKES, k), holes[i].par) : 0),
    0,
  );
};
export const totalStrokes = (s: Pick<GolfState, 'strokes'>) =>
  s.strokes.reduce((n, k) => n + Math.min(MAX_STROKES, k), 0);
/** Points for playing every hole in par (the same on every course). */
export const PAR_POINTS = HOLES_PER_COURSE * 40;

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
export function cocoGolf(rng: () => number = Math.random, course = 0): number {
  return (COURSES[course]?.holes ?? HOLES).reduce((n, h) => {
    const r = rng();
    const strokes =
      r < 0.08 ? 1 : r < 0.3 ? h.par - 1 || 1 : r < 0.65 ? h.par : r < 0.9 ? h.par + 1 : h.par + 2;
    return n + holePoints(strokes, h.par);
  }, 0);
}

export const isInRect = inRect;
