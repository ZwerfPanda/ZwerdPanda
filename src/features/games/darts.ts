/** The numbers clockwise from the top, as on every pub board. */
export const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/**
 * A real dartboard, measured from the centre with the board's radius as 1.
 * The treble and double rings are a touch wider than in a pub, so a phone
 * thumb has a fair chance.
 */
export const RINGS = {
  bull: 0.05,
  outerBull: 0.11,
  trebleIn: 0.55,
  trebleOut: 0.63,
  doubleIn: 0.91,
  doubleOut: 1,
} as const;

export interface Hit {
  score: number;
  label: string;
}

/** What a dart at (x, y) scores; y grows downward, like on screen. */
export function scoreAt(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  if (r <= RINGS.bull) return { score: 50, label: 'BULLSEYE' };
  if (r <= RINGS.outerBull) return { score: 25, label: '25' };
  if (r > RINGS.doubleOut) return { score: 0, label: 'mis' };
  // Clockwise from straight up, in degrees.
  const angle = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  const segment = SEGMENTS[Math.floor((angle + 9) / 18) % 20];
  if (r >= RINGS.trebleIn && r <= RINGS.trebleOut)
    return { score: segment * 3, label: `T${segment}` };
  if (r >= RINGS.doubleIn) return { score: segment * 2, label: `D${segment}` };
  return { score: segment, label: String(segment) };
}

export const TURNS = 5;
export const DARTS_PER_TURN = 3;

/** Normally distributed noise (Box–Muller). */
function gauss(random: () => number) {
  const u = Math.max(1e-9, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Coco aims for the treble 20 with a wobbly paw. */
export function cocoDarts(random = Math.random): Hit[] {
  return Array.from({ length: TURNS * DARTS_PER_TURN }, () => {
    const x = gauss(random) * 0.2;
    const y = -0.59 + gauss(random) * 0.24;
    return scoreAt(x, y);
  });
}

/* ------------------------------------------------------------ the throw */

/**
 * A real throw: you hold the dart on the board (your hand sways, more the
 * longer you hold), then flick up. The flick's speed decides the height —
 * too soft and the dart drops, too hard and it flies high — and a slanted
 * flick pulls it sideways. So pointing at the bullseye isn't enough.
 */
export interface Flick {
  /** Upward speed, in board widths per second. */
  speed: number;
  /** Sideways per upward (0 is straight). */
  slant: number;
}

/** The sweet spot for a flick's speed (board widths per second). */
export const IDEAL_FLICK = 4.2;
const SPEED_TOLERANCE = 0.45;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How far the hand sways at `t` seconds after picking up the dart. */
export function swayAt(t: number, calm = false): { x: number; y: number } {
  // Steady for a breath, then the arm gets tired.
  const tired = t < 1.4 ? 0 : Math.min(0.1, (t - 1.4) * 0.05);
  const a = (calm ? 0.05 : 0.075) + tired;
  return {
    x: a * Math.sin(t * 2.3) + a * 0.55 * Math.sin(t * 5.9 + 1),
    y: a * Math.cos(t * 1.9) + a * 0.55 * Math.sin(t * 4.7 + 2),
  };
}

export type Power = 'soft' | 'good' | 'hard';

/** Where a dart lands: the aim, the sway when it left the hand, and the flick. */
export function dartLanding(
  aim: { x: number; y: number },
  sway: { x: number; y: number },
  flick: Flick,
  random = Math.random,
): { x: number; y: number; power: Power } {
  const off = (IDEAL_FLICK - flick.speed) / IDEAL_FLICK; // >0: too soft
  // Within the sweet spot only a little drift; outside it grows fast.
  const beyond = Math.sign(off) * Math.max(0, Math.abs(off) - 0.06);
  const dy = clamp(beyond * 1.15, -0.7, 0.9);
  const dx = clamp(flick.slant * 0.55, -0.6, 0.6);
  const jitter = 0.02 + Math.abs(off) * 0.04;
  return {
    x: aim.x + sway.x + dx + gauss(random) * jitter,
    y: aim.y + sway.y + dy + gauss(random) * jitter,
    power: off > SPEED_TOLERANCE / 3 ? 'soft' : off < -SPEED_TOLERANCE / 3 ? 'hard' : 'good',
  };
}
