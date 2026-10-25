/**
 * The lane, the ball and the pins, in proportions taken from a real alley:
 * the lane is 72 units across (41.5 inch), a pin is 8.3 wide (4.77 inch) and
 * stands 26 tall, the ball is 14.6 across, the pins stand a foot apart. Seen
 * from above: x across (lane from 14 to 86), y down the lane (0 at the pins'
 * end, 200 at the bowler).
 *
 * A pin only falls when it's really hit; a little tap makes it wobble. A
 * falling pin sweeps a lot more than its base, so it takes neighbours with it,
 * and pins bounce off the side walls back into the deck — that's where strikes
 * come from.
 */

export const W = 100;
export const L = 200;
export const LANE_LEFT = 14;
export const LANE_RIGHT = 86;
export const BALL_R = 7.3;
export const PIN_R = 4.15;
export const PIN_H = 26;
export const START_Y = L - 16;
/** Where the pin deck starts (the head pin stands just behind it). */
export const DECK_Y = 76;
/** The side walls around the pin deck (beyond the gutters). */
export const WALL_LEFT = 4;
export const WALL_RIGHT = 96;
const HEAD_Y = 66;
const SPACING = 20.8;
const ROW = 18;

const BALL_MASS = 4.5;
const PIN_MASS = 1;
/** How hard a standing pin must be hit before it goes over (units per step). */
const KNOCK = 0.16;
/** A falling pin topples a standing one with much less. */
const TOPPLE = 0.05;
const HOOK = 0.003;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Pin extends Body {
  /** Where it stood. */
  hx: number;
  hy: number;
  /** Knocked over (counts as down). */
  down: boolean;
  /** Swept into the pit (not drawn any more). */
  gone: boolean;
  /** Which way it falls / lies, in radians on the lane (0: towards +x). */
  angle: number;
  /** 0 standing … 1 lying flat. */
  fall: number;
  /** Turning while it slides. */
  spin: number;
  /** A pin that was only tapped rocks for a moment. */
  wobble: number;
}

export function rack(): Pin[] {
  const pins: Pin[] = [];
  [1, 2, 3, 4].forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const x = W / 2 + (i - (n - 1) / 2) * SPACING;
      const y = HEAD_Y - r * ROW;
      pins.push({
        x,
        y,
        vx: 0,
        vy: 0,
        hx: x,
        hy: y,
        down: false,
        gone: false,
        angle: 0,
        fall: 0,
        spin: 0,
        wobble: 0,
      });
    }
  });
  return pins;
}

export interface World {
  ball: Body;
  pins: Pin[];
  gutter: boolean;
  /** The ball's hook (-1 … 1). */
  spin: number;
  /** Something hit since the last look (for sounds). */
  hits: number;
}

/** Pushes two round bodies apart and exchanges momentum. Returns the impulse. */
function bounce(a: Body, b: Body, ra: number, rb: number, ma: number, mb: number, e: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = ra + rb;
  if (dist === 0 || dist >= min) return 0;
  const nx = dx / dist;
  const ny = dy / dist;
  const overlap = min - dist;
  const total = ma + mb;
  a.x -= nx * overlap * (mb / total);
  a.y -= ny * overlap * (mb / total);
  b.x += nx * overlap * (ma / total);
  b.y += ny * overlap * (ma / total);
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel <= 0) return 0;
  const j = ((1 + e) * rel) / total;
  a.vx -= j * mb * nx;
  a.vy -= j * mb * ny;
  b.vx += j * ma * nx;
  b.vy += j * ma * ny;
  return rel;
}

/** A pin's reach: a falling pin sweeps far more than its base. */
const reach = (p: Pin) => PIN_R * (1 + p.fall * 0.6);

function knockOver(p: Pin, random: () => number) {
  if (p.down) return;
  p.down = true;
  p.angle = Math.atan2(p.vy, p.vx) + (random() - 0.5) * 0.5;
  p.spin = (random() - 0.5) * 0.08;
}

