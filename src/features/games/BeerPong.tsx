import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import {
  BALL_R,
  CUP_BASE_R,
  CUP_H,
  CUP_R,
  TABLE,
  applyThrow,
  beforeCups,
  clampThrow,
  cocoThrow,
  cupsOf,
  fly,
  launch,
  left,
  newPong,
  normalizePong,
  project,
  type Cup,
  type Flight,
  type Landing,
  type LastThrow,
  type PongNews,
  type PongState,
  type Side,
  type Throw,
} from './pong';
import './pong.css';

const W = 360;
const H = 560;
/** A swipe this long (canvas units) is a "normal" throw… */
const SWIPE = 230;
/** …and this is how much the length matters. */
const TOUCH = 0.28;
const AIMK = 0.45;
const HAND = { x: 180, y: 458 };

const power = (up: number) => 1 + (up / SWIPE - 1) * TOUCH;
const aimOf = (dx: number, up: number) => (dx / Math.max(30, up)) * AIMK;

const NEAR = {
  short: 'net te kort',
  long: 'net te ver',
  left: 'net te links',
  right: 'net te rechts',
};

function missText(l: Extract<Landing, { cup: null }>): string {
  const near = l.near ? NEAR[l.near] : '';
  switch (l.why) {
    case 'rim':
      return `Op de rand… eruit! (${near || 'zo dichtbij'})`;
    case 'wall':
      return l.near === 'long' ? 'Tegen de achterste beker — iets korter' : 'Tegen een beker aan — iets verder';
    case 'short':
      return 'Te kort — veeg iets langer';
    case 'long':
      return 'Te ver — veeg iets korter';
    case 'left':
      return 'Te veel naar links';
    case 'right':
      return 'Te veel naar rechts';
    case 'roll':
      return 'Over de tafel gerold…';
  }
}

interface Splash {
  cup: Cup;
  at: number;
}

interface View {
  cups: Cup[];
  ball: Flight | null;
  trail: { x: number; y: number; r: number }[];
  splashes: Splash[];
  now: number;
  /** Ready to throw: the ball in your hand (and where your finger is). */
  hand: { x: number; y: number } | null;
  drag: { up: number; dx: number } | null;
  fire: boolean;
  /** Where the last ball came down, and how the power was. */
  ghost: { x: number; z: number; power: number; good: boolean } | null;
  rival: string;
  tint: string;
}

/* -------------------------------------------------------------- drawing */

function room(ctx: CanvasRenderingContext2D, now: number, rival: string) {
  const wall = ctx.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, '#2a1240');
  wall.addColorStop(0.45, '#1d0d31');
  wall.addColorStop(1, '#120820');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, W, H);
  // a neon sign
  ctx.save();
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const flicker = 0.85 + Math.sin(now / 130) * 0.05 + (Math.sin(now / 1700) > 0.97 ? -0.4 : 0);
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 18;
  ctx.globalAlpha = flicker;
  ctx.fillStyle = '#ffb3d4';
  ctx.fillText('BEER PONG', W / 2, 66);
  ctx.restore();
  // string lights
  for (let i = 0; i < 13; i++) {
    const x = 4 + i * 29.5;
    const y = 22 + Math.sin(i * 0.9) * 6;
    const c = ['#ffd75e', '#ff8cc0', '#5ff3ff'][i % 3];
    const pulse = 0.7 + Math.sin(now / 400 + i) * 0.3;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 15);
    g.addColorStop(0, c);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = pulse;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // who's at the other end
  const far = project(0, 0.2, TABLE.end + 0.3);
  ctx.save();
  ctx.globalAlpha = 0.95;
  ctx.font = `${Math.round(far.k * 0.13)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(rival, far.x + Math.sin(now / 900) * 4, far.y);
  ctx.restore();
}

function table(ctx: CanvasRenderingContext2D, tint: string) {
  const a = project(-TABLE.half, 0, -0.2);
  const b = project(TABLE.half, 0, -0.2);
  const c = project(TABLE.half, 0, TABLE.end);
  const d = project(-TABLE.half, 0, TABLE.end);
  const e1 = project(-TABLE.half, -0.04, TABLE.end);
  // the far edge (its thickness)
  ctx.fillStyle = '#b9a690';
  ctx.fillRect(d.x, d.y, c.x - d.x, e1.y - d.y + 1);
  const top = ctx.createLinearGradient(0, c.y, 0, H);
  top.addColorStop(0, '#efe6d9');
  top.addColorStop(1, '#fffaf2');
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  // edge stripes: his yellow, her pink
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffc61a';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(d.x, d.y);
  ctx.stroke();
  ctx.strokeStyle = '#ff5fa2';
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.stroke();
  // centre line and a heart in the middle
  const m1 = project(0, 0, 0.2);
  const m2 = project(0, 0, TABLE.end);
  ctx.strokeStyle = 'rgba(120,90,140,0.22)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(m1.x, m1.y);
  ctx.lineTo(m2.x, m2.y);
  ctx.stroke();
  const hc = project(0, 0, 1.25);
  ctx.save();
  ctx.translate(hc.x, hc.y);
  ctx.scale(1, 0.32);
  ctx.globalAlpha = 0.28;
  ctx.font = `${Math.round(hc.k * 0.24)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = tint;
  ctx.fillText('♥', 0, 0);
  ctx.restore();
}

