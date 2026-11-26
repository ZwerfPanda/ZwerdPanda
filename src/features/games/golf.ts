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
  /** Jumps: roll up one fast enough (in the arrow's direction) and you fly. */
  ramps?: Push[];
  /** Gates that stay shut until you roll over the button with the same id. */
  gates?: (Rect & { id: number })[];
  buttons?: { x: number; y: number; id: number }[];
  /** A cup that slides to and fro: (dx, dy) either way from `cup`. */
  cupMove?: { dx: number; dy: number; speed: number };
  mills?: Mill[];
  sliders?: Slider[];
}

export type ThemeId =
  | 'park'
  | 'beach'
  | 'candy'
  | 'ice'
  | 'space'
  | 'garden'
  | 'city'
  | 'fair'
  | 'volcano'
  | 'castle';

export interface Course {
  id: string;
  name: string;
  emoji: string;
  theme: ThemeId;
  blurb: string;
  /** The whole course is a bit slippery (ice) or not. */
  glide?: number;
  /** A bonus world: open once you've got this many stars elsewhere. */
  unlock?: number;
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

/* ----------------------------------------------- 6. Coco's garden (bonus) */

const GARDEN: Hole[] = [
  {
    name: 'Het schansje',
    emoji: '🛝',
    par: 2,
    tee: { x: 150, y: 430 },
    cup: { x: 150, y: 90 },
    walls: [box(50, 25, 200, 445)],
    water: [{ x: 50, y: 195, w: 200, h: 90 }],
    ramps: [{ x: 115, y: 300, w: 70, h: 44, ax: 0, ay: -1 }],
  },
  {
    name: 'De tuinpoort',
    emoji: '🚪',
    par: 3,
    tee: { x: 210, y: 430 },
    cup: { x: 150, y: 90 },
    walls: [box(30, 25, 240, 445), box(30, 200, 95, 16), box(175, 200, 95, 16)],
    gates: [{ x: 125, y: 200, w: 50, h: 16, id: 0 }],
    buttons: [{ x: 65, y: 330, id: 0 }],
    sand: [{ x: 200, y: 40, w: 60, h: 50 }],
  },
  {
    name: 'Wortelveld',
    emoji: '🥕',
    par: 3,
    tee: { x: 150, y: 435 },
    cup: { x: 150, y: 110 },
    walls: [box(30, 25, 240, 445), box(30, 228, 240, 22)],
    ramps: [{ x: 110, y: 268, w: 80, h: 44, ax: 0, ay: -1 }],
    bumpers: [
      { x: 90, y: 150, r: 13 },
      { x: 210, y: 150, r: 13 },
    ],
    sand: [{ x: 40, y: 40, w: 70, h: 50 }],
  },
  {
    name: 'Konijnenholen',
    emoji: '🐇',
    par: 3,
    tee: { x: 70, y: 435 },
    cup: { x: 220, y: 85 },
    walls: [box(25, 25, 250, 445), box(140, 25, 20, 445), box(160, 200, 40, 16)],
    portals: [{ a: { x: 70, y: 110 }, b: { x: 220, y: 420 } }],
    gates: [{ x: 200, y: 200, w: 75, h: 16, id: 0 }],
    buttons: [{ x: 70, y: 280, id: 0 }],
  },
  {
    name: 'De tuinslang',
    emoji: '💦',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 70 },
    walls: [box(30, 25, 240, 445)],
    water: [{ x: 30, y: 215, w: 240, h: 45 }],
    ramps: [
      { x: 45, y: 280, w: 60, h: 44, ax: 0, ay: -1 },
      { x: 195, y: 280, w: 60, h: 44, ax: 0, ay: -1 },
    ],
    bumpers: [{ x: 150, y: 305, r: 18 }],
    mills: [{ x: 150, y: 150, len: 42, speed: 1.4 }],
  },
  {
    name: 'De moestuin',
    emoji: '🏆',
    par: 4,
    tee: { x: 60, y: 440 },
    cup: { x: 60, y: 62 },
    walls: [box(25, 25, 250, 445), box(25, 330, 180, 18), box(25, 110, 170, 16)],
    water: [{ x: 25, y: 200, w: 250, h: 50 }],
    ramps: [{ x: 210, y: 262, w: 60, h: 46, ax: 0, ay: -1 }],
    gates: [{ x: 195, y: 110, w: 80, h: 16, id: 0 }],
    buttons: [{ x: 70, y: 165, id: 0 }],
    sliders: [{ y: 380, w: 50, h: 20, from: 30, to: 270, speed: 1 }],
  },
];

