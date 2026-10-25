import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import {
  BALLS,
  BOARD_Q,
  CORNERS,
  MIN_POWER,
  RINGS,
  RING_CENTER,
  cocoRolls,
  landing,
  meterAt,
  strokeSpeed,
  powerOfFlick,
  type Landing,
} from './skee';

/* -------------------------------------------------------------- the view */

/** A camera behind the player, looking up the lane. World: x across (lane is 2 wide), z up the lane, y up. */
const LANE_Z = 3;
const rise = (z: number) => Math.min(z, LANE_Z) * 0.12;
const BALL_R = 0.16;

function camera(w: number, h: number) {
  const z0 = 2.1;
  const camH = 2.3;
  const f = (w * 0.46 * z0) / 1;
  const hy = h * 0.97 - (camH * f) / z0;
  return (x: number, y: number, z: number) => {
    const s = f / (z + z0);
    return { x: w / 2 + x * s, y: hy + (camH - y) * s, s };
  };
}

/** A point on the target board (u across, q up the board) in world coordinates. */
const board = (u: number, q: number) => {
  const t = q / BOARD_Q;
  return { x: u, z: LANE_Z + 0.2 + t * 0.6, y: rise(LANE_Z) + 0.14 + t * 3.1 };
};

type Phase = 'ready' | 'roll' | 'air' | 'drop' | 'back';

interface Throw {
  start: number;
  power: number;
  from: number;
  land: Landing | null;
}

/** Where the ball is at time `ms` into a throw, and which part of the throw that is. */
function ballAt(th: Throw, ms: number) {
  const tRoll = 820 - Math.min(1, th.power) * 360;
  const tAir = 380;
  const tDrop = 420;
  if (!th.land) {
    // too soft: up the lane, and back down to us
    const top = LANE_Z * 0.85 * Math.max(0.15, th.power / MIN_POWER);
    const k = Math.min(1, ms / (tRoll * 1.8));
    const z = top * Math.sin(k * Math.PI);
    return {
      phase: (k >= 1 ? 'ready' : 'back') as Phase,
      x: th.from,
      y: rise(z) + BALL_R,
      z,
      done: k >= 1,
    };
  }
  const land = th.land;
  const lb = board(land.u, land.q);
  if (ms < tRoll) {
    const k = ms / tRoll;
    const z = LANE_Z * (1 - (1 - k) ** 1.7);
    const x = th.from + (land.u - th.from) * k * 0.7;
    return { phase: 'roll' as Phase, x, y: rise(z) + BALL_R, z, done: false };
  }
  if (ms < tRoll + tAir) {
    const k = (ms - tRoll) / tAir;
    const sx = th.from + (land.u - th.from) * 0.7;
    const x = sx + (land.u - sx) * k;
    const z = LANE_Z + (lb.z - LANE_Z) * k;
    const y = rise(LANE_Z) + BALL_R + (lb.y - rise(LANE_Z)) * k + Math.sin(k * Math.PI) * 0.55;
    return { phase: 'air' as Phase, x, y, z, done: false };
  }
  const k = Math.min(1, (ms - tRoll - tAir) / tDrop);
  const hole = board(land.hole.u, land.hole.q);
  const e = 1 - (1 - k) ** 2;
  return {
    phase: 'drop' as Phase,
    x: lb.x + (hole.x - lb.x) * e,
    y: lb.y + (hole.y - lb.y) * e + BALL_R * (1 - k),
    z: lb.z + (hole.z - lb.z) * e,
    done: k >= 1,
    sink: Math.max(0, (k - 0.6) / 0.4),
  };
}

const RING_COLORS: Record<number, [string, string]> = {
  10: ['#ff8cc0', '#7a1f45'],
  20: ['#ff5fa2', '#5c1236'],
  30: ['#b07bff', '#3e1d70'],
  40: ['#5ff3ff', '#0f4a5c'],
  50: ['#ffd75e', '#6b4a0a'],
  100: ['#ffd75e', '#6b4a0a'],
};

