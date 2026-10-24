/**
 * Air hockey on one phone. The rink is 1 wide and RINK_H tall (in rink
 * units); the bottom player defends the bottom goal, the top player (or
 * Coco) the top one.
 */
export const RINK_H = 1.6;
export const PADDLE_R = 0.075;
export const PUCK_R = 0.045;
export const GOAL_W = 0.38;
export const MAX_SPEED = 2.8;
export const WIN_AT = 5;

export interface Vec {
  x: number;
  y: number;
}

export interface Rink {
  puck: Vec;
  vel: Vec;
  /** [bottom, top] */
  paddles: [Vec, Vec];
  /** How fast each paddle moved this frame (units/s), for a proper whack. */
  paddleVel: [Vec, Vec];
  score: [number, number];
}

export const startRink = (serveTo: 0 | 1 = 0): Rink => ({
  puck: { x: 0.5, y: RINK_H / 2 + (serveTo === 0 ? 0.12 : -0.12) },
  vel: { x: 0, y: 0 },
  paddles: [
    { x: 0.5, y: RINK_H - 0.18 },
    { x: 0.5, y: 0.18 },
  ],
  paddleVel: [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ],
  score: [0, 0],
});

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Keeps a paddle on its own half and inside the walls. */
export function clampPaddle(p: Vec, side: 0 | 1): Vec {
  const half = RINK_H / 2;
  return {
    x: clamp(p.x, PADDLE_R, 1 - PADDLE_R),
    y:
      side === 0
        ? clamp(p.y, half + PADDLE_R, RINK_H - PADDLE_R)
        : clamp(p.y, PADDLE_R, half - PADDLE_R),
  };
}

const speed = (v: Vec) => Math.hypot(v.x, v.y);

function limit(v: Vec, max: number): Vec {
  const s = speed(v);
  return s > max ? { x: (v.x / s) * max, y: (v.y / s) * max } : v;
}

export type StepEvent = 'hit' | 'wall' | 'goal-bottom' | 'goal-top' | null;

/**
 * Moves the puck for `dt` seconds. A goal in the top net is a point for the
 * bottom player ("goal-top"), and the other way round.
 */
export function step(r: Rink, dt: number): { rink: Rink; event: StepEvent } {
  let event: StepEvent = null;
  let vel = { x: r.vel.x * Math.pow(0.82, dt), y: r.vel.y * Math.pow(0.82, dt) };
  let puck = { x: r.puck.x + vel.x * dt, y: r.puck.y + vel.y * dt };

  // Paddles.
  r.paddles.forEach((p, i) => {
    const dx = puck.x - p.x;
    const dy = puck.y - p.y;
    const dist = Math.hypot(dx, dy) || 0.0001;
    const min = PADDLE_R + PUCK_R;
    if (dist >= min) return;
    const n = { x: dx / dist, y: dy / dist };
    puck = { x: p.x + n.x * min, y: p.y + n.y * min };
    const pv = r.paddleVel[i];
    const rel = { x: vel.x - pv.x, y: vel.y - pv.y };
    const along = rel.x * n.x + rel.y * n.y;
    if (along < 0) {
      vel = { x: vel.x - 1.9 * along * n.x, y: vel.y - 1.9 * along * n.y };
    }
    // A paddle that's pushing always sends the puck away a little.
    vel = { x: vel.x + n.x * 0.25, y: vel.y + n.y * 0.25 };
    event = 'hit';
  });
  vel = limit(vel, MAX_SPEED);

  // Side walls.
  if (puck.x < PUCK_R) {
    puck.x = PUCK_R;
    vel.x = Math.abs(vel.x) * 0.9;
    event ??= 'wall';
  } else if (puck.x > 1 - PUCK_R) {
    puck.x = 1 - PUCK_R;
    vel.x = -Math.abs(vel.x) * 0.9;
    event ??= 'wall';
  }

  // Ends: a goal through the mouth, otherwise a bounce.
  const inMouth = Math.abs(puck.x - 0.5) < GOAL_W / 2;
  if (puck.y < PUCK_R) {
    if (inMouth && puck.y < -PUCK_R) {
      const score: [number, number] = [r.score[0] + 1, r.score[1]];
      return { rink: { ...startRink(1), score }, event: 'goal-top' };
    }
    if (!inMouth) {
      puck.y = PUCK_R;
      vel.y = Math.abs(vel.y) * 0.9;
      event ??= 'wall';
    }
  } else if (puck.y > RINK_H - PUCK_R) {
    if (inMouth && puck.y > RINK_H + PUCK_R) {
      const score: [number, number] = [r.score[0], r.score[1] + 1];
      return { rink: { ...startRink(0), score }, event: 'goal-bottom' };
    }
    if (!inMouth) {
      puck.y = RINK_H - PUCK_R;
      vel.y = -Math.abs(vel.y) * 0.9;
      event ??= 'wall';
    }
  }

  return { rink: { ...r, puck, vel }, event };
}

/**
 * Where Coco moves her paddle: she defends her goal, and goes for the puck
 * when it's on her side — quick, but not unbeatable.
 */
export function cocoTarget(r: Rink): Vec {
  const half = RINK_H / 2;
  const onHerSide = r.puck.y < half;
  if (onHerSide && r.puck.y > r.paddles[1].y - 0.02) {
    // Get behind it and push it down towards the other goal.
    return { x: r.puck.x + (r.puck.x - 0.5) * 0.15, y: r.puck.y - PUCK_R * 0.5 };
  }
  if (onHerSide) return { x: r.puck.x, y: Math.max(0.12, r.puck.y - 0.12) };
  // Wait in front of the goal, leaning towards the puck.
  return { x: 0.5 + (r.puck.x - 0.5) * 0.6, y: 0.2 };
}

/** One frame of Coco moving towards where she wants to be. */
export function moveToward(from: Vec, to: Vec, maxSpeed: number, dt: number): Vec {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  const s = Math.min(d, maxSpeed * dt);
  return d < 1e-6 ? from : { x: from.x + (dx / d) * s, y: from.y + (dy / d) * s };
}
