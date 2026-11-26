import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { RoundCard } from './RoundCard';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { planDuel } from './duel';
import {
  CRUMBLE,
  R,
  W,
  ZONES,
  blinkState,
  cocoSteer,
  meters,
  newWorld,
  platX,
  score,
  seedOf,
  step,
  zoneAt,
  type Hopper,
  type LavaEvent,
  type Plat,
  type World,
} from './lava';
import './lava.css';

const H = 600;
/** Where the camera's bottom sits on screen. */
const FLOOR = 140;
const sy = (w: World, y: number) => H - (y - w.cam) - FLOOR;

type Who = Person | 'coco';
const LOOK: Record<Who, { body: string; dark: string; cheek: string }> = {
  you: { body: '#ffc61a', dark: '#c48f00', cheek: '#ff8a5c' },
  partner: { body: '#ff5fa2', dark: '#c22f72', cheek: '#ffb3d1' },
  coco: { body: '#f6efe7', dark: '#b9a898', cheek: '#ffb3c6' },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  text?: string;
}

/* --------------------------------------------------------------- colours */

function mix(a: string, b: string, k: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}

/** The sky at this height: blends from one zone into the next. */
function skyAt(m: number): [string, string, number] {
  const z = zoneAt(m);
  const a = ZONES[z];
  const b = ZONES[Math.min(ZONES.length - 1, z + 1)];
  const span = b.at - a.at || 1;
  const k = z === ZONES.length - 1 ? 0 : Math.max(0, Math.min(1, (m - a.at - span * 0.7) / (span * 0.3)));
  return [mix(a.sky[0], b.sky[0], k), mix(a.sky[1], b.sky[1], k), z];
}