/* --------------------------------------------------------- 7. Amsterdam */

const CITY: Hole[] = [
  {
    name: 'Grachtengordel',
    emoji: '🛶',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 80 },
    walls: [box(30, 25, 240, 445)],
    water: [
      { x: 30, y: 300, w: 170, h: 40 },
      { x: 100, y: 170, w: 170, h: 40 },
    ],
    bumpers: [{ x: 235, y: 255, r: 10 }],
  },
  {
    name: 'Fietsbrug',
    emoji: '🚲',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 75 },
    walls: [box(30, 25, 240, 445)],
    water: [
      { x: 30, y: 200, w: 100, h: 60 },
      { x: 170, y: 200, w: 100, h: 60 },
    ],
    sliders: [{ y: 140, w: 46, h: 22, from: 35, to: 265, speed: 1.5 }],
  },
  {
    name: 'Vondelpark',
    emoji: '🌳',
    par: 3,
    tee: { x: 60, y: 440 },
    cup: { x: 240, y: 70 },
    walls: [box(25, 25, 250, 445)],
    bumpers: [
      { x: 100, y: 350, r: 14 },
      { x: 190, y: 320, r: 14 },
      { x: 140, y: 250, r: 14 },
      { x: 70, y: 200, r: 14 },
      { x: 150, y: 130, r: 14 },
    ],
    sand: [{ x: 170, y: 380, w: 70, h: 40 }],
    water: [{ x: 205, y: 220, w: 70, h: 50 }],
  },
  {
    name: 'De kaaswinkel',
    emoji: '🧀',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 95 },
    cupMove: { dx: 70, dy: 0, speed: 1 },
    walls: [box(40, 25, 220, 445), box(40, 250, 70, 20), box(190, 250, 70, 20)],
    sand: [
      { x: 45, y: 30, w: 50, h: 36 },
      { x: 205, y: 30, w: 50, h: 36 },
    ],
  },
  {
    name: 'Tram 2',
    emoji: '🚋',
    par: 4,
    tee: { x: 60, y: 440 },
    cup: { x: 60, y: 80 },
    walls: [box(25, 25, 250, 445), box(25, 330, 180, 18), box(95, 170, 180, 18)],
    sliders: [
      { y: 240, w: 110, h: 24, from: 30, to: 270, speed: 1.2 },
      { y: 395, w: 50, h: 20, from: 30, to: 270, speed: 1.6 },
    ],
  },
  {
    name: 'De Dam',
    emoji: '🏛️',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 60 },
    walls: [box(25, 25, 250, 445), box(25, 230, 250, 20)],
    portals: [
      { a: { x: 150, y: 330 }, b: { x: 150, y: 190 } },
      { a: { x: 60, y: 300 }, b: { x: 240, y: 420 } },
    ],
    mills: [{ x: 150, y: 125, len: 38, speed: 1.6 }],
  },
];

/* ------------------------------------------------------------ 8. the fair */

