import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { LAVA_TICKETS_PER_ROUND } from '../../data/normalize';
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
  POWERS,
  R,
  W,
  ZONES,
  blinkState,
  cocoSteer,
  frozen,
  meters,
  newWorld,
  platX,
  powered,
  score,
  seedOf,
  step,
  zoneAt,
  type Hopper,
  type ItemKind,
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
const lookOf = (who: string) => LOOK[(who as Who) in LOOK ? (who as Who) : 'you'];

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

/** A finger on the screen: who it steers for, where it started, where it is. */
interface Touch {
  who: string;
  startX: number;
  x: number;
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

/** What a plain platform looks like in each zone. */
const STONE = [
  { body: ['#8a7466', '#6b5649'], top: '#74d34f', dots: '#4fae35' }, // mossy stone
  { body: ['#3a2a26', '#1e1412'], top: '#ff6a1f', dots: '#ffd23f' }, // basalt, glowing
  { body: ['#ffffff', '#dfe9f5'], top: '#ffffff', dots: '#cfe3ff' }, // clouds
  { body: ['#5c5a9c', '#33316b'], top: '#9fa6ff', dots: '#5ff3ff' }, // space metal
  { body: ['#ffcf33', '#c99400'], top: '#fff2a8', dots: '#ffffff' }, // sunny gold
];

const ITEM_EMOJI: Record<ItemKind, string> = {
  heart: '💖',
  ticket: '🎟️',
  rocket: POWERS.rocket.emoji,
  shield: POWERS.shield.emoji,
  magnet: POWERS.magnet.emoji,
  feather: POWERS.feather.emoji,
  freeze: POWERS.freeze.emoji,
};

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
  const zone = zoneAt(meters(p.y));
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
      y += (k - CRUMBLE) * (k - CRUMBLE) * 900;
      ctx.globalAlpha = Math.max(0, 1 - (k - CRUMBLE) * 1.2);
    } else ctx.translate(Math.sin(now / 20) * 2, 0);
  }
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x - half + 3, y + 5, p.w, 13, 6);
  ctx.fill();
  if (p.check) {
    // a golden rest stop with a flag
    const g = ctx.createLinearGradient(0, y, 0, y + 16);
    g.addColorStop(0, '#fff2a8');
    g.addColorStop(1, '#e0a400');
    ctx.fillStyle = g;
    roundRect(ctx, x - half, y, p.w, 16, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 10; i < p.w - 10; i += 22) ctx.fillRect(x - half + i, y + 3, 10, 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + half - 24, y);
    ctx.lineTo(x + half - 24, y - 34);
    ctx.stroke();
    ctx.fillStyle = '#ff4f6d';
    ctx.beginPath();
    ctx.moveTo(x + half - 24, y - 34);
    ctx.lineTo(x + half - 4 + Math.sin(now / 200) * 2, y - 28);
    ctx.lineTo(x + half - 24, y - 22);
    ctx.fill();
    ctx.font = '900 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#7a5200';
    ctx.fillText(`${p.check} m`, x, y + 9);
    ctx.restore();
    return;
  }
  const skin = STONE[zone];
  const colors: Record<string, [string, string]> = {
    normal: skin.body as unknown as [string, string],
    spring: skin.body as unknown as [string, string],
    crumble: ['#e8b877', '#b9874a'],
    move: ['#6f9be6', '#3f67b0'],
    blink: ['#7ff6ff', '#2bb8c9'],
  };
  const [top, bottom] = colors[p.kind];
  const g = ctx.createLinearGradient(0, y, 0, y + 14);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  if (zone === 2 && (p.kind === 'normal' || p.kind === 'spring')) {
    // fluffy cloud
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.arc(x - half + 8 + ((p.w - 16) * i) / 4, y + 6 + (i % 2) * 2, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    roundRect(ctx, x - half, y + 2, p.w, 12, 6);
    ctx.fill();
  } else {
    roundRect(ctx, x - half, y, p.w, 14, 6);
    ctx.fill();
  }
  if ((p.kind === 'normal' || p.kind === 'spring') && zone !== 2) {
    ctx.fillStyle = skin.top;
    if (zone === 1) {
      // glowing cracks in the basalt
      ctx.globalAlpha *= 0.6 + 0.4 * Math.sin(now / 300 + p.id);
      for (let i = 8; i < p.w - 6; i += 17) ctx.fillRect(x - half + i, y + 4 + (i % 3), 7, 2);
      ctx.globalAlpha = 1;
    } else {
      roundRect(ctx, x - half, y - 2, p.w, 5, 3);
      ctx.fill();
      ctx.fillStyle = skin.dots;
      for (let i = 6; i < p.w - 4; i += 9) {
        if (zone === 3) ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 250 + i));
        ctx.fillRect(x - half + i, y + 4, 3, 2);
      }
      ctx.globalAlpha = 1;
    }
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
  const look = lookOf(p.who);
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
  const rocket = powered(p, 'rocket', w.t);
  if (rocket) {
    // flames out of the bottom
    for (let i = 0; i < 6; i++) {
      const fx = x + Math.sin(now / 40 + i * 2) * 5;
      const fy = y + R + 4 + i * 6 + Math.random() * 4;
      ctx.fillStyle = i < 2 ? '#fff2a8' : i < 4 ? '#ffb347' : '#ff4b1f';
      ctx.globalAlpha = 1 - i / 7;
      ctx.beginPath();
      ctx.arc(fx, fy, 7 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (powered(p, 'magnet', w.t)) {
    ctx.strokeStyle = 'rgba(255,95,109,0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(x, y, 30 + ((now / 20) % 20), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (powered(p, 'feather', w.t)) {
    // little wings
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const flap = Math.sin(now / 80) * 0.4;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(x + s * (R + 2), y - 2);
      ctx.rotate(s * (0.5 + flap));
      ctx.beginPath();
      ctx.ellipse(s * 6, 0, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  const since = w.t - p.bounced;
  const squash = Math.exp(-since * 14) * 0.3;
  const stretch = Math.max(0, Math.min(0.18, p.vy / 5000));
  const sx = 1 + squash - stretch * 0.5;
  const syk = 1 - squash + stretch;
  ctx.save();
  ctx.translate(x, y + R * (1 - syk));
  if (w.t - p.hurt < 0.6) ctx.rotate((w.t - p.hurt) * 18);
  ctx.scale(sx, syk);
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.2, 0, 0, R * 1.1);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, look.body);
  g.addColorStop(1, look.dark);
  if (p.who === 'coco') {
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
  const eyes = Math.max(-1, Math.min(1, p.vx / 200)) * 2.5;
  const up = p.vy > 0 ? -1.5 : 1;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(s * 5 + eyes, -2 + up * 0.5, 3.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a1a2e';
    ctx.beginPath();
    ctx.arc(s * 5 + eyes * 1.4, -1.5 + up, 2, 0, Math.PI * 2);
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
  const scared = p.y - w.lava < 140 && !frozen(w);
  if (scared || rocket) ctx.ellipse(eyes, 6, 2.5, 3, 0, 0, Math.PI * 2);
  else ctx.arc(eyes, 4, 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
  if (p.shield) {
    // a soap-bubble shield
    const pulse = 1 + Math.sin(now / 200) * 0.04;
    const b = ctx.createRadialGradient(x - 6, y - 8, 2, x, y, R * 1.9 * pulse);
    b.addColorStop(0, 'rgba(255,255,255,0.35)');
    b.addColorStop(0.8, 'rgba(95,243,255,0.15)');
    b.addColorStop(1, 'rgba(95,243,255,0.6)');
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(x, y, R * 1.9 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = '800 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  const tw = ctx.measureText(name).width + 10;
  roundRect(ctx, x - tw / 2, y - R - 34, tw, 14, 7);
  ctx.fill();
  ctx.fillStyle = look.body;
  ctx.fillText(name, x, y - R - 27);
}

function drawLava(ctx: CanvasRenderingContext2D, w: World, now: number) {
  const top = sy(w, w.lava);
  if (top > H + 40) return;
  const ice = frozen(w);
  const wave = (x: number) =>
    ice
      ? Math.sin(x * 0.045) * 3
      : Math.sin(x * 0.045 + now / 380) * 5 + Math.sin(x * 0.11 - now / 250) * 3 + Math.sin(x * 0.02 + now / 900) * 4;
  const glow = ctx.createLinearGradient(0, top - 140, 0, top);
  glow.addColorStop(0, ice ? 'rgba(127,208,255,0)' : 'rgba(255,110,30,0)');
  glow.addColorStop(1, ice ? 'rgba(127,208,255,0.35)' : 'rgba(255,110,30,0.45)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, top - 140, W, 140);
  const g = ctx.createLinearGradient(0, top, 0, Math.min(H, top + 220));
  if (ice) {
    g.addColorStop(0, '#e8fbff');
    g.addColorStop(0.15, '#9fe0ff');
    g.addColorStop(0.6, '#4f8fd6');
    g.addColorStop(1, '#2a3f8a');
  } else {
    g.addColorStop(0, '#ffd23f');
    g.addColorStop(0.12, '#ff8a1f');
    g.addColorStop(0.5, '#e8340f');
    g.addColorStop(1, '#8a0f06');
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, H + 10);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, top + wave(x));
  ctx.lineTo(W, H + 10);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ice ? 'rgba(255,255,255,0.9)' : 'rgba(255,240,160,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) {
    if (x === 0) ctx.moveTo(x, top + wave(x));
    else ctx.lineTo(x, top + wave(x));
  }
  ctx.stroke();
  if (ice) {
    // cracks in the ice
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const bx = (i * 67 + 20) % W;
      ctx.beginPath();
      ctx.moveTo(bx, top + 10);
      ctx.lineTo(bx + 12, top + 30);
      ctx.lineTo(bx + 4, top + 48);
      ctx.stroke();
    }
    return;
  }
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
  touches: Touch[],
  split: boolean,
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
    if (z === 1) {
      // a volcano far away, smoking
      ctx.fillStyle = 'rgba(30,6,2,0.55)';
      const vy = 260 + ((par * 0.3) % 200);
      ctx.beginPath();
      ctx.moveTo(40, vy + 200);
      ctx.lineTo(150, vy);
      ctx.lineTo(210, vy);
      ctx.lineTo(320, vy + 200);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,110,30,0.5)';
      ctx.fillRect(150, vy - 2, 60, 4);
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
      ]) {
        ctx.beginPath();
        ctx.arc(xx + dx, yy + dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (z >= 3) {
    for (let i = 0; i < 60; i++) {
      const xx = (i * 61.7) % W;
      const yy = ((((i * 113.3 + par * 0.5) % H) + H) % H);
      ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 600 + i));
      ctx.fillStyle = '#fff';
      ctx.fillRect(xx, yy, 2, 2);
    }
    ctx.globalAlpha = 1;
    if (z === 3) {
      ctx.font = '42px system-ui, sans-serif';
      ctx.fillText('🪐', 280, 120 + ((par * 0.2) % 300));
    }
  }
  if (z === 4) {
    const sun = ctx.createRadialGradient(W / 2, 60, 10, W / 2, 60, 160);
    sun.addColorStop(0, 'rgba(255,255,220,0.9)');
    sun.addColorStop(1, 'rgba(255,200,60,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, 260);
  }

  // two halves when we play together
  if (split) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 60);
    ctx.lineTo(W / 2, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (const p of w.plats) drawPlat(ctx, w, p, now);
  for (const it of w.items) {
    const yy = sy(w, it.y) + Math.sin(now / 300 + it.id) * 3;
    if (yy < -20 || yy > H + 20) continue;
    if (it.kind !== 'heart') {
      const color = it.kind === 'ticket' ? '#ffd23f' : POWERS[it.kind].color;
      const glow = ctx.createRadialGradient(it.x, yy, 2, it.x, yy, 22);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55 + 0.25 * Math.sin(now / 180 + it.id);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(it.x, yy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(it.x, yy, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = it.kind === 'heart' ? '18px system-ui, sans-serif' : '19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ITEM_EMOJI[it.kind], it.x, yy);
  }
  for (const f of w.fireballs) {
    const yy = sy(w, f.y);
    if (yy < -30 || yy > H + 30) continue;
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.5 - i * 0.09;
      ctx.fillStyle = i < 2 ? '#ffd23f' : '#ff6a1f';
      ctx.beginPath();
      ctx.arc(f.x + Math.sin(now / 50 + i) * 2, yy + (f.vy > 0 ? 1 : -1) * i * 7, 9 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const fb = ctx.createRadialGradient(f.x - 2, yy - 2, 1, f.x, yy, 10);
    fb.addColorStop(0, '#fff6c9');
    fb.addColorStop(0.5, '#ffb347');
    fb.addColorStop(1, '#e8340f');
    ctx.fillStyle = fb;
    ctx.beginPath();
    ctx.arc(f.x, yy, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of w.players) drawHopper(ctx, w, p, names[p.who] ?? p.who, now);

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
  if (nearest < 160 && !frozen(w)) {
    const k = (1 - nearest / 160) * (0.6 + 0.4 * Math.sin(now / 120));
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, 'rgba(255,40,0,0)');
    v.addColorStop(1, `rgba(255,40,0,${0.45 * k})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // fingers: where you're steering from
  for (const t of touches) {
    const look = lookOf(t.who);
    const baseY = H - 70;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = look.body;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(split ? t.startX : t.x, baseY, split ? 34 : 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = look.body;
    ctx.beginPath();
    const knob = split ? t.startX + Math.max(-34, Math.min(34, t.x - t.startX)) : t.x;
    ctx.arc(knob, baseY, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // the scoreboard
  ctx.textBaseline = 'middle';
  w.players.forEach((p, i) => {
    const look = lookOf(p.who);
    const x = i === 0 ? 10 : W - 10;
    ctx.textAlign = i === 0 ? 'left' : 'right';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(`${meters(p.best)} m`, x + 1, 22);
    ctx.fillStyle = p.alive ? look.body : 'rgba(255,255,255,0.45)';
    ctx.fillText(`${meters(p.best)} m`, x, 21);
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const bits = [
      `${p.alive ? '' : '👻 '}${names[p.who] ?? p.who}`,
      p.hearts ? `💖${p.hearts}` : '',
      p.tickets ? `🎟️${p.tickets}` : '',
    ].filter(Boolean);
    ctx.fillText(bits.join(' · '), x, 41);
    // what you've got going on
    const icons: string[] = [];
    if (p.shield) icons.push('🛡️');
    if (p.power && w.t < p.powerUntil) icons.push(POWERS[p.power].emoji);
    if (icons.length) {
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(icons.join(' '), x, 60);
      if (p.power && w.t < p.powerUntil) {
        const k = (p.powerUntil - w.t) / POWERS[p.power].secs;
        ctx.fillStyle = POWERS[p.power].color;
        const bw = 44;
        ctx.fillRect(i === 0 ? x : x - bw, 72, bw * k, 3);
      }
    }
  });
  const zone = ZONES[w.zone];
  ctx.textAlign = 'center';
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${zone.emoji} ${zone.name}`, W / 2, 20);
  if (alive.length) {
    const gap = Math.max(0, meters(nearest));
    ctx.fillStyle = frozen(w) ? '#9fe0ff' : gap < 15 ? '#ffd23f' : 'rgba(255,255,255,0.65)';
    ctx.fillText(frozen(w) ? '❄️ lava bevroren!' : `🔥 lava ${gap} m onder je`, W / 2, 38);
  }

  if (count !== null) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#8a0f06';
    ctx.lineWidth = 6;
    const text = count > 0 ? String(count) : 'SPRING!';
    ctx.font = count > 0 ? '900 96px system-ui, sans-serif' : '900 56px system-ui, sans-serif';
    ctx.strokeText(text, W / 2, H / 2);
    ctx.fillText(text, W / 2, H / 2);
  }
}

/* --------------------------------------------------------------- the game */

const MODE_TEXT: Partial<Record<PlayMode, string>> = {
  local: '💛💗 Tegelijk op één telefoon',
  coco: '🐰 Tegen Coco',
  remote: '⚔️ Duel (apart)',
};

const ITEM_TEXT: Record<ItemKind, string> = {
  heart: '+5',
  ticket: '+1 🎟️',
  rocket: '🚀 RAKET!',
  shield: '🛡️ Schild!',
  magnet: '🧲 Magneet!',
  feather: '🪶 Zweven!',
  freeze: '❄️ Lava bevroren!',
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
  const keys = useRef<Record<string, { l: boolean; r: boolean }>>({});
  const touches = useRef(new Map<number, Touch>());
  const parts = useRef<Particle[]>([]);
  const countFrom = useRef<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const seed = useRef(0);

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'lava', me) : null;
  const answering = plan?.type === 'answer' ? matches.find((m) => m.id === plan.id) : undefined;
  const players: Who[] = mode === 'local' ? [me, them] : mode === 'coco' ? [me, 'coco'] : [me];
  const split = mode === 'local';
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

  // keyboard too: one player on the arrows (or A/D); two: A/D and the arrows
  useEffect(() => {
    const map = (key: string): [string, 'l' | 'r'] | null => {
      const k = key.toLowerCase();
      if (k === 'a') return [me, 'l'];
      if (k === 'd') return [me, 'r'];
      if (key === 'ArrowLeft') return [split ? them : me, 'l'];
      if (key === 'ArrowRight') return [split ? them : me, 'r'];
      return null;
    };
    const set = (e: KeyboardEvent, on: boolean) => {
      const m = map(e.key);
      if (!m) return;
      e.preventDefault();
      keys.current[m[0]] = { ...(keys.current[m[0]] ?? { l: false, r: false }), [m[1]]: on };
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [mode, me, them, split]);

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
    parts.current.push({ x, y, vx: 0, vy: 50, life: 1.1, max: 1.1, color, size: 14, text });

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
      } else if (e.type === 'item') {
        const color = e.kind === 'heart' ? '#ff8cc0' : e.kind === 'ticket' ? '#ffd23f' : POWERS[e.kind].color;
        playSfx(e.kind === 'heart' ? 'coin' : e.kind === 'ticket' ? 'chime' : 'star', true);
        burst(e.x, e.y, color, 14, 150);
        floatText(e.x, e.y + 24, ITEM_TEXT[e.kind], color);
        if (e.kind === 'ticket') say(`🎟️ ${names[e.who] ?? e.who} vond een ticket!`);
        else if (e.kind === 'freeze') say('❄️ De lava is bevroren!');
      } else if (e.type === 'stomp') {
        playSfx('squeak', true);
        floatText(e.x, e.y + 30, 'Hop! 😆', '#ffffff');
      } else if (e.type === 'saved') {
        playSfx('pop', true);
        burst(e.x, e.y, '#5ff3ff', 16, 180);
        floatText(e.x, e.y + 30, 'Gered! 🛡️', '#5ff3ff');
      } else if (e.type === 'burn') {
        playSfx('splat', true);
        burst(e.x, e.y, '#ff6a1f', 10, 140);
        floatText(e.x, e.y + 26, 'Au! 🔥', '#ffb347');
      } else if (e.type === 'spit') {
        playSfx('whoosh', true);
      } else if (e.type === 'die') {
        playSfx('splat', true);
        burst(e.x, e.y, '#ffd23f', 16, 200);
        burst(e.x, e.y, '#ff4b1f', 12, 160);
        const w = world.current!;
        if (w.players.filter((p) => p.alive).length) say(`🔥 ${names[e.who] ?? e.who} is in de lava gevallen!`);
      } else if (e.type === 'check') {
        playSfx('success', true);
        say(`🏁 ${e.m} meter! Goed bezig!`);
      } else if (e.type === 'zone') {
        playSfx('chime', true);
        const z = ZONES[e.zone];
        say(
          e.zone === 1
            ? '🌋 De vulkaan! Pas op voor vuurballen…'
            : e.zone === 3
              ? '🚀 De ruimte! Minder zwaartekracht…'
              : `${z.emoji} ${z.name}! Het wordt moeilijker…`,
        );
      } else if (e.type === 'over') finish();
    }
  };

  /** How a player steers now: their finger(s) first, else the keys. */
  const steerFor = (p: Hopper): number => {
    let finger: Touch | null = null;
    for (const t of touches.current.values()) if (t.who === p.who) finger = t;
    if (finger) {
      if (split) return Math.max(-1, Math.min(1, (finger.x - finger.startX) / 30));
      // alone: the hopper follows your finger
      let dx = finger.x - p.x;
      if (Math.abs(dx) < 6) dx = 0;
      return Math.max(-1, Math.min(1, dx / 40));
    }
    const k = keys.current[p.who];
    return k ? (k.r ? 1 : 0) - (k.l ? 1 : 0) : 0;
  };

  const namesRef = useRef(names);
  namesRef.current = names;
  // the loop lives on: let it always reach this render's handlers
  const reactRef = useRef(react);
  reactRef.current = react;
  const steerRef = useRef(steerFor);
  steerRef.current = steerFor;
  const splitRef = useRef(split);
  splitRef.current = split;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

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
        // (only a real round moves: the tower behind the start screen stands still)
        if (phaseRef.current === 'play' && (countFrom.current === null || count! <= 0)) {
          for (const p of w.players) {
            if (p.who === 'coco') {
              if (frame % 20 === 0) wobble = (Math.random() - 0.5) * 90;
              if (frame % 10 === 0) p.input = cocoSteer(w, w.players.indexOf(p), wobble);
            } else p.input = steerRef.current(p);
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
        paint(ctx, w, namesRef.current, parts.current, [...touches.current.values()], splitRef.current, now, count);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // a preview tower behind the start screen
  useEffect(() => {
    if (phase !== 'ready') return;
    world.current = newWorld(seedOf('preview'), players);
    for (const p of world.current.players) {
      p.vy = 0;
      p.y = 20 + R;
    }
  }, [mode, phase]);

  const start = () => {
    const theirs = answering?.state.seed;
    seed.current = typeof theirs === 'number' ? theirs : Math.floor(Math.random() * 2 ** 31);
    world.current = newWorld(seed.current, players);
    keys.current = {};
    touches.current.clear();
    parts.current = [];
    countFrom.current = performance.now();
    setResult(null);
    setRecord(false);
    phaseRef.current = 'play';
    setPhase('play');
    playSfx('horn', true);
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  const finish = () => {
    const w = world.current!;
    if (phaseRef.current !== 'play') return;
    phaseRef.current = 'done';
    setPhase('done');
    const s = (who: string) => score(w.players.find((p) => p.who === who)!);
    const found = (who: string) => Math.min(LAVA_TICKETS_PER_ROUND, w.players.find((p) => p.who === who)?.tickets ?? 0);
    const tix = (who: string) => (found(who) ? ` · 🎟️ +${found(who)}` : '');
    if (mode === 'local') {
      const a = s(me);
      const b = s(them);
      addScore('lava', a, me, found(me));
      addScore('lava', b, them, found(them));
      const winner: Person | 'draw' = a === b ? 'draw' : a > b ? me : them;
      recordResult('lava', ['you', 'partner'], winner);
      playSfx('success', true);
      celebrateFrom(stage.current);
      setResult({
        title: winner === 'draw' ? 'Gelijkspel! 🔥' : `${nameOf(winner, profile)} wint! 🏆`,
        line: `${nameOf(me, profile)} ${a}${tix(me)} · ${nameOf(them, profile)} ${b}${tix(them)}`,
        tickets: found(me) + found(them) || null,
      });
      return;
    }
    const mine = s(me);
    const myBest = best[me];
    setRecord(myBest !== null && myBest !== undefined && mine > myBest);
    if (mode === 'coco') {
      const coco = s('coco');
      if (getAuthor()) addScore('lava', mine, undefined, found(me));
      addScore('lava', coco, 'coco');
      const winner = mine > coco ? me : mine < coco ? 'coco' : 'draw';
      recordResult('lava', [me, 'coco'], winner);
      playSfx(winner === me ? 'success' : 'coin', true);
      if (winner === me) celebrateFrom(stage.current);
      setResult({
        title: winner === me ? 'Jij wint van Coco! 🎉' : winner === 'coco' ? 'Coco sprong hoger 🐰' : 'Gelijk!',
        line: `Jij ${mine}${tix(me)} · Coco ${coco}`,
        tickets: found(me) || null,
      });
      return;
    }
    // a duel: the round's score goes in, and the tickets you picked up with it
    const end = duel.finish(mine, { seed: seed.current });
    if (found(me) && getAuthor()) addScore('lava', 0, undefined, found(me));
    if (end.tickets) celebrateFrom(stage.current);
    setResult({
      title: `${mine} punten 🔥`,
      line: `${end.text}${tix(me)}`,
      tickets: (end.tickets ?? 0) + found(me) || null,
    });
  };

  /* ---------------------------------------------- fingers on the screen */

  const toLocal = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * W;
  };
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'play') return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const x = toLocal(e);
    const who = split ? (x < W / 2 ? me : them) : me;
    touches.current.set(e.pointerId, { who, startX: x, x });
  };
  const onMove = (e: React.PointerEvent) => {
    const t = touches.current.get(e.pointerId);
    if (!t) return;
    t.x = toLocal(e);
    // drag past the edge of the stick and it comes along (so turning back is quick)
    if (split) {
      if (t.x - t.startX > 40) t.startX = t.x - 40;
      if (t.startX - t.x > 40) t.startX = t.x + 40;
    }
  };
  const onUp = (e: React.PointerEvent) => touches.current.delete(e.pointerId);

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
      labels={MODE_TEXT}
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
          Tegelijk op één telefoon: {nameOf(me, profile)} stuurt op de linkerhelft, {nameOf(them, profile)} op de
          rechter. Spring op elkaars hoofd voor een extra zetje 😆
        </p>
      ) : (
        <DuelPanel kind="lava" mode={mode} first={duel.first} result={duel.result} />
      )}
      <div className="lava-stage" ref={stage}>
        <canvas
          ref={canvas}
          className="lava-canvas"
          role="application"
          aria-label="De vloer is lava: sleep met je vinger naar links of rechts om je poppetje te sturen"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
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
              <>
                <p>
                  {split
                    ? 'Ieder een helft van het scherm: zet je duim neer en schuif naar links of rechts.'
                    : 'Leg je vinger op het scherm: je poppetje springt vanzelf en volgt je vinger.'}
                </p>
                <ul className="lava-powers" aria-label="Power-ups">
                  {(Object.keys(POWERS) as (keyof typeof POWERS)[]).map((k) => (
                    <li key={k}>
                      <span aria-hidden="true">{POWERS[k].emoji}</span> {POWERS[k].name}
                    </li>
                  ))}
                  <li>
                    <span aria-hidden="true">🎟️</span> echte tickets!
                  </li>
                </ul>
              </>
            )}
            <button type="button" className="lava-go" onClick={start}>
              {result ? 'Nog een keer! 🔥' : split ? 'Samen springen! 💛💗' : 'Springen! 🔥'}
            </button>
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
            { label: 'Hartjes · tickets', value: `💖 ${mineP.hearts} · 🎟️ ${Math.min(LAVA_TICKETS_PER_ROUND, mineP.tickets)}` },
            { label: 'Zone', value: `${ZONES[zoneAt(meters(mineP.best))].emoji} ${ZONES[zoneAt(meters(mineP.best))].name}` },
          ]}
        />
      )}
    </GameShell>
  );
}