/** One small step of the world. */
export function step(w: World, random: () => number = Math.random) {
  const b = w.ball;
  // the hook: spin bends the path once the ball has gone a way down the lane
  // (per bit of lane, so a fast ball hooks less than a slow one)
  if (!w.gutter && b.y > DECK_Y - 10 && b.y < L - 40) b.vx += w.spin * HOOK * Math.abs(b.vy);
  b.x += b.vx;
  b.y += b.vy;
  b.vx *= 0.999;
  b.vy *= 0.999;
  // off the lane before the pins: into the gutter, and past them all
  if (!w.gutter && b.y > DECK_Y - 4 && (b.x < LANE_LEFT + 1 || b.x > LANE_RIGHT - 1)) {
    w.gutter = true;
    b.vx = 0;
    b.x = b.x < W / 2 ? LANE_LEFT - 4.5 : LANE_RIGHT + 4.5;
  }
  // in the pin deck a ball can still leave the lane; it then runs along the wall
  if (!w.gutter && (b.x < LANE_LEFT - BALL_R || b.x > LANE_RIGHT + BALL_R)) w.gutter = true;

  for (const p of w.pins) {
    if (p.gone) continue;
    if (p.down) {
      p.x += p.vx;
      p.y += p.vy;
      // sliding on the oily deck, slowly coming to rest
      p.vx *= 0.99;
      p.vy *= 0.99;
      p.angle += p.spin;
      p.spin *= 0.97;
      if (p.fall < 1) p.fall = Math.min(1, p.fall + 0.045);
      // the side walls send pins back in
      if (p.x < WALL_LEFT + PIN_R && p.vx < 0) {
        p.x = WALL_LEFT + PIN_R;
        p.vx = -p.vx * 0.4;
        w.hits++;
      }
      if (p.x > WALL_RIGHT - PIN_R && p.vx > 0) {
        p.x = WALL_RIGHT - PIN_R;
        p.vx = -p.vx * 0.4;
        w.hits++;
      }
      // into the pit
      if (p.y < -PIN_R * 2) {
        p.gone = true;
      }
    } else {
      p.vx = 0;
      p.vy = 0;
      p.wobble *= 0.93;
    }
    if (!w.gutter) {
      const before = { vx: p.vx, vy: p.vy };
      const hit = bounce(b, p, BALL_R, reach(p), BALL_MASS, PIN_MASS, 0.55);
      if (hit) {
        w.hits++;
        if (!p.down) {
          if (hit > KNOCK) knockOver(p, random);
          else {
            // just tapped: it rocks and stays
            p.vx = before.vx;
            p.vy = before.vy;
            p.wobble = Math.min(1, p.wobble + hit * 6);
          }
        }
      }
    }
  }

  // pin on pin: only moving pins push others
  const pins = w.pins;
  for (let i = 0; i < pins.length; i++) {
    for (let j = i + 1; j < pins.length; j++) {
      const a = pins[i];
      const c = pins[j];
      if (a.gone || c.gone || (!a.down && !c.down)) continue;
      const keep = [a, c].map((p) => ({ x: p.x, y: p.y }));
      const hit = bounce(a, c, reach(a), reach(c), PIN_MASS, PIN_MASS, 0.5);
      if (!hit) continue;
      w.hits++;
      [a, c].forEach((p, k) => {
        if (p.down) return;
        if (hit > TOPPLE) knockOver(p, random);
        else {
          // only brushed: it rocks and stays where it was
          p.x = keep[k].x;
          p.y = keep[k].y;
          p.vx = 0;
          p.vy = 0;
          p.wobble = Math.min(1, p.wobble + hit * 8);
        }
      });
    }
  }
}

export const moving = (w: World) =>
  (Math.hypot(w.ball.vx, w.ball.vy) > 0.05 && w.ball.y > -12) ||
  w.pins.some((p) => !p.gone && p.down && (Math.hypot(p.vx, p.vy) > 0.03 || p.fall < 1));

export const standingCount = (pins: Pin[]) => pins.filter((p) => !p.gone && !p.down).length;

/** A throw: where the ball starts, how fast, which way, and how much hook. */
export interface Throw {
  x: number;
  /** Down the lane (units per step, positive). */
  speed: number;
  /** Sideways per unit down the lane. */
  angle: number;
  spin: number;
}

/** Rolls one ball through a rack until everything is still (for tests and Coco). */
export function simulate(t: Throw, pins: Pin[] = rack(), random: () => number = Math.random) {
  const w: World = {
    ball: { x: t.x, y: START_Y, vx: t.angle * t.speed, vy: -t.speed },
    pins: pins.map((p) => ({ ...p })),
    gutter: false,
    spin: t.spin,
    hits: 0,
  };
  for (let i = 0; i < 6000; i++) {
    step(w, random);
    if (w.ball.y < -12 && !moving(w)) break;
    if (!moving(w) && i > 30) break;
  }
  return w;
}