const FAIR: Hole[] = [
  {
    name: 'Flipperkast',
    emoji: '🕹️',
    par: 2,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 70 },
    walls: [box(40, 25, 220, 445)],
    bumpers: [
      { x: 150, y: 140, r: 14 },
      { x: 110, y: 190, r: 12 },
      { x: 190, y: 190, r: 12 },
      { x: 150, y: 240, r: 14 },
      { x: 90, y: 260, r: 10 },
      { x: 210, y: 260, r: 10 },
    ],
    boosts: [
      { x: 45, y: 330, w: 40, h: 60, ax: 300, ay: -300 },
      { x: 215, y: 330, w: 40, h: 60, ax: -300, ay: -300 },
    ],
  },
  {
    name: 'Botsauto’s',
    emoji: '🚗',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 70 },
    walls: [box(30, 25, 240, 445)],
    sliders: [
      { y: 330, w: 40, h: 30, from: 35, to: 265, speed: 1.6 },
      { y: 230, w: 40, h: 30, from: 35, to: 265, speed: -1.3 },
      { y: 200, w: 30, h: 40, from: 110, to: 300, speed: 1.1, vertical: true },
    ],
  },
  {
    name: 'Reuzenrad',
    emoji: '🎡',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 70 },
    walls: [box(30, 25, 240, 445)],
    mills: [{ x: 150, y: 240, len: 80, speed: 0.7, blades: 6 }],
    sand: [{ x: 35, y: 360, w: 50, h: 50 }],
  },
  {
    name: 'Spiegelpaleis',
    emoji: '🪞',
    par: 3,
    tee: { x: 60, y: 440 },
    cup: { x: 150, y: 60 },
    walls: [box(25, 25, 250, 445), box(25, 320, 170, 16), box(105, 170, 170, 16)],
    portals: [
      { a: { x: 240, y: 400 }, b: { x: 60, y: 260 } },
      { a: { x: 240, y: 250 }, b: { x: 240, y: 430 } },
      { a: { x: 60, y: 210 }, b: { x: 240, y: 100 } },
    ],
  },
  {
    name: 'De glijbaan',
    emoji: '🛝',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 80 },
    walls: [box(40, 25, 220, 445)],
    slopes: [{ x: 40, y: 270, w: 220, h: 110, ax: 0, ay: 150 }],
    water: [{ x: 40, y: 175, w: 220, h: 45 }],
    ramps: [{ x: 120, y: 228, w: 60, h: 40, ax: 0, ay: -1 }],
  },
  {
    name: 'Kop van Jut',
    emoji: '🔔',
    par: 4,
    tee: { x: 80, y: 440 },
    cup: { x: 210, y: 415 },
    cupMove: { dx: 35, dy: 0, speed: 1.3 },
    walls: [box(25, 25, 250, 445), box(140, 140, 20, 330)],
    boosts: [{ x: 40, y: 220, w: 80, h: 110, ax: 0, ay: -500 }],
    gates: [{ x: 160, y: 250, w: 115, h: 14, id: 0 }],
    buttons: [{ x: 80, y: 170, id: 0 }],
  },
];

/* ---------------------------------------------------- 9. volcano (bonus) */

const VOLCANO: Hole[] = [
  {
    name: 'Lavastroom',
    emoji: '🌊',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 80 },
    walls: [box(30, 25, 240, 445)],
    water: [
      { x: 30, y: 300, w: 240, h: 30 },
      { x: 30, y: 170, w: 240, h: 30 },
    ],
    ramps: [
      { x: 120, y: 340, w: 60, h: 40, ax: 0, ay: -1 },
      { x: 120, y: 208, w: 60, h: 40, ax: 0, ay: -1 },
    ],
  },
  {
    name: 'Magmabellen',
    emoji: '🫧',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 70 },
    walls: [box(30, 25, 240, 445)],
    water: [
      { x: 60, y: 150, w: 50, h: 50 },
      { x: 190, y: 150, w: 50, h: 50 },
      { x: 125, y: 260, w: 50, h: 50 },
      { x: 50, y: 330, w: 50, h: 40 },
      { x: 200, y: 330, w: 50, h: 40 },
    ],
    bumpers: [{ x: 150, y: 180, r: 12 }],
  },
  {
    name: 'De krater',
    emoji: '🌋',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 200 },
    walls: [poly(90, 25, 210, 25, 270, 90, 270, 400, 210, 465, 90, 465, 30, 400, 30, 90)],
    water: [
      { x: 90, y: 130, w: 120, h: 22 },
      { x: 90, y: 250, w: 120, h: 22 },
      { x: 90, y: 152, w: 22, h: 98 },
    ],
    mills: [{ x: 232, y: 200, len: 32, speed: 1.4 }],
  },
  {
    name: 'Dinopad',
    emoji: '🦖',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 65 },
    walls: [box(40, 25, 220, 445)],
    sliders: [
      { y: 320, w: 50, h: 26, from: 45, to: 255, speed: 1.1 },
      { y: 200, w: 50, h: 26, from: 45, to: 255, speed: -1.4 },
      { y: 120, w: 50, h: 26, from: 45, to: 255, speed: 1.8 },
    ],
    water: [
      { x: 40, y: 250, w: 50, h: 40 },
      { x: 210, y: 250, w: 50, h: 40 },
    ],
  },
  {
    name: 'Uitbarsting',
    emoji: '💥',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 230, y: 80 },
    walls: [box(30, 25, 240, 445)],
    boosts: [
      { x: 35, y: 280, w: 60, h: 60, ax: 350, ay: -200 },
      { x: 205, y: 200, w: 60, h: 60, ax: -350, ay: -200 },
      { x: 35, y: 110, w: 60, h: 60, ax: 350, ay: 0 },
    ],
    water: [{ x: 110, y: 180, w: 80, h: 110 }],
  },
  {
    name: 'Hart van de vulkaan',
    emoji: '❤️‍🔥',
    par: 3,
    tee: { x: 150, y: 445 },
    cup: { x: 150, y: 70 },
    walls: [box(25, 25, 250, 445)],
    wells: [{ x: 150, y: 270, r: 85, pull: 800 }],
    water: [
      { x: 25, y: 150, w: 90, h: 30 },
      { x: 185, y: 150, w: 90, h: 30 },
    ],
    ramps: [{ x: 205, y: 340, w: 60, h: 40, ax: 0, ay: -1 }],
  },
];