function cup(ctx: CanvasRenderingContext2D, c: Cup, alpha = 1, sink = 0) {
  const y0 = -sink * CUP_H;
  const base = project(c.x, y0, c.z);
  const rim = project(c.x, CUP_H + y0, c.z);
  const rr = CUP_R * rim.k;
  const rb = CUP_BASE_R * base.k;
  const squash = 0.3;
  ctx.globalAlpha = alpha;
  // shadow on the table
  ctx.fillStyle = 'rgba(40,20,40,0.18)';
  ctx.beginPath();
  ctx.ellipse(base.x + rb * 0.25, base.y + 1, rb * 1.25, rb * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createLinearGradient(rim.x - rr, 0, rim.x + rr, 0);
  body.addColorStop(0, '#8c0f20');
  body.addColorStop(0.35, '#e5263d');
  body.addColorStop(0.55, '#ff5a6a');
  body.addColorStop(1, '#7c0c1b');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(rim.x - rr, rim.y);
  ctx.lineTo(base.x - rb, base.y);
  ctx.ellipse(base.x, base.y, rb, rb * squash, 0, Math.PI, 0, true);
  ctx.lineTo(rim.x + rr, rim.y);
  ctx.closePath();
  ctx.fill();
  // the ribs of a party cup
  ctx.strokeStyle = 'rgba(80,0,15,0.35)';
  ctx.lineWidth = 1;
  for (const f of [0.28, 0.62]) {
    const p = project(c.x, CUP_H * f + y0, c.z);
    const r = (CUP_BASE_R + (CUP_R - CUP_BASE_R) * f) * p.k;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * squash, 0, 0, Math.PI);
    ctx.stroke();
  }
  // the white rim, the inside, the beer
  ctx.fillStyle = '#fdf7f2';
  ctx.beginPath();
  ctx.ellipse(rim.x, rim.y, rr, rr * squash, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a51428';
  ctx.beginPath();
  ctx.ellipse(rim.x, rim.y + 0.5, rr * 0.88, rr * squash * 0.82, 0, 0, Math.PI * 2);
  ctx.fill();
  const beer = ctx.createLinearGradient(0, rim.y - rr * 0.2, 0, rim.y + rr * 0.3);
  beer.addColorStop(0, '#ffd27a');
  beer.addColorStop(1, '#e08b1f');
  ctx.fillStyle = beer;
  ctx.beginPath();
  ctx.ellipse(rim.x, rim.y + rr * 0.1, rr * 0.74, rr * squash * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(rim.x - rr * 0.25, rim.y + rr * 0.04, rr * 0.22, rr * squash * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function ballAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fire: boolean,
  now: number,
) {
  if (fire) {
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
    g.addColorStop(0, 'rgba(255,170,40,0.9)');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 3, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 4; k++) {
      const a = now / 90 + k * 1.6;
      ctx.fillStyle = k % 2 ? '#ffd75e' : '#ff6a3d';
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 1.3, y + r * 0.6 + Math.sin(a) * r * 0.6, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.7, '#f4efe8');
  g.addColorStop(1, '#cfc6bd');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function paint(ctx: CanvasRenderingContext2D, v: View) {
  ctx.clearRect(0, 0, W, H);
  room(ctx, v.now, v.rival);
  table(ctx, v.tint);

  // where the last ball came down
  if (v.ghost) {
    const g = project(v.ghost.x, 0.002, v.ghost.z);
    if (Math.abs(v.ghost.x) < TABLE.half + 0.1 && v.ghost.z < TABLE.end + 0.3) {
      ctx.strokeStyle = v.ghost.good ? 'rgba(60,196,106,0.8)' : 'rgba(229,38,61,0.7)';
      ctx.lineWidth = 2.5;
      const s = 6;
      ctx.beginPath();
      ctx.moveTo(g.x - s, g.y - s * 0.4);
      ctx.lineTo(g.x + s, g.y + s * 0.4);
      ctx.moveTo(g.x + s, g.y - s * 0.4);
      ctx.lineTo(g.x - s, g.y + s * 0.4);
      ctx.stroke();
    }
  }

  // the ball's shadow on the table
  const ball = v.ball;
  if (ball && Math.abs(ball.x) < TABLE.half && ball.z < TABLE.end && ball.y > -0.01) {
    const sh = project(ball.x, 0.002, ball.z);
    const fade = Math.max(0.05, 0.3 - ball.y * 0.25);
    ctx.fillStyle = `rgba(40,20,40,${fade})`;
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, BALL_R * sh.k * 1.1, BALL_R * sh.k * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // cups back to front, with the ball between them where it belongs
  const order = [...v.cups].sort((p, q) => q.z - p.z);
  const behind = (c: Cup) => {
    if (!ball) return false;
    const near = Math.hypot(ball.x - c.x, ball.z - c.z) < CUP_R + BALL_R * 2;
    return near ? ball.y <= CUP_H : ball.z > c.z;
  };
  const drawBall = () => {
    if (!ball) return;
    v.trail.forEach((p, i) => {
      ctx.globalAlpha = (i / v.trail.length) * 0.35;
      ctx.fillStyle = v.fire ? '#ffb347' : '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.4 + (i / v.trail.length) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    const p = project(ball.x, ball.y, ball.z);
    ballAt(ctx, p.x, p.y, Math.max(2, BALL_R * p.k), v.fire, v.now);
  };
  let drawn = false;
  for (const c of order) {
    if (!drawn && behind(c)) {
      drawBall();
      drawn = true;
    }
    cup(ctx, c);
  }
  // cups that just got hit: they sink, the beer splashes
  for (const s of v.splashes) {
    const k = Math.min(1, (v.now - s.at) / 750);
    cup(ctx, s.cup, 1 - k, k * 0.6);
    const rim = project(s.cup.x, CUP_H, s.cup.z);
    const rr = CUP_R * rim.k;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const dist = k * rr * 2.4;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = i % 3 ? '#ffd27a' : '#fff6dc';
      ctx.beginPath();
      ctx.arc(
        rim.x + Math.cos(a) * dist,
        rim.y - Math.abs(Math.sin(a)) * dist * 0.8 - Math.sin(k * Math.PI) * rr * 1.2,
        2.6 * (1 - k) + 1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (!drawn) drawBall();

  // in your hand, ready to throw
  if (v.hand) {
    const hx = v.hand.x;
    const hy = v.hand.y;
    if (v.drag && v.drag.up > 12) {
      // the way it's going: a short dotted guide
      const aim = aimOf(v.drag.dx, v.drag.up);
      const to = project(aim * 1.15, 0.12, 1.15);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.setLineDash([3, 8]);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy - 20);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = 'rgba(40,20,40,0.18)';
    ctx.beginPath();
    ctx.ellipse(hx + 4, hy + 24, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ballAt(ctx, hx, hy, 20, v.fire, v.now);
  }

  // the power meter
  if (v.hand && (v.drag || v.ghost)) {
    const x = W - 24;
    const top = 250;
    const bottom = 470;
    const toY = (p: number) => bottom - ((p - 0.82) / 0.36) * (bottom - top);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.roundRect(x - 7, top, 14, bottom - top, 7);
    ctx.fill();
    if (v.drag) {
      const p = Math.max(0.82, Math.min(1.18, power(v.drag.up)));
      const g = ctx.createLinearGradient(0, bottom, 0, top);
      g.addColorStop(0, '#5ff3ff');
      g.addColorStop(0.5, '#ffd75e');
      g.addColorStop(1, '#ff4f6d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(x - 7, toY(p), 14, bottom - toY(p), 7);
      ctx.fill();
    }
    if (v.ghost) {
      const y = toY(Math.max(0.82, Math.min(1.18, v.ghost.power)));
      ctx.fillStyle = v.ghost.good ? '#3cc46a' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x - 18, y - 5);
      ctx.lineTo(x - 18, y + 5);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------------- the table */

interface Replay {
  key: number;
  throw: Throw;
  before: Cup[];
  hit: number[];
}

/**
 * The table: you throw by swiping up when it's your go. Otherwise it shows
 * the cups being thrown at — Coco throwing, or the other's ball (replayed
 * here exactly as it flew on their phone).
 */
function Table({
  cups,
  canThrow,
  onLanded,
  cocoThrowing,
  cocoKey = 0,
  replay,
  onReplayed,
  fire,
  rival,
  tint,
  hint,
}: {
  cups: Cup[];
  canThrow: boolean;
  onLanded: (l: Landing, t: Throw) => void;
  /** Coco's turn: she throws by herself at these cups. */
  cocoThrowing?: boolean;
  /** Changes with every throw, so Coco throws her next ball too. */
  cocoKey?: number;
  replay?: Replay | null;
  onReplayed?: () => void;
  fire: boolean;
  rival: string;
  tint: string;
  hint: (text: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ball = useRef<Flight | null>(null);
  const acc = useRef(0);
  const trail = useRef<{ x: number; y: number; r: number }[]>([]);
  const splashes = useRef<Splash[]>([]);
  const press = useRef<{ x: number; y: number } | null>(null);
  const drag = useRef<{ up: number; dx: number; x: number; y: number } | null>(null);
  const ghost = useRef<View['ghost']>(null);
  const current = useRef<{ throw: Throw; cups: Cup[]; done: (l: Landing) => void } | null>(null);
  /** While the other's ball is replayed, the cups stand as they were. */
  const replaying = useRef<Cup[] | null>(null);
  /** A ball is on its way (or just landed): no second one yet. */
  const pending = useRef(false);
  const props = useRef({ cups, canThrow, fire, rival, tint });
  props.current = { cups, canThrow, fire, rival, tint };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    el.width = W * dpr;
    el.height = H * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const fl = current.current;
      if (ball.current && fl) {
        const out = fly(ball.current, dt, fl.cups, acc.current);
        ball.current = out.flight;
        acc.current = out.acc;
        for (const t of out.touches) playSfx(t === 'wall' ? 'clunk' : 'tap', true);
        const p = project(out.flight.x, out.flight.y, out.flight.z);
        trail.current.push({ x: p.x, y: p.y, r: BALL_R * p.k });
        if (trail.current.length > 9) trail.current.shift();
        if (out.landed) {
          const l = out.landed;
          ghost.current = {
            ...(out.flight.cross ?? { x: out.flight.x, z: out.flight.z }),
            power: fl.throw.power,
            good: l.cup !== null,
          };
          ball.current = null;
          trail.current = [];
          current.current = null;
          fl.done(l);
        }
      }
      splashes.current = splashes.current.filter((s) => now - s.at < 800);
      const pr = props.current;
      const showHand = pr.canThrow && !ball.current && !pending.current;
      paint(ctx, {
        cups: replaying.current ?? pr.cups,
        ball: ball.current,
        trail: trail.current,
        splashes: splashes.current,
        now,
        hand: showHand
          ? drag.current
            ? {
                x: HAND.x + Math.max(-60, Math.min(60, drag.current.dx * 0.35)),
                y: HAND.y - Math.max(0, Math.min(40, drag.current.up * 0.15)),
              }
            : HAND
          : null,
        drag: showHand ? drag.current : null,
        fire: pr.fire,
        ghost: ghost.current,
        rival: pr.rival,
        tint: pr.tint,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const start = (t: Throw, at: Cup[], done: (l: Landing) => void) => {
    const th = clampThrow(t);
    ball.current = launch(th.power, th.aim);
    acc.current = 0;
    trail.current = [];
    current.current = { throw: th, cups: at, done };
    playSfx('whoosh', true);
  };

  const splashAt = (c: Cup) => {
    splashes.current.push({ cup: c, at: performance.now() });
    playSfx('splash', true);
  };

  const throwIt = (t: Throw) => {
    if (ball.current || pending.current) return;
    pending.current = true;
    const at = props.current.cups;
    start(t, at, (l) => {
      if (l.cup !== null) splashAt(at[l.cup]);
      else {
        playSfx('thunk', true);
        hint(missText(l));
      }
      window.setTimeout(
        () => {
          pending.current = false;
          onLanded(l, t);
        },
        l.cup !== null ? 600 : 250,
      );
    });
  };

  // Coco's turn: she aims and throws by herself — and the ball really flies.
  useEffect(() => {
    if (!cocoThrowing || ball.current) return;
    const id = window.setTimeout(() => throwIt(cocoThrow(props.current.cups)), 1000);
    return () => window.clearTimeout(id);
  }, [cocoThrowing, cocoKey]);

  // The other's throw came in: watch it fly.
  useEffect(() => {
    if (!replay) return;
    const at = replay.before;
    replaying.current = at;
    const id = window.setTimeout(
      () =>
        start(replay.throw, at, () => {
          replaying.current = null;
          for (const i of replay.hit) if (at[i]) splashAt(at[i]);
          if (!replay.hit.length) playSfx('thunk', true);
          window.setTimeout(() => onReplayed?.(), replay.hit.length ? 700 : 400);
        }),
      350,
    );
    return () => {
      window.clearTimeout(id);
      replaying.current = null;
    };
  }, [replay?.key]);

  const local = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  return (
    <canvas
      ref={canvas}
      className={`pong-canvas${canThrow ? ' is-mine' : ''}`}
      role="application"
      tabIndex={0}
      aria-label={
        canThrow
          ? 'Beer pong: veeg omhoog om te gooien — de lengte is de kracht, de richting is je mikpunt'
          : 'Beer pong-tafel'
      }
      onPointerDown={(e) => {
        if (!canThrow || ball.current || pending.current) return;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        press.current = local(e);
        drag.current = { up: 0, dx: 0, ...press.current };
      }}
      onPointerMove={(e) => {
        if (!press.current) return;
        const p = local(e);
        drag.current = { up: press.current.y - p.y, dx: p.x - press.current.x, ...p };
      }}
      onPointerUp={(e) => {
        const from = press.current;
        press.current = null;
        drag.current = null;
        if (!from || !canThrow) return;
        const p = local(e);
        const up = from.y - p.y;
        if (up < 30) {
          if (up > -10) hint('Veeg omhoog om te gooien ☝️');
          return;
        }
        throwIt({ power: power(up), aim: aimOf(p.x - from.x, up) });
      }}
      onPointerCancel={() => {
        press.current = null;
        drag.current = null;
      }}
      onKeyDown={(e) => {
        if (!canThrow || (e.key !== ' ' && e.key !== 'Enter')) return;
        e.preventDefault();
        throwIt({ power: 0.99 + (Math.random() - 0.5) * 0.06, aim: (Math.random() - 0.5) * 0.08 });
      }}
    />
  );
}

/* ---------------------------------------------------------- around it */

function useHint() {
  const [hint, setHint] = useState<{ id: number; text: string } | null>(null);
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 1700);
    return () => window.clearTimeout(t);
  }, [hint]);
  return { hint, say: (text: string) => setHint({ id: performance.now(), text }) };
}

function Hint({ hint }: { hint: { id: number; text: string } | null }) {
  return (
    <AnimatePresence>
      {hint && (
        <motion.p
          key={hint.id}
          className="pong-hint"
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0 }}
        >
          {hint.text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

/** A little map of the cups still standing, as they stand. */
function Rack({ cups, label, paint: color, active }: { cups: Cup[]; label: string; paint: string; active?: boolean }) {
  return (
    <span
      className={`pong-rack is-${color}${active ? ' is-active' : ''}`}
      aria-label={`${label}: nog ${cups.length} ${cups.length === 1 ? 'beker' : 'bekers'}`}
      role="img"
    >
      <small>
        {label} · {cups.length}
      </small>
      <svg viewBox="-0.23 -0.02 0.46 0.36" className="pong-rack__cups" aria-hidden="true">
        {cups.map((c, i) => (
          <circle key={i} cx={c.x} cy={2.35 - c.z} r={0.044} />
        ))}
      </svg>
    </span>
  );
}

function newsText(
  news: PongNews[],
  name: string,
  rival: string,
  me: boolean,
  cupsLeft: number,
  l: Landing,
): string | null {
  const you = me ? 'Je' : name;
  if (news.includes('redeemed')) return '😱 Alles raak — overtime! Drie bekers elk';
  if (news.includes('lastCup')) return `🏆 Laatste beker! ${rival} krijgt nog één laatste kans…`;
  if (news.includes('bounce')) return '🏓 Bounce shot! Twee bekers weg';
  if (news.includes('fire')) return `🔥 ${you} ${me ? 'bent' : 'is'} on fire! Gooien tot je mist`;
  if (news.includes('ballsBack')) return '🔁 Allebei raak — ballen terug!';
  if (news.includes('fireOut')) return '🧯 Vuurtje uit';
  if (news.includes('hit')) return l.cup !== null && l.rim ? `🌀 Rond de rand… erin! nog ${cupsLeft}` : `🎯 Raak! nog ${cupsLeft}`;
  if (news.includes('rerack')) return '🔄 Bekers herschikt';
  return null;
}

const PAINT: Record<Person, string> = { you: 'yellow', partner: 'pink' };

function SizePick({ onPick, label }: { onPick: (n: 6 | 10) => void; label: string }) {
  return (
    <div className="pong-size">
      <button type="button" className="neon-btn" onClick={() => onPick(10)}>
        {label} · 10 bekers
      </button>
      <button type="button" className="pong-size__quick" onClick={() => onPick(6)}>
        Snel potje · 6 bekers
      </button>
    </div>
  );
}

function Status({ s, names }: { s: PongState; names: Record<Side, string> }) {
  const chips: string[] = [];
  if (s.fire) chips.push(`🔥 ${names[s.fire]} on fire`);
  if (s.redemption)
    chips.push(`⏳ Laatste kans voor ${names[s.redemption] === 'Jij' ? 'jou' : names[s.redemption]}`);
  if (s.overtime) chips.push('⚡ Overtime');
  if (!chips.length) return null;
  return (
    <p className="pong-status">
      {chips.map((c) => (
        <span key={c}>{c}</span>
      ))}
    </p>
  );
}

/** Against Coco, or two on one phone. */
function LocalGame({ vsCoco }: { vsCoco: boolean }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const [state, setState] = useState<PongState>(() => newPong(10));
  const [turn, setTurn] = useState<Side>('you');
  const [busy, setBusy] = useState(false);
  const { hint, say } = useHint();
  const names: Record<Side, string> = vsCoco
    ? { you: 'Jij', partner: 'Coco' }
    : { you: profile.yourName, partner: profile.partnerName };
  const winner = state.winner ?? null;
  const target: Side = turn === 'you' ? 'partner' : 'you';
  const room = useRef<HTMLDivElement>(null);

  const landed = (l: Landing, t: Throw) => {
    if (state.winner) return;
    const out = applyThrow(state, turn, l, t);
    setState(out.state);
    const text = newsText(
      out.news,
      names[turn],
      names[target],
      !vsCoco || turn === 'you',
      left(out.state, target),
      l,
    );
    if (text) say(text);
    if (out.won) {
      const w = out.state.winner!;
      if (vsCoco) recordResult('pong', [me, 'coco'], w === 'you' ? me : 'coco');
      else recordResult('pong', ['you', 'partner'], w);
      if (!(vsCoco && w === 'partner')) {
        playSfx('success', true);
        celebrateFrom(room.current);
      } else playSfx('coin', true);
      return;
    }
    if (out.news.includes('fire')) playSfx('star', true);
    if (out.turnOver) {
      setBusy(true);
      window.setTimeout(() => {
        setTurn(target);
        setBusy(false);
      }, 900);
    }
  };

  const fresh = (n: 6 | 10) => {
    setState(newPong(n));
    setTurn('you');
  };

  const balls = state.redemption === turn ? 'tot je mist' : state.fire === turn ? '🔥 tot je mist' : `nog ${state.balls} ${state.balls === 1 ? 'bal' : 'ballen'}`;
  return (
    <>
      <TurnBanner
        mine={!vsCoco || turn === 'you'}
        name="Coco 🐰"
        note={`${vsCoco ? 'Jij' : names[turn]} gooit · ${balls}`}
        done={
          winner
            ? vsCoco
              ? winner === 'you'
                ? 'Alle bekers van Coco geraakt — jij wint! 🎉'
                : 'Coco raakte al jouw bekers 🐰🍻'
              : `${names[winner]} wint! 🎉`
            : undefined
        }
      />
      <div className="pong-racks">
        <Rack cups={cupsOf(state, 'you')} label={names.you} paint={vsCoco ? PAINT[me] : 'yellow'} active={target === 'you'} />
        <Rack cups={cupsOf(state, 'partner')} label={names.partner} paint={vsCoco ? 'caramel' : 'pink'} active={target === 'partner'} />
      </div>
      <Status s={state} names={names} />
      <div className="pong-room" ref={room}>
        <Table
          cups={cupsOf(state, target)}
          canThrow={!winner && !busy && (!vsCoco || turn === 'you')}
          cocoThrowing={vsCoco && turn === 'partner' && !winner && !busy}
          cocoKey={state.throws}
          onLanded={landed}
          fire={state.fire === turn}
          rival={vsCoco ? (turn === 'you' ? '🐰' : '🙈') : turn === 'you' ? '💗' : '💛'}
          tint={turn === 'you' ? '#ff5fa2' : '#ffc61a'}
          hint={say}
        />
        <p className="pong-label">
          {vsCoco && turn === 'partner' ? 'Coco gooit naar jouw bekers…' : `Bekers van ${names[target]}`}
        </p>
        <Hint hint={hint} />
      </div>
      <p className="pong-help">Veeg omhoog: hoe langer, hoe verder · schuin = opzij. Het ✕ laat zien waar je vorige bal neerkwam.</p>
      <SizePick label={winner ? 'Nog een potje' : 'Opnieuw'} onPick={fresh} />
    </>
  );
}

/** Each on our own phone: every ball travels through the sync. */
function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('pong');
  const state = normalizePong(match?.state);
  const { hint, say } = useHint();
  const mine = Boolean(match && !match.winner && match.turn === me);
  const names: Record<Side, string> = { you: profile.yourName, partner: profile.partnerName };
  /** The last throw we've seen (null: the match hasn't loaded yet). */
  const seen = useRef<number | null>(match ? (state.last?.n ?? 0) : null);
  const [watching, setWatching] = useState<LastThrow | null>(null);
  const room = useRef<HTMLDivElement>(null);

  // Their ball came in: watch it fly into your cups.
  useEffect(() => {
    const l = state.last;
    if (seen.current === null) {
      seen.current = l?.n ?? 0;
      return;
    }
    if (!l || l.n === seen.current) return;
    const fresh = l.n > seen.current;
    seen.current = l.n;
    if (fresh && l.by !== me) setWatching(l);
  }, [state.last?.n, Boolean(match)]);

  const start = (n: 6 | 10) => startMatch('pong', { ...newPong(n) }, them, me);
  if (!match)
    return (
      <div className="game-panel">
        <p>
          Start een potje — {nameOf(them, profile)} gooit eerst. Twee ballen per beurt; allebei raak = ballen terug.
          Bounce = twee bekers, drie op rij = on fire 🔥
        </p>
        <SizePick label="Nieuw potje" onPick={start} />
      </div>
    );

  const landed = (l: Landing, t: Throw) => {
    if (match.winner || match.turn !== me) return;
    const out = applyThrow(state, me, l, t);
    seen.current = out.state.last?.n ?? seen.current;
    const text = newsText(out.news, nameOf(me, profile), nameOf(them, profile), true, left(out.state, them), l);
    if (text) say(text);
    if (out.won) {
      if (out.state.winner === me) {
        playSfx('success', true);
        celebrateFrom(room.current);
      } else playSfx('coin', true);
    } else if (out.news.includes('fire')) playSfx('star', true);
    updateMatch(match.id, (m) => ({
      ...m,
      state: { ...out.state },
      turn: out.won ? undefined : out.turnOver ? them : me,
      winner: out.won ? out.state.winner : undefined,
    }));
  };

  const replayDone = () => {
    const l = watching;
    setWatching(null);
    if (!l) return;
    if (l.hit.length) say(l.bounce ? `🏓 Bounce shot van ${nameOf(them, profile)} — twee bekers!` : `💦 ${nameOf(them, profile)} raakte je beker!`);
    else say(`${nameOf(them, profile)} gooide mis 😮‍💨`);
  };

  const target: Side = watching ? me : mine ? them : me;
  const before = watching ? beforeCups(watching) : null;
  const done = Boolean(match.winner) && !watching;
  return (
    <>
      <TurnBanner
        mine={mine && !watching}
        name={nameOf(them, profile)}
        note={`Jij gooit · ${state.redemption === me ? 'laatste kans: tot je mist' : state.fire === me ? '🔥 tot je mist' : `nog ${state.balls} ${state.balls === 1 ? 'bal' : 'ballen'}`}`}
        done={
          done
            ? match.winner === me
              ? 'Al hun bekers geraakt — jij wint! 🎉'
              : `${nameOf(match.winner as Person, profile)} wint dit potje 🍻`
            : undefined
        }
      />
      <div className="pong-racks">
        <Rack cups={cupsOf(state, 'you')} label={names.you} paint="yellow" active={target === 'you'} />
        <Rack cups={cupsOf(state, 'partner')} label={names.partner} paint="pink" active={target === 'partner'} />
      </div>
      <Status s={state} names={names} />
      <div className="pong-room" ref={room}>
        <Table
          cups={before ?? cupsOf(state, target)}
          canThrow={mine && !watching}
          onLanded={landed}
          replay={watching ? { key: watching.n, throw: watching.throw, before: before!, hit: watching.hit } : null}
          onReplayed={replayDone}
          fire={state.fire === (mine ? me : them)}
          rival={mine ? (them === 'partner' ? '💗' : '💛') : '👀'}
          tint={them === 'partner' ? '#ff5fa2' : '#ffc61a'}
          hint={say}
        />
        <p className="pong-label">
          {watching
            ? `${names[them]} gooit naar jouw bekers…`
            : mine
              ? `Bekers van ${names[them]}`
              : `Jouw bekers — ${names[them]} is aan de beurt`}
        </p>
        <Hint hint={hint} />
      </div>
      <p className="pong-help">Veeg omhoog: hoe langer, hoe verder · schuin = opzij. Het ✕ laat zien waar je vorige bal neerkwam.</p>
      {done && <SizePick label="Nog een potje" onPick={start} />}
    </>
  );
}

export function BeerPong() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'pong', 'you', 'partner');
  const coco = headToHead(results, 'pong', me, 'coco');
  return (
    <GameShell
      id="pong"
      title="Beer pong"
      mode={mode}
      onMode={setMode}
      modes={['remote', 'coco', 'local']}
      score={
        mode === 'coco' ? (
          <ScoreBoard
            label="jij tegen coco"
            entries={[
              { name: 'JIJ', value: coco.a, me: true },
              { name: 'COCO', value: coco.b },
            ]}
          />
        ) : (
          <ScoreBoard
            label="gewonnen"
            entries={[
              { name: `${profile.yourName.toUpperCase()} 💛`, value: h.a, me: me === 'you' },
              { name: `${profile.partnerName.toUpperCase()} 💗`, value: h.b, me: me === 'partner' },
            ]}
          />
        )
      }
    >
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteGame />
        </WhoAreYou>
      ) : (
        <LocalGame key={mode} vsCoco={mode === 'coco'} />
      )}
    </GameShell>
  );
}
