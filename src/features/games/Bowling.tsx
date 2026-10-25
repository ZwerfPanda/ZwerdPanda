import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { afterRoll, frameScores, marks, totalScore } from './bowlingScore';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { strokeSpeed } from './skee';
import {
  BALL_R,
  DECK_Y,
  L,
  LANE_LEFT,
  LANE_RIGHT,
  PIN_H,
  PIN_R,
  START_Y,
  W,
  WALL_LEFT,
  WALL_RIGHT,
  moving,
  rack,
  standingCount,
  step,
  type Body,
  type Pin,
} from './bowlingPhysics';

/** Coco bowls a game of her own: decent, never perfect. */
export function cocoGame(random = Math.random): number[][] {
  const frames: number[][] = [];
  const roll = (left: number) => {
    const r = random();
    if (r < 0.28) return left;
    return Math.min(left, Math.floor(random() * (left + 1) * 0.95 + left * 0.2));
  };
  for (let f = 0; f < 10; f++) {
    const a = roll(10);
    if (f < 9) {
      frames.push(a === 10 ? [10] : [a, roll(10 - a)]);
      continue;
    }
    const b = a === 10 ? roll(10) : roll(10 - a);
    const bonus = a === 10 || a + b === 10;
    const c = bonus ? roll(a === 10 && b < 10 ? 10 - b : 10) : undefined;
    frames.push(c === undefined ? [a, b] : [a, b, c]);
  }
  return frames;
}

/* ------------------------------------------------------------ the view */

/*
 * A camera behind the bowler, a little above the lane, that follows the ball
 * towards the pins. World: X across (lane centre 0), Y up, Z down the lane
 * (0 at the bowler's end, L at the pins' end) — the physics' x/y mapped.
 */
const toX = (x: number) => x - W / 2;
const toZ = (y: number) => L - y;
const Z0 = 92;
const CAM_H = 74;
const FAR = L + 10;

interface Cam {
  zc: number;
  P: (x: number, y: number, z: number) => { x: number; y: number; s: number };
}

function makeCam(w: number, h: number, zc: number): Cam {
  const f = (w * 0.5 * Z0) / ((WALL_RIGHT - WALL_LEFT) / 2 + 2);
  const hy = h * 0.97 - (CAM_H * f) / Z0;
  return {
    zc,
    P: (x, y, z) => {
      const s = f / Math.max(8, z - zc + Z0);
      return { x: w / 2 + x * s, y: hy + (CAM_H - y) * s, s };
    },
  };
}