/* ----------------------------------------------------- 10. castle (bonus) */

const CASTLE: Hole[] = [
  {
    name: 'De slotgracht',
    emoji: '🏰',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 125 },
    walls: [
      box(25, 25, 250, 445),
      box(70, 60, 14, 150),
      box(216, 60, 14, 150),
      box(84, 60, 132, 14),
      box(84, 196, 41, 14),
      box(175, 196, 41, 14),
    ],
    water: [{ x: 40, y: 228, w: 220, h: 35 }],
    ramps: [{ x: 120, y: 278, w: 60, h: 42, ax: 0, ay: -1 }],
  },
  {
    name: 'Het valhek',
    emoji: '⛓️',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 80 },
    walls: [box(30, 25, 240, 445), box(30, 220, 95, 20), box(175, 220, 95, 20)],
    gates: [{ x: 125, y: 220, w: 50, h: 20, id: 0 }],
    buttons: [{ x: 60, y: 300, id: 0 }],
    bumpers: [
      { x: 95, y: 330, r: 11 },
      { x: 60, y: 365, r: 11 },
    ],
    sliders: [{ y: 268, w: 44, h: 24, from: 35, to: 265, speed: 1.2 }],
  },
  {
    name: 'De ridderzaal',
    emoji: '⚔️',
    par: 3,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 60 },
    walls: [box(40, 25, 220, 445)],
    mills: [
      { x: 105, y: 300, len: 45, speed: 2, blades: 2 },
      { x: 195, y: 300, len: 45, speed: -2, blades: 2 },
      { x: 150, y: 165, len: 55, speed: 1.3, blades: 3 },
    ],
  },
  {
    name: 'De draak',
    emoji: '🐉',
    par: 4,
    tee: { x: 60, y: 440 },
    cup: { x: 240, y: 70 },
    walls: [box(25, 25, 250, 445), box(25, 300, 190, 18), box(85, 150, 190, 18)],
    boosts: [{ x: 120, y: 190, w: 60, h: 100, ax: -400, ay: 0 }],
    sliders: [{ y: 390, w: 40, h: 40, from: 30, to: 270, speed: 1.5 }],
  },
  {
    name: 'De geheime gang',
    emoji: '🕯️',
    par: 4,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 60 },
    walls: [box(25, 25, 250, 445), box(25, 240, 250, 18), box(25, 120, 170, 16)],
    portals: [{ a: { x: 240, y: 300 }, b: { x: 60, y: 205 } }],
    gates: [{ x: 195, y: 120, w: 80, h: 16, id: 0 }],
    buttons: [{ x: 60, y: 160, id: 0 }],
    bumpers: [{ x: 150, y: 330, r: 14 }],
  },
  {
    name: 'De troonzaal',
    emoji: '👑',
    par: 4,
    tee: { x: 150, y: 440 },
    cup: { x: 150, y: 70 },
    cupMove: { dx: 80, dy: 0, speed: 0.8 },
    walls: [box(25, 25, 250, 445)],
    gates: [{ x: 25, y: 130, w: 250, h: 14, id: 0 }],
    buttons: [{ x: 50, y: 300, id: 0 }],
    water: [{ x: 100, y: 290, w: 100, h: 40 }],
    bumpers: [
      { x: 80, y: 200, r: 12 },
      { x: 220, y: 200, r: 12 },
      { x: 150, y: 230, r: 14 },
    ],
  },
];