/** A circle on the board, drawn in perspective. */
function boardCircle(
  ctx: CanvasRenderingContext2D,
  P: ReturnType<typeof camera>,
  cu: number,
  cq: number,
  r: number,
) {
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const b = board(cu + Math.cos(a) * r, cq + Math.sin(a) * r);
    const p = P(b.x, b.y, b.z);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
}

function drawMachine(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  now: number,
  reduce: boolean,
) {
  const P = camera(w, h);
  // the arcade behind
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#120720');
  bg.addColorStop(1, '#2a1240');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // the cabinet walls along the lane
  const wall = (side: -1 | 1) => {
    const a = P(side * 1.18, 0, 0);
    const b = P(side * 1.18, rise(LANE_Z) + 3.6, LANE_Z + 0.85);
    const c = P(side * 1.18, rise(LANE_Z) + 0.3, LANE_Z + 0.85);
    const g = ctx.createLinearGradient(a.x, 0, w / 2, 0);
    g.addColorStop(0, '#3b1a5c');
    g.addColorStop(1, '#1d0c30');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(side < 0 ? 0 : w, h);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(side < 0 ? 0 : w, 0);
    ctx.closePath();
    ctx.fill();
    // chasing bulbs along the top rail
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      const p = P(side * 1.18, 0.75 + (rise(LANE_Z) + 0.3 - 0.75) * k, LANE_Z * k + 0.85 * k);
      const on = reduce ? i % 2 === 0 : Math.floor(now / 140 + i) % 3 === 0;
      ctx.fillStyle = on ? '#ffd75e' : '#5a4630';
      ctx.shadowColor = '#ffd75e';
      ctx.shadowBlur = on ? 12 : 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.6, p.s * 0.05), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  };
  wall(-1);
  wall(1);

  // the marquee
  const top = P(0, rise(LANE_Z) + 3.6, LANE_Z + 0.85);
  ctx.save();
  ctx.font = `900 ${Math.round(w * 0.085)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const flicker = reduce || Math.sin(now / 900) > -0.95 ? 1 : 0.4;
  ctx.globalAlpha = flicker;
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 18;
  ctx.fillText('SKEE·BALL ♡', w / 2, Math.max(h * 0.06, top.y - h * 0.09));
  ctx.restore();

  // the net behind the board
  const n1 = P(-1.1, rise(LANE_Z) + 3.6, LANE_Z + 0.9);
  const n2 = P(1.1, rise(LANE_Z) + 0.2, LANE_Z + 0.9);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = n1.x; x <= n2.x; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, n1.y);
    ctx.lineTo(x, n2.y);
    ctx.stroke();
  }

  // the target board
  const corners = [board(-1, 0), board(1, 0), board(1, BOARD_Q), board(-1, BOARD_Q)].map((b) =>
    P(b.x, b.y, b.z),
  );
  const bg2 = ctx.createLinearGradient(0, corners[2].y, 0, corners[0].y);
  bg2.addColorStop(0, '#2a1446');
  bg2.addColorStop(1, '#43205f');
  ctx.fillStyle = bg2;
  ctx.beginPath();
  corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ff5fa2';
  ctx.shadowColor = '#ff5fa2';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // rings, outer to inner, each a glowing band with its number
  const label = (text: string, u: number, q: number, color: string, size = 0.2) => {
    const b = board(u, q);
    const p = P(b.x, b.y, b.z);
    ctx.font = `900 ${Math.max(8, Math.round(p.s * size))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, p.x, p.y);
  };
  // the big 10 trough at the bottom
  boardCircle(ctx, P, 0, 0.42, 0.34);
  ctx.fillStyle = '#1a0a24';
  ctx.fill();
  ctx.strokeStyle = RING_COLORS[10][0];
  ctx.lineWidth = 2;
  ctx.stroke();
  label('10', -0.62, 0.42, RING_COLORS[10][0]);
  label('10', 0.62, 0.42, RING_COLORS[10][0]);
  for (const ring of [...RINGS].reverse()) {
    const [glow, deep] = RING_COLORS[ring.v];
    boardCircle(ctx, P, RING_CENTER.u, RING_CENTER.q, ring.r);
    ctx.fillStyle = deep;
    ctx.fill();
    ctx.strokeStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  // the holes, dark and deep
  const hole = (u: number, q: number, r: number) => {
    boardCircle(ctx, P, u, q, r);
    const p = P(board(u, q).x, board(u, q).y, board(u, q).z);
    const g = ctx.createRadialGradient(p.x, p.y - 2, 1, p.x, p.y, Math.max(2, r * p.s));
    g.addColorStop(0, '#000');
    g.addColorStop(1, '#2b1424');
    ctx.fillStyle = g;
    ctx.fill();
  };
  RINGS.forEach((ring, i) => {
    const inner = i ? RINGS[i - 1].r : 0;
    const q = RING_CENTER.q - (ring.v === 50 ? 0 : (inner + ring.r) / 2);
    hole(0, q, ring.v === 50 ? 0.13 : 0.08);
    // the number on both sides of its band, like on a real machine
    if (ring.v === 50) label('50', 0, RING_CENTER.q + 0.15, '#fff7d6');
    else
      for (const side of [-1, 1])
        label(
          String(ring.v),
          side * ((inner + ring.r) / 2),
          RING_CENTER.q,
          RING_COLORS[ring.v][0],
          0.12,
        );
  });
  hole(0, 0.42, 0.1);
  for (const c of CORNERS) {
    boardCircle(ctx, P, c.u, c.q, c.r + 0.04);
    ctx.fillStyle = RING_COLORS[100][1];
    ctx.fill();
    ctx.strokeStyle = RING_COLORS[100][0];
    ctx.shadowColor = RING_COLORS[100][0];
    ctx.shadowBlur = reduce ? 6 : 6 + 6 * Math.abs(Math.sin(now / 300));
    ctx.stroke();
    ctx.shadowBlur = 0;
    hole(c.u, c.q, c.r - 0.03);
    label('100', c.u, c.q - c.r - 0.12, RING_COLORS[100][0]);
  }

  // the lane: wooden planks rising to the hump
  const l0 = P(-1, 0, 0);
  const l1 = P(1, 0, 0);
  const l2 = P(1, rise(LANE_Z), LANE_Z);
  const l3 = P(-1, rise(LANE_Z), LANE_Z);
  const wood = ctx.createLinearGradient(0, l3.y, 0, l0.y);
  wood.addColorStop(0, '#8a4f22');
  wood.addColorStop(1, '#e8a95e');
  ctx.fillStyle = wood;
  ctx.beginPath();
  ctx.moveTo(l0.x, l0.y);
  ctx.lineTo(l1.x, l1.y);
  ctx.lineTo(l2.x, l2.y);
  ctx.lineTo(l3.x, l3.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,30,10,0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    const x = -1 + (i / 8) * 2;
    const a = P(x, 0, 0);
    const b = P(x, rise(LANE_Z), LANE_Z);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // a soft shine down the middle
  const shine = ctx.createLinearGradient(l0.x, 0, l1.x, 0);
  shine.addColorStop(0, 'rgba(255,255,255,0)');
  shine.addColorStop(0.5, 'rgba(255,240,220,0.22)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fill();
  // neon rails
  ctx.strokeStyle = '#5ff3ff';
  ctx.shadowColor = '#5ff3ff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(l0.x, l0.y);
  ctx.lineTo(l3.x, l3.y);
  ctx.moveTo(l1.x, l1.y);
  ctx.lineTo(l2.x, l2.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // the hump
  const h0 = P(-1, rise(LANE_Z) + 0.12, LANE_Z);
  const h1 = P(1, rise(LANE_Z) + 0.12, LANE_Z);
  ctx.fillStyle = '#6b3618';
  ctx.fillRect(h0.x, h0.y, h1.x - h0.x, Math.max(4, l3.y - h0.y));
  ctx.fillStyle = 'rgba(255,220,180,0.35)';
  ctx.fillRect(h0.x, h0.y, h1.x - h0.x, 2);
  return P;
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  P: ReturnType<typeof camera>,
  x: number,
  y: number,
  z: number,
  spin: number,
  sink = 0,
) {
  const p = P(x, y, z);
  const ground = P(x, z <= LANE_Z ? rise(z) : y - BALL_R, z);
  const r = Math.max(2, BALL_R * p.s * (1 - sink * 0.8));
  ctx.save();
  ctx.globalAlpha = 1 - sink * 0.7;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(ground.x, ground.y, r, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(p.x - r / 3, p.y - r / 3, 1, p.x, p.y, r);
  g.addColorStop(0, '#fff6fb');
  g.addColorStop(0.55, '#ff8fc0');
  g.addColorStop(1, '#9c2456');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  // a little heart on the ball, turning as it rolls
  const hy = Math.sin(spin) * r * 0.45;
  if (Math.cos(spin) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `${Math.round(r * 0.8)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♥', p.x, p.y + hy);
  }
  ctx.restore();
  return p;
}

const HINT = 'Veeg de bal omhoog ↑ — of houd vast en laat los als de meter goed staat';

export function Skeeball() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const best = useBest('skeeball');
  const [mode, setMode] = useState<PlayMode>('remote');
  const [left, setLeft] = useState(BALLS);
  const [score, setScore] = useState(0);
  const [last, setLast] = useState(HINT);
  const [pops, setPops] = useState<{ id: number; v: number; x: number; y: number }[]>([]);
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const duel = useDuelRound('skeeball', mode);
  const duelNow = useRef(duel);
  duelNow.current = duel;
  const [handOver, setHandOver] = useState(false);
  const shot = useRef<Throw | null>(null);
  const aim = useRef(0);
  const drag = useRef<{ x: number; y: number; t: number }[]>([]);
  const hold = useRef<number | null>(null);
  const size = useRef({ w: 300, h: 480 });
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const leftRef = useRef(left);
  leftRef.current = left;

  useEffect(() => {
    const resize = () => {
      const c = canvas.current;
      const box = wrap.current;
      if (!c || !box) return;
      const w = box.clientWidth;
      const h = Math.min(window.innerHeight * 0.62, w * 1.5);
      const dpr = window.devicePixelRatio || 1;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w, h };
    };
    resize();
    wrap.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let raf = 0;
    let spin = 0;
    const draw = (now: number) => {
      const ctx = canvas.current?.getContext('2d');
      if (!ctx) return;
      const { w, h } = size.current;
      ctx.clearRect(0, 0, w, h);
      const P = drawMachine(ctx, w, h, now, reduce);
      const th = shot.current;

      if (th) {
        const b = ballAt(th, now - th.start);
        spin += b.phase === 'roll' || b.phase === 'back' ? 0.35 : 0.1;
        const p = drawBall(ctx, P, b.x, b.y, b.z, spin, 'sink' in b ? b.sink : 0);
        if (b.done) {
          shot.current = null;
          const v = th.land?.value ?? 0;
          setScore((n) => n + v);
          if (v > 0)
            setPops((all) => [...all, { id: now, v, x: (p.x / w) * 100, y: (p.y / h) * 100 }]);
          const pct = Math.round(Math.min(1.3, th.power) * 100);
          setLast(
            v === 0
              ? `Te zacht (${pct}%) — hij rolde terug 🙃`
              : `${v >= 100 ? '100!!! 🤯✨' : v >= 50 ? `${v}! 🎯` : `${v}`} · kracht ${pct}%`,
          );
          playSfx(v === 0 ? 'boing' : 'clunk', true);
          if (v > 0) window.setTimeout(() => playSfx(v >= 50 ? 'star' : 'coin', true), 140);
          if (v >= 50) celebrateFrom(canvas.current);
        }
      } else if (leftRef.current > 0) {
        // the next ball, waiting at our end of the lane
        const p0 = drawBall(ctx, P, aim.current, BALL_R, 0.15, spin);
        // where it will go
        if (drag.current.length) {
          ctx.strokeStyle = 'rgba(95,243,255,0.55)';
          ctx.setLineDash([4, 5]);
          ctx.lineWidth = 2;
          const far = P(aim.current * 0.85, rise(LANE_Z), LANE_Z);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(far.x, far.y);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // the hold-and-release meter
        if (hold.current !== null) {
          const m = meterAt(now - hold.current);
          const mx = w - 26;
          const mh = h * 0.42;
          const my = h * 0.5;
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(mx - 8, my - mh / 2, 16, mh);
          const g = ctx.createLinearGradient(0, my + mh / 2, 0, my - mh / 2);
          g.addColorStop(0, '#5ff3ff');
          g.addColorStop(0.55, '#ffd75e');
          g.addColorStop(1, '#ff5fa2');
          ctx.fillStyle = g;
          ctx.fillRect(mx - 6, my + mh / 2 - m * mh, 12, m * mh);
          // the sweet spot for the 50
          const sweet = (0.539 - 0.05) / 0.95;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(mx - 11, my + mh / 2 - sweet * mh);
          ctx.lineTo(mx + 11, my + mh / 2 - sweet * mh);
          ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = '700 10px system-ui';
          ctx.textAlign = 'right';
          ctx.fillText('50', mx - 13, my + mh / 2 - sweet * mh + 3);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  // When the last ball has landed: tickets, the record, and Coco's turn.
  const finished = useRef(false);
  useEffect(() => {
    if (left > 0 || finished.current) return;
    const t = window.setTimeout(() => {
      if (shot.current) return;
      finished.current = true;
      const total = scoreRef.current;
      playSfx('success', true);
      if (mode !== 'coco') {
        // Against each other: a duel (apart), or the second round settles it (one phone).
        const end = duelNow.current.finish(total);
        setLast(end.text);
        setTickets(end.tickets);
        setHandOver(Boolean(end.handOver));
        if (end.tickets) celebrateFrom(canvas.current);
        return;
      }
      if (getAuthor()) addScore('skeeball', total);
      setLast('Coco is aan de beurt… 🐰');
      const rolls = cocoRolls();
      let shown = 0;
      let sum = 0;
      const tick = window.setInterval(() => {
        sum += rolls[shown];
        shown += 1;
        setCocoScore(sum);
        playSfx(rolls[shown - 1] >= 50 ? 'star' : 'coin', true);
        if (shown >= BALLS) {
          window.clearInterval(tick);
          addScore('skeeball', sum, 'coco');
          const winner = total > sum ? me : total < sum ? 'coco' : 'draw';
          recordResult('skeeball', [me, 'coco'], winner);
          setLast(
            winner === me
              ? `Jij wint! ${total} tegen ${sum} 🎉`
              : winner === 'coco'
                ? `Coco wint met ${sum} tegen ${total} 🐰👑`
                : `Gelijk! ${total}–${sum}`,
          );
        }
      }, 380);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [left, mode, me]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
  };

  /** Where the finger is across the lane, as an aim (-0.85 … 0.85). */
  const aimAt = (x: number) => {
    const { w, h } = size.current;
    const p = camera(w, h)(0, 0, 0.15);
    return Math.max(-0.85, Math.min(0.85, (x - p.x) / p.s));
  };

  const throwBall = (power: number, drift: number) => {
    const from = aim.current;
    const land = landing(power, from + drift, Math.random() * 2 - 1);
    shot.current = { start: performance.now(), power, from, land };
    setLeft((n) => n - 1);
    playSfx('roll', true);
  };

  const onDown = (e: React.PointerEvent) => {
    if (shot.current || left <= 0) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = pos(e);
    drag.current = [p];
    aim.current = aimAt(p.x);
    // still holding after a moment: the power meter starts
    const t0 = p.t;
    window.setTimeout(() => {
      const d = drag.current;
      if (d.length && d[0].t === t0 && d[0].y - d[d.length - 1].y < 14)
        hold.current = performance.now();
    }, 320);
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.length) return;
    const p = pos(e);
    d.push(p);
    if (d.length > 80) d.splice(1, 1);
    // slide sideways to aim, until the flick starts
    if (d[0].y - p.y < 12 || hold.current !== null) aim.current = aimAt(p.x);
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = [];
    const held = hold.current;
    hold.current = null;
    if (!d.length || shot.current || left <= 0) return;
    d.push(pos(e));
    const up = d[0].y - d[d.length - 1].y;
    const speed = strokeSpeed(d, size.current.h);
    if (up > 24 && speed > 0.8) {
      const lastP = d[d.length - 1];
      const mid = d[Math.max(0, d.length - 6)];
      const drift = Math.max(
        -0.5,
        Math.min(0.5, ((lastP.x - mid.x) / Math.max(20, mid.y - lastP.y)) * 0.6),
      );
      throwBall(powerOfFlick(speed), drift);
    } else if (held !== null) {
      throwBall(0.05 + meterAt(performance.now() - held) * 0.95, 0);
    } else {
      setLast(HINT);
    }
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    setHandOver(false);
    setLeft(BALLS);
    setScore(0);
    setPops([]);
    setTickets(null);
    setCocoScore(null);
    shot.current = null;
    finished.current = false;
    setLast(HINT);
  };

  return (
    <GameShell
      id="skeeball"
      title="Skeeball"
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
      <DuelPanel kind="skeeball" mode={mode} first={duel.first} result={duel.result} />
      <div className="skee-status">
        <span className="skee-digits" aria-label={`Score ${score}`}>
          {String(score).padStart(3, '0')}
        </span>
        {cocoScore !== null && (
          <span className="skee-digits skee-digits--coco" aria-label={`Coco ${cocoScore}`}>
            🐰 {String(cocoScore).padStart(3, '0')}
          </span>
        )}
        <span className="skee-balls" role="img" aria-label={`${left} ballen over`}>
          {Array.from({ length: BALLS }, (_, i) => (
            <span key={i} className={`skee-ball ${i < left ? '' : 'is-used'}`} />
          ))}
        </span>
      </div>
      <p className="game-turn is-mine" aria-live="polite">
        {last}
      </p>
      <div className="skee" ref={wrap}>
        <canvas
          ref={canvas}
          className="skee__canvas"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => {
            drag.current = [];
            hold.current = null;
          }}
          role="img"
          aria-label="Skeeball: schuif opzij om te mikken, veeg omhoog om te gooien, of houd vast en laat los bij de juiste kracht."
        />
        <AnimatePresence>
          {pops.map((p) => (
            <motion.span
              key={p.id}
              className={`skee-pop ${p.v >= 50 ? 'is-big' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: -60, scale: 1.1 }}
              transition={{ duration: 1.2 }}
              onAnimationComplete={() => setPops((all) => all.filter((x) => x.id !== p.id))}
            >
              +{p.v}
            </motion.span>
          ))}
        </AnimatePresence>
        <AnimatePresence>
          {tickets !== null && (
            <motion.div
              className="skee-tickets"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {Array.from({ length: Math.min(tickets, 12) }, (_, i) => (
                <motion.span
                  key={i}
                  className="skee-ticket"
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: i * 0.08 }}
                >
                  🎟️
                </motion.span>
              ))}
              <strong>{tickets} tickets!</strong>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="game-hint">
        Tip: schuif je vinger opzij om te mikken. De 100 zit in de hoeken bovenaan.
      </p>
      {handOver && left === 0 ? (
        <button type="button" className="neon-btn" onClick={() => restart(true)}>
          Nu {nameOf(duel.player, profile)} ▶
        </button>
      ) : (
        <button type="button" className="neon-btn" onClick={() => restart()}>
          {left === 0 ? 'Nog een keer' : 'Opnieuw beginnen'}
        </button>
      )}
    </GameShell>
  );
}
