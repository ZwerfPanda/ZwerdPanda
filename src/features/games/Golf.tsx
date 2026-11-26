import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { GameShell, ScoreBoard, WhoAreYou, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { RoundCard } from './RoundCard';
import { addScore, startMatch, updateMatch, useBest } from './gameData';
import { recordResult } from './gameStats';
import { duelScores, planDuel } from './duel';
import {
  BALLS,
  BALL_R,
  COURSES,
  CUP_R,
  H,
  MAX_STROKES,
  PAR_POINTS,
  PORTAL_R,
  PULL,
  W,
  airHeight,
  cocoGolf,
  courseIndex,
  courseOf,
  coursePar,
  courseStars,
  cupAt,
  allStars,
  MAX_STARS,
  SECRET_SHORT,
  HOLES_PER_COURSE,
  ownsBall,
  golfScore,
  holeOf,
  holePoints,
  holeStars,
  holeWord,
  inPoly,
  isOpen,
  millBlades,
  newGolf,
  nextHole,
  normalizeProgress,
  preview,
  putt,
  recordHole,
  slidersAt,
  step,
  totalStars,
  totalStrokes,
  type BallSkin,
  type GolfEvent,
  type GolfProgress,
  type GolfState,
  type Hole,
  type Push,
  type ThemeId,
} from './golf';
import './golf.css';

type P = { x: number; y: number };

interface Theme {
  bg: [string, string];
  felt: [string, string];
  wall: string;
  wallDark: string;
  wallTop: string;
  block: string;
  blockDark: string;
  water: [string, string];
  sand: [string, string];
  bumper: [string, string];
  slider: [string, string];
  sliderEmoji: string;
  mill: string;
  decor: string[];
  /** Little dots on the ground outside the course (sprinkles, stars…). */
  specks?: string[];
  stripes?: boolean;
  hazard: string;
  hazardText: string;
}

const THEMES: Record<ThemeId, Theme> = {
  park: {
    bg: ['#4f9a3c', '#58a644'],
    felt: ['#3cc46a', '#38bb64'],
    wall: '#8a5a2b',
    wallDark: '#5e3c1b',
    wallTop: '#c99a62',
    block: '#b98352',
    blockDark: '#7a4f26',
    water: ['#4ab3e6', '#2d86b8'],
    sand: ['#ecd9a6', '#d6bd7c'],
    bumper: ['#ff8cc0', '#b8236a'],
    slider: ['#9b6a3a', '#6b4422'],
    sliderEmoji: '🐰',
    mill: '#fffaf0',
    decor: ['🌳', '🌷', '🌼', '🍄', '🌲', '🌻'],
    hazard: '🦆',
    hazardText: '💦 In het water! +1 slag',
  },
  beach: {
    bg: ['#f3dca6', '#ecd193'],
    felt: ['#2fc2b3', '#2bb5a7'],
    wall: '#f6f0e4',
    wallDark: '#a8957a',
    wallTop: '#fffdf6',
    block: '#e9d4a8',
    blockDark: '#b39465',
    water: ['#3fa8e8', '#1f6fb0'],
    sand: ['#f7e7b8', '#e2c98a'],
    bumper: ['#ffd75e', '#e5263d'],
    slider: ['#ff7a59', '#b8442a'],
    sliderEmoji: '🦀',
    mill: '#e5263d',
    decor: ['🐚', '⭐', '🌴', '⛱️', '🦀', '🪸'],
    specks: ['#e2c98a', '#fff3d1'],
    hazard: '🐟',
    hazardText: '🌊 In zee! +1 slag',
  },
  candy: {
    bg: ['#ffd6ea', '#ffcbe3'],
    felt: ['#7fe3c7', '#74d9bd'],
    wall: '#ff4f8b',
    wallDark: '#b8235e',
    wallTop: '#ffffff',
    block: '#8b4a2b',
    blockDark: '#5a2d17',
    water: ['#c77dff', '#8a3fd1'],
    sand: ['#fff3fa', '#f2c6dd'],
    bumper: ['#ff5fa2', '#a30f55'],
    slider: ['#f6b26b', '#b4702a'],
    sliderEmoji: '🍩',
    mill: '#ffffff',
    decor: ['🍭', '🧁', '🍩', '🍬', '🍪', '🍓'],
    specks: ['#ff5fa2', '#5ff3ff', '#ffd75e', '#7fe3c7'],
    stripes: true,
    hazard: '🫧',
    hazardText: '🫧 In de limonade! +1 slag',
  },
  ice: {
    bg: ['#e4f5ff', '#d5eefc'],
    felt: ['#a6e3ff', '#9bdcfa'],
    wall: '#ffffff',
    wallDark: '#7fb7d9',
    wallTop: '#ffffff',
    block: '#e8f7ff',
    blockDark: '#8fc3e3',
    water: ['#1f5e8f', '#0f3a5e'],
    sand: ['#ffffff', '#cfe6f5'],
    bumper: ['#ffffff', '#8fbfe0'],
    slider: ['#2a3550', '#141b2e'],
    sliderEmoji: '🐧',
    mill: '#ffffff',
    decor: ['❄️', '⛄', '🌲', '🐧', '🏔️', '🦭'],
    specks: ['#ffffff'],
    hazard: '🐟',
    hazardText: '🧊 Door het ijs gezakt! +1 slag',
  },
  space: {
    bg: ['#0d0b26', '#110e30'],
    felt: ['#2b2a6b', '#28265f'],
    wall: '#5ff3ff',
    wallDark: '#1b8a9c',
    wallTop: '#c9fbff',
    block: '#3d3a8c',
    blockDark: '#1c1a52',
    water: ['#ff6a3d', '#a3260b'],
    sand: ['#8c86c9', '#625ca8'],
    bumper: ['#b18cff', '#5a2fd6'],
    slider: ['#8a7f73', '#4f463d'],
    sliderEmoji: '☄️',
    mill: '#ffd75e',
    decor: ['🪐', '🌟', '👽', '🛸', '🌍', '⭐'],
    specks: ['#ffffff', '#ffd75e', '#5ff3ff'],
    hazard: '🔥',
    hazardText: '🔥 In de lava! +1 slag',
  },
  city: {
    bg: ['#c9b9a6', '#bfae99'],
    felt: ['#55b97a', '#4fb173'],
    wall: '#a64b2a',
    wallDark: '#6e2c15',
    wallTop: '#d07a52',
    block: '#8a3d22',
    blockDark: '#5a2410',
    water: ['#3f86c9', '#285d94'],
    sand: ['#e8d9b0', '#c9b58a'],
    bumper: ['#2d6b3a', '#1b4224'],
    slider: ['#ffcf33', '#b38a00'],
    sliderEmoji: '🚲',
    mill: '#ffffff',
    decor: ['🌷', '🚲', '🏠', '🧀', '🦆', '🌉'],
    specks: ['#a89580', '#d9ccbb'],
    hazard: '🦆',
    hazardText: '🚤 In de gracht! +1 slag',
  },
  fair: {
    bg: ['#3a1f5c', '#43246a'],
    felt: ['#c25bd6', '#b853cc'],
    wall: '#ffcf33',
    wallDark: '#b38a00',
    wallTop: '#fff2b3',
    block: '#ff5f6d',
    blockDark: '#a8233a',
    water: ['#5fd0ff', '#1f8fc7'],
    sand: ['#ffe9a8', '#e5c46a'],
    bumper: ['#ffffff', '#e5263d'],
    slider: ['#5fd0ff', '#1f6fb0'],
    sliderEmoji: '🚗',
    mill: '#ffffff',
    decor: ['🎡', '🎠', '🍿', '🎪', '🎈', '🍭'],
    specks: ['#ffd75e', '#ff8cc0', '#5ff3ff'],
    stripes: true,
    hazard: '🦆',
    hazardText: '💦 In de eendjesvijver! +1 slag',
  },
  volcano: {
    bg: ['#2b1714', '#331b17'],
    felt: ['#6b5a52', '#64544c'],
    wall: '#ff6a1f',
    wallDark: '#7a2a0a',
    wallTop: '#ffb347',
    block: '#3a2a26',
    blockDark: '#1e1412',
    water: ['#ff7b1f', '#c2320a'],
    sand: ['#8f8580', '#6f6660'],
    bumper: ['#4a3b36', '#ff6a1f'],
    slider: ['#5a4a42', '#2e2420'],
    sliderEmoji: '🦖',
    mill: '#ffb347',
    decor: ['🌋', '🔥', '🦖', '🪨', '🌴', '🦴'],
    specks: ['#ff6a1f', '#ffb347'],
    hazard: '🔥',
    hazardText: '🔥 In de lava! +1 slag',
  },
  castle: {
    bg: ['#5f8f4a', '#679851'],
    felt: ['#7cc26a', '#74b963'],
    wall: '#9aa0aa',
    wallDark: '#5c616b',
    wallTop: '#c9ced6',
    block: '#8a909a',
    blockDark: '#50555e',
    water: ['#3a7fb5', '#245883'],
    sand: ['#d9c79a', '#b8a575'],
    bumper: ['#c9ced6', '#5c616b'],
    slider: ['#7a5a3a', '#4a3520'],
    sliderEmoji: '🐴',
    mill: '#d9dde3',
    decor: ['🏰', '🐉', '👑', '🛡️', '🌲', '🗡️'],
    hazard: '🐊',
    hazardText: '🐊 In de slotgracht! +1 slag',
  },
  secret: {
    bg: ['#140a2e', '#1a0d3a'],
    felt: ['#2a1b5c', '#311f6b'],
    wall: '#ffd75e',
    wallDark: '#b8860b',
    wallTop: '#fff6c9',
    block: '#4a2f9c',
    blockDark: '#ffd75e',
    water: ['#ff5fa2', '#7a2fd6'],
    sand: ['#ffe9a8', '#e5c46a'],
    bumper: ['#5ff3ff', '#1b8a9c'],
    slider: ['#ffd75e', '#b8860b'],
    sliderEmoji: '⭐',
    mill: '#ffd75e',
    decor: ['✨', '🌈', '💎', '👑', '🦄', '💫'],
    specks: ['#ffd75e', '#ff8cc0', '#5ff3ff', '#ffffff'],
    hazard: '🌈',
    hazardText: '🌈 In de regenboog-lava! +1 slag',
  },
  garden: {
    bg: ['#6fae4a', '#79b853'],
    felt: ['#9be07a', '#92d671'],
    wall: '#3f7a2c',
    wallDark: '#24511a',
    wallTop: '#5fa043',
    block: '#3f8a34',
    blockDark: '#24511a',
    water: ['#58b7e8', '#2d7fb3'],
    sand: ['#b98a5a', '#8a6038'],
    bumper: ['#ff7a3d', '#b8441a'],
    slider: ['#c9a27a', '#7a5a3a'],
    sliderEmoji: '🐌',
    mill: '#fff6d8',
    decor: ['🥕', '🌷', '🐝', '🦋', '🌻', '🐞', '🥬'],
    specks: ['#ffd75e', '#ffffff', '#ff8cc0'],
    hazard: '🐸',
    hazardText: '💦 In de vijver! +1 slag',
  },
};

const pathOf = (pl: P[]) => `M${pl.map((p) => `${p.x} ${p.y}`).join('L')}Z`;

/** A little seeded random, so a hole's decorations never jump around. */
function seeded(n: number) {
  let s = n * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** Bits of scenery on the ground round the course, never on it. */
function scenery(h: Hole, seed: number, t: Theme) {
  const rnd = seeded(seed);
  const outer = h.walls[0];
  const near = (p: P, m: number) =>
    [
      [0, 0],
      [m, 0],
      [-m, 0],
      [0, m],
      [0, -m],
    ].some(([dx, dy]) => inPoly({ x: p.x + dx, y: p.y + dy }, outer));
  const decor: { x: number; y: number; e: string; s: number }[] = [];
  for (let k = 0; k < 120 && decor.length < 14; k++) {
    const p = { x: 8 + rnd() * (W - 16), y: 14 + rnd() * (H - 22) };
    if (near(p, 18)) continue;
    if (decor.some((d) => Math.hypot(d.x - p.x, d.y - p.y) < 34)) continue;
    decor.push({ ...p, e: t.decor[Math.floor(rnd() * t.decor.length)], s: 14 + rnd() * 10 });
  }
  const specks: { x: number; y: number; c: string; r: number }[] = [];
  if (t.specks)
    for (let k = 0; k < 160 && specks.length < 60; k++) {
      const p = { x: rnd() * W, y: rnd() * H };
      if (near(p, 6)) continue;
      specks.push({ ...p, c: t.specks[Math.floor(rnd() * t.specks.length)], r: 0.8 + rnd() * 1.6 });
    }
  return { decor, specks };
}

/** Chevrons across a pad, pointing the way it pushes. */
function Chevrons({ r, cls }: { r: Push; cls: string }) {
  const ang = (Math.atan2(r.ay, r.ax) * 180) / Math.PI;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const size = Math.min(r.w, r.h);
  const gap = size / 3.2;
  return (
    <g transform={`rotate(${ang} ${cx} ${cy})`}>
      {[-1, 0, 1].map((k) => (
        <path
          key={k}
          className={cls}
          style={{ animationDelay: `${(k + 1) * 0.18}s` }}
          d={`M${cx + k * gap - gap * 0.35} ${cy - size * 0.28}L${cx + k * gap + gap * 0.25} ${cy}L${cx + k * gap - gap * 0.35} ${cy + size * 0.28}`}
        />
      ))}
    </g>
  );
}

export interface Fx {
  trail: P[];
  bump: { i: number; at: number } | null;
  splash: { x: number; y: number; at: number } | null;
  sunkAt: number | null;
  warpAt: number | null;
  shake: { at: number; power: number } | null;
  /** How far the ball has rolled (to turn it). */
  roll: number;
}

const freshFx = (): Fx => ({
  trail: [],
  bump: null,
  splash: null,
  sunkAt: null,
  warpAt: null,
  shake: null,
  roll: 0,
});

/** A golf ball in one of the skins, rolling. */
function BallSprite({
  x,
  y,
  r,
  skin,
  roll,
  dir,
}: {
  x: number;
  y: number;
  r: number;
  skin: BallSkin;
  roll: number;
  dir: P;
}) {
  const fill =
    skin.fill === 'rainbow' ? 'url(#golf-rainbow)' : skin.id === 'white' ? 'url(#golf-ball)' : skin.fill;
  // a dimple that travels over the ball as it rolls
  const k = Math.sin(roll / Math.max(1, r));
  const vis = Math.cos(roll / Math.max(1, r)) > 0;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={skin.ring} strokeWidth="0.8" />
      {'emoji' in skin && skin.emoji ? (
        <text
          x={x + dir.x * k * r * 0.35}
          y={y + dir.y * k * r * 0.35 + 0.5}
          fontSize={r * 1.15}
          textAnchor="middle"
          dominantBaseline="central"
          opacity={vis ? 1 : 0.35}
        >
          {skin.emoji}
        </text>
      ) : (
        vis && (
          <circle
            cx={x + dir.x * k * r * 0.55}
            cy={y + dir.y * k * r * 0.55}
            r={r * 0.22}
            fill="rgba(0,0,0,0.18)"
          />
        )
      )}
      <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.3} fill="rgba(255,255,255,0.75)" />
      {'shine' in skin && skin.shine && (
        <path
          className="golf-shine"
          d={`M${x + r * 1.1} ${y - r * 1.3}l1.2 2.6 2.6 1.2 -2.6 1.2 -1.2 2.6 -1.2 -2.6 -2.6 -1.2 2.6 -1.2z`}
          fill="#fff"
        />
      )}
    </g>
  );
}