export const COURSES: Course[] = [
  { id: 'park', name: 'Het park', emoji: '🌳', theme: 'park', blurb: 'Windmolen & vijver', holes: PARK },
  { id: 'beach', name: 'Het strand', emoji: '🏖️', theme: 'beach', blurb: 'Zee, zand en een vuurtoren', holes: BEACH },
  { id: 'candy', name: 'Snoepland', emoji: '🍭', theme: 'candy', blurb: 'Gombal-bumpers & portalen', holes: CANDY },
  { id: 'ice', name: 'IJspaleis', emoji: '❄️', theme: 'ice', blurb: 'Glad! De bal glijdt ver door', glide: 0.35, holes: ICE },
  { id: 'space', name: 'De ruimte', emoji: '🪐', theme: 'space', blurb: 'Zwarte gaten en wormgaten', holes: SPACE },
  {
    id: 'garden',
    name: 'Coco’s tuin',
    emoji: '🐰',
    theme: 'garden',
    blurb: 'Schansen en geheime poortjes',
    unlock: 30,
    holes: GARDEN,
  },
  { id: 'city', name: 'Amsterdam', emoji: '🚲', theme: 'city', blurb: 'Grachten, fietsen en een schuivende cup', holes: CITY },
  { id: 'fair', name: 'De kermis', emoji: '🎡', theme: 'fair', blurb: 'Flipperkast, botsauto’s en een spiegelpaleis', holes: FAIR },
  {
    id: 'volcano',
    name: 'De vulkaan',
    emoji: '🌋',
    theme: 'volcano',
    blurb: 'Over de lava springen',
    unlock: 55,
    holes: VOLCANO,
  },
  {
    id: 'castle',
    name: 'Het kasteel',
    emoji: '🏰',
    theme: 'castle',
    blurb: 'Slotgracht, valhek en een draak',
    unlock: 80,
    holes: CASTLE,
  },
];

/** Where the cup is right now (some slide). */
export function cupAt(h: Hole, t: number): P {
  if (!h.cupMove) return h.cup;
  const k = Math.sin(t * h.cupMove.speed);
  return { x: h.cup.x + h.cupMove.dx * k, y: h.cup.y + h.cupMove.dy * k };
}

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
  /** In the air after a jump: how long so far, and how long in all. */
  air?: { t: number; dur: number };
  /** Gates opened on this hole. */
  open?: number[];
}

export type GolfEvent =
  | { type: 'wall' }
  | { type: 'bump' }
  | { type: 'boost' }
  | { type: 'warp' }
  | { type: 'water'; at: P }
  | { type: 'void'; at: P }
  | { type: 'out' }
  | { type: 'jump' }
  | { type: 'land' }
  | { type: 'click' }
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
const outerEdges = new WeakMap<Hole, [P, P][]>();
/** All the solid edges of a hole at time t (gates count until they're open). */
export function edgesAt(h: Hole, t: number, open: number[] = []): [P, P][] {
  let fixed = staticEdges.get(h);
  if (!fixed) {
    fixed = h.walls.flatMap(segs);
    staticEdges.set(h, fixed);
  }
  const out = [...fixed, ...bladesAt(h, t)];
  for (const s of slidersAt(h, t)) out.push(...segs(box(s.x, s.y, s.w, s.h)));
  for (const g of h.gates ?? []) if (!open.includes(g.id)) out.push(...segs(box(g.x, g.y, g.w, g.h)));
  return out;
}

/** Only the course's edge: what a ball in the air can still hit. */
function edgeOnly(h: Hole): [P, P][] {
  let e = outerEdges.get(h);
  if (!e) {
    e = segs(h.walls[0]);
    outerEdges.set(h, e);
  }
  return e;
}

