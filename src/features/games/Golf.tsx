import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { RoundCard } from './RoundCard';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { duelScores, planDuel } from './duel';
import {
  BALL_R,
  COURSES,
  CUP_R,
  H,
  MAX_STROKES,
  PAR_POINTS,
  PORTAL_R,
  PULL,
  W,
  cocoGolf,
  courseIndex,
  courseOf,
  coursePar,
  golfScore,
  holeOf,
  holePoints,
  holeWord,
  inPoly,
  millBlades,
  newGolf,
  nextHole,
  putt,
  slidersAt,
  step,
  totalStrokes,
  type GolfEvent,
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
}

function CourseView({
  s,
  aim,
  flag,
  fx,
}: {
  s: GolfState;
  aim: { dx: number; dy: number } | null;
  flag: string;
  fx: Fx;
}) {
  const course = courseOf(s);
  const t = THEMES[course.theme];
  const h = holeOf(s);
  const [outer, ...inner] = h.walls;
  const id = course.theme;
  const scene = useMemo(() => scenery(h, s.course * 10 + s.hole + 1, t), [h, s.course, s.hole, t]);
  const sliders = slidersAt(h, s.t);
  const len = aim ? Math.min(PULL, Math.hypot(aim.dx, aim.dy)) : 0;
  const k = len / PULL;
  const aimLen = aim ? Math.hypot(aim.dx, aim.dy) || 1 : 1;
  const ux = aim ? -aim.dx / aimLen : 0;
  const uy = aim ? -aim.dy / aimLen : 0;
  const ballR = fx.sunkAt !== null ? BALL_R * Math.max(0, 1 - (s.t - fx.sunkAt) / 0.35) : BALL_R;
  const ballAt =
    fx.sunkAt !== null
      ? { x: h.cup.x, y: h.cup.y }
      : { x: s.ball.x, y: s.ball.y };

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

      {/* the course: a shadow, the felt, the wooden (or candy, or neon) edge */}
      <path d={pathOf(outer)} transform="translate(0 7)" fill="rgba(0,0,0,0.28)" filter="url(#golf-soft)" />
      <path d={pathOf(outer)} fill={`url(#golf-felt-${id})`} />
      <path
        d={pathOf(outer)}
        fill="none"
        stroke={t.wallDark}
        strokeWidth="11"
        strokeLinejoin="round"
      />
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
      {course.theme === 'space' && (
        <path
          d={pathOf(outer)}
          fill="none"
          stroke={t.wall}
          strokeWidth="14"
          opacity="0.25"
          filter="url(#golf-soft)"
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
          {r.w > 90 && r.h > 60 && (
            <text x={r.x + r.w - 26} y={r.y + 30} fontSize="18" className="golf-bob">
              {course.theme === 'space' ? '🔥' : course.theme === 'ice' ? '🐟' : course.theme === 'candy' ? '🫧' : '🦆'}
            </text>
          )}
        </g>
      ))}
      {(h.wells ?? []).map((w, i) => (
        <g key={`we${i}`}>
          <circle cx={w.x} cy={w.y} r={w.r} fill="url(#golf-well)" />
          <g className="golf-spin" style={{ transformOrigin: `${w.x}px ${w.y}px` }}>
            <circle
              cx={w.x}
              cy={w.y}
              r={w.r * 0.55}
              fill="none"
              stroke="#b18cff"
              strokeWidth="2"
              strokeDasharray="6 10"
              opacity="0.7"
            />
            <circle
              cx={w.x}
              cy={w.y}
              r={w.r * 0.3}
              fill="none"
              stroke="#ff8cc0"
              strokeWidth="2"
              strokeDasharray="4 8"
              opacity="0.8"
            />
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
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={PORTAL_R - 3}
                    fill="none"
                    stroke={c[0]}
                    strokeWidth="3"
                    strokeDasharray="5 4"
                  />
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
          <path
            d={pathOf(pl)}
            fill={t.block}
            stroke={t.blockDark}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {t.stripes && (
            <path
              d={pathOf(pl)}
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="2"
              strokeDasharray="3 6"
            />
          )}
        </g>
      ))}

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
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r + 4 + (1 - hit) * 12}
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                opacity={hit}
              />
            )}
          </g>
        );
      })}

      {(h.mills ?? []).map((m, i) => (
        <g key={`m${i}`}>
          {course.theme === 'park' && (
            <g>
              <rect
                x={m.x - 16}
                y={m.y - 10}
                width="32"
                height="30"
                rx="4"
                fill="#ff8cc0"
                stroke="#b8236a"
                strokeWidth="2"
              />
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
              <line
                x1={a.x}
                y1={a.y + 3}
                x2={b.x}
                y2={b.y + 3}
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="7"
                strokeLinecap="round"
              />
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={t.mill}
                strokeWidth="7"
                strokeLinecap="round"
              />
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
      <circle cx={h.cup.x} cy={h.cup.y} r={CUP_R + 3} fill="rgba(255,255,255,0.18)" />
      <circle cx={h.cup.x} cy={h.cup.y} r={CUP_R} fill="url(#golf-cup)" />
      {fx.sunkAt === null && (
        <g className="golf-flag">
          <line x1={h.cup.x + 2} y1={h.cup.y + 2} x2={h.cup.x + 14} y2={h.cup.y - 30} stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
          <line x1={h.cup.x} y1={h.cup.y} x2={h.cup.x} y2={h.cup.y - 40} stroke="#fff" strokeWidth="2" />
          <path d={`M${h.cup.x} ${h.cup.y - 40}l24 8 -24 8z`} fill={flag} />
          <text x={h.cup.x + 8} y={h.cup.y - 29.5} fontSize="8" fontWeight="800" fill="#2f2a26">
            {s.hole + 1}
          </text>
        </g>
      )}
      <circle cx={h.tee.x} cy={h.tee.y} r="5" fill="rgba(255,255,255,0.3)" />

      {/* a splash or a spark where you went in */}
      {fx.splash && s.t - fx.splash.at < 0.8 && (
        <g opacity={1 - (s.t - fx.splash.at) / 0.8}>
          {[0, 0.25].map((d) => (
            <circle
              key={d}
              cx={fx.splash!.x}
              cy={fx.splash!.y}
              r={4 + Math.max(0, s.t - fx.splash!.at - d) * 50}
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
            />
          ))}
        </g>
      )}

      {/* aiming: a dotted line the way it goes, and a ring that fills with power */}
      {aim && len > 6 && (
        <g>
          <line
            x1={s.ball.x}
            y1={s.ball.y}
            x2={s.ball.x + ux * (30 + len * 1.1)}
            y2={s.ball.y + uy * (30 + len * 1.1)}
            stroke="#fff"
            strokeWidth="3"
            strokeDasharray="2 7"
            strokeLinecap="round"
            opacity="0.9"
          />
          <path
            d={`M${s.ball.x + ux * (36 + len * 1.1)} ${s.ball.y + uy * (36 + len * 1.1)}l${-ux * 10 - uy * 6} ${-uy * 10 + ux * 6}m${uy * 12} ${-ux * 12}l${ux * 10 - uy * 6} ${uy * 10 + ux * 6}`}
            stroke="#fff"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
          />
          <line
            x1={s.ball.x}
            y1={s.ball.y}
            x2={s.ball.x - ux * len * 0.5}
            y2={s.ball.y - uy * len * 0.5}
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle
            cx={s.ball.x}
            cy={s.ball.y}
            r="20"
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="5"
          />
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
          fill="#fff"
          opacity={(i / fx.trail.length) * 0.35}
        />
      ))}
      {ballR > 0.3 && (
        <g>
          {fx.sunkAt === null && (
            <ellipse cx={ballAt.x + 2} cy={ballAt.y + 3} rx={ballR} ry={ballR * 0.7} fill="rgba(0,0,0,0.3)" />
          )}
          <circle cx={ballAt.x} cy={ballAt.y} r={ballR} fill="url(#golf-ball)" stroke="#bbb" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  );
}

const PICK_KEY = 'golf-course';

export function Golf() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('golf');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
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
  const [line, setLine] = useState(
    'Kies een wereld, sleep dan vanaf de bal naar achteren en laat los — zoals een katapult',
  );
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const game = useRef<GolfState>(newGolf(picked));
  const fx = useRef<Fx>({ trail: [], bump: null, splash: null, sunkAt: null, warpAt: null });
  const stage = useRef<HTMLDivElement>(null);
  const svgBox = useRef<HTMLDivElement>(null);
  const press = useRef<{ x: number; y: number } | null>(null);
  const [aim, setAim] = useState<{ dx: number; dy: number } | null>(null);

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'golf', me) : null;
  const answering = plan?.type === 'answer' ? matches.find((m) => m.id === plan.id) : undefined;
  const target =
    mode === 'local' && duel.first !== null
      ? duel.first
      : answering
        ? (duelScores(answering)[them] ?? null)
        : null;
  /** In a duel we answer (or the second go on one phone) it's the same course. */
  const lockedCourse =
    answering !== undefined
      ? courseIndex(answering.state.course)
      : mode === 'local' && duel.first !== null
        ? game.current.course
        : null;
  const courseNo = lockedCourse ?? picked;
  const player = mode === 'local' ? duel.player : me;
  const flag = player === 'partner' ? '#ff5fa2' : '#ffc61a';

  const choose = (i: number) => {
    setPicked(i);
    try {
      localStorage.setItem(PICK_KEY, COURSES[i].id);
    } catch {
      /* fine */
    }
    if (phase === 'ready') game.current = newGolf(i);
  };

  const nearestBumper = (s: GolfState) => {
    const bs = holeOf(s).bumpers ?? [];
    let best = -1;
    let d = Infinity;
    bs.forEach((b, i) => {
      const dd = Math.hypot(b.x - s.ball.x, b.y - s.ball.y) - b.r;
      if (dd < d) {
        d = dd;
        best = i;
      }
    });
    return best;
  };

  const react = (events: GolfEvent[], s: GolfState) => {
    for (const e of events) {
      if (e.type === 'wall') playSfx('clunk', true);
      else if (e.type === 'bump') {
        playSfx('boing', true);
        fx.current.bump = { i: nearestBumper(s), at: s.t };
      } else if (e.type === 'boost') playSfx('whoosh', true);
      else if (e.type === 'warp') {
        playSfx('sparkle', true);
        fx.current.warpAt = s.t;
        fx.current.trail = [];
      } else if (e.type === 'lip') setLine('Net over de rand — iets zachter!');
      else if (e.type === 'out') setLine('Oeps, door de muur geglipt — probeer opnieuw');
      else if (e.type === 'water' || e.type === 'void') {
        playSfx(e.type === 'water' ? 'splash' : 'whirr', true);
        fx.current.splash = { ...e.at, at: s.t };
        fx.current.trail = [];
        const theme = courseOf(s).theme;
        setBanner(
          e.type === 'void'
            ? '🕳️ Opgeslokt door het zwarte gat! +1 slag'
            : theme === 'space'
              ? '🔥 In de lava! +1 slag'
              : theme === 'ice'
                ? '🧊 Door het ijs gezakt! +1 slag'
                : theme === 'candy'
                  ? '🫧 In de limonade! +1 slag'
                  : '💦 In het water! +1 slag',
        );
      } else if (e.type === 'sunk') {
        fx.current.sunkAt = s.t;
        fx.current.trail = [];
        playSfx(e.strokes === 1 ? 'star' : 'success', true);
        setBanner(`${holeWord(e.strokes, e.par)} · +${holePoints(e.strokes, e.par)}`);
        if (e.strokes === 1 || e.strokes <= e.par - 1) celebrateFrom(svgBox.current);
        window.setTimeout(() => advance(), reduce ? 400 : 1600);
      } else if (e.type === 'max') {
        setBanner(`${MAX_STROKES} slagen — door naar de volgende`);
        window.setTimeout(() => advance(), reduce ? 400 : 1400);
      }
    }
  };

  const advance = () => {
    const out = nextHole(game.current);
    game.current = out.state;
    fx.current = { trail: [], bump: null, splash: null, sunkAt: null, warpAt: null };
    if (out.state.over) finish(out.state);
    else {
      const h = holeOf(out.state);
      setBanner(`${h.emoji} Hole ${out.state.hole + 1}: ${h.name} · par ${h.par}`);
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
      if (!game.current.over) {
        const out = step(game.current, dt);
        game.current = out.state;
        const f = fx.current;
        if (out.state.moving) {
          f.trail.push({ x: out.state.ball.x, y: out.state.ball.y });
          if (f.trail.length > 12) f.trail.shift();
        } else if (f.trail.length) f.trail.shift();
        if (out.events.length) react(out.events, out.state);
      }
      setFrame((n) => (n + 1) % 1_000_000);
      if (!game.current.over) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(t);
  }, [banner]);

  const finish = (s: GolfState) => {
    setPhase('done');
    const total = golfScore(s);
    const myBest = mode === 'local' ? null : best[me];
    setRecord(myBest !== null && myBest !== undefined && total > myBest);
    if (mode !== 'coco') {
      const end = duel.finish(total, { course: COURSES[s.course].id });
      setLine(end.text);
      setTickets(end.tickets);
      setHandOver(Boolean(end.handOver));
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
    game.current = newGolf(courseNo);
    fx.current = { trail: [], bump: null, splash: null, sunkAt: null, warpAt: null };
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setRecord(false);
    setPhase('play');
    const h = holeOf(game.current);
    setBanner(`${h.emoji} Hole 1: ${h.name} · par ${h.par}`);
    setLine(tipFor(h));
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    const c = keepDuel ? game.current.course : picked;
    game.current = newGolf(c);
    fx.current = { trail: [], bump: null, splash: null, sunkAt: null, warpAt: null };
    setPhase('ready');
    setLine(
      keepDuel
        ? `Nu ${nameOf(duel.player, profile)}! Zelfde wereld: ${COURSES[c].emoji} ${COURSES[c].name}`
        : 'Kies een wereld, sleep dan vanaf de bal naar achteren en laat los',
    );
  };

  const local = (e: React.PointerEvent) => {
    const r = svgBox.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  // Before teeing off, show the course you're about to play.
  if (phase === 'ready' && game.current.course !== courseNo) game.current = newGolf(courseNo);
  const s = game.current;
  const course = courseOf(s);
  const h = holeOf(s);
  const score = golfScore(s);
  return (
    <GameShell
      id="golf"
      title="Minigolf"
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
      <DuelPanel kind="golf" mode={mode} first={duel.first} result={duel.result} />
      <div className={`golf-park is-${course.theme}`} ref={stage}>
        {phase === 'ready' && (
          <div className="golf-worlds" role="radiogroup" aria-label="Kies een wereld">
            {COURSES.map((c, i) => {
              const locked = lockedCourse !== null && lockedCourse !== i;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={courseNo === i}
                  disabled={locked}
                  className={`golf-world is-${c.theme}${courseNo === i ? ' is-on' : ''}`}
                  onClick={() => choose(i)}
                >
                  <span className="golf-world__emoji" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <strong>{c.name}</strong>
                  <small>
                    par {coursePar(c)}
                  </small>
                </button>
              );
            })}
          </div>
        )}
        {phase === 'ready' && lockedCourse !== null && (
          <p className="golf-target">
            🔒 Duel op {COURSES[lockedCourse].emoji} {COURSES[lockedCourse].name} — dezelfde holes
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
            🎯 Te verslaan: <strong>{target}</strong> punten van{' '}
            {nameOf(mode === 'local' ? me : them, profile)}
          </p>
        )}
        <div
          className="golf-green"
          ref={svgBox}
          role="application"
          tabIndex={0}
          aria-label={`Minigolf, ${course.name}, hole ${s.hole + 1}: sleep naar achteren en laat los om te slaan`}
          onPointerDown={(e) => {
            if (phase !== 'play' || s.moving || s.sunk) return;
            (e.target as Element).setPointerCapture?.(e.pointerId);
            press.current = local(e);
            setAim({ dx: 0, dy: 0 });
          }}
          onPointerMove={(e) => {
            if (!press.current) return;
            const p = local(e);
            setAim({ dx: p.x - press.current.x, dy: p.y - press.current.y });
          }}
          onPointerUp={(e) => {
            const from = press.current;
            press.current = null;
            setAim(null);
            if (!from) return;
            const p = local(e);
            const before = game.current.strokes[game.current.hole];
            game.current = putt(game.current, p.x - from.x, p.y - from.y);
            if (game.current.strokes[game.current.hole] > before) {
              playSfx('tap', true);
              fx.current.trail = [];
            }
          }}
          onPointerCancel={() => {
            press.current = null;
            setAim(null);
          }}
        >
          <CourseView s={s} aim={aim} flag={flag} fx={fx.current} />
          <AnimatePresence>
            {banner && (
              <motion.p
                className="golf-banner"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {banner}
              </motion.p>
            )}
          </AnimatePresence>
          {phase === 'ready' && (
            <div className="golf-start">
              <p>
                {course.emoji} {course.name} · {course.blurb}
              </p>
              <p className="golf-start__small">
                Sleep ergens op de baan naar achteren — hoe verder, hoe harder — en laat los. Water
                kost een slag.
              </p>
              <button type="button" className="golf-go" onClick={start}>
                {mode === 'local' && duel.first !== null
                  ? `Start, ${nameOf(duel.player, profile)}!`
                  : 'Afslaan ⛳'}
              </button>
            </div>
          )}
        </div>
        <ol className="golf-card" aria-label="Scorekaart">
          {course.holes.map((hole, i) => {
            const k = s.strokes[i];
            const done = i < s.hole || (i === s.hole && (s.sunk || s.over));
            const shown = done && k ? Math.min(MAX_STROKES, k) : null;
            const tone =
              shown === null ? '' : shown < hole.par ? ' is-under' : shown > hole.par ? ' is-over' : ' is-par';
            return (
              <li
                key={hole.name}
                className={`${i === s.hole && !s.over ? 'is-now' : ''}${tone}`}
                title={hole.name}
              >
                <small>
                  {hole.emoji} {i + 1}
                </small>
                <strong>{shown ?? '·'}</strong>
                <em>par {hole.par}</em>
              </li>
            );
          })}
        </ol>
        {cocoScore !== null && <p className="golf-coco">🐰 Coco haalde {cocoScore} punten</p>}
      </div>
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <TicketStrip tickets={tickets} />
      {phase === 'done' && (
        <RoundCard
          title={`${course.emoji} ${course.name} uitgespeeld!`}
          score={score}
          record={record}
          stars={score >= PAR_POINTS + 20 ? 3 : score >= PAR_POINTS - 40 ? 2 : score >= PAR_POINTS - 100 ? 1 : 0}
          stats={[
            { label: 'Slagen', value: totalStrokes(s) },
            { label: 'Par', value: coursePar(course) },
            { label: 'Hole in one', value: s.strokes.filter((k) => k === 1).length },
          ]}
        />
      )}
      {phase === 'done' &&
        (handOver ? (
          <button type="button" className="neon-btn" onClick={() => restart(true)}>
            Nu {nameOf(duel.player, profile)} ▶
          </button>
        ) : (
          <button type="button" className="neon-btn" onClick={() => restart()}>
            Nog een rondje ⛳
          </button>
        ))}
    </GameShell>
  );
}

/** A small tip for what's new on this hole. */
function tipFor(h: Hole): string {
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
