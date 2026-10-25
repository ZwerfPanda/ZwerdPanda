/*
 * Skeeball, the rules: the ball rolls up the lane, jumps the hump and lands
 * on the target board. Where it lands is set by how hard it was thrown
 * (power 0–1+) and where it was aimed (u, -1 left … 1 right). It drops into
 * the hole of the ring it lands in.
 *
 * The board is a plane: u across it (world units, board is 2 wide), q up it
 * (0 at the bottom, BOARD_Q at the top).
 */

export const BALLS = 9;
export const BOARD_Q = 3.16;
/** Below this the ball doesn't make it over the hump and rolls back. */
export const MIN_POWER = 0.1;
/** The power that reaches the top of the board. */
const TOP_POWER = 0.85;

export const RING_CENTER = { u: 0, q: 1.85 };
/** Rings around the centre, inner to outer. Outside them (on the board) is 10. */
export const RINGS = [
  { v: 50, r: 0.22 },
  { v: 40, r: 0.42 },
  { v: 30, r: 0.62 },
  { v: 20, r: 0.82 },
];
export const CORNERS = [
  { v: 100, u: -0.78, q: 2.85, r: 0.17 },
  { v: 100, u: 0.78, q: 2.85, r: 0.17 },
];

export interface Landing {
  /** Where it touches down on the board. */
  u: number;
  q: number;
  value: number;
  /** The hole it drops into. */
  hole: { u: number; q: number };
}

/** The score where a ball lands (u, q) on the board. */
export function ringAt(u: number, q: number): { value: number; hole: { u: number; q: number } } {
  for (const c of CORNERS)
    if (Math.hypot(u - c.u, q - c.q) <= c.r) return { value: c.v, hole: { u: c.u, q: c.q } };
  const d = Math.hypot(u - RING_CENTER.u, q - RING_CENTER.q);
  let inner = 0;
  for (const ring of RINGS) {
    if (d <= ring.r) {
      // each ring's hole sits at the bottom of its band
      const mid = ring.v === 50 ? 0 : (inner + ring.r) / 2;
      return { value: ring.v, hole: { u: 0, q: RING_CENTER.q - mid } };
    }
    inner = ring.r;
  }
  return { value: 10, hole: { u: 0, q: 0.42 } };
}

/**
 * Where a ball thrown with this power and aim ends up. A ball thrown too hard
 * bounces off the net at the top and comes down in the upper rings — never
 * nothing. `jitter` (−1…1) is the little bounce on landing.
 */
export function landing(power: number, aim: number, jitter = 0): Landing | null {
  if (power < MIN_POWER) return null;
  let q = ((power - MIN_POWER) / (TOP_POWER - MIN_POWER)) * BOARD_Q;
  if (q > BOARD_Q) q = Math.max(2.4, BOARD_Q - (q - BOARD_Q) * 0.8);
  q = Math.min(BOARD_Q - 0.02, Math.max(0.05, q + jitter * 0.05));
  const u = Math.max(-0.95, Math.min(0.95, aim + jitter * 0.04));
  return { u, q, ...ringAt(u, q) };
}

/**
 * How hard a flick was, from its speed in canvas heights per second. A gentle
 * flick (~1.5/s) lands low, an easy one (~3/s) near the 50, a firm one
 * (~5/s) at the top.
 */
export const powerOfFlick = (heightsPerSecond: number) =>
  Math.max(0, Math.min(1.3, 0.04 + heightsPerSecond / 6.4));

/**
 * How fast a flick went up, in canvas heights per second: the distance over
 * the time of its last stretch (at most 250 ms), from its first real movement.
 * Averaging like this keeps it steady however often the phone reports a touch.
 */
export function strokeSpeed(points: { y: number; t: number }[], height: number): number {
  if (points.length < 2) return 0;
  const end = points[points.length - 1];
  let i = points.findIndex((p) => points[0].y - p.y > 8);
  if (i < 0) return 0;
  while (i < points.length - 2 && end.t - points[i].t > 250) i++;
  const start = points[i];
  const dt = Math.max(30, end.t - start.t);
  return (((start.y - end.y) / dt) * 1000) / Math.max(1, height);
}

/** The hold-and-release meter: up and down, once every 1.5 s. */
export const meterAt = (ms: number) => {
  const t = (ms % 1500) / 1500;
  return t < 0.5 ? t * 2 : 2 - t * 2;
};

/** Coco's nine balls: she aims for the middle and mostly gets 20–40. */
export function cocoRolls(random = Math.random): number[] {
  return Array.from(
    { length: BALLS },
    () => landing(0.3 + random() * 0.55, (random() - 0.5) * 0.7, random() * 2 - 1)?.value ?? 0,
  );
}