/** How high a jumping ball is (0..1). */
export const airHeight = (s: Pick<GolfState, 'air'>) =>
  s.air ? Math.sin(Math.PI * Math.min(1, s.air.t / s.air.dur)) : 0;

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
      air: undefined,
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
  let air = s.air ? { ...s.air } : undefined;
  let open = s.open ?? [];
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
    if (air) {
      // flying: over water, sand and hedges; only the edge stops you
      air.t += h2;
      const keep = Math.exp(-0.25 * h2);
      b = { x: b.x + b.vx * h2, y: b.y + b.vy * h2, vx: b.vx * keep, vy: b.vy * keep };
      for (const e of edgeOnly(h)) {
        const out = bounce(b, e);
        if (out) b = out;
      }
      if (air.t >= air.dur) {
        air = undefined;
        events.push({ type: 'land' });
      }
      continue;
    }
    for (const r of h.ramps ?? []) {
      if (!inRect(b, r)) continue;
      const along = (b.vx * r.ax + b.vy * r.ay) / (Math.hypot(r.ax, r.ay) || 1);
      if (along > 140) {
        const sp = Math.hypot(b.vx, b.vy);
        air = { t: 0, dur: Math.max(0.3, Math.min(0.85, sp / 650)) };
        events.push({ type: 'jump' });
        break;
      }
    }
    if (air) continue;
    for (const bt of h.buttons ?? [])
      if (!open.includes(bt.id) && Math.hypot(b.x - bt.x, b.y - bt.y) < 11) {
        open = [...open, bt.id];
        events.push({ type: 'click' });
      }
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
      if (dist < 9) return penalty({ ...next, warped, open }, 'void', events, { x: w.x, y: w.y });
    }
    const speed = Math.hypot(b.vx, b.vy);
    // rolling friction: a little drag, a little steady slowing
    const roll = sandy ? 900 : icy ? 22 : 95 * glide;
    const drag = sandy ? 3.2 : icy ? 0.12 : 0.55 * glide;
    const slow = Math.max(0, Math.min(TOP_SPEED, speed) - roll * h2) * Math.exp(-drag * h2);
    const f = speed > 0 ? slow / speed : 0;
    b = { x: b.x + b.vx * f * h2, y: b.y + b.vy * f * h2, vx: b.vx * f, vy: b.vy * f };
    for (const e of edgesAt(h, t, open)) {
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
    const cup = cupAt(h, t);
    const toCup = Math.hypot(b.x - cup.x, b.y - cup.y);
    const v = Math.hypot(b.vx, b.vy);
    if (toCup < CUP_R - 2) {
      if (v < 330) {
        const strokes = next.strokes[next.hole];
        events.push({ type: 'sunk', strokes, par: h.par });
        return {
          state: {
            ...next,
            ball: { x: cup.x, y: cup.y, vx: 0, vy: 0 },
            moving: false,
            sunk: true,
            warped: undefined,
            open,
          },
          events,
        };
      }
      // a fast ball over the hole bends a little
      b = { ...b, vx: b.vx * 0.86 + (cup.x - b.x) * 2, vy: b.vy * 0.86 + (cup.y - b.y) * 2 };
      add('lip');
    } else if (toCup < CUP_R + 8 && v < 120) {
      // a slow ball near the cup is drawn in a little (the edge slopes)
      b.vx += (cup.x - b.x) * 6 * h2;
      b.vy += (cup.y - b.y) * 6 * h2;
    }
    if ((h.water ?? []).some((r) => inRect(b, r)))
      return penalty({ ...next, warped, open }, 'water', events, b);
  }
  if (!air && !inside(h, b)) {
    // squeezed through a wall somehow: back where you were, no penalty
    events.push({ type: 'out' });
    return {
      state: {
        ...next,
        open,
        ball: { ...next.lastRest, vx: 0, vy: 0 },
        moving: false,
        warped: undefined,
      },
      events: maxed(next.hole, next.strokes, events),
    };
  }
  if (hitWall) add('wall');
  if (pushed) add('boost');
  const rolling = s.rolling + d;
  const v = Math.hypot(b.vx, b.vy);
  // on a hill or near a black hole the ball only rests against something
  const stopped = !air && ((v < 6 && (!leaning || hitWall || v < 1)) || rolling > 14);
  next = {
    ...next,
    rolling,
    air,
    open,
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
      air: undefined,
      open: [],
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

/* ------------------------------------------------------ stars & progress */

/** Stars for a hole: under par 3, par 2, one over 1. */
export function holeStars(strokes: number, par: number): number {
  if (!strokes) return 0;
  if (strokes === 1 || strokes < par) return 3;
  if (strokes === par) return 2;
  if (strokes === par + 1) return 1;
  return 0;
}

/** Best strokes per hole, per course id. */
export type GolfProgress = Record<string, number[]>;

export const courseStars = (p: GolfProgress, c: Course) =>
  c.holes.reduce((n, h, i) => n + holeStars(p[c.id]?.[i] ?? 0, h.par), 0);

/** Stars from the always-open worlds (what unlocks the bonus ones). */
export const totalStars = (p: GolfProgress) =>
  COURSES.filter((c) => !c.unlock).reduce((n, c) => n + courseStars(p, c), 0);

export const isOpen = (p: GolfProgress, c: Course) => !c.unlock || totalStars(p) >= c.unlock;

/** Remember a finished hole if it beat the best so far. */
export function recordHole(p: GolfProgress, course: Course, hole: number, strokes: number): GolfProgress {
  if (!strokes) return p;
  const row = [...(p[course.id] ?? [])];
  const k = Math.min(MAX_STROKES, strokes);
  if (row[hole] && row[hole] <= k) return p;
  while (row.length < hole) row.push(0);
  row[hole] = k;
  return { ...p, [course.id]: row };
}

export function normalizeProgress(raw: unknown): GolfProgress {
  const out: GolfProgress = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const c of COURSES) {
    const v = (raw as Record<string, unknown>)[c.id];
    if (Array.isArray(v))
      out[c.id] = v
        .slice(0, c.holes.length)
        .map((n) => (Number.isInteger(n) && n > 0 && n <= MAX_STROKES ? n : 0));
  }
  return out;
}