/* -------------------------------------------------------------- drawing */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawPlat(ctx: CanvasRenderingContext2D, w: World, p: Plat, now: number) {
  const x = platX(p, w.t);
  let y = sy(w, p.y);
  const half = p.w / 2;
  if (y < -30 || y > H + 30) return;
  const blink = blinkState(p, w.t);
  ctx.save();
  if (p.kind === 'blink') {
    if (!blink.on) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = 'rgba(95,243,255,0.35)';
      ctx.lineWidth = 2;
      roundRect(ctx, x - half, y, p.w, 12, 6);
      ctx.stroke();
      ctx.restore();
      return;
    }
    ctx.globalAlpha = blink.warn ? 0.35 + 0.6 * Math.abs(Math.sin(now / 45)) : 0.92;
  }
  if (p.kind === 'crumble' && p.hit !== null) {
    const k = w.t - p.hit;
    if (k > CRUMBLE) {
      const fall = (k - CRUMBLE) * (k - CRUMBLE) * 900;
      y += fall;
      ctx.globalAlpha = Math.max(0, 1 - (k - CRUMBLE) * 1.2);
    } else ctx.translate(Math.sin(now / 20) * 2, 0);
  }
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x - half + 3, y + 5, p.w, 13, 6);
  ctx.fill();
  const colors: Record<string, [string, string]> = {
    normal: ['#8a7466', '#6b5649'],
    crumble: ['#e8b877', '#b9874a'],
    move: ['#6f9be6', '#3f67b0'],
    blink: ['#7ff6ff', '#2bb8c9'],
    spring: ['#8a7466', '#6b5649'],
  };
  const [top, bottom] = colors[p.kind];
  const g = ctx.createLinearGradient(0, y, 0, y + 14);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  roundRect(ctx, x - half, y, p.w, 14, 6);
  ctx.fill();
  if (p.kind === 'normal' || p.kind === 'spring') {
    // a mossy top
    ctx.fillStyle = '#74d34f';
    roundRect(ctx, x - half, y - 2, p.w, 6, 3);
    ctx.fill();
    ctx.fillStyle = '#4fae35';
    for (let i = 6; i < p.w - 4; i += 9) ctx.fillRect(x - half + i, y + 3, 3, 2);
  }
  if (p.kind === 'crumble') {
    ctx.strokeStyle = 'rgba(110,70,30,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const cx = x - half + (p.w * i) / 4;
      ctx.moveTo(cx, y + 1);
      ctx.lineTo(cx - 4, y + 7);
      ctx.lineTo(cx + 2, y + 13);
    }
    ctx.stroke();
  }
  if (p.kind === 'move') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('‹  ›', x, y + 7);
    ctx.fillStyle = '#d9e6ff';
    for (const dx of [-half + 6, half - 6]) {
      ctx.beginPath();
      ctx.arc(x + dx, y + 7, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (p.kind === 'blink') {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    roundRect(ctx, x - half + 4, y + 2, p.w - 8, 3, 2);
    ctx.fill();
  }
  if (p.kind === 'spring') {
    ctx.strokeStyle = '#d9dde3';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) ctx.lineTo(x + (i % 2 ? 6 : -6), y - 3 - i * 3);
    ctx.stroke();
    ctx.fillStyle = '#ff4f6d';
    roundRect(ctx, x - 11, y - 19, 22, 6, 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawHopper(ctx: CanvasRenderingContext2D, w: World, p: Hopper, name: string, now: number) {
  const look = LOOK[(p.who as Who) in LOOK ? (p.who as Who) : 'you'];
  const x = p.x;
  const y = sy(w, p.y);
  if (!p.alive) {
    // a little ghost floats up out of the lava
    const k = p.diedAt !== null ? w.t - p.diedAt : 9;
    if (k < 1.8) {
      ctx.save();
      ctx.globalAlpha = 1 - k / 1.8;
      ctx.font = '26px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👻', x + Math.sin(k * 6) * 6, sy(w, w.lava) - 20 - k * 60);
      ctx.restore();
    }
    return;
  }
  const since = w.t - p.bounced;
  const squash = Math.exp(-since * 14) * 0.3;
  const stretch = Math.max(0, Math.min(0.18, p.vy / 5000));
  const sx = 1 + squash - stretch * 0.5;
  const syk = 1 - squash + stretch;
  ctx.save();
  ctx.translate(x, y + R * (1 - syk));
  ctx.scale(sx, syk);
  // body
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.2, 0, 0, R * 1.1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, look.body);
  g.addColorStop(1, look.dark);
  if (p.who === 'coco') {
    // ears
    for (const s of [-1, 1]) {
      ctx.fillStyle = look.body;
      ctx.beginPath();
      ctx.ellipse(s * 6, -R - 8, 4.5, 11, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffb3c6';
      ctx.beginPath();
      ctx.ellipse(s * 6, -R - 8, 2, 7, s * 0.15, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // a little tuft
    ctx.strokeStyle = look.dark;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -R + 1);
    ctx.quadraticCurveTo(4, -R - 9, 9, -R - 6);
    ctx.stroke();
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  // face
  const look2 = Math.max(-1, Math.min(1, p.vx / 200)) * 2.5;
  const up = p.vy > 0 ? -1.5 : 1;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(s * 5 + look2, -2 + up * 0.5, 3.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1a2e';
    ctx.beginPath();
    ctx.arc(s * 5 + look2 * 1.4, -1.5 + up, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = look.cheek;
  ctx.globalAlpha = 0.7;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * 9, 4, 2.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#2a1a2e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  const scared = p.y - w.lava < 140;
  if (scared) ctx.ellipse(look2, 6, 2.5, 3, 0, 0, Math.PI * 2);
  else ctx.arc(look2, 4, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
  // name tag
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const tw = ctx.measureText(name).width + 10;
  roundRect(ctx, x - tw / 2, y - R - 30, tw, 14, 7);
  ctx.fill();
  ctx.fillStyle = look.body;
  ctx.fillText(name, x, y - R - 20);
  void now;
}

function drawLava(ctx: CanvasRenderingContext2D, w: World, now: number) {
  const top = sy(w, w.lava);
  if (top > H + 40) return;
  // heat glow above it
  const glow = ctx.createLinearGradient(0, top - 140, 0, top);
  glow.addColorStop(0, 'rgba(255,110,30,0)');
  glow.addColorStop(1, 'rgba(255,110,30,0.45)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, top - 140, W, 140);
  // the lava itself, wobbling
  const g = ctx.createLinearGradient(0, top, 0, Math.min(H, top + 220));
  g.addColorStop(0, '#ffd23f');
  g.addColorStop(0.12, '#ff8a1f');
  g.addColorStop(0.5, '#e8340f');
  g.addColorStop(1, '#8a0f06');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H + 10);
  for (let x = 0; x <= W; x += 8) {
    const wave =
      Math.sin(x * 0.045 + now / 380) * 5 + Math.sin(x * 0.11 - now / 250) * 3 + Math.sin(x * 0.02 + now / 900) * 4;
    ctx.lineTo(x, top + wave);
  }
  ctx.lineTo(W, H + 10);
  ctx.closePath();
  ctx.fill();
  // bright crust lines and bubbles
  ctx.strokeStyle = 'rgba(255,240,160,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    const wave =
      Math.sin(x * 0.045 + now / 380) * 5 + Math.sin(x * 0.11 - now / 250) * 3 + Math.sin(x * 0.02 + now / 900) * 4;
    if (x === 0) ctx.moveTo(x, top + wave);
    else ctx.lineTo(x, top + wave);
  }
  ctx.stroke();
  for (let i = 0; i < 9; i++) {
    const seed = i * 97.13;
    const period = 1400 + (i % 4) * 300;
    const k = ((now + seed * 13) % period) / period;
    const bx = (seed * 37) % W;
    const by = top + 30 + ((seed * 7) % 120) - k * 30;
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(bx, by, 3 + k * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: World,
  names: Record<string, string>,
  parts: Particle[],
  now: number,
  count: number | null,
) {
  const camM = meters(w.cam + 200);
  const [skyTop, skyBottom, z] = skyAt(camM);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, skyTop);
  sky.addColorStop(1, skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // scenery that scrolls slower than you climb
  const par = w.cam * 0.35;
  if (z <= 1) {
    // rocky cave walls
    ctx.fillStyle = z === 0 ? 'rgba(0,0,0,0.25)' : 'rgba(60,10,0,0.35)';
    for (const side of [0, 1])
      for (let i = -1; i < 8; i++) {
        const yy = ((i * 110 + par) % 880) - 110;
        const x0 = side ? W : 0;
        const d = side ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.lineTo(x0 + d * (22 + ((i * 7) % 3) * 9), yy + 40);
        ctx.lineTo(x0 + d * (12 + ((i * 5) % 4) * 6), yy + 90);
        ctx.lineTo(x0, yy + 120);
        ctx.fill();
      }
  }
  if (z === 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 6; i++) {
      const yy = ((i * 140 + par * 0.8) % 840) - 120;
      const xx = (i * 97) % W;
      for (const [dx, dy, r] of [
        [0, 0, 22],
        [20, -8, 18],
        [38, 2, 20],
        [-18, 4, 15],
      ])
        ctx.beginPath(), ctx.arc(xx + dx, yy + dy, r, 0, Math.PI * 2), ctx.fill();
    }
  }
  if (z >= 3) {
    for (let i = 0; i < 60; i++) {
      const xx = (i * 61.7) % W;
      const yy = ((i * 113.3 + par * 0.5) % H + H) % H;
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 600 + i));
      ctx.fillStyle = '#fff';
      ctx.fillRect(xx, yy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  for (const p of w.plats) drawPlat(ctx, w, p, now);
  for (const hr of w.hearts) {
    const yy = sy(w, hr.y) + Math.sin(now / 300 + hr.id) * 3;
    if (yy < -20 || yy > H + 20) continue;
    ctx.font = '18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💖', hr.x, yy);
  }
  for (const p of w.players) drawHopper(ctx, w, p, names[p.who] ?? p.who, now);

  // sparks and dust
  for (const pt of parts) {
    const k = pt.life / pt.max;
    ctx.globalAlpha = Math.max(0, k);
    if (pt.text) {
      ctx.font = `800 ${pt.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = pt.color;
      ctx.fillText(pt.text, pt.x, sy(w, pt.y));
    } else {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, sy(w, pt.y), pt.size * (0.4 + k * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  drawLava(ctx, w, now);

  // too close to the lava: the screen glows red
  const alive = w.players.filter((p) => p.alive);
  const nearest = alive.length ? Math.min(...alive.map((p) => p.y - w.lava)) : 999;
  if (nearest < 160) {
    const k = (1 - nearest / 160) * (0.6 + 0.4 * Math.sin(now / 120));
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(255,40,0,0)');
    v.addColorStop(1, `rgba(255,40,0,${0.45 * k})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // the scoreboard
  ctx.textBaseline = 'middle';
  w.players.forEach((p, i) => {
    const look = LOOK[(p.who as Who) in LOOK ? (p.who as Who) : 'you'];
    const x = i === 0 ? 10 : W - 10;
    ctx.textAlign = i === 0 ? 'left' : 'right';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(`${meters(p.best)} m`, x + 1, 22);
    ctx.fillStyle = p.alive ? look.body : 'rgba(255,255,255,0.45)';
    ctx.fillText(`${meters(p.best)} m`, x, 21);
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`${p.alive ? '' : '👻 '}${names[p.who] ?? p.who}${p.hearts ? ` · 💖${p.hearts}` : ''}`, x, 41);
  });
  const zone = ZONES[w.zone];
  ctx.textAlign = 'center';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(`${zone.emoji} ${zone.name}`, W / 2, 20);
  if (alive.length) {
    const gap = Math.max(0, meters(nearest));
    ctx.fillStyle = gap < 15 ? '#ffd23f' : 'rgba(255,255,255,0.65)';
    ctx.fillText(`🔥 lava ${gap} m onder je`, W / 2, 38);
  }

  if (count !== null) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = '900 96px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#8a0f06';
    ctx.lineWidth = 6;
    const text = count > 0 ? String(count) : 'SPRING!';
    if (count <= 0) ctx.font = '900 56px system-ui, sans-serif';
    ctx.strokeText(text, W / 2, H / 2);
    ctx.fillText(text, W / 2, H / 2);
  }
}

/* ------------------------------------------------------------ controls */

type Keys = Record<string, { l: boolean; r: boolean }>;

function Pad({
  who,
  keys,
  label,
  color,
  wide,
}: {
  who: string;
  keys: React.MutableRefObject<Keys>;
  label: string;
  color: string;
  wide?: boolean;
}) {
  const set = (dir: 'l' | 'r', on: boolean) => {
    const k = keys.current[who] ?? { l: false, r: false };
    keys.current[who] = { ...k, [dir]: on };
  };
  const btn = (dir: 'l' | 'r') => (
    <button
      type="button"
      className="lava-btn"
      style={{ ['--pad' as string]: color }}
      aria-label={`${label} ${dir === 'l' ? 'links' : 'rechts'}`}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as Element).setPointerCapture?.(e.pointerId);
        set(dir, true);
      }}
      onPointerUp={() => set(dir, false)}
      onPointerCancel={() => set(dir, false)}
      onLostPointerCapture={() => set(dir, false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {dir === 'l' ? '◀' : '▶'}
    </button>
  );
  return (
    <div className={`lava-pad${wide ? ' is-wide' : ''}`}>
      {btn('l')}
      {!wide && <span className="lava-pad__name" style={{ color }}>{label}</span>}
      {btn('r')}
    </div>
  );
}

/* --------------------------------------------------------------- the game */

const DUEL_TEXT: Partial<Record<PlayMode, string>> = {
  local: '💛💗 Tegelijk op één telefoon',
  coco: '🐰 Tegen Coco',
  remote: '⚔️ Duel (apart)',
};

export function Lava() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('lava');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('local');
  const duel = useDuelRound('lava', mode);
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [result, setResult] = useState<{ title: string; line: string; tickets: number | null } | null>(null);
  const [record, setRecord] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const keys = useRef<Keys>({});
  const parts = useRef<Particle[]>([]);
  const countFrom = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const seed = useRef(0);

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'lava', me) : null;
  const answering = plan?.type === 'answer' ? matches.find((m) => m.id === plan.id) : undefined;
  const players: Who[] = mode === 'local' ? [me, them] : mode === 'coco' ? [me, 'coco'] : [me];
  const names: Record<string, string> = {
    you: nameOf('you', profile),
    partner: nameOf('partner', profile),
    coco: 'Coco',
  };
  if (mode !== 'local') names[me] = mode === 'coco' ? 'Jij' : nameOf(me, profile);

  const say = (text: string) => setBanner({ id: performance.now(), text });
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1600);
    return () => window.clearTimeout(t);
  }, [banner]);

  // keyboard: one player on the arrows (or A/D); two: A/D and the arrows
  useEffect(() => {
    const map = (key: string): [string, 'l' | 'r'] | null => {
      const two = players.length === 2 && mode === 'local';
      const k = key.toLowerCase();
      if (k === 'a') return [me, 'l'];
      if (k === 'd') return [me, 'r'];
      if (key === 'ArrowLeft') return [two ? them : me, 'l'];
      if (key === 'ArrowRight') return [two ? them : me, 'r'];
      return null;
    };
    const down = (e: KeyboardEvent) => {
      const m = map(e.key);
      if (!m) return;
      e.preventDefault();
      keys.current[m[0]] = { ...(keys.current[m[0]] ?? { l: false, r: false }), [m[1]]: true };
    };
    const up = (e: KeyboardEvent) => {
      const m = map(e.key);
      if (!m) return;
      keys.current[m[0]] = { ...(keys.current[m[0]] ?? { l: false, r: false }), [m[1]]: false };
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [mode, me, them, players.length]);

  const burst = (x: number, y: number, color: string, n = 8, speed = 120) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      parts.current.push({
        x,
        y,
        vx: Math.cos(a) * speed * (0.4 + Math.random()),
        vy: Math.sin(a) * speed * (0.4 + Math.random()) + 60,
        life: 0.6,
        max: 0.6,
        color,
        size: 3 + Math.random() * 2,
      });
    }
  };
  const floatText = (x: number, y: number, text: string, color: string) =>
    parts.current.push({ x, y, vx: 0, vy: 50, life: 1, max: 1, color, size: 14, text });

  const react = (events: LavaEvent[]) => {
    for (const e of events) {
      if (e.type === 'bounce') {
        if (e.kind === 'crumble') {
          playSfx('thunk', true);
          burst(e.x, e.y, '#e8b877', 10, 90);
        } else burst(e.x, e.y, 'rgba(255,255,255,0.8)', 4, 60);
      } else if (e.type === 'spring') {
        playSfx('boing', true);
        burst(e.x, e.y, '#ffd75e', 12, 160);
        floatText(e.x, e.y + 30, 'BOING!', '#ffd75e');
      } else if (e.type === 'heart') {
        playSfx('coin', true);
        burst(e.x, e.y, '#ff5fa2', 10, 120);
        floatText(e.x, e.y + 20, '+5', '#ff8cc0');
      } else if (e.type === 'stomp') {
        playSfx('squeak', true);
        floatText(e.x, e.y + 30, 'Hop! 😆', '#ffffff');
      } else if (e.type === 'die') {
        playSfx('splat', true);
        burst(e.x, e.y, '#ffd23f', 16, 200);
        burst(e.x, e.y, '#ff4b1f', 12, 160);
        const w = world.current!;
        if (w.players.filter((p) => p.alive).length)
          say(`🔥 ${names[e.who] ?? e.who} is in de lava gevallen!`);
      } else if (e.type === 'zone') {
        playSfx('chime', true);
        const z = ZONES[e.zone];
        say(`${z.emoji} ${z.name}! Het wordt moeilijker…`);
      } else if (e.type === 'over') finish();
    }
  };

  // the loop: draw always, play while playing
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
    let frame = 0;
    let wobble = 0;
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      frame++;
      const w = world.current;
      let count: number | null = null;
      if (w) {
        if (countFrom.current !== null) {
          const left = 3 - (now - countFrom.current) / 700;
          count = Math.ceil(left);
          if (left <= -0.6) countFrom.current = null;
        }
        if (countFrom.current === null || count! <= 0) {
          for (const p of w.players) {
            if (p.who === 'coco') {
              if (frame % 20 === 0) wobble = (Math.random() - 0.5) * 90;
              if (frame % 10 === 0) p.input = cocoSteer(w, w.players.indexOf(p), wobble);
            } else {
              const k = keys.current[p.who];
              p.input = k ? (k.r ? 1 : 0) - (k.l ? 1 : 0) : 0;
            }
          }
          if (!w.over) reactRef.current(step(w, dt));
        }
        for (const pt of parts.current) {
          pt.life -= dt;
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          if (!pt.text) pt.vy -= 300 * dt;
        }
        parts.current = parts.current.filter((pt) => pt.life > 0);
        paint(ctx, w, namesRef.current, parts.current, now, count);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const namesRef = useRef(names);
  namesRef.current = names;
  // the loop lives on: let it always reach this render's handlers
  const reactRef = useRef(react);
  reactRef.current = react;

  // a preview world behind the start screen
  const preview = () => {
    world.current = newWorld(seedOf('preview'), players);
    for (const p of world.current.players) p.vy = 0;
    world.current.players.forEach((p) => (p.y = 20 + 14));
  };
  useEffect(() => {
    if (phase === 'ready') preview();
  }, [mode, phase]);

  const start = () => {
    const theirs = answering?.state.seed;
    seed.current = typeof theirs === 'number' ? theirs : Math.floor(Math.random() * 2 ** 31);
    world.current = newWorld(seed.current, players);
    keys.current = {};
    parts.current = [];
    countFrom.current = performance.now();
    setResult(null);
    setRecord(false);
    setPhase('play');
    playSfx('horn', true);
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  const finish = () => {
    const w = world.current!;
    setPhase('done');
    const s = (who: string) => score(w.players.find((p) => p.who === who)!);
    if (mode === 'local') {
      const a = s(me);
      const b = s(them);
      addScore('lava', a, me);
      addScore('lava', b, them);
      const winner: Person | 'draw' = a === b ? 'draw' : a > b ? me : them;
      recordResult('lava', ['you', 'partner'], winner);
      playSfx('success', true);
      celebrateFrom(stage.current);
      setResult({
        title: winner === 'draw' ? 'Gelijkspel! 🔥' : `${nameOf(winner, profile)} wint! 🏆`,
        line: `${nameOf(me, profile)} ${a} · ${nameOf(them, profile)} ${b}`,
        tickets: null,
      });
      return;
    }
    const mine = s(me);
    const myBest = best[me];
    setRecord(myBest !== null && myBest !== undefined && mine > myBest);
    if (mode === 'coco') {
      const coco = s('coco');
      if (getAuthor()) addScore('lava', mine);
      addScore('lava', coco, 'coco');
      const winner = mine > coco ? me : mine < coco ? 'coco' : 'draw';
      recordResult('lava', [me, 'coco'], winner);
      playSfx(winner === me ? 'success' : 'coin', true);
      if (winner === me) celebrateFrom(stage.current);
      setResult({
        title: winner === me ? 'Jij wint van Coco! 🎉' : winner === 'coco' ? 'Coco sprong hoger 🐰' : 'Gelijk!',
        line: `Jij ${mine} · Coco ${coco}`,
        tickets: null,
      });
      return;
    }
    const end = duel.finish(mine, { seed: seed.current });
    if (end.tickets) celebrateFrom(stage.current);
    setResult({ title: `${mine} punten 🔥`, line: end.text, tickets: end.tickets });
  };

  const w = world.current;
  const mineP = w?.players.find((p) => p.who === me);
  return (
    <GameShell
      id="lava"
      title="De vloer is lava"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        duel.reset();
        setPhase('ready');
        setResult(null);
      }}
      modes={['local', 'coco', 'remote']}
      labels={DUEL_TEXT}
      score={
        <ScoreBoard
          label="records"
          entries={[
            { name: profile.yourName.toUpperCase(), value: best.you ?? '---', me: me === 'you' },
            { name: profile.partnerName.toUpperCase(), value: best.partner ?? '---', me: me === 'partner' },
            { name: 'COCO', value: best.coco ?? '---' },
          ]}
        />
      }
    >
      {mode === 'local' ? (
        <p className="duel-panel">
          Tegelijk op één telefoon: {nameOf(me, profile)} links, {nameOf(them, profile)} rechts. Spring op elkaars hoofd
          voor een extra zetje 😆 Wie het hoogst komt, wint!
        </p>
      ) : (
        <DuelPanel kind="lava" mode={mode} first={duel.first} result={duel.result} />
      )}
      <div className="lava-stage" ref={stage}>
        <canvas
          ref={canvas}
          className="lava-canvas"
          role="img"
          aria-label="De vloer is lava: poppetjes springen omhoog terwijl de lava stijgt"
        />
        <AnimatePresence>
          {banner && (
            <motion.p
              key={banner.id}
              className="lava-banner"
              initial={{ opacity: 0, y: -8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              {banner.text}
            </motion.p>
          )}
        </AnimatePresence>
        {phase !== 'play' && (
          <div className="lava-start">
            <p className="lava-start__title">🌋 De vloer is lava!</p>
            {result ? (
              <>
                <p className="lava-start__big">{result.title}</p>
                <p>{result.line}</p>
              </>
            ) : (
              <p>
                Je springt vanzelf — jij stuurt links en rechts. Brokkelige platforms storten in, blauwe verdwijnen, veren
                lanceren je. En de lava stijgt steeds sneller…
              </p>
            )}
            <button type="button" className="lava-go" onClick={start}>
              {result ? 'Nog een keer! 🔥' : mode === 'local' ? 'Samen springen! 💛💗' : 'Springen! 🔥'}
            </button>
          </div>
        )}
        {phase === 'play' && (
          <div className="lava-pads">
            {mode === 'local' ? (
              <>
                <Pad who={me} keys={keys} label={nameOf(me, profile)} color={LOOK[me].body} />
                <Pad who={them} keys={keys} label={nameOf(them, profile)} color={LOOK[them].body} />
              </>
            ) : (
              <Pad who={me} keys={keys} label="Jij" color={LOOK[me].body} wide />
            )}
          </div>
        )}
      </div>
      <TicketStrip tickets={result?.tickets ?? null} />
      {phase === 'done' && mineP && mode !== 'local' && (
        <RoundCard
          title="Uit de lava gesprongen!"
          score={score(mineP)}
          record={record}
          stars={meters(mineP.best) >= 400 ? 3 : meters(mineP.best) >= 200 ? 2 : meters(mineP.best) >= 80 ? 1 : 0}
          stats={[
            { label: 'Hoogte', value: `${meters(mineP.best)} m` },
            { label: 'Hartjes', value: mineP.hearts },
            { label: 'Zone', value: `${ZONES[zoneAt(meters(mineP.best))].emoji} ${ZONES[zoneAt(meters(mineP.best))].name}` },
          ]}
        />
      )}
    </GameShell>
  );
}