function quad(
  ctx: CanvasRenderingContext2D,
  P: Cam['P'],
  pts: [number, number, number][],
  fill: string | CanvasGradient,
) {
  ctx.beginPath();
  pts.forEach(([x, y, z], i) => {
    const p = P(x, y, z);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** The flat strip of lane between two x's and two z's, at height y. */
const strip = (
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  y = 0,
): [number, number, number][] => [
  [x0, y, z0],
  [x1, y, z0],
  [x1, y, z1],
  [x0, y, z1],
];

function drawAlley(ctx: CanvasRenderingContext2D, cam: Cam, w: number, h: number, now: number) {
  const { P } = cam;
  const lx = toX(LANE_LEFT);
  const rx = toX(LANE_RIGHT);
  const near = Math.max(cam.zc, 0);

  // the hall
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#07030f');
  bg.addColorStop(0.5, '#1d0c30');
  bg.addColorStop(1, '#0d0617');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // the masking unit above the pins: our sign, lit up, all the way to the ceiling
  const foot = P(0, 0, FAR);
  const top = P(0, 60, FAR);
  const half = (WALL_RIGHT - WALL_LEFT) * 0.9 * foot.s;
  const panel = ctx.createLinearGradient(0, 0, 0, foot.y);
  panel.addColorStop(0, '#12061e');
  panel.addColorStop(0.55, '#3b1456');
  panel.addColorStop(1, '#1a0828');
  ctx.fillStyle = panel;
  ctx.fillRect(foot.x - half, 0, half * 2, foot.y);
  // a big neon heart behind the sign
  const cx = foot.x;
  const cy = Math.max(h * 0.08, top.y + (foot.y - top.y) * 0.18);
  const hs = Math.min(half * 0.55, (foot.y - cy) * 0.55);
  ctx.save();
  ctx.lineWidth = Math.max(2, hs * 0.05);
  ctx.strokeStyle = 'rgba(255,95,162,0.85)';
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 18 + 6 * Math.sin(now / 500);
  ctx.beginPath();
  ctx.moveTo(cx, cy + hs * 0.95);
  ctx.bezierCurveTo(
    cx - hs * 1.5,
    cy + hs * 0.1,
    cx - hs * 0.75,
    cy - hs * 0.85,
    cx,
    cy - hs * 0.2,
  );
  ctx.bezierCurveTo(
    cx + hs * 0.75,
    cy - hs * 0.85,
    cx + hs * 1.5,
    cy + hs * 0.1,
    cx,
    cy + hs * 0.95,
  );
  ctx.stroke();
  ctx.font = `900 ${Math.max(12, Math.round(foot.s * 9.5))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowBlur = 14;
  ctx.fillText('LOVE LANES', cx, cy + hs * 0.18);
  ctx.restore();
  // chasing bulbs along the bottom of the panel
  const bulbs = 16;
  for (let i = 0; i <= bulbs; i++) {
    const x = foot.x - half + (half * 2 * i) / bulbs;
    const on = Math.floor(now / 160 + i) % 3 === 0;
    ctx.fillStyle = on ? '#ffd75e' : '#5a4630';
    ctx.shadowColor = '#ffd75e';
    ctx.shadowBlur = on ? 10 : 0;
    ctx.beginPath();
    ctx.arc(x, foot.y - 5, Math.max(1.5, foot.s * 1.1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // the neighbouring lanes, dimmed, beyond our side walls
  for (const side of [-1, 1]) {
    const a = side * (toX(WALL_RIGHT) + 4);
    const b = side * (toX(WALL_RIGHT) + 80);
    quad(ctx, P, strip(Math.min(a, b), Math.max(a, b), near, FAR), 'rgba(214,170,110,0.14)');
  }

  // the side walls around the pin deck (the kickbacks), with a neon edge
  const deckZ = toZ(DECK_Y);
  for (const side of [-1, 1]) {
    const x = side * toX(WALL_RIGHT);
    const g = ctx.createLinearGradient(0, P(x, 30, FAR).y, 0, P(x, 0, deckZ).y);
    g.addColorStop(0, '#2c1240');
    g.addColorStop(1, '#4a2266');
    quad(
      ctx,
      P,
      [
        [x, 0, deckZ],
        [x, 22, deckZ],
        [x, 22, FAR],
        [x, 0, FAR],
      ],
      g,
    );
  }

  // gutters: round channels
  for (const [a, b] of [
    [toX(WALL_LEFT) + 1, lx],
    [rx, toX(WALL_RIGHT) - 1],
  ]) {
    const g = ctx.createLinearGradient(P(a, 0, near).x, 0, P(b, 0, near).x, 0);
    g.addColorStop(0, '#1d1426');
    g.addColorStop(0.5, '#5a4866');
    g.addColorStop(1, '#1d1426');
    quad(ctx, P, strip(a, b, near, FAR, -2), g);
  }

  // the lane: maple boards, the approach in a lighter wood, the pin deck lit
  const wood = ctx.createLinearGradient(0, foot.y, 0, h);
  wood.addColorStop(0, '#b97a42');
  wood.addColorStop(1, '#f0c287');
  quad(ctx, P, strip(lx, rx, near, FAR), wood);
  const boards = 20;
  for (let i = 0; i < boards; i++) {
    if (i % 2) continue;
    const x0 = lx + ((rx - lx) * i) / boards;
    const x1 = lx + ((rx - lx) * (i + 1)) / boards;
    quad(ctx, P, strip(x0, x1, near, FAR, 0.005), 'rgba(140,80,30,0.08)');
  }
  ctx.strokeStyle = 'rgba(110,60,25,0.22)';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < boards; i++) {
    const x = lx + ((rx - lx) * i) / boards;
    const a = P(x, 0, near);
    const b = P(x, 0, FAR);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // the oil: a long glossy shine down the middle
  const shine = ctx.createLinearGradient(P(lx, 0, near).x, 0, P(rx, 0, near).x, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,250,240,0.32)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  quad(ctx, P, strip(lx + 6, rx - 6, near, toZ(DECK_Y + 10), 0.01), shine);
  // the pin deck, under a spotlight
  const spot = P(0, 0, toZ(40));
  const light = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, (rx - lx) * spot.s);
  light.addColorStop(0, 'rgba(255,245,225,0.55)');
  light.addColorStop(1, 'rgba(255,245,225,0)');
  quad(ctx, P, strip(lx, rx, deckZ, FAR, 0.02), light);
  // where each pin stands
  ctx.fillStyle = 'rgba(120,60,40,0.25)';
  for (const p of rack()) {
    const c = P(toX(p.hx), 0.03, toZ(p.hy));
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, PIN_R * 0.5 * c.s, PIN_R * 0.18 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // arrows and dots
  ctx.fillStyle = 'rgba(176,40,95,0.85)';
  [-20, -10, 0, 10, 20].forEach((dx, i) => {
    const z = toZ(128 + Math.abs(i - 2) * 5);
    const a = P(dx, 0.03, z + 5);
    const b = P(dx - 2.4, 0.03, z - 1);
    const c = P(dx + 2.4, 0.03, z - 1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.fill();
  });
  [-15, -5, 5, 15].forEach((dx) => {
    const p = P(dx, 0.03, toZ(168));
    if (toZ(168) < near) return;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, Math.max(1, p.s * 1.1), Math.max(0.6, p.s * 0.4), 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // the foul line
  if (toZ(L - 30) > near) {
    const f0 = P(lx, 0.03, toZ(L - 30));
    const f1 = P(rx, 0.03, toZ(L - 30));
    ctx.strokeStyle = 'rgba(176,40,95,0.75)';
    ctx.lineWidth = Math.max(1, f0.s * 0.9);
    ctx.beginPath();
    ctx.moveTo(f0.x, f0.y);
    ctx.lineTo(f1.x, f1.y);
    ctx.stroke();
  }
  // neon along the outer edges
  ctx.strokeStyle = '#ff5fa2';
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2.2;
  for (const x of [toX(WALL_LEFT), toX(WALL_RIGHT)]) {
    const a = P(x, 1, near);
    const b = P(x, 1, FAR);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

/** A bowling pin's outline (half-width), from the base up, in pin units (height 1). */
const PIN_PROFILE: [number, number][] = [
  [0.0, 0.26],
  [0.06, 0.38],
  [0.2, 0.5],
  [0.36, 0.46],
  [0.5, 0.3],
  [0.6, 0.21],
  [0.68, 0.2],
  [0.78, 0.25],
  [0.88, 0.25],
  [0.96, 0.17],
  [1.0, 0.04],
];

/**
 * A pin, standing, rocking or falling: drawn along its own axis, which tips
 * from straight up to flat on the lane in the direction it was hit.
 */
function drawPin(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  p: Pin,
  now: number,
  options: { mirror?: boolean; drop?: number } = {},
) {
  const tilt = p.fall * (Math.PI / 2) + (p.down ? 0 : p.wobble * 0.18 * Math.sin(now / 45));
  const ax = Math.cos(p.angle);
  const az = -Math.sin(p.angle);
  const flip = options.mirror ? -1 : 1;
  const lift = options.drop ?? 0;
  const X = toX(p.x);
  const Z = toZ(p.y);
  const axis = { x: Math.sin(tilt) * ax, y: Math.cos(tilt) * flip, z: Math.sin(tilt) * az };
  const at = (v: number) =>
    cam.P(X + axis.x * v * PIN_H, lift + axis.y * v * PIN_H, Z + axis.z * v * PIN_H);
  const base = at(0);
  const tip = at(1);
  // the screen direction of the pin, and across it
  let dx = tip.x - base.x;
  let dy = tip.y - base.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  const nx = -dy;
  const ny = dx;
  if (!options.mirror && lift === 0) {
    // its shadow on the deck
    const g = cam.P(X + axis.x * PIN_H * 0.5, 0, Z + axis.z * PIN_H * 0.5);
    ctx.fillStyle = 'rgba(40,15,10,0.28)';
    ctx.beginPath();
    ctx.ellipse(
      g.x,
      g.y,
      PIN_R * base.s * (0.9 + p.fall * 1.6),
      PIN_R * base.s * 0.35,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  for (const [v, u] of PIN_PROFILE) {
    const c = at(v);
    const half = u * PIN_R * 2 * c.s;
    left.push({ x: c.x + nx * half, y: c.y + ny * half });
    right.push({ x: c.x - nx * half, y: c.y - ny * half });
  }
  ctx.save();
  if (options.mirror) ctx.globalAlpha = 0.16;
  ctx.beginPath();
  left.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  [...right].reverse().forEach((q) => ctx.lineTo(q.x, q.y));
  ctx.closePath();
  const mid = at(0.25);
  const wMid = 0.5 * PIN_R * 2 * mid.s;
  const g = ctx.createLinearGradient(
    mid.x + nx * wMid,
    mid.y + ny * wMid,
    mid.x - nx * wMid,
    mid.y - ny * wMid,
  );
  g.addColorStop(0, '#cfc4b8');
  g.addColorStop(0.3, '#ffffff');
  g.addColorStop(0.55, '#f4efe9');
  g.addColorStop(1, '#a89b8e');
  ctx.fillStyle = g;
  ctx.fill();
  if (!options.mirror) {
    ctx.strokeStyle = 'rgba(70,40,40,0.35)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  // the two red neck stripes
  ctx.fillStyle = '#d8323c';
  for (const [v0, v1] of [
    [0.66, 0.695],
    [0.725, 0.76],
  ]) {
    const a = at(v0);
    const b = at(v1);
    const wa = 0.205 * PIN_R * 2 * a.s;
    const wb = 0.215 * PIN_R * 2 * b.s;
    ctx.beginPath();
    ctx.moveTo(a.x + nx * wa, a.y + ny * wa);
    ctx.lineTo(b.x + nx * wb, b.y + ny * wb);
    ctx.lineTo(b.x - nx * wb, b.y - ny * wb);
    ctx.lineTo(a.x - nx * wa, a.y - ny * wa);
    ctx.fill();
  }
  // a shine down the belly
  if (!options.mirror) {
    const s0 = at(0.12);
    const s1 = at(0.42);
    const off = 0.18 * PIN_R * 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 0.12 * PIN_R * 2 * s0.s);
    ctx.beginPath();
    ctx.moveTo(s0.x + nx * off * s0.s, s0.y + ny * off * s0.s);
    ctx.lineTo(s1.x + nx * off * s1.s * 0.8, s1.y + ny * off * s1.s * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  cam: Cam,
  b: Body,
  roll: number,
  trail: { x: number; y: number }[],
  gutter: boolean,
) {
  const y0 = gutter ? -2 : 0;
  trail.forEach((t, i) => {
    const p = cam.P(toX(t.x), y0 + BALL_R, toZ(t.y));
    ctx.fillStyle = `rgba(255,95,162,${(i / trail.length) * 0.18})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, BALL_R * p.s * (0.35 + (i / trail.length) * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });
  const g0 = cam.P(toX(b.x), y0, toZ(b.y));
  const c = cam.P(toX(b.x), y0 + BALL_R, toZ(b.y));
  const r = Math.max(2, BALL_R * c.s);
  // its reflection in the polished lane, and its shadow
  if (!gutter) {
    const m = cam.P(toX(b.x), -BALL_R, toZ(b.y));
    const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, r);
    mg.addColorStop(0, 'rgba(194,48,106,0.25)');
    mg.addColorStop(1, 'rgba(194,48,106,0)');
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(m.x, m.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(g0.x, g0.y, r * 1.05, r * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, r * 0.1, c.x, c.y, r * 1.05);
  g.addColorStop(0, '#ffc2df');
  g.addColorStop(0.4, '#d23a7a');
  g.addColorStop(0.8, '#6a1650');
  g.addColorStop(1, '#2a0822');
  ctx.fillStyle = g;
  ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
  // marble swirls that turn as it rolls
  ctx.strokeStyle = 'rgba(255,220,240,0.35)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  for (let i = 0; i < 3; i++) {
    const a = roll * 0.6 + i * 2.1;
    ctx.beginPath();
    ctx.ellipse(
      c.x,
      c.y + Math.sin(roll + i) * r * 0.25,
      r * (0.5 + i * 0.15),
      r * 0.22,
      a,
      0,
      Math.PI,
    );
    ctx.stroke();
  }
  // finger holes rolling over the top
  const k = Math.sin(roll);
  if (Math.cos(roll) > -0.2) {
    ctx.fillStyle = 'rgba(25,8,25,0.9)';
    [
      [0, -0.42, 0.15],
      [-0.23, -0.12, 0.12],
      [0.23, -0.12, 0.12],
    ].forEach(([x, y, hr]) => {
      ctx.beginPath();
      ctx.ellipse(c.x + x * r, c.y + (y + k * 0.35) * r, hr * r, hr * r * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.ellipse(c.x - r * 0.38, c.y - r * 0.45, r * 0.24, r * 0.14, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

/** The sweep bar that clears the fallen pins away between balls. */
function drawSweep(ctx: CanvasRenderingContext2D, cam: Cam, y: number) {
  const z = toZ(y);
  const x0 = toX(WALL_LEFT);
  const x1 = toX(WALL_RIGHT);
  quad(
    ctx,
    cam.P,
    [
      [x0, 0, z],
      [x1, 0, z],
      [x1, 16, z],
      [x0, 16, z],
    ],
    'rgba(30,14,44,0.92)',
  );
  const a = cam.P(x0, 16, z);
  const b = cam.P(x1, 16, z);
  ctx.strokeStyle = '#5ff3ff';
  ctx.shadowColor = '#5ff3ff';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function freshWorld() {
  return {
    ball: { x: W / 2, y: START_Y, vx: 0, vy: 0 } as Body,
    pins: rack(),
    gutter: false,
    standingBefore: 10,
    spin: 0,
    roll: 0,
    trail: [] as { x: number; y: number }[],
    shake: 0,
    hits: 0,
    heard: 0,
    crashed: false,
    inGutter: false,
    sweep: null as { t: number; reset: boolean } | null,
    drop: 0,
  };
}

export function Bowling() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const best = useBest('bowling');
  const [mode, setMode] = useState<PlayMode>('remote');
  const [frames, setFrames] = useState<number[][]>([[]]);
  const [frame, setFrame] = useState(0);
  const [over, setOver] = useState(false);
  const [message, setMessage] = useState(
    'Schuif opzij om te gaan staan, veeg omhoog om te gooien — een bocht geeft effect',
  );
  const [flash, setFlash] = useState<{ key: number; text: string } | null>(null);
  const [coco, setCoco] = useState<{ frames: number[][]; shown: number } | null>(null);
  const duel = useDuelRound('bowling', mode);
  const duelNow = useRef(duel);
  duelNow.current = duel;
  const [handOver, setHandOver] = useState(false);

  const world = useRef(freshWorld());
  const drag = useRef<{ x: number; y: number; t: number }[]>([]);
  const live = useRef(false);
  const size = useRef({ w: 320, h: 520 });
  const camZ = useRef(0);
  const latest = useRef({ frames, frame });
  latest.current = { frames, frame };

  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const width = box.clientWidth;
      const height = Math.min(window.innerHeight * 0.6, width * 1.3);
      const dpr = window.devicePixelRatio || 1;
      c.width = width * dpr;
      c.height = height * dpr;
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      size.current = { w: width, h: height };
      c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    wrap.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const finishRoll = () => {
    if (!live.current) return;
    live.current = false;
    const w = world.current;
    const { frames: fr, frame: f } = latest.current;
    const standing = standingCount(w.pins);
    const knocked = w.standingBefore - standing;
    const next = fr.map((x) => x.slice());
    next[f] = [...(next[f] ?? []), knocked];
    const result = afterRoll(next, f, standing);
    const first = next[f].length === 1 || (f === 9 && next[f][next[f].length - 2] === 10);
    if (standing === 0 && knocked > 0) {
      const strike = first;
      setFlash({ key: Date.now(), text: strike ? 'STRIKE!' : 'SPARE!' });
      playSfx('success', true);
      celebrateFrom(canvas.current);
      if (strike) w.shake = 14;
    }
    setMessage(
      standing === 0 && knocked > 0
        ? first
          ? 'Alle tien in één keer 🎳✨'
          : 'Netjes opgeruimd 💕'
        : knocked === 0
          ? w.gutter
            ? 'Goot… 🙈'
            : 'Oei, niks geraakt'
          : `${knocked} ${knocked === 1 ? 'kegel' : 'kegels'}!`,
    );
    // The sweep bar clears the fallen pins (and on a new frame, all of them).
    w.sweep = { t: 0, reset: Boolean(result.reset || result.nextFrame) };
    w.standingBefore = result.reset || result.nextFrame ? 10 : standing;
    if (result.gameOver) {
      setFrames(next);
      setOver(true);
      const total = totalScore(next);
      if (mode === 'coco') {
        if (getAuthor()) addScore('bowling', total);
        startCoco(total);
      } else {
        // Against each other: a duel (apart), or the second game settles it (one phone).
        const end = duelNow.current.finish(total);
        setMessage(end.text);
        setHandOver(Boolean(end.handOver));
        if (end.tickets) celebrateFrom(canvas.current);
      }
      return;
    }
    if (result.nextFrame) {
      next.push([]);
      setFrame(f + 1);
    }
    window.setTimeout(() => {
      w.ball = { x: W / 2, y: L + 14, vx: 0, vy: -1.6 };
      w.trail = [];
      w.gutter = false;
    }, 700);
    setFrames(next);
  };

  /** After your tenth frame, Coco bowls hers, frame by frame. */
  const startCoco = (yours: number) => {
    const theirs = cocoGame();
    setCoco({ frames: theirs, shown: 0 });
    setMessage('Coco is aan de beurt… 🐰🎳');
    let shown = 0;
    const tick = window.setInterval(() => {
      shown += 1;
      playSfx(theirs[shown - 1]?.[0] === 10 ? 'success' : 'pop', true);
      setCoco({ frames: theirs, shown });
      if (shown >= 10) {
        window.clearInterval(tick);
        const cocoTotal = totalScore(theirs);
        addScore('bowling', cocoTotal, 'coco');
        const winner = yours > cocoTotal ? me : yours < cocoTotal ? 'coco' : 'draw';
        recordResult('bowling', [me, 'coco'], winner);
        setMessage(
          winner === me
            ? `Jij wint! ${yours} tegen ${cocoTotal} 🎉`
            : winner === 'coco'
              ? `Coco wint met ${cocoTotal} tegen ${yours} 🐰👑`
              : `Gelijk! ${yours}–${cocoTotal}`,
        );
        if (winner === me) celebrateFrom(canvas.current);
      }
    }, 450);
  };

  useEffect(() => {
    let raf = 0;
    let lastHit = 0;
    const tick = () => {
      const c = canvas.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const w = world.current;
      const { w: cw, h: ch } = size.current;

      // the ball rolls back in after a throw
      if (!live.current && w.ball.y > START_Y) {
        w.ball.y = Math.max(START_Y, w.ball.y + w.ball.vy);
        if (w.ball.y === START_Y) w.ball.vy = 0;
      }

      if (live.current) {
        for (let n = 0; n < 2; n++) step(w);
        w.roll += Math.hypot(w.ball.vx, w.ball.vy) / BALL_R;
        if (w.gutter && !w.inGutter) {
          w.inGutter = true;
          playSfx('clunk', true);
        }
        if (w.hits > w.heard && performance.now() - lastHit > 260) {
          playSfx('pins', true);
          lastHit = performance.now();
          // the first crash into the rack shakes the screen a little
          if (!w.crashed && !w.gutter) {
            w.crashed = true;
            w.shake = Math.max(w.shake, 5 + Math.hypot(w.ball.vx, w.ball.vy) * 4);
          }
        }
        w.heard = w.hits;
        w.trail.push({ x: w.ball.x, y: w.ball.y });
        if (w.trail.length > 10) w.trail.shift();
        if (!moving(w) || (w.ball.y < -12 && !moving(w))) finishRoll();
      }

      // pins that were tapped keep rocking for a moment, fallen ones finish falling
      if (!live.current)
        for (const p of w.pins) {
          if (!p.down) p.wobble *= 0.93;
          else if (p.fall < 1) p.fall = Math.min(1, p.fall + 0.045);
        }

      // the sweep: a bar comes down and pushes the fallen pins into the pit
      let sweepY: number | null = null;
      if (w.sweep) {
        w.sweep.t = Math.min(1, w.sweep.t + (reduce ? 0.05 : 1 / 55));
        const t = w.sweep.t;
        sweepY = DECK_Y + 6 - Math.max(0, t - 0.15) * ((DECK_Y + 40) / 0.85);
        for (const p of w.pins)
          if ((p.down || w.sweep.reset) && !p.gone && p.y > sweepY - PIN_R * 2) {
            p.y = sweepY - PIN_R * 2;
            if (p.y < -PIN_R * 3) p.gone = true;
          }
        if (t >= 1) {
          if (w.sweep.reset) {
            w.pins = rack();
            w.drop = 1;
          } else
            w.pins = w.pins
              .filter((p) => !p.down && !p.gone)
              .map((p) => ({ ...p, x: p.hx, y: p.hy, wobble: 0 }));
          w.sweep = null;
        }
      }
      // a new rack comes down from the pinsetter
      if (w.drop > 0) w.drop = Math.max(0, w.drop - (reduce ? 0.2 : 0.035));

      // the camera follows the ball down the lane, and comes back for the next one
      // (it stays at the pins while they're swept)
      const target = live.current
        ? Math.max(0, Math.min(120, toZ(w.ball.y) - 40))
        : w.sweep
          ? 120
          : 0;
      camZ.current += (target - camZ.current) * (reduce ? 1 : live.current ? 0.1 : 0.12);
      const cam = makeCam(cw, ch, camZ.current);

      ctx.clearRect(0, 0, cw, ch);
      ctx.save();
      if (w.shake > 0 && !reduce) {
        ctx.translate((Math.random() - 0.5) * w.shake * 0.4, (Math.random() - 0.5) * w.shake * 0.4);
        w.shake *= 0.86;
        if (w.shake < 0.5) w.shake = 0;
      }
      drawAlley(ctx, cam, cw, ch, performance.now());
      const now = performance.now();
      const pins = w.pins.filter((p) => !p.gone);
      const drop = w.drop > 0 ? w.drop * w.drop * 60 : 0;
      // the polished lane mirrors the standing pins
      for (const p of pins) if (!p.down) drawPin(ctx, cam, p, now, { mirror: true, drop: -drop });
      // far to near, so nearer things cover farther ones
      const things: { z: number; draw: () => void }[] = pins.map((p) => ({
        z: toZ(p.y),
        draw: () => drawPin(ctx, cam, p, now, { drop }),
      }));
      things.push({
        z: toZ(w.ball.y) - 0.1,
        draw: () => drawBall(ctx, cam, w.ball, w.roll, live.current ? w.trail : [], w.gutter),
      });
      if (sweepY !== null)
        things.push({ z: toZ(sweepY) - 0.2, draw: () => drawSweep(ctx, cam, sweepY!) });
      things.sort((a, b) => b.z - a.z).forEach((t) => t.draw());
      // aim guide while dragging
      const d = drag.current;
      if (!live.current && d.length > 1) {
        const moved = d.find((q) => d[0].y - q.y > 8);
        const last = d[d.length - 1];
        if (moved && moved !== last) {
          const k = (last.x - moved.x) / Math.max(10, moved.y - last.y);
          ctx.strokeStyle = 'rgba(255,95,162,0.85)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          for (let i = 0; i <= 12; i++) {
            const y = w.ball.y - i * 10;
            const p = cam.P(toX(w.ball.x + k * i * 10 * 0.55), 0.2, toZ(y));
            if (i) ctx.lineTo(p.x, p.y);
            else ctx.moveTo(p.x, p.y);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // finishRoll reads fresh values through refs.
  }, [reduce, mode]);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };
  const onDown = (e: React.PointerEvent) => {
    if (live.current || over || world.current.sweep || world.current.drop > 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = [point(e)];
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.length) return;
    const p = point(e);
    d.push(p);
    if (d.length > 80) d.splice(1, 1);
    // slide sideways first to stand where you want, then swipe
    if (d[0].y - p.y < 10) {
      const { w: cw, h: ch } = size.current;
      const at = makeCam(cw, ch, 0).P(0, 0, toZ(START_Y));
      const x = W / 2 + (p.x - at.x) / at.s;
      world.current.ball.x = Math.max(LANE_LEFT + BALL_R, Math.min(LANE_RIGHT - BALL_R, x));
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = [];
    if (d.length < 2) return;
    const speed = strokeSpeed(d, size.current.h);
    const moved = d.find((q) => d[0].y - q.y > 8);
    const last = d[d.length - 1];
    if (!moved || speed < 0.6) {
      setMessage('Veeg omhoog ↑ om te gooien');
      return;
    }
    // A curved swipe gives spin: compare the start and the end of the swipe.
    const mid = d[Math.floor((d.indexOf(moved) + d.length - 1) / 2)];
    const a1 = Math.atan2(mid.y - moved.y, mid.x - moved.x);
    const a2 = Math.atan2(last.y - mid.y, last.x - mid.x);
    let bend = a2 - a1;
    if (bend > Math.PI) bend -= Math.PI * 2;
    if (bend < -Math.PI) bend += Math.PI * 2;
    const spin = Math.max(-1, Math.min(1, bend * 2.2));
    // how hard: canvas heights per second, the same however big the phone is
    const vy = -Math.min(1.45, 0.42 + speed * 0.28);
    const vx = Math.max(
      -1.6,
      Math.min(1.6, ((last.x - moved.x) / Math.max(10, moved.y - last.y)) * -vy * 0.55),
    );
    const w = world.current;
    w.hits = 0;
    w.heard = 0;
    w.crashed = false;
    w.inGutter = false;
    // a real hand is never perfectly straight
    w.ball.vx = vx + (Math.random() - 0.5) * 0.06;
    w.ball.vy = vy;
    w.spin = Math.abs(spin) > 0.15 ? spin : 0;
    w.trail = [];
    live.current = true;
    setMessage(w.spin ? `Met effect ${w.spin > 0 ? '↪' : '↩'}` : '…');
    playSfx('roll', true);
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    setHandOver(false);
    world.current = freshWorld();
    live.current = false;
    setFrames([[]]);
    setFrame(0);
    setOver(false);
    setCoco(null);
    setMessage('Schuif opzij om te gaan staan, veeg omhoog om te gooien — een bocht geeft effect');
  };

  const scores = frameScores(frames);
  const cocoScores = coco ? frameScores(coco.frames.slice(0, coco.shown)) : [];
  return (
    <GameShell
      id="bowling"
      title="Bowlen"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        restart();
      }}
      modes={['remote', 'local', 'coco']}
      labels={DUEL_LABELS}
      score={
        <ScoreBoard
          label="records"
          entries={[
            { name: profile.yourName.toUpperCase(), value: best.you ?? '---', me: me === 'you' },
            {
              name: profile.partnerName.toUpperCase(),
              value: best.partner ?? '---',
              me: me === 'partner',
            },
            { name: 'COCO', value: best.coco ?? '---' },
          ]}
        />
      }
    >
      <DuelPanel kind="bowling" mode={mode} first={duel.first} result={duel.result} />
      <ol className="bowl-sheet" aria-label="Jouw scorekaart">
        {Array.from({ length: 10 }, (_, f) => (
          <li key={f} className={f === frame && !over ? 'is-now' : ''}>
            <span className="bowl-sheet__n">{f + 1}</span>
            <span className="bowl-sheet__rolls">{marks(frames[f] ?? [], f === 9).join(' ')}</span>
            <strong>{scores[f] ?? ''}</strong>
          </li>
        ))}
      </ol>
      {coco && (
        <ol className="bowl-sheet bowl-sheet--coco" aria-label="Coco’s scorekaart">
          {Array.from({ length: 10 }, (_, f) => (
            <li key={f} className={f === coco.shown - 1 ? 'is-now' : ''}>
              <span className="bowl-sheet__n">{f === 0 ? '🐰' : f + 1}</span>
              <span className="bowl-sheet__rolls">
                {f < coco.shown ? marks(coco.frames[f], f === 9).join(' ') : ''}
              </span>
              <strong>{cocoScores[f] ?? ''}</strong>
            </li>
          ))}
        </ol>
      )}
      <p className="game-turn is-mine" aria-live="polite">
        {message}
      </p>
      <div className="bowl" ref={wrap}>
        <canvas
          ref={canvas}
          className="bowl__canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => (drag.current = [])}
          role="img"
          aria-label="Bowlingbaan: zet je vinger op de baan en veeg omhoog om te gooien"
        />
        <AnimatePresence>
          {flash && (
            <motion.span
              key={flash.key}
              className="bowl__flash"
              initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
              animate={{ scale: [0.3, 1.3, 1], opacity: [0, 1, 1, 0], rotate: [-10, 4, 0] }}
              transition={{ duration: 1.4, times: [0, 0.3, 0.8, 1] }}
              onAnimationComplete={() => setFlash(null)}
            >
              {flash.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      {!getAuthor() && (
        <p className="game-hint">Kies in Instellingen wie je bent om je record te bewaren.</p>
      )}
      {handOver && over ? (
        <button type="button" className="neon-btn" onClick={() => restart(true)}>
          Nu {nameOf(duel.player, profile)} ▶
        </button>
      ) : (
        <button type="button" className="neon-btn" onClick={() => restart()}>
          {over ? 'Nog een potje' : 'Opnieuw beginnen'}
        </button>
      )}
    </GameShell>
  );
}