/** Balls you can play with, unlocked by stars. */
export const BALLS = [
  { id: 'white', name: 'Klassiek', stars: 0, fill: '#ffffff', ring: '#c9c9c9' },
  { id: 'sun', name: 'Zonnetje', stars: 8, fill: '#ffd75e', ring: '#e0a400' },
  { id: 'rose', name: 'Roosje', stars: 16, fill: '#ff8cc0', ring: '#d14a8a' },
  { id: 'mint', name: 'Mintje', stars: 24, fill: '#7fe3c7', ring: '#2fae8a' },
  { id: 'coco', name: 'Coco', stars: 34, fill: '#f1e7dc', ring: '#a58c74', emoji: '🐰' },
  { id: 'rainbow', name: 'Regenboog', stars: 46, fill: 'rainbow', ring: '#7a4fd6' },
  { id: 'heart', name: 'Hartje', stars: 58, fill: '#ff4f6d', ring: '#b8233e', emoji: '♥' },
  { id: 'gold', name: 'Goud', stars: 75, fill: '#ffcf33', ring: '#b8860b', shine: true },
] as const;
export type BallSkin = (typeof BALLS)[number];

/**
 * Where a putt would go, for the aiming guide: the path up to just after the
 * first bounce (or `max` units), nothing further — the rest is up to you.
 */
export function preview(s: GolfState, dx: number, dy: number, max = 230): P[] {
  let st = putt({ ...s, moving: false }, dx, dy);
  if (!st.moving) return [];
  const pts: P[] = [{ x: st.ball.x, y: st.ball.y }];
  let len = 0;
  let after: number | null = null;
  for (let i = 0; i < 240; i++) {
    const out = step(st, 1 / 60);
    const prev = st.ball;
    st = out.state;
    len += Math.hypot(st.ball.x - prev.x, st.ball.y - prev.y);
    pts.push({ x: st.ball.x, y: st.ball.y });
    if (out.events.some((e) => ['water', 'void', 'out', 'warp', 'jump'].includes(e.type))) break;
    if (after === null && out.events.some((e) => e.type === 'wall' || e.type === 'bump')) after = len;
    if (after !== null && len - after > 35) break;
    if (len > max || !st.moving || st.sunk) break;
  }
  return pts;
}