function CourseView({
  s,
  aim,
  path,
  flag,
  fx,
  skin,
}: {
  s: GolfState;
  aim: { dx: number; dy: number } | null;
  path: P[];
  flag: string;
  fx: Fx;
  skin: BallSkin;
}) {
  const course = courseOf(s);
  const t = THEMES[course.theme];
  const h = holeOf(s);
  const [outer, ...inner] = h.walls;
  const id = course.theme;
  const scene = useMemo(() => scenery(h, s.course * 10 + s.hole + 1, t), [h, s.course, s.hole, t]);
  const sliders = slidersAt(h, s.t);
  const open = s.open ?? [];
  const len = aim ? Math.min(PULL, Math.hypot(aim.dx, aim.dy)) : 0;
  const k = len / PULL;
  const sinkK = fx.sunkAt !== null ? Math.max(0, Math.min(1, (s.t - fx.sunkAt) / 0.35)) : 0;
  const ballR = BALL_R * (1 - sinkK) * (1 + airHeight(s) * 0.7);
  const lift = airHeight(s) * 16;
  const cup = cupAt(h, s.t);
  const ballAt = fx.sunkAt !== null ? { x: cup.x, y: cup.y } : { x: s.ball.x, y: s.ball.y };
  const sp = Math.hypot(s.ball.vx, s.ball.vy);
  const dir = sp > 1 ? { x: s.ball.vx / sp, y: s.ball.vy / sp } : { x: 0, y: -1 };

  return (
    <svg className={`golf-course is-${id}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs>
        <pattern id={`golf-bg-${id}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <rect width="24" height="24" fill={t.bg[0]} />
          <rect width="12" height="24" fill={t.bg[1]} />
        </pattern>
        <pattern id={`golf-felt-${id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill={t.felt[0]} />
          <rect y="10" width="20" height="10" fill={t.felt[1]} />
        </pattern>
        <pattern id="golf-gate" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="12" fill="#fffaf0" />
          <rect width="6" height="12" fill="#e5263d" />
        </pattern>
        <linearGradient id="golf-ramp" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#c58a4f" />
          <stop offset="1" stopColor="#f2c48a" />
        </linearGradient>
        <linearGradient id="golf-rainbow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5f6d" />
          <stop offset="0.25" stopColor="#ffd75e" />
          <stop offset="0.5" stopColor="#5fe08a" />
          <stop offset="0.75" stopColor="#5fb8ff" />
          <stop offset="1" stopColor="#b18cff" />
        </linearGradient>
        <radialGradient id="golf-cup" cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.8" stopColor="#0d1f10" />
          <stop offset="1" stopColor="#24402a" />
        </radialGradient>
        <radialGradient id="golf-ball" cx="35%" cy="30%" r="70%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.7" stopColor="#f2f2f2" />
          <stop offset="1" stopColor="#c9c9c9" />
        </radialGradient>
        <radialGradient id="golf-well" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.25" stopColor="#05030f" />
          <stop offset="0.6" stopColor="rgba(120,60,200,0.35)" />
          <stop offset="1" stopColor="rgba(120,60,200,0)" />
        </radialGradient>
        <linearGradient id={`golf-water-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.water[0]} />
          <stop offset="1" stopColor={t.water[1]} />
        </linearGradient>
        <filter id="golf-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* the ground round the course */}
      <rect width={W} height={H} fill={`url(#golf-bg-${id})`} />
      {scene.specks.map((p, i) => (
        <circle key={`p${i}`} className="golf-speck" cx={p.x} cy={p.y} r={p.r} fill={p.c} />
      ))}
      {scene.decor.map((d, i) => (
        <text
          key={`d${i}`}
          x={d.x}
          y={d.y}
          fontSize={d.s}
          textAnchor="middle"
          dominantBaseline="central"
          className="golf-decor"
        >
          {d.e}
        </text>
      ))}

      {/* the course: a shadow, the felt, the edge */}
      <path d={pathOf(outer)} transform="translate(0 7)" fill="rgba(0,0,0,0.28)" filter="url(#golf-soft)" />
      <path d={pathOf(outer)} fill={`url(#golf-felt-${id})`} />
      <path d={pathOf(outer)} fill="none" stroke={t.wallDark} strokeWidth="11" strokeLinejoin="round" />
      <path
        d={pathOf(outer)}
        fill="none"
        stroke={t.wall}
        strokeWidth="7"
        strokeLinejoin="round"
        strokeDasharray={t.stripes ? '10 10' : undefined}
      />
      {t.stripes && (
        <path
          d={pathOf(outer)}
          fill="none"
          stroke={t.wallTop}
          strokeWidth="7"
          strokeLinejoin="round"
          strokeDasharray="10 10"
          strokeDashoffset="10"
        />
      )}
      {(course.theme === 'space' || course.theme === 'secret') && (
        <path d={pathOf(outer)} fill="none" stroke={t.wall} strokeWidth="14" opacity="0.25" filter="url(#golf-soft)" />
      )}
      {course.theme === 'secret' && (
        <path
          className="golf-rainbow-edge"
          d={pathOf(outer)}
          fill="none"
          stroke="url(#golf-rainbow)"
          strokeWidth="4"
          strokeLinejoin="round"
          strokeDasharray="14 8"
        />
      )}

      {/* zones on the felt */}
      {(h.ice ?? []).map((r, i) => (
        <rect key={`ice${i}`} className="golf-ice" x={r.x} y={r.y} width={r.w} height={r.h} rx="10" />
      ))}
      {(h.slopes ?? []).map((r, i) => (
        <g key={`sl${i}`}>
          <rect className="golf-slope" x={r.x} y={r.y} width={r.w} height={r.h} />
          <Chevrons r={r} cls="golf-slope__arrow" />
        </g>
      ))}
      {(h.boosts ?? []).map((r, i) => (
        <g key={`bo${i}`}>
          <rect className="golf-boost" x={r.x + 2} y={r.y + 2} width={r.w - 4} height={r.h - 4} rx="10" />
          <Chevrons r={r} cls="golf-boost__arrow" />
        </g>
      ))}
      {(h.sand ?? []).map((r, i) => (
        <rect
          key={`s${i}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          rx={Math.min(14, r.h / 2)}
          fill={t.sand[0]}
          stroke={t.sand[1]}
          strokeWidth="2"
        />
      ))}
      {(h.water ?? []).map((r, i) => (
        <g key={`w${i}`}>
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={Math.min(18, r.h / 3)}
            fill={`url(#golf-water-${id})`}
            stroke={t.water[1]}
            strokeWidth="3"
          />
          {[0.35, 0.65].map((f) => (
            <path
              key={f}
              className="golf-ripple"
              d={`M${r.x + r.w * 0.2} ${r.y + r.h * f}q${r.w * 0.1} -6 ${r.w * 0.2} 0t${r.w * 0.2} 0t${r.w * 0.2} 0`}
            />
          ))}
          {r.w > 90 && r.h > 40 && (
            <text x={r.x + r.w - 26} y={r.y + Math.min(30, r.h - 8)} fontSize="18" className="golf-bob">
              {t.hazard}
            </text>
          )}
        </g>
      ))}
      {(h.ramps ?? []).map((r, i) => {
        const ang = (Math.atan2(r.ay, r.ax) * 180) / Math.PI + 90;
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        return (
          <g key={`r${i}`} transform={`rotate(${ang} ${cx} ${cy})`}>
            <rect x={cx - r.w / 2 + 2} y={cy - r.h / 2 + 5} width={r.w} height={r.h} rx="6" fill="rgba(0,0,0,0.25)" />
            <rect
              x={cx - r.w / 2}
              y={cy - r.h / 2}
              width={r.w}
              height={r.h}
              rx="6"
              fill="url(#golf-ramp)"
              stroke="#8a5a2b"
              strokeWidth="2"
            />
            {[0.3, 0.55, 0.8].map((f) => (
              <line
                key={f}
                x1={cx - r.w / 2 + 4}
                x2={cx + r.w / 2 - 4}
                y1={cy - r.h / 2 + r.h * f}
                y2={cy - r.h / 2 + r.h * f}
                stroke="rgba(138,90,43,0.45)"
                strokeWidth="1.5"
              />
            ))}
            <path
              className="golf-ramp__arrow"
              d={`M${cx - 9} ${cy + 4}L${cx} ${cy - 8}L${cx + 9} ${cy + 4}`}
              fill="none"
              stroke="#fff"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        );
      })}
      {(h.buttons ?? []).map((b, i) => {
        const on = open.includes(b.id);
        return (
          <g key={`bt${i}`}>
            <circle cx={b.x} cy={b.y + 2} r="11" fill="rgba(0,0,0,0.25)" />
            <circle cx={b.x} cy={b.y} r="11" fill="#e8e1d4" stroke="#9a8f7c" strokeWidth="2" />
            <circle
              className={on ? '' : 'golf-button'}
              cx={b.x}
              cy={on ? b.y + 1 : b.y - 1}
              r="7"
              fill={on ? '#3cc46a' : '#e5263d'}
            />
          </g>
        );
      })}
      {(h.wells ?? []).map((w, i) => (
        <g key={`we${i}`}>
          <circle cx={w.x} cy={w.y} r={w.r} fill="url(#golf-well)" />
          <g className="golf-spin" style={{ transformOrigin: `${w.x}px ${w.y}px` }}>
            <circle cx={w.x} cy={w.y} r={w.r * 0.55} fill="none" stroke="#b18cff" strokeWidth="2" strokeDasharray="6 10" opacity="0.7" />
            <circle cx={w.x} cy={w.y} r={w.r * 0.3} fill="none" stroke="#ff8cc0" strokeWidth="2" strokeDasharray="4 8" opacity="0.8" />
          </g>
          <circle cx={w.x} cy={w.y} r="10" fill="#000" stroke="#ffd75e" strokeWidth="1.5" />
        </g>
      ))}
      {(h.portals ?? []).map((pr, i) => (
        <g key={`po${i}`}>
          {(['a', 'b'] as const).map((end) => {
            const p = pr[end];
            const c = end === 'a' ? ['#b18cff', '#5a2fd6'] : ['#ffb35e', '#d1621a'];
            const flash = fx.warpAt !== null && s.t - fx.warpAt < 0.4 ? 1 + (0.4 - (s.t - fx.warpAt)) : 1;
            return (
              <g key={end}>
                <circle cx={p.x} cy={p.y} r={PORTAL_R * flash} fill={c[1]} opacity="0.85" />
                <g className="golf-spin is-fast" style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
                  <circle cx={p.x} cy={p.y} r={PORTAL_R - 3} fill="none" stroke={c[0]} strokeWidth="3" strokeDasharray="5 4" />
                </g>
                <circle cx={p.x} cy={p.y} r="4" fill="#fff" opacity="0.9" />
                <text x={p.x} y={p.y - PORTAL_R - 4} fontSize="9" textAnchor="middle" className="golf-tag">
                  {end === 'a' ? `in ${i + 1}` : `uit ${i + 1}`}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      {/* solid blocks inside the course */}
      {inner.map((pl, i) => (
        <g key={`i${i}`}>
          <path d={pathOf(pl)} transform="translate(0 4)" fill="rgba(0,0,0,0.25)" />
          <path d={pathOf(pl)} fill={t.block} stroke={t.blockDark} strokeWidth="3" strokeLinejoin="round" />
          {t.stripes && (
            <path d={pathOf(pl)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeDasharray="3 6" />
          )}
          {course.theme === 'garden' && (
            <path d={pathOf(pl)} fill="none" stroke="#6fbf4f" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
          )}
        </g>
      ))}

      {/* gates: shut until the button's been rolled over */}
      {(h.gates ?? []).map((g, i) =>
        open.includes(g.id) ? (
          <rect
            key={`g${i}`}
            x={g.x}
            y={g.y}
            width={g.w}
            height={g.h}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />
        ) : (
          <g key={`g${i}`}>
            <rect x={g.x} y={g.y + 3} width={g.w} height={g.h} fill="rgba(0,0,0,0.25)" />
            <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="url(#golf-gate)" stroke="#8a1222" strokeWidth="1.5" />
          </g>
        ),
      )}

      {(h.bumpers ?? []).map((b, i) => {
        const hit = fx.bump && fx.bump.i === i ? Math.max(0, 1 - (s.t - fx.bump.at) / 0.25) : 0;
        const r = b.r * (1 + hit * 0.22);
        return (
          <g key={`b${i}`}>
            <ellipse cx={b.x + 2} cy={b.y + 4} rx={b.r} ry={b.r * 0.8} fill="rgba(0,0,0,0.25)" />
            <circle cx={b.x} cy={b.y} r={r} fill={t.bumper[1]} />
            <circle cx={b.x} cy={b.y} r={r * 0.78} fill={t.bumper[0]} />
            {course.theme === 'beach' && (
              <path
                d={`M${b.x - r * 0.78} ${b.y}A${r * 0.78} ${r * 0.78} 0 0 1 ${b.x + r * 0.78} ${b.y}`}
                fill="#5ab8ff"
                opacity="0.9"
              />
            )}
            <circle cx={b.x - r * 0.3} cy={b.y - r * 0.32} r={r * 0.22} fill="rgba(255,255,255,0.7)" />
            {hit > 0 && (
              <circle cx={b.x} cy={b.y} r={b.r + 4 + (1 - hit) * 12} fill="none" stroke="#fff" strokeWidth="2" opacity={hit} />
            )}
          </g>
        );
      })}

      {(h.mills ?? []).map((m, i) => (
        <g key={`m${i}`}>
          {course.theme === 'park' && (
            <g>
              <rect x={m.x - 16} y={m.y - 10} width="32" height="30" rx="4" fill="#ff8cc0" stroke="#b8236a" strokeWidth="2" />
              <path d={`M${m.x - 18} ${m.y - 8}L${m.x} ${m.y - 24}L${m.x + 18} ${m.y - 8}Z`} fill="#b8236a" />
            </g>
          )}
          {course.theme === 'beach' && (
            <g>
              <circle cx={m.x} cy={m.y} r="15" fill="#fff" stroke="#e5263d" strokeWidth="4" />
              <circle cx={m.x} cy={m.y} r="7" fill="#ffd75e" className="golf-beam" />
            </g>
          )}
          {millBlades(m, s.t).map(([a, b], j) => (
            <g key={j}>
              <line x1={a.x} y1={a.y + 3} x2={b.x} y2={b.y + 3} stroke="rgba(0,0,0,0.25)" strokeWidth="7" strokeLinecap="round" />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={t.mill} strokeWidth="7" strokeLinecap="round" />
            </g>
          ))}
          <circle cx={m.x} cy={m.y} r="6" fill={t.wallDark} stroke={t.wall} strokeWidth="2" />
        </g>
      ))}

      {sliders.map((r, i) => (
        <g key={`sl${i}`}>
          <rect x={r.x + 1} y={r.y + 4} width={r.w} height={r.h} rx="10" fill="rgba(0,0,0,0.25)" />
          <rect
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx={Math.min(10, r.h / 2)}
            fill={t.slider[0]}
            stroke={t.slider[1]}
            strokeWidth="2"
          />
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h / 2 + 1}
            fontSize={Math.min(18, r.h * 0.8)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {t.sliderEmoji}
          </text>
        </g>
      ))}

      {/* the cup and its flag */}
      <circle cx={cup.x} cy={cup.y} r={CUP_R + 3} fill="rgba(255,255,255,0.18)" />
      <circle cx={cup.x} cy={cup.y} r={CUP_R} fill="url(#golf-cup)" />
      {fx.sunkAt === null ? (
        <g className="golf-flag">
          <line x1={cup.x + 2} y1={cup.y + 2} x2={cup.x + 14} y2={cup.y - 30} stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
          <line x1={cup.x} y1={cup.y} x2={cup.x} y2={cup.y - 40} stroke="#fff" strokeWidth="2" />
          <path d={`M${cup.x} ${cup.y - 40}l24 8 -24 8z`} fill={flag} />
          <text x={cup.x + 8} y={cup.y - 29.5} fontSize="8" fontWeight="800" fill="#2f2a26">
            {s.hole + 1}
          </text>
        </g>
      ) : (
        // in! a little burst of confetti out of the cup
        s.t - fx.sunkAt < 0.9 && (
          <g opacity={1 - (s.t - fx.sunkAt) / 0.9}>
            {Array.from({ length: 14 }, (_, i) => {
              const a = (i / 14) * Math.PI * 2;
              const d = 8 + (s.t - fx.sunkAt!) * 70;
              return (
                <rect
                  key={i}
                  x={cup.x + Math.cos(a) * d - 2}
                  y={cup.y + Math.sin(a) * d - 2 - (s.t - fx.sunkAt!) * 20}
                  width="4"
                  height="4"
                  rx="1"
                  fill={['#ffd75e', '#ff8cc0', '#5ff3ff', flag][i % 4]}
                  transform={`rotate(${i * 40 + (s.t - fx.sunkAt!) * 400} ${cup.x + Math.cos(a) * d} ${cup.y + Math.sin(a) * d})`}
                />
              );
            })}
          </g>
        )
      )}
      <circle cx={h.tee.x} cy={h.tee.y} r="5" fill="rgba(255,255,255,0.3)" />

      {/* a splash where you went in */}
      {fx.splash && s.t - fx.splash.at < 0.8 && (
        <g opacity={1 - (s.t - fx.splash.at) / 0.8}>
          {[0, 0.25].map((dl) => (
            <circle
              key={dl}
              cx={fx.splash!.x}
              cy={fx.splash!.y}
              r={4 + Math.max(0, s.t - fx.splash!.at - dl) * 50}
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
            />
          ))}
        </g>
      )}

      {/* aiming: where it'll roll (up to the first bounce), and the power */}
      {aim && len > 6 && (
        <g>
          {path.map((p, i) =>
            i % 3 === 0 ? (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={2.4}
                fill="#fff"
                opacity={Math.max(0.15, 0.95 - (i / path.length) * 0.8)}
              />
            ) : null,
          )}
          <line
            x1={s.ball.x}
            y1={s.ball.y}
            x2={s.ball.x + (aim.dx / (Math.hypot(aim.dx, aim.dy) || 1)) * len * 0.5}
            y2={s.ball.y + (aim.dy / (Math.hypot(aim.dx, aim.dy) || 1)) * len * 0.5}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx={s.ball.x} cy={s.ball.y} r="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
          <circle
            cx={s.ball.x}
            cy={s.ball.y}
            r="20"
            fill="none"
            stroke={k > 0.85 ? '#ff4f6d' : k > 0.5 ? '#ffd75e' : '#ffffff'}
            strokeWidth="5"
            strokeDasharray={`${k * 125.7} 200`}
            transform={`rotate(-90 ${s.ball.x} ${s.ball.y})`}
            strokeLinecap="round"
          />
        </g>
      )}

      {/* the ball, with a little trail when it rolls */}
      {fx.trail.map((p, i) => (
        <circle
          key={`t${i}`}
          cx={p.x}
          cy={p.y}
          r={BALL_R * (0.35 + (i / fx.trail.length) * 0.5)}
          fill={skin.fill === 'rainbow' ? ['#ff5f6d', '#ffd75e', '#5fe08a', '#5fb8ff'][i % 4] : '#fff'}
          opacity={(i / fx.trail.length) * 0.35}
        />
      ))}
      {ballR > 0.3 && (
        <g>
          {fx.sunkAt === null && (
            <ellipse
              cx={ballAt.x + 2 + lift * 0.4}
              cy={ballAt.y + 3 + lift * 0.3}
              rx={BALL_R * (1 - airHeight(s) * 0.3)}
              ry={BALL_R * 0.7 * (1 - airHeight(s) * 0.3)}
              fill={`rgba(0,0,0,${0.3 - airHeight(s) * 0.15})`}
            />
          )}
          <BallSprite x={ballAt.x} y={ballAt.y - lift} r={ballR} skin={skin} roll={fx.roll} dir={dir} />
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------- remembering things */

const PICK_KEY = 'golf-course';
const progressKey = (p: Person) => `golf-progress:${p}`;
const skinKey = (p: Person) => `golf-ball:${p}`;

function load<T>(key: string, read: (raw: unknown) => T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : read(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* fine: it just won't be remembered */
  }
}

function useProgress() {
  const [all, setAll] = useState<Record<Person, GolfProgress>>(() => ({
    you: load(progressKey('you'), normalizeProgress, {}),
    partner: load(progressKey('partner'), normalizeProgress, {}),
  }));
  const [skins, setSkins] = useState<Record<Person, string>>(() => ({
    you: load(skinKey('you'), (v) => (typeof v === 'string' ? v : 'white'), 'white'),
    partner: load(skinKey('partner'), (v) => (typeof v === 'string' ? v : 'white'), 'white'),
  }));
  const holeDone = (who: Person, s: GolfState) => {
    setAll((cur) => {
      const next = recordHole(cur[who], courseOf(s), s.hole, s.strokes[s.hole] ?? 0);
      if (next === cur[who]) return cur;
      save(progressKey(who), next);
      return { ...cur, [who]: next };
    });
  };
  const skinOf = (who: Person): BallSkin => {
    const want = BALLS.find((b) => b.id === skins[who]);
    return want && ownsBall(all[who], want) ? want : BALLS[0];
  };
  const pickSkin = (who: Person, id: string) => {
    save(skinKey(who), id);
    setSkins((cur) => ({ ...cur, [who]: id }));
  };
  return { all, holeDone, skinOf, pickSkin };
}

const Stars = ({ n, of = 3 }: { n: number; of?: number }) => (
  <span className="golf-stars" aria-label={`${n} van ${of} sterren`}>
    {Array.from({ length: of }, (_, i) => (
      <i key={i} className={i < n ? 'is-on' : ''}>
        ★
      </i>
    ))}
  </span>
);

const COLORS: Record<Person, string> = { you: '#ffc61a', partner: '#ff5fa2' };

/* ------------------------------------------------------------ the game */

export function Golf() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('golf');
  const reduce = useReducedMotion();
  const progress = useProgress();
  const [mode, setMode] = useState<PlayMode>('live');
  const duel = useDuelRound('golf', mode);
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [, setFrame] = useState(0);
  const [picked, setPicked] = useState<number>(() => {
    try {
      return courseIndex(localStorage.getItem(PICK_KEY));
    } catch {
      return 0;
    }
  });
  const [line, setLine] = useState('Kies een wereld en een bal — sleep dan vanaf de bal naar achteren en laat los');
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const [localEnd, setLocalEnd] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ id: number; text: string; big?: boolean } | null>(null);
  /** On one phone we play together: a ball each, hole by hole. */
  const games = useRef<Record<Person, GolfState>>({ you: newGolf(picked), partner: newGolf(picked) });
  const [turn, setTurn] = useState<Person>(me);
  const fx = useRef<Fx>(freshFx());
  const stage = useRef<HTMLDivElement>(null);
  const svgBox = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const [aim, setAim] = useState<{ dx: number; dy: number } | null>(null);
  const [path, setPath] = useState<P[]>([]);
  const busy = useRef(false);

  const together = mode === 'local';
  const player: Person = together ? turn : me;
  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'golf', me) : null;
  const answering = plan?.type === 'answer' ? matches.find((m) => m.id === plan.id) : undefined;
  const target = answering ? (duelScores(answering)[them] ?? null) : null;
  /** In a duel we answer it's the same course as theirs. */
  const lockedCourse = answering !== undefined ? courseIndex(answering.state.course) : null;
  const courseNo = lockedCourse ?? picked;
  const myProgress = progress.all[me];
  const flag = COLORS[player];
  const skin = progress.skinOf(player);

  const say = (text: string, big = false) => setBanner({ id: performance.now(), text, big });
  // (the animation loop keeps old closures: always ask the ref who's playing)
  const playerRef = useRef(player);
  playerRef.current = player;
  const current = () => games.current[playerRef.current];
  const setCurrent = (s: GolfState) => {
    games.current = { ...games.current, [playerRef.current]: s };
  };

  const choose = (i: number) => {
    if (!isOpen(myProgress, COURSES[i])) {
      playSfx('error', true);
      say(
        COURSES[i].secret
          ? `🤫 Iets geheims… haal alle sterren op ${SECRET_SHORT} na`
          : `🔒 Nog ${(COURSES[i].unlock ?? 0) - totalStars(myProgress)} ⭐ nodig`,
      );
      return;
    }
    if (COURSES[i].secret) playSfx('sparkle', true);
    setPicked(i);
    try {
      localStorage.setItem(PICK_KEY, COURSES[i].id);
    } catch {
      /* fine */
    }
    if (phase === 'ready') games.current = { you: newGolf(i), partner: newGolf(i) };
  };

  const nearestBumper = (s: GolfState) => {
    const bs = holeOf(s).bumpers ?? [];
    let bi = -1;
    let d = Infinity;
    bs.forEach((b, i) => {
      const dd = Math.hypot(b.x - s.ball.x, b.y - s.ball.y) - b.r;
      if (dd < d) {
        d = dd;
        bi = i;
      }
    });
    return bi;
  };

  const react = (events: GolfEvent[], s: GolfState) => {
    const f = fx.current;
    for (const e of events) {
      if (e.type === 'wall') {
        playSfx('clunk', true);
        const v = Math.hypot(s.ball.vx, s.ball.vy);
        if (v > 220 && !reduce) f.shake = { at: s.t, power: Math.min(5, v / 90) };
      } else if (e.type === 'bump') {
        playSfx('boing', true);
        f.bump = { i: nearestBumper(s), at: s.t };
      } else if (e.type === 'boost') playSfx('whoosh', true);
      else if (e.type === 'jump') {
        playSfx('whoosh', true);
        say('🛝 Wieee!');
      } else if (e.type === 'land') {
        playSfx('thunk', true);
        if (!reduce) f.shake = { at: s.t, power: 2.5 };
      } else if (e.type === 'click') {
        playSfx('unlock', true);
        say('🔓 Klik! Het poortje gaat open');
      } else if (e.type === 'warp') {
        playSfx('sparkle', true);
        f.warpAt = s.t;
        f.trail = [];
      } else if (e.type === 'lip') setLine('Net over de rand — iets zachter!');
      else if (e.type === 'out') setLine('Oeps, door de muur geglipt — probeer opnieuw');
      else if (e.type === 'water' || e.type === 'void') {
        playSfx(e.type === 'water' ? 'splash' : 'whirr', true);
        f.splash = { ...e.at, at: s.t };
        f.trail = [];
        say(e.type === 'void' ? '🕳️ Opgeslokt door het zwarte gat! +1 slag' : THEMES[courseOf(s).theme].hazardText);
      } else if (e.type === 'sunk') {
        f.sunkAt = s.t;
        f.trail = [];
        progress.holeDone(playerRef.current, s);
        const stars = holeStars(e.strokes, e.par);
        playSfx(e.strokes === 1 ? 'star' : 'success', true);
        say(
          `${holeWord(e.strokes, e.par)} · +${holePoints(e.strokes, e.par)} ${'★'.repeat(stars)}`,
          e.strokes === 1,
        );
        if (e.strokes === 1 || stars === 3 || courseOf(s).secret) celebrateFrom(svgBox.current);
        if (courseOf(s).secret) {
          window.setTimeout(() => celebrateFrom(svgBox.current), 500);
          window.setTimeout(() => say('🌈 Je hebt het geheime level uitgespeeld! ✦ Sterrenstof-bal vrijgespeeld', true), 900);
        }
        busy.current = true;
        window.setTimeout(() => advance(), reduce ? 400 : e.strokes === 1 ? 2400 : 1600);
      } else if (e.type === 'max') {
        progress.holeDone(playerRef.current, s);
        say(`${MAX_STROKES} slagen — door naar de volgende`);
        busy.current = true;
        window.setTimeout(() => advance(), reduce ? 400 : 1400);
      }
    }
  };

  /** Who's next on one phone: whoever's behind, the first of us on a tie. */
  const nextUp = (): Person => {
    const g = games.current;
    const at = (p: Person) => (g[p].over ? 99 : g[p].hole);
    return at(them) < at(me) ? them : me;
  };

  const advance = () => {
    busy.current = false;
    const out = nextHole(current());
    setCurrent(out.state);
    fx.current = freshFx();
    if (together) {
      const g = games.current;
      if (g.you.over && g.partner.over) return finish();
      const who = nextUp();
      playerRef.current = who;
      setTurn(who);
      const s = g[who];
      const h = holeOf(s);
      say(`${who === me ? '💛' : '💗'} ${nameOf(who, profile)} · Hole ${s.hole + 1}: ${h.name}`);
      setLine(tipFor(h));
      return;
    }
    if (out.state.over) finish();
    else {
      const h = holeOf(out.state);
      say(`${h.emoji} Hole ${out.state.hole + 1}: ${h.name} · par ${h.par}`);
      setLine(tipFor(h));
    }
  };

  useEffect(() => {
    if (phase !== 'play') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const s0 = games.current[playerRef.current];
      if (!s0.over) {
        const out = step(s0, dt);
        games.current = { ...games.current, [playerRef.current]: out.state };
        const f = fx.current;
        if (out.state.moving) {
          f.trail.push({ x: out.state.ball.x, y: out.state.ball.y });
          if (f.trail.length > 12) f.trail.shift();
          f.roll += Math.hypot(out.state.ball.x - s0.ball.x, out.state.ball.y - s0.ball.y);
        } else if (f.trail.length) f.trail.shift();
        if (out.events.length) react(out.events, out.state);
      }
      setFrame((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), banner.big ? 2600 : 1800);
    return () => window.clearTimeout(t);
  }, [banner]);

  const finish = () => {
    setPhase('done');
    const g = games.current;
    if (together) {
      const a = golfScore(g[me]);
      const b = golfScore(g[them]);
      addScore('golf', a, me);
      addScore('golf', b, them);
      const winner: Person | 'draw' = a === b ? 'draw' : a > b ? me : them;
      recordResult('golf', ['you', 'partner'], winner);
      playSfx('success', true);
      celebrateFrom(stage.current);
      setLocalEnd(
        winner === 'draw'
          ? `Gelijkspel! ${a}–${b} 💛💗`
          : `${nameOf(winner, profile)} wint ${Math.max(a, b)}–${Math.min(a, b)}! 🏆`,
      );
      setLine('Wat een rondje samen ⛳');
      return;
    }
    const s = g[me];
    const total = golfScore(s);
    const myBest = best[me];
    setRecord(myBest !== null && myBest !== undefined && total > myBest);
    if (mode !== 'coco') {
      const end = duel.finish(total, { course: COURSES[s.course].id });
      setLine(end.text);
      setTickets(end.tickets);
      if (end.tickets) celebrateFrom(stage.current);
      return;
    }
    if (getAuthor()) addScore('golf', total);
    const coco = cocoGolf(Math.random, s.course);
    setCocoScore(coco);
    addScore('golf', coco, 'coco');
    const winner = total > coco ? me : total < coco ? 'coco' : 'draw';
    recordResult('golf', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      winner === me
        ? `Jij wint! ${total} tegen ${coco} ⛳🎉`
        : winner === 'coco'
          ? `Coco wint met ${coco} tegen ${total} — met haar neusje 🐰`
          : `Gelijk! ${total}–${coco}`,
    );
  };

  const start = () => {
    games.current = { you: newGolf(courseNo), partner: newGolf(courseNo) };
    fx.current = freshFx();
    busy.current = false;
    setTurn(me);
    setTickets(null);
    setCocoScore(null);
    setLocalEnd(null);
    setRecord(false);
    setPhase('play');
    const h = holeOf(games.current[me]);
    say(
      together
        ? `💛 ${nameOf(me, profile)} begint · Hole 1: ${h.name}`
        : `${h.emoji} Hole 1: ${h.name} · par ${h.par}`,
    );
    setLine(tipFor(h));
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  const restart = () => {
    duel.reset();
    games.current = { you: newGolf(picked), partner: newGolf(picked) };
    fx.current = freshFx();
    setTurn(me);
    setPhase('ready');
    setLocalEnd(null);
    setLine('Kies een wereld en een bal — sleep dan vanaf de bal naar achteren en laat los');
  };

  const local = (e: React.PointerEvent) => {
    const r = svgBox.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  // Before teeing off, show the course you're about to play.
  if (phase === 'ready' && games.current[me].course !== courseNo)
    games.current = { you: newGolf(courseNo), partner: newGolf(courseNo) };
  const s = games.current[player];
  const course = courseOf(s);
  const h = holeOf(s);
  const score = golfScore(s);
  const f = fx.current;
  const shake =
    f.shake && s.t - f.shake.at < 0.3
      ? Math.sin(s.t * 95) * f.shake.power * (1 - (s.t - f.shake.at) / 0.3)
      : 0;
  const stars = totalStars(myProgress);
  const myStars = (p: Person) => course.holes.map((hole, i) => holeStars(games.current[p].strokes[i] ?? 0, hole.par));

  return (
    <GameShell
      id="golf"
      title="Minigolf"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        restart();
      }}
      modes={['live', 'remote', 'local', 'coco']}
      labels={{
        ...DUEL_LABELS,
        live: '📱↔📱 Live samen',
        remote: '⚔️ Duel (apart)',
        local: '💛💗 Eén telefoon',
      }}
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
      {mode === 'live' ? (
        <WhoAreYou>
          <GolfLive progress={progress} />
        </WhoAreYou>
      ) : (
        <>
      {together ? (
        <p className="duel-panel">
          Samen op één telefoon: om de beurt per hole, net als echt minigolf. Wie heeft na 6 holes de meeste punten? 💛💗
        </p>
      ) : (
        <DuelPanel kind="golf" mode={mode} first={duel.first} result={duel.result} />
      )}
      <div className={`golf-park is-${course.theme}`} ref={stage}>
        {phase === 'ready' && (
          <>
            <p className="golf-total">
              <Stars n={1} of={1} /> {stars} sterren verzameld
            </p>
            <div className="golf-worlds" role="radiogroup" aria-label="Kies een wereld">
              {COURSES.map((c, i) => {
                const open = isOpen(myProgress, c) || lockedCourse === i;
                const locked = (lockedCourse !== null && lockedCourse !== i) || !open;
                if (c.secret)
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={courseNo === i}
                      aria-disabled={locked}
                      aria-label={open ? `Geheim level: ${c.name}` : 'Geheim level, nog op slot'}
                      className={`golf-world golf-secret${open ? ' is-open' : ''}${courseNo === i ? ' is-on' : ''}`}
                      onClick={() => lockedCourse === null && choose(i)}
                    >
                      <span className="golf-world__emoji" aria-hidden="true">
                        {open ? '🌈' : '❓'}
                      </span>
                      <strong>{open ? `✨ ${c.name} ✨` : '???'}</strong>
                      <small>
                        {open
                          ? `Geheim level · par ${c.holes[0].par}`
                          : `Geheim · nog ${Math.max(0, MAX_STARS - SECRET_SHORT - allStars(myProgress))} ⭐`}
                      </small>
                    </button>
                  );
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={courseNo === i}
                    aria-disabled={locked}
                    className={`golf-world is-${c.theme}${courseNo === i ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
                    onClick={() => lockedCourse === null && choose(i)}
                  >
                    <span className="golf-world__emoji" aria-hidden="true">
                      {open ? c.emoji : '🔒'}
                    </span>
                    <strong>{c.name}</strong>
                    <small>
                      {open ? `★ ${courseStars(myProgress, c)}/${c.holes.length * 3}` : `${c.unlock} ★ nodig`}
                    </small>
                  </button>
                );
              })}
            </div>
            <div className="golf-balls" role="radiogroup" aria-label="Kies je bal">
              {BALLS.map((b) => {
                const own = ownsBall(progress.all[player], b);
                const isSecret = 'secret' in b && b.secret;
                if (isSecret && !own) return null;
                const on = progress.skinOf(player).id === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={own ? `Bal: ${b.name}` : `${b.name}: nog ${b.stars} sterren nodig`}
                    title={own ? b.name : `${b.stars} ★ nodig`}
                    className={`golf-ballpick${on ? ' is-on' : ''}${own ? '' : ' is-locked'}`}
                    onClick={() => {
                      if (!own) {
                        playSfx('error', true);
                        say(`🔒 ${b.name}: verzamel ${b.stars} ⭐`);
                        return;
                      }
                      playSfx('pop', true);
                      progress.pickSkin(player, b.id);
                    }}
                  >
                    <svg viewBox="-10 -10 20 20" aria-hidden="true">
                      <BallSprite x={0} y={0} r={7} skin={b} roll={0} dir={{ x: 0, y: -1 }} />
                    </svg>
                    {!own && <small>{b.stars}★</small>}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {phase === 'ready' && lockedCourse !== null && (
          <p className="golf-target">
            🔒 Duel op {COURSES[lockedCourse].emoji} {COURSES[lockedCourse].name} — dezelfde holes
          </p>
        )}
        {together && phase === 'play' && (
          <p className="golf-turn" style={{ background: COLORS[player] }} aria-live="polite">
            {player === me ? '💛' : '💗'} {nameOf(player, profile)} is aan de beurt
          </p>
        )}
        <div className="golf-sign">
          <span className="golf-sign__world">
            {course.emoji} {course.name}

          </span>
          <span className="golf-sign__hole">
            {h.emoji} Hole {s.hole + 1}/{course.holes.length} · {h.name}
          </span>
          <span className="golf-sign__meta">
            par {h.par} · slag {s.strokes[s.hole] ?? 0} · {score} pt
          </span>
        </div>
        {target !== null && phase !== 'done' && (
          <p className="golf-target">
            🎯 Te verslaan: <strong>{target}</strong> punten van {nameOf(them, profile)}
          </p>
        )}
        <div
          className="golf-green"
          ref={svgBox}
          role="application"
          tabIndex={0}
          style={shake ? { transform: `translate(${shake}px, ${shake * 0.6}px)` } : undefined}
          aria-label={`Minigolf, ${course.name}, hole ${s.hole + 1}: sleep naar achteren en laat los om te slaan`}
          onPointerDown={(e) => {
            if (phase !== 'play' || s.moving || s.sunk || busy.current) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            press.current = local(e);
            setAim({ dx: 0, dy: 0 });
            setPath([]);
          }}
          onPointerMove={(e) => {
            if (!press.current) return;
            const p = local(e);
            const a = { dx: p.x - press.current.x, dy: p.y - press.current.y };
            setAim(a);
            setPath(preview(current(), a.dx, a.dy));
          }}
          onPointerUp={(e) => {
            const from = press.current;
            press.current = null;
            setAim(null);
            setPath([]);
            if (!from || busy.current) return;
            const p = local(e);
            const before = current().strokes[current().hole];
            setCurrent(putt(current(), p.x - from.x, p.y - from.y));
            if (current().strokes[current().hole] > before) {
              playSfx('tap', true);
              fx.current.trail = [];
            }
          }}
          onPointerCancel={() => {
            press.current = null;
            setAim(null);
            setPath([]);
          }}
        >
          <CourseView s={s} aim={aim} path={path} flag={flag} fx={f} skin={skin} />
          <AnimatePresence>
            {banner && (
              <motion.p
                key={banner.id}
                className={`golf-banner${banner.big ? ' is-big' : ''}`}
                initial={{ opacity: 0, y: -10, scale: banner.big ? 0.6 : 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {banner.text}
              </motion.p>
            )}
          </AnimatePresence>
          {phase === 'ready' && (
            <div className="golf-start">
              <p>
                {course.emoji} {course.name} · {course.blurb}
              </p>
              <p className="golf-start__small">
                Sleep naar achteren — hoe verder, hoe harder — en laat los. De stippellijn laat zien waar je bal
                heen rolt, tot de eerste botsing.
              </p>
              <button type="button" className="golf-go" onClick={start}>
                {together ? 'Samen afslaan 💛💗' : 'Afslaan ⛳'}
              </button>
            </div>
          )}
        </div>

        {together ? (
          <table className="golf-duo" aria-label="Scorekaart">
            <thead>
              <tr>
                <th />
                {course.holes.map((hole, i) => (
                  <th key={hole.name} className={i === s.hole && phase === 'play' ? 'is-now' : ''}>
                    {i + 1}
                    <small>par {hole.par}</small>
                  </th>
                ))}
                <th>pt</th>
              </tr>
            </thead>
            <tbody>
              {([me, them] as Person[]).map((p) => {
                const g = games.current[p];
                return (
                  <tr key={p} className={p === player && phase === 'play' ? 'is-turn' : ''}>
                    <th style={{ color: COLORS[p] }}>{nameOf(p, profile)}</th>
                    {course.holes.map((hole, i) => {
                      const k = g.strokes[i];
                      const done = i < g.hole || (i === g.hole && (g.sunk || g.over));
                      const shown = done && k ? Math.min(MAX_STROKES, k) : null;
                      const tone =
                        shown === null ? '' : shown < hole.par ? 'is-under' : shown > hole.par ? 'is-over' : 'is-par';
                      return (
                        <td key={hole.name} className={tone}>
                          {shown ?? '·'}
                        </td>
                      );
                    })}
                    <td className="golf-duo__total">{golfScore(g)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <ol className="golf-card" aria-label="Scorekaart">
            {course.holes.map((hole, i) => {
              const k = s.strokes[i];
              const done = i < s.hole || (i === s.hole && (s.sunk || s.over));
              const shown = done && k ? Math.min(MAX_STROKES, k) : null;
              const tone =
                shown === null ? '' : shown < hole.par ? ' is-under' : shown > hole.par ? ' is-over' : ' is-par';
              const bestK = myProgress[course.id]?.[i] ?? 0;
              return (
                <li key={hole.name} className={`${i === s.hole && !s.over ? 'is-now' : ''}${tone}`} title={hole.name}>
                  <small>
                    {hole.emoji} {i + 1}
                  </small>
                  <strong>{shown ?? '·'}</strong>
                  {done ? <Stars n={myStars(me)[i]} /> : <Stars n={holeStars(bestK, hole.par)} />}
                </li>
              );
            })}
          </ol>
        )}
        {cocoScore !== null && <p className="golf-coco">🐰 Coco haalde {cocoScore} punten</p>}
      </div>
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <TicketStrip tickets={tickets} />
      {phase === 'done' && together && localEnd && (
        <RoundCard
          title={localEnd}
          score={Math.max(golfScore(games.current.you), golfScore(games.current.partner))}
          stats={[
            { label: nameOf(me, profile), value: `${golfScore(games.current[me])} pt · ${totalStrokes(games.current[me])} slagen` },
            { label: nameOf(them, profile), value: `${golfScore(games.current[them])} pt · ${totalStrokes(games.current[them])} slagen` },
            { label: 'Wereld', value: `${course.emoji} ${course.name}` },
          ]}
        />
      )}
      {phase === 'done' && !together && (
        <RoundCard
          title={`${course.emoji} ${course.name} uitgespeeld!`}
          score={score}
          record={record}
          stars={
            course.holes.length !== HOLES_PER_COURSE
              ? holeStars(s.strokes[0] ?? 0, course.holes[0].par)
              : score >= PAR_POINTS + 20
                ? 3
                : score >= PAR_POINTS - 40
                  ? 2
                  : score >= PAR_POINTS - 100
                    ? 1
                    : 0
          }
          stats={[
            { label: 'Slagen', value: `${totalStrokes(s)} (par ${coursePar(course)})` },
            { label: 'Sterren', value: `${myStars(me).reduce((n, k) => n + k, 0)} / ${course.holes.length * 3}` },
            { label: 'Hole in one', value: s.strokes.filter((k) => k === 1).length },
          ]}
        />
      )}
      {phase === 'done' && (
        <button type="button" className="neon-btn" onClick={restart}>
          Nog een rondje ⛳
        </button>
      )}
        </>
      )}
    </GameShell>
  );
}

/** A small tip for what's new on this hole. */
function tipFor(h: Hole): string {
  if (h.cupMove) return 'De cup schuift heen en weer — mik op waar hij straks is 🎯';
  if (h.buttons?.length) return 'Rol over de rode knop om het poortje te openen 🔓';
  if (h.ramps?.length) return 'Neem de schans met vaart en je vliegt eroverheen 🛝';
  if (h.wells?.length) return 'Het zwarte gat trekt je bal aan — niet in het midden komen!';
  if (h.portals?.length) return 'Rol door een paars portaal en je komt er oranje weer uit';
  if (h.boosts?.length) return 'De pijlen geven je bal een flinke duw';
  if (h.slopes?.length) return 'Een heuvel: de bal rolt mee in de richting van de pijltjes';
  if (h.bumpers?.length) return 'De bumpers kaatsen je bal extra hard terug';
  if (h.mills?.length) return 'Wacht op een gat tussen de wieken';
  if (h.sliders?.length) return 'Timing! Sla als het blok net voorbij is';
  if (h.water?.length) return 'Ga om het water heen — erin kost een slag';
  if (h.sand?.length) return 'Zand remt je bal flink af';
  return 'Sleep naar achteren en laat los';
}

/* ------------------------------------------------ live, on two phones */

/** Fixed steps, so both phones roll the very same ball. */
const LIVE_DT = 1 / 120;

interface LiveShot {
  dx: number;
  dy: number;
  t: number;
}

interface LiveRun {
  by: Person;
  hole: number;
  shots: LiveShot[];
  skin: string;
}

interface LiveGame {
  course: string;
  hole: number;
  /** Who putts first on every hole. */
  order: [Person, Person];
  strokes: Record<Person, number[]>;
  /** The hole being played right now (every putt, as it's made). */
  live: LiveRun | null;
  /** The hole just finished (so the other can watch its last putt). */
  last: LiveRun | null;
}

function readRun(v: unknown): LiveRun | null {
  const r = v as Partial<LiveRun> | null;
  if (!r || (r.by !== 'you' && r.by !== 'partner') || !Array.isArray(r.shots)) return null;
  return {
    by: r.by,
    hole: Number.isInteger(r.hole) ? (r.hole as number) : 0,
    shots: r.shots.filter(
      (x): x is LiveShot =>
        !!x && [x.dx, x.dy, x.t].every((n) => typeof n === 'number' && Number.isFinite(n)),
    ),
    skin: typeof r.skin === 'string' ? r.skin : 'white',
  };
}

function readLive(raw: Record<string, unknown>): LiveGame {
  const nums = (v: unknown) =>
    Array.isArray(v) ? v.map((n) => (Number.isInteger(n) && n > 0 ? Math.min(MAX_STROKES, n) : 0)) : [];
  const st = (raw.strokes ?? {}) as Record<string, unknown>;
  const order = Array.isArray(raw.order) && raw.order[0] === 'partner' ? ['partner', 'you'] : ['you', 'partner'];
  return {
    course: typeof raw.course === 'string' ? raw.course : 'park',
    hole: Number.isInteger(raw.hole) ? (raw.hole as number) : 0,
    order: order as [Person, Person],
    strokes: { you: nums(st.you), partner: nums(st.partner) },
    live: readRun(raw.live),
    last: readRun(raw.last),
  };
}

/** A fresh ball on the tee of this hole. */
function atHole(course: number, hole: number): GolfState {
  let s = newGolf(course);
  for (let i = 0; i < hole; i++) s = nextHole({ ...s, sunk: true }).state;
  return { ...s, strokes: s.strokes.map(() => 0) };
}

interface Replay {
  id: string;
  run: LiveRun;
  done: number;
  state: GolfState;
  /** When it finished rolling (it stays on screen a moment). */
  endAt: number | null;
}

function GolfLive({ progress }: { progress: ReturnType<typeof useProgress> }) {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const reduce = useReducedMotion();
  const match = matches
    .filter((m) => m.kind === 'golf' && m.state.duo)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  const st = match ? readLive(match.state) : null;
  const [picked, setPicked] = useState(0);
  const courseNo = st ? courseIndex(st.course) : picked;
  const course = COURSES[courseNo];
  const playing = Boolean(match && !match.winner);
  const mine = Boolean(playing && match!.turn === me);
  const [, setFrame] = useState(0);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [aim, setAim] = useState<{ dx: number; dy: number } | null>(null);
  const [path, setPath] = useState<P[]>([]);
  const press = useRef<{ x: number; y: number } | null>(null);
  const svgBox = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const mineState = useRef<GolfState>(atHole(courseNo, st?.hole ?? 0));
  const mineKey = useRef('');
  const fx = useRef<Fx>(freshFx());
  const replay = useRef<Replay | null>(null);
  const watched = useRef(new Set<string>());
  const shown = useRef('');
  const busy = useRef(false);
  const live = useRef({ match, st, mine, me });
  live.current = { match, st, mine, me };

  const say = (text: string) => setBanner({ id: performance.now(), text });
  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(t);
  }, [banner]);

  // my turn on a new hole: a fresh ball on the tee
  const key = match && st ? `${match.id}:${st.hole}:${match.turn ?? 'end'}` : 'none';
  if (mine && key !== mineKey.current) {
    mineKey.current = key;
    mineState.current = atHole(courseNo, st!.hole);
    busy.current = false;
    fx.current = freshFx();
  }

  // the other's putts: watch each one roll, the same as on their phone
  useEffect(() => {
    if (!match || !st) return;
    // when a match is first seen, don't replay what happened long ago
    const fresh = Date.now() - new Date(match.updatedAt).getTime() < 60_000;
    for (const run of [st.last, st.live]) {
      if (!run || run.by !== them) continue;
      const id = `${match.id}:${run.hole}`;
      if (watched.current.has(id)) continue;
      if (replay.current?.id === id) {
        replay.current.run = run;
        continue;
      }
      if (!fresh && run === st.last) {
        watched.current.add(id);
        continue;
      }
      if (replay.current) continue;
      replay.current = { id, run, done: 0, state: atHole(courseNo, run.hole), endAt: null };
      fx.current = freshFx();
    }
  }, [match?.updatedAt, match?.id]);

  const finishHole = (s: GolfState) => {
    const { match: m0, st: g0 } = live.current;
    if (!m0 || !g0) return;
    const k = Math.min(MAX_STROKES, s.strokes[s.hole] ?? MAX_STROKES);
    progress.holeDone(me, s);
    updateMatch(m0.id, (m) => {
      const g = readLive(m.state);
      if (m.winner || m.turn !== me || g.hole !== s.hole) return m;
      const strokes = { ...g.strokes, [me]: [...g.strokes[me]] };
      strokes[me][g.hole] = k;
      const run = g.live && g.live.by === me ? g.live : null;
      const base = { ...m.state, strokes, live: null, last: run };
      if (me === g.order[0]) return { ...m, state: base, turn: g.order[1] };
      const holes = COURSES[courseIndex(g.course)].holes.length;
      if (g.hole + 1 < holes) return { ...m, state: { ...base, hole: g.hole + 1 }, turn: g.order[0] };
      const c = courseIndex(g.course);
      const a = golfScore({ strokes: strokes.you, course: c });
      const b = golfScore({ strokes: strokes.partner, course: c });
      return { ...m, state: base, turn: undefined, winner: a === b ? 'draw' : a > b ? 'you' : 'partner' };
    });
  };

  const sounds = (events: GolfEvent[], s: GolfState, f: Fx, ownBall: boolean) => {
    for (const e of events) {
      if (e.type === 'wall') playSfx('clunk', true);
      else if (e.type === 'bump') playSfx('boing', true);
      else if (e.type === 'boost' || e.type === 'jump') playSfx('whoosh', true);
      else if (e.type === 'click') playSfx('unlock', true);
      else if (e.type === 'warp') {
        playSfx('sparkle', true);
        f.warpAt = s.t;
        f.trail = [];
      } else if (e.type === 'water' || e.type === 'void') {
        playSfx(e.type === 'water' ? 'splash' : 'whirr', true);
        f.splash = { ...e.at, at: s.t };
        f.trail = [];
        if (ownBall) say(THEMES[courseOf(s).theme].hazardText);
      } else if (e.type === 'sunk') {
        f.sunkAt = s.t;
        f.trail = [];
        playSfx(e.strokes === 1 ? 'star' : 'success', true);
        const who = ownBall ? 'Jij' : nameOf(them, profile);
        say(`${who}: ${holeWord(e.strokes, e.par)}`);
        if (e.strokes === 1) celebrateFrom(svgBox.current);
      }
    }
  };
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;
  const finishRef = useRef(finishHole);
  finishRef.current = finishHole;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      acc += dt;
      const f = fx.current;
      const rp = replay.current;
      while (acc >= LIVE_DT) {
        acc -= LIVE_DT;
        if (rp) {
          let s = rp.state;
          if (!s.moving && !s.sunk && rp.done < rp.run.shots.length) {
            const shot = rp.run.shots[rp.done++];
            s = putt({ ...s, t: shot.t }, shot.dx, shot.dy);
            f.trail = [];
          }
          const out = step(s, LIVE_DT);
          if (out.state.moving) {
            f.roll += Math.hypot(out.state.ball.x - s.ball.x, out.state.ball.y - s.ball.y);
            if (Math.random() < 0.5) {
              f.trail.push({ x: out.state.ball.x, y: out.state.ball.y });
              if (f.trail.length > 12) f.trail.shift();
            }
          }
          rp.state = out.state;
          if (out.events.length) soundsRef.current(out.events, out.state, f, false);
          const { st: g } = live.current;
          const finished = g?.last?.by === rp.run.by && g.last.hole === rp.run.hole;
          if (!out.state.moving && rp.done >= rp.run.shots.length && (out.state.sunk || finished)) {
            if (rp.endAt === null) rp.endAt = now;
            else if (now - rp.endAt > 1300) {
              watched.current.add(rp.id);
              replay.current = null;
              fx.current = freshFx();
              break;
            }
          }
        } else if (live.current.mine) {
          const s0 = mineState.current;
          const out = step(s0, LIVE_DT);
          mineState.current = out.state;
          if (out.state.moving) {
            f.roll += Math.hypot(out.state.ball.x - s0.ball.x, out.state.ball.y - s0.ball.y);
            if (Math.random() < 0.5) {
              f.trail.push({ x: out.state.ball.x, y: out.state.ball.y });
              if (f.trail.length > 12) f.trail.shift();
            }
          } else if (f.trail.length) f.trail.shift();
          if (out.events.length) soundsRef.current(out.events, out.state, f, true);
          if (!busy.current && out.events.some((e) => e.type === 'sunk' || e.type === 'max')) {
            busy.current = true;
            const done = out.state;
            window.setTimeout(() => finishRef.current(done), reduce ? 400 : 1500);
          }
        }
      }
      setFrame((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const local = (e: React.PointerEvent) => {
    const r = svgBox.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const begin = () => {
    startMatch(
      'golf',
      {
        duo: true,
        course: course.id,
        hole: 0,
        order: [me, them],
        strokes: { you: [], partner: [] },
        live: null,
        last: null,
      },
      me,
      me,
    );
    watched.current = new Set();
    replay.current = null;
    playSfx('pop', true);
  };

  const shoot = (dx: number, dy: number) => {
    const { match: m0, st: g0 } = live.current;
    if (!m0 || !g0 || busy.current) return;
    const s = mineState.current;
    const next = putt(s, dx, dy);
    if (next === s || !next.moving) return;
    const shot = { dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100, t: s.t };
    // (rounded, so both phones putt exactly the same ball)
    mineState.current = putt(s, shot.dx, shot.dy);
    fx.current.trail = [];
    playSfx('tap', true);
    const skin = progress.skinOf(me).id;
    updateMatch(m0.id, (m) => {
      const g = readLive(m.state);
      const before = g.live && g.live.by === me && g.live.hole === g.hole ? g.live.shots : [];
      return { ...m, state: { ...m.state, live: { by: me, hole: g.hole, shots: [...before, shot], skin } } };
    });
  };

  // what's on screen: their ball rolling, my ball, or the tee
  const rp = replay.current;
  const viewId = rp ? rp.id : mine ? `mine:${mineKey.current}` : `idle:${key}`;
  if (viewId !== shown.current) {
    shown.current = viewId;
    fx.current = freshFx();
  }
  const s = rp ? rp.state : mine ? mineState.current : atHole(courseNo, st?.hole ?? 0);
  const ballOwner: Person = rp ? rp.run.by : mine ? me : (match?.turn as Person) ?? me;
  const skin = rp
    ? (BALLS.find((b) => b.id === rp.run.skin) ?? BALLS[0])
    : progress.skinOf(mine ? me : ballOwner);
  const h = holeOf(s);
  const canPutt = mine && !rp && !busy.current && !s.moving && !s.sunk;
  const myProgress = progress.all[me];
  const sc = (p: Person) => golfScore({ strokes: st?.strokes[p] ?? [], course: courseNo });
  const order: Person[] = st ? st.order : [me, them];

  return (
    <div className={`golf-park is-${course.theme}`} ref={stage}>
      {!playing && (
        <>
          <p className="duel-panel">
            Elk op je eigen telefoon, om de beurt per hole. Je ziet de bal van de ander live over jouw scherm rollen 📱↔📱
          </p>
          <div className="golf-worlds" role="radiogroup" aria-label="Kies een wereld">
            {COURSES.map((c, i) => {
              const open = isOpen(myProgress, c);
              if (c.secret && !open) return null;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={courseNo === i}
                  aria-disabled={!open}
                  className={`golf-world is-${c.theme}${courseNo === i ? ' is-on' : ''}${open ? '' : ' is-locked'}`}
                  onClick={() => (open ? setPicked(i) : playSfx('error', true))}
                >
                  <span className="golf-world__emoji" aria-hidden="true">
                    {open ? c.emoji : '🔒'}
                  </span>
                  <strong>{c.name}</strong>
                  <small>{open ? `par ${coursePar(c)}` : `${c.unlock} ★ nodig`}</small>
                </button>
              );
            })}
          </div>
        </>
      )}
      {playing && (
        <p
          className="golf-turn"
          style={{ background: COLORS[rp ? rp.run.by : (match!.turn as Person)] }}
          aria-live="polite"
        >
          {rp
            ? `👀 ${nameOf(rp.run.by, profile)} is aan het putten…`
            : mine
              ? '⛳ Jouw beurt!'
              : `⏳ ${nameOf(them, profile)} is aan de beurt`}
        </p>
      )}
      <div className="golf-sign">
        <span className="golf-sign__world">
          {course.emoji} {course.name}
        </span>
        <span className="golf-sign__hole">
          {h.emoji} Hole {s.hole + 1}/{course.holes.length} · {h.name}
        </span>
        <span className="golf-sign__meta">
          par {h.par} · slag {s.strokes[s.hole] ?? 0}
        </span>
      </div>
      <div
        className="golf-green"
        ref={svgBox}
        role="application"
        tabIndex={0}
        aria-label={`Minigolf live, hole ${s.hole + 1}${canPutt ? ': sleep naar achteren en laat los' : ''}`}
        onPointerDown={(e) => {
          if (!canPutt) return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          press.current = local(e);
          setAim({ dx: 0, dy: 0 });
          setPath([]);
        }}
        onPointerMove={(e) => {
          if (!press.current) return;
          const p = local(e);
          const a = { dx: p.x - press.current.x, dy: p.y - press.current.y };
          setAim(a);
          setPath(preview(mineState.current, a.dx, a.dy));
        }}
        onPointerUp={(e) => {
          const from = press.current;
          press.current = null;
          setAim(null);
          setPath([]);
          if (!from || !canPutt) return;
          const p = local(e);
          shoot(p.x - from.x, p.y - from.y);
        }}
        onPointerCancel={() => {
          press.current = null;
          setAim(null);
          setPath([]);
        }}
      >
        <CourseView s={s} aim={canPutt ? aim : null} path={path} flag={COLORS[ballOwner]} fx={fx.current} skin={skin} />
        <AnimatePresence>
          {banner && (
            <motion.p
              key={banner.id}
              className="golf-banner"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {banner.text}
            </motion.p>
          )}
        </AnimatePresence>
        {!playing && (
          <div className="golf-start">
            {match?.winner && (
              <p>
                {match.winner === 'draw'
                  ? `Gelijkspel! ${sc('you')}–${sc('partner')} 💛💗`
                  : match.winner === me
                    ? `Jij wint ${sc(me)}–${sc(them)}! 🏆`
                    : `${nameOf(them, profile)} wint ${sc(them)}–${sc(me)} 🏌️`}
              </p>
            )}
            <p>
              {course.emoji} {course.name} · {course.blurb}
            </p>
            <button type="button" className="golf-go" onClick={begin}>
              {match?.winner ? 'Nog een potje 📱↔📱' : 'Start samen 📱↔📱'}
            </button>
          </div>
        )}
      </div>
      {st && (
        <table className="golf-duo" aria-label="Scorekaart">
          <thead>
            <tr>
              <th />
              {course.holes.map((hole, i) => (
                <th key={hole.name} className={i === st.hole && playing ? 'is-now' : ''}>
                  {i + 1}
                  <small>par {hole.par}</small>
                </th>
              ))}
              <th>pt</th>
            </tr>
          </thead>
          <tbody>
            {order.map((p) => (
              <tr key={p} className={playing && match!.turn === p ? 'is-turn' : ''}>
                <th style={{ color: COLORS[p] }}>{nameOf(p, profile)}</th>
                {course.holes.map((hole, i) => {
                  const k = st.strokes[p][i] ?? 0;
                  const tone = !k ? '' : k < hole.par ? 'is-under' : k > hole.par ? 'is-over' : 'is-par';
                  return (
                    <td key={hole.name} className={tone}>
                      {k || '·'}
                    </td>
                  );
                })}
                <td className="golf-duo__total">{sc(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {playing && (
        <button type="button" className="golf-restart" onClick={begin}>
          Opnieuw beginnen
        </button>
      )}
    </div>
  );
}
