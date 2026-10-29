import { memo, useEffect, useRef, useState } from 'react';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { PetFood } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { BunnySide, type SidePose } from '../pet/BunnySide';
import { FoodArt } from '../pet/Props';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { RoundCard } from './RoundCard';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { duelScores, planDuel } from './duel';
import {
  COCO_W,
  COCO_X,
  POWER_SECONDS,
  TREAT,
  ZONES,
  ZONE_METRES,
  cocoRun,
  hopScore,
  jump,
  metres,
  newRun,
  step,
  streakTimes,
  type HopEvent,
  type HopState,
  type Obstacle,
  type ObstacleKind,
  type PowerKind,
} from './hop';
import './hop.css';

/*
 * Coco's hop-race: tap to hop (hold for a higher one, tap again in the air
 * for a second), from the garden at golden hour to a starry night.
 */

const W = 400;
const H = 230;
const GROUND = 192;
const COCO_SCALE = 0.3;
const CX = COCO_X + COCO_W / 2;

const SOUND: Partial<Record<HopEvent['type'], Parameters<typeof playSfx>[0]>> = {
  hop: 'boing',
  double: 'whoosh',
  crash: 'thunk',
  splash: 'splash',
  hug: 'heart',
  power: 'sparkle',
  zone: 'chime',
};

const ENDING: Record<ObstacleKind, string> = {
  pot: 'Boem, tegen een bloempot 🌷',
  pots: 'Twee bloempotten… één te veel 🌷🌷',
  fence: 'Oeps, het hekje 🪵',
  puddle: 'Plons! Recht in de plas 💦',
  bee: 'Bzzz! Recht tegen een bij aan 🐝',
  hedgehog: 'Au, een egeltje! 🦔',
};

const POWER_NAME: Record<PowerKind, string> = {
  hug: '💗 Knuffel! Eén botsing vergeven',
  magnet: '🥕 Gouden wortel! Snacks komen naar je toe',
  star: '⭐ Sterrenhop! Dubbele punten',
};

/* ------------------------------------------------------------- colours */

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};

/** Each part of the run: sky (top, middle, bottom), hills, grass. */
const LOOK = [
  { sky: ['#ffc9dc', '#ffe0c9', '#fff3dc'], hill: '#c5e3b0', bush: '#8cc47a', grass: '#7ab868' },
  { sky: ['#ff9f8a', '#ffc58f', '#ffe7b8'], hill: '#d9c98a', bush: '#9fb85a', grass: '#86ad55' },
  { sky: ['#5d6fc4', '#a786d0', '#f4b3c2'], hill: '#5a5f8f', bush: '#4f7a5c', grass: '#4f8a57' },
  { sky: ['#0f1433', '#25235a', '#40336e'], hill: '#1c2146', bush: '#22344a', grass: '#2f5a44' },
];

/** Where in the run's colours we are: this part, the next, and how far the change is. */
function lookAt(distance: number) {
  const m = Math.max(0, distance) / 40;
  const i = Math.floor(m / ZONE_METRES) % 4;
  const p = (m % ZONE_METRES) / ZONE_METRES;
  const t = p > 0.82 ? (p - 0.82) / 0.18 : 0;
  const a = LOOK[i];
  const b = LOOK[(i + 1) % 4];
  return {
    zone: i,
    t,
    sky: a.sky.map((c, k) => mix(c, b.sky[k], t)),
    hill: mix(a.hill, b.hill, t),
    bush: mix(a.bush, b.bush, t),
    grass: mix(a.grass, b.grass, t),
    /** 0 by day, 1 at night: stars, moon and lit windows. */
    night: i === 3 ? 1 - t : i === 2 ? 0.1 + t * 0.9 : 0,
    /** How low the sun is (0 high, 1 gone); it comes up again as the night ends. */
    sun: i === 0 ? 0.15 + p * 0.3 : i === 1 ? 0.45 + p * 0.55 : i === 3 ? 1 - t * 0.85 : 1,
  };
}

/* -------------------------------------------------------------- scenery */

const wrap = (x: number, w: number) => ((x % w) + w) % w;

const STARS = Array.from({ length: 34 }, (_, i) => ({
  x: (i * 97) % 400,
  y: 8 + ((i * 53) % 110),
  r: i % 5 === 0 ? 1.6 : 1,
}));

function Sky({ distance, t }: { distance: number; t: number }) {
  const L = lookAt(distance);
  const cloud = -((distance * 0.06) % 520);
  const sunY = 40 + L.sun * 170;
  return (
    <g>
      <defs>
        <linearGradient id="hop-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={L.sky[0]} />
          <stop offset="58%" stopColor={L.sky[1]} />
          <stop offset="100%" stopColor={L.sky[2]} />
        </linearGradient>
        <radialGradient id="hop-sun">
          <stop offset="0%" stopColor="#fffbe0" />
          <stop offset="60%" stopColor="#fff1a8" />
          <stop offset="100%" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#hop-sky)" />
      {L.night > 0 && (
        <g opacity={L.night}>
          {STARS.map((s, i) => (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill="#fff"
              opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 1.5 + i))}
            />
          ))}
          <circle cx="318" cy="44" r="15" fill="#fff6d8" />
          <circle cx="324" cy="40" r="13" fill={L.sky[0]} />
        </g>
      )}
      {L.sun < 1 && <circle cx="330" cy={sunY} r="34" fill="url(#hop-sun)" />}
      {L.night < 0.7 && (
        <g transform={`translate(${cloud} 0)`} opacity={1 - L.night}>
          {[0, 520].map((o) => (
            <g key={o} fill="#fff" opacity="0.75">
              <ellipse cx={o + 90} cy="40" rx="26" ry="9" />
              <ellipse cx={o + 108} cy="34" rx="16" ry="9" />
              <ellipse cx={o + 300} cy="64" rx="30" ry="8" />
              <ellipse cx={o + 318} cy="58" rx="15" ry="8" />
              <ellipse cx={o + 470} cy="30" rx="22" ry="7" />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

/** Canal houses: gables against the sky, lit windows at dusk. */
function House({ x, h, c, lit }: { x: number; h: number; c: string; lit: number }) {
  return (
    <g transform={`translate(${x} ${GROUND - 14})`}>
      <path d={`M0 0v-${h}l9 -10l9 10v${h}z`} transform="scale(1.6 1)" fill={c} />
      {[0, 1].map((r) =>
        [0, 1].map((k) => (
          <rect
            key={`${r}${k}`}
            x={6 + k * 12}
            y={-h + 8 + r * 14}
            width="6"
            height="8"
            rx="1"
            fill="#ffd77a"
            opacity={lit}
          />
        )),
      )}
    </g>
  );
}

function Backdrop({ distance, t }: { distance: number; t: number }) {
  const L = lookAt(distance);
  const far = -((distance * 0.15) % 200);
  const mid = -((distance * 0.45) % 120);
  const near = -(distance % 40);
  const zone = L.zone;
  const next = (zone + 1) % 4;
  // the canal houses fade in towards the canal and stay through the night
  const houses = zone === 2 || zone === 3 ? (zone === 3 ? 1 - L.t : 1) : zone === 1 ? L.t : 0;
  const sunflowers = zone === 1 ? 1 - L.t : zone === 0 ? L.t : 0;
  const water = zone === 2 ? 1 : zone === 1 ? L.t : zone === 3 ? 1 - L.t * 0.5 : 0;
  const fireflies = zone === 3 ? 1 - L.t : zone === 2 ? L.t : 0;
  const lanterns = next === 3 ? L.t : zone === 3 ? 1 - L.t : 0;
  return (
    <g aria-hidden="true">
      <g transform={`translate(${far} 0)`}>
        {[0, 200, 400, 600].map((x) => (
          <path
            key={x}
            d={`M${x} ${GROUND - 20}q50 -60 100 -20q50 -50 100 0v40h-200z`}
            fill={L.hill}
          />
        ))}
      </g>
      {houses > 0 && (
        <g transform={`translate(${-((distance * 0.25) % 240)} 0)`} opacity={houses}>
          {[0, 240].map((o) =>
            [
              [8, 52, '#7d4f5f'],
              [40, 64, '#a0606b'],
              [72, 46, '#6b5a7d'],
              [104, 58, '#86593f'],
              [136, 50, '#5d6b8a'],
              [168, 62, '#9a6f55'],
              [200, 48, '#7d4f5f'],
            ].map(([x, h, c]) => (
              <House
                key={`${o}-${x}`}
                x={o + (x as number)}
                h={h as number}
                c={c as string}
                lit={0.25 + L.night * 0.75}
              />
            )),
          )}
        </g>
      )}
      {water > 0 && (
        <g opacity={water}>
          <rect y={GROUND - 16} width={W} height="12" fill="#5b8fc9" />
          <g transform={`translate(${-((distance * 0.6) % 60)} 0)`}>
            {Array.from({ length: 9 }, (_, i) => (
              <path
                key={i}
                d={`M${i * 60} ${GROUND - 10}q8 -3 16 0`}
                stroke="#cfe6ff"
                strokeWidth="1.4"
                fill="none"
                opacity="0.7"
              />
            ))}
          </g>
        </g>
      )}
      <g transform={`translate(${mid} 0)`}>
        {Array.from({ length: 6 }, (_, i) => (
          <g key={i} transform={`translate(${i * 120} ${GROUND - 6})`}>
            <ellipse cx="30" cy="-10" rx="34" ry="20" fill={L.bush} />
            <ellipse cx="62" cy="-6" rx="22" ry="14" fill={L.bush} opacity="0.85" />
            <circle cx="22" cy="-18" r="3" fill="#ff8cc0" />
            <circle cx="44" cy="-14" r="3" fill="#fff" />
            <circle cx="66" cy="-10" r="2.5" fill="#ffd75e" />
            {sunflowers > 0 && (
              <g opacity={sunflowers}>
                {[8, 50, 92].map((x) => (
                  <g key={x} transform={`translate(${x} 0)`}>
                    <path d="M0 0v-40" stroke="#4f8a3a" strokeWidth="2.5" />
                    <circle cy="-42" r="8" fill="#ffc93c" />
                    <circle cy="-42" r="3.6" fill="#7a4a1e" />
                  </g>
                ))}
              </g>
            )}
            {lanterns > 0 && (
              <g opacity={lanterns}>
                <path d="M100 0v-46" stroke="#3a2a3a" strokeWidth="2" />
                <rect x="94" y="-58" width="12" height="13" rx="3" fill="#ffd77a" />
                <circle cx="100" cy="-52" r="14" fill="#ffd77a" opacity="0.25" />
              </g>
            )}
          </g>
        ))}
      </g>
      {fireflies > 0 && (
        <g opacity={fireflies}>
          {Array.from({ length: 10 }, (_, i) => (
            <circle
              key={i}
              cx={wrap(i * 47 + Math.sin(t * 0.8 + i) * 18 - distance * 0.3, W)}
              cy={110 + ((i * 31) % 60) + Math.cos(t * 1.1 + i) * 8}
              r="2"
              fill="#f8ff9a"
              opacity={0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i * 1.7))}
            />
          ))}
        </g>
      )}
      <rect y={GROUND} width={W} height={H - GROUND} fill={L.grass} />
      <rect y={GROUND} width={W} height="5" fill="#000" opacity="0.12" />
      <g transform={`translate(${near} 0)`}>
        {Array.from({ length: 12 }, (_, i) => (
          <path
            key={i}
            d={`M${i * 40 + 6} ${GROUND + 16}l4 -6l4 6M${i * 40 + 24} ${GROUND + 28}l3 -5l3 5`}
            stroke="#000"
            strokeOpacity="0.18"
            strokeWidth="2"
            fill="none"
          />
        ))}
      </g>
    </g>
  );
}

/* ----------------------------------------------------------- the things */

const FLOWERS = ['#ff7aa8', '#ffb347', '#b493ff', '#7fd1ff'];

function ObstacleArt({ o, zone, t }: { o: Obstacle; zone: number; t: number }) {
  const ink = { stroke: '#3a2a3a', strokeWidth: 2, strokeLinejoin: 'round' as const };
  if (o.kind === 'puddle')
    return (
      <g>
        <ellipse
          cx={o.w / 2}
          cy="2"
          rx={o.w / 2}
          ry="6"
          fill={zone === 3 ? '#4d6bb0' : '#7fc8ff'}
          {...ink}
        />
        <ellipse
          cx={o.w / 2 - 8}
          cy="1"
          rx={o.w / 5}
          ry="2"
          fill={zone === 3 ? '#fff6d8' : '#d6f0ff'}
        />
      </g>
    );
  if (o.kind === 'fence')
    return (
      <g {...ink}>
        {[0, 13, 26].map((x) => (
          <path key={x} d={`M${x} 0v-${o.h - 6}l5 -6l5 6v${o.h - 6}z`} fill="#fff7ee" />
        ))}
        <rect x="-3" y={-o.h * 0.7} width={o.w + 6} height="6" rx="2" fill="#f1e3d3" />
        <rect x="-3" y={-o.h * 0.32} width={o.w + 6} height="6" rx="2" fill="#f1e3d3" />
        {zone === 3 && <circle cx="18" cy={-o.h - 3} r="3.5" fill="#ffd77a" stroke="none" />}
      </g>
    );
  if (o.kind === 'bee') {
    const flap = Math.sin(t * 40) > 0;
    return (
      <g transform={`translate(0 ${-o.y - o.h})`}>
        <ellipse
          cx="11"
          cy={flap ? -2 : 1}
          rx="7"
          ry={flap ? 6 : 4}
          fill="#ffffff"
          opacity="0.8"
          {...ink}
          strokeWidth="1.2"
        />
        <ellipse cx="15" cy="9" rx="12" ry="8" fill="#ffd23c" {...ink} />
        <path d="M11 2v14M17 2v14" stroke="#3a2a3a" strokeWidth="3" />
        <circle cx="5" cy="8" r="1.6" fill="#3a2a3a" />
        <path d="M27 9l4 1l-4 1z" fill="#3a2a3a" />
      </g>
    );
  }
  if (o.kind === 'hedgehog') {
    const step = Math.sin(t * 18) > 0 ? 2 : -2;
    return (
      <g>
        <path d="M4 0q-2 -22 16 -22q16 0 16 22z" fill="#8a5a3c" {...ink} />
        {[6, 12, 18, 24, 30].map((x) => (
          <path key={x} d={`M${x} -16l-3 -8l6 2z`} fill="#5e3b26" />
        ))}
        <ellipse cx="4" cy="-6" rx="7" ry="5" fill="#e8c9a0" {...ink} />
        <circle cx="-2" cy="-7" r="1.8" fill="#3a2a3a" />
        <circle cx="2" cy="-8" r="1.2" fill="#3a2a3a" />
        <path d={`M10 0l${step} 3M26 0l${-step} 3`} stroke="#3a2a3a" strokeWidth="2" />
      </g>
    );
  }
  const pot = (x: number, flower: string) => (
    <g key={x} transform={`translate(${x} 0)`}>
      <path d="M13 -14v-12" stroke="#5a9c4c" strokeWidth="3" />
      <ellipse cx="9" cy="-22" rx="4" ry="2" fill="#7cb565" transform="rotate(-30 9 -22)" />
      <path d="M8 -30q5 -10 10 0q-5 5 -10 0z" fill={flower} stroke="#3a2a3a" strokeWidth="1.6" />
      <path d="M2 -16h22l-3 16h-16z" fill="#d9774f" {...ink} />
      <rect x="0" y="-18" width="26" height="5" rx="2" fill="#e58e64" {...ink} />
    </g>
  );
  return (
    <g>
      {o.kind === 'pots'
        ? [pot(0, FLOWERS[zone]), pot(28, FLOWERS[(zone + 1) % 4])]
        : pot(0, FLOWERS[(o.id + zone) % 4])}
    </g>
  );
}

const PowerArt = memo(function PowerArt({ kind }: { kind: PowerKind }) {
  if (kind === 'hug')
    return (
      <g>
        <circle r="20" fill="#ff8cc0" opacity="0.25" />
        <path
          d="M0 10l-13 -12a7 7 0 0 1 13 -8a7 7 0 0 1 13 8z"
          fill="#ff5fa2"
          stroke="#fff"
          strokeWidth="2"
        />
      </g>
    );
  if (kind === 'star')
    return (
      <g>
        <circle r="20" fill="#ffd75e" opacity="0.3" />
        <path
          d="M0 -14l4 9l10 1l-8 7l3 10l-9 -5l-9 5l3 -10l-8 -7l10 -1z"
          fill="#ffd75e"
          stroke="#fff"
          strokeWidth="1.6"
        />
      </g>
    );
  return (
    <g>
      <circle r="20" fill="#ffd75e" opacity="0.28" />
      <g transform="rotate(30) scale(0.42)">
        <path d="M-9 -16q9 -6 18 0l-6 52q-3 7 -6 0z" fill="#ffc83c" stroke="#fff" strokeWidth="4" />
        <path d="M-2 -17q-12 -14 -10 -26q8 6 9 20z" fill="#9fdc6a" />
        <path d="M1 -18q2 -18 9 -24q4 12 -5 24z" fill="#b5e88a" />
      </g>
    </g>
  );
});

const Coco = memo(function Coco({ pose }: { pose: SidePose }) {
  return <BunnySide pose={pose} />;
});

const Treat = memo(function Treat({ food }: { food: PetFood }) {
  return <FoodArt food={food} />;
});

/* ------------------------------------------------------------ particles */

interface Bit {
  id: number;
  kind: 'dust' | 'crumb' | 'drop' | 'spark' | 'heart';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color?: string;
}
interface Float {
  id: number;
  text: string;
  x: number;
  y: number;
  life: number;
  gold?: boolean;
}

const CRUMB: Partial<Record<PetFood, string>> = {
  carrot: '#f08a2e',
  apple: '#e5484d',
  banana: '#ffd75e',
  strawberry: '#ff5f7e',
};

let bitSeq = 0;
function burst(kind: Bit['kind'], x: number, y: number, n: number, color?: string): Bit[] {
  return Array.from({ length: n }, () => {
    const a = Math.random() * Math.PI * 2;
    const v =
      kind === 'dust'
        ? 30 + Math.random() * 30
        : kind === 'drop'
          ? 80 + Math.random() * 80
          : 60 + Math.random() * 90;
    return {
      id: ++bitSeq,
      kind,
      x,
      y,
      vx: kind === 'dust' ? -Math.abs(Math.cos(a)) * v : Math.cos(a) * v,
      vy:
        kind === 'drop'
          ? -Math.abs(Math.sin(a)) * v - 40
          : Math.sin(a) * v - (kind === 'heart' ? 50 : 0),
      life: 0,
      max: kind === 'dust' ? 0.45 : kind === 'heart' ? 1.1 : 0.7,
      color,
    };
  });
}

/* ------------------------------------------------------------- the game */

export function HopRace() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('hop');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
  const duel = useDuelRound('hop', mode);
  const [phase, setPhase] = useState<'ready' | 'run' | 'paused' | 'done'>('ready');
  const [, setFrame] = useState(0);
  const [line, setLine] = useState('Tik om te starten — en tik om te hoppen!');
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [record, setRecord] = useState(false);
  const run = useRef<HopState>(newRun());
  const held = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const passed = useRef(false);
  const bits = useRef<Bit[]>([]);
  const floats = useRef<Float[]>([]);
  const landedAt = useRef(-1);

  // What to beat: their score in an open duel, or the first round on one phone.
  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'hop', me) : null;
  const target =
    mode === 'local' && duel.first !== null
      ? duel.first
      : plan?.type === 'answer'
        ? (duelScores(matches.find((m) => m.id === plan.id))[them] ?? null)
        : null;
  const targetName = nameOf(mode === 'local' ? me : them, profile);
  const myBest = mode === 'local' ? null : best[me];

  const say = (text: string) => setBanner({ id: performance.now(), text });

  /** What happened this frame: sounds, particles, words. */
  const react = (events: HopEvent[], s: HopState) => {
    const sx = (x: number) => x - s.distance;
    for (const e of events) {
      const sound = SOUND[e.type];
      if (sound) playSfx(sound, true);
      if (reduce) continue;
      if (e.type === 'land') {
        landedAt.current = s.t;
        bits.current.push(...burst('dust', CX - 10, GROUND - 2, 5));
      } else if (e.type === 'hop') {
        bits.current.push(...burst('dust', CX - 8, GROUND - 2, 3));
      } else if (e.type === 'eat') {
        playSfx(e.streak >= 10 ? 'coin' : 'munch', true);
        bits.current.push(
          ...burst('crumb', sx(e.x) + TREAT / 2, GROUND - e.y - TREAT / 2, 6, CRUMB[e.food]),
        );
        floats.current.push({
          id: ++bitSeq,
          text: `+${e.points}`,
          x: sx(e.x) + TREAT / 2,
          y: GROUND - e.y - TREAT,
          life: 0,
          gold: e.points > (e.food === 'strawberry' ? 25 : 15),
        });
      } else if (e.type === 'power') {
        bits.current.push(
          ...burst('spark', sx(e.x) + TREAT / 2, GROUND - e.y - TREAT / 2, 14, '#ffd75e'),
        );
      } else if (e.type === 'hug') {
        bits.current.push(...burst('heart', CX, GROUND - 30, 8, '#ff5fa2'));
      } else if (e.type === 'splash') {
        bits.current.push(...burst('drop', CX, GROUND, 14, '#7fc8ff'));
      } else if (e.type === 'crash') {
        bits.current.push(...burst('spark', CX + 16, GROUND - 26, 10, '#fff6a8'));
      }
    }
    for (const e of events) {
      if (e.type === 'zone') say(`${ZONES[e.zone].emoji} ${ZONES[e.zone].name}`);
      if (e.type === 'power') say(POWER_NAME[e.kind]);
      if (e.type === 'hug') say('💗 Gered door een knuffel!');
      if (e.type === 'eat' && (e.streak === 10 || e.streak === 25))
        say(`🔥 ${e.streak} op rij — nu ×${streakTimes(e.streak)}!`);
    }
  };

  // The run itself.
  useEffect(() => {
    if (phase !== 'run') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
      last = now;
      const out = step(run.current, dt, held.current);
      run.current = out.state;
      react(out.events, out.state);
      // particles drift and fade
      bits.current = bits.current
        .map((b) => ({
          ...b,
          x: b.x + b.vx * dt,
          y: b.y + b.vy * dt,
          vy: b.vy + (b.kind === 'heart' ? -20 : b.kind === 'dust' ? -10 : 320) * dt,
          life: b.life + dt,
        }))
        .filter((b) => b.life < b.max);
      floats.current = floats.current
        .map((f) => ({ ...f, y: f.y - 40 * dt, life: f.life + dt }))
        .filter((f) => f.life < 0.9);
      const score = hopScore(out.state);
      if (target !== null && !passed.current && score > target) {
        passed.current = true;
        playSfx('star', true);
        say(`✨ Voorbij ${targetName}!`);
      }
      setFrame((n) => n + 1);
      if (out.state.over) {
        finish(out.state);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const away = () => {
      if (document.visibilityState === 'hidden') setPhase('paused');
    };
    document.addEventListener('visibilitychange', away);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', away);
    };
  }, [phase]);

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1800);
    return () => window.clearTimeout(t);
  }, [banner]);

  const finish = (s: HopState) => {
    setPhase('done');
    held.current = false;
    const total = hopScore(s);
    setRecord(myBest !== null && myBest !== undefined && total > myBest);
    const how = s.hit ? ENDING[s.hit] : '';
    if (mode !== 'coco') {
      const end = duel.finish(total);
      setLine(`${how} · ${end.text}`);
      setTickets(end.tickets);
      setHandOver(Boolean(end.handOver));
      if (end.tickets) celebrateFrom(stage.current);
      return;
    }
    if (getAuthor()) addScore('hop', total);
    const coco = cocoRun();
    setCocoScore(coco);
    addScore('hop', coco, 'coco');
    const winner = total > coco ? me : total < coco ? 'coco' : 'draw';
    recordResult('hop', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      `${how} · ${
        winner === me
          ? `Jij wint! ${total} tegen ${coco} 🎉`
          : winner === 'coco'
            ? `Coco wint met ${coco} tegen ${total} — haar eigen tuin 🐰👑`
            : `Gelijk! ${total}–${coco}`
      }`,
    );
  };

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    run.current = newRun();
    passed.current = false;
    held.current = false;
    bits.current = [];
    floats.current = [];
    landedAt.current = -1;
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setBanner(null);
    setRecord(false);
    setPhase('ready');
    setLine(
      keepDuel
        ? `Nu ${nameOf(duel.player, profile)}! Tik om te starten.`
        : 'Tik om te starten — en tik om te hoppen!',
    );
  };

  const press = () => {
    held.current = true;
    if (phase === 'ready' || phase === 'paused') {
      setPhase('run');
      if (phase === 'ready') {
        setLine('Hop! Houd vast voor een hoge sprong, tik nog eens in de lucht. Onder bijen door!');
        say(`${ZONES[0].emoji} ${ZONES[0].name}`);
      }
      return;
    }
    if (phase !== 'run') return;
    const j = jump(run.current);
    run.current = j.state;
    if (j.event) react([j.event], j.state);
  };
  const release = () => {
    held.current = false;
  };

  // The garden in view (above the tab bar) when the game opens and when a run starts.
  useEffect(() => {
    stage.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [phase === 'ready']);

  // Space or arrow up hops too.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key !== ' ' && e.key !== 'ArrowUp') || e.repeat) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, button, [role="dialog"]')) return;
      if (phase === 'done') return;
      e.preventDefault();
      press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp') release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  const s = run.current;
  const score = hopScore(s);
  const pose: SidePose =
    s.over && s.hit
      ? 'loaf'
      : s.y > 0
        ? s.vy > 120
          ? 'leap'
          : 'land'
        : phase === 'run'
          ? Math.floor(s.t * 7) % 2
            ? 'crouch'
            : 'land'
          : 'sit';
  // squash on landing, stretch on the way up
  const since = s.t - landedAt.current;
  const squash = !reduce && s.y === 0 && since >= 0 && since < 0.12 ? 1 - (0.12 - since) * 1.6 : 1;
  const stretch = !reduce && s.y > 0 ? 1 + Math.min(0.12, Math.max(-0.08, s.vy / 5000)) : 1;
  const sy = squash * stretch;
  const sx = 1 / Math.sqrt(sy);
  const starOn = s.t < s.starUntil;
  const magnetOn = s.t < s.magnetUntil;
  const zone = lookAt(s.distance).zone;
  const shake = s.over && !reduce ? 'is-bumped' : '';
  const times = streakTimes(s.streak);
  const fast = s.speed > 420 && phase === 'run' && !reduce;

  return (
    <GameShell
      id="hop"
      title="Coco’s Hoprace"
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
      <DuelPanel kind="hop" mode={mode} first={duel.first} result={duel.result} />
      <div className="skee-status">
        <span className="skee-digits" aria-label={`Score ${score}`}>
          {String(score).padStart(4, '0')}
        </span>
        <span className="hop-meta">
          <span>
            {metres(s.distance)} m · {ZONES[zone].emoji} {ZONES[zone].name}
          </span>
          <span>
            🥕 {s.eaten} · +{s.treatPoints}
          </span>
        </span>
        {cocoScore !== null && (
          <span className="skee-digits skee-digits--coco" aria-label={`Coco ${cocoScore}`}>
            🐰 {String(cocoScore).padStart(4, '0')}
          </span>
        )}
      </div>
      {target !== null && phase !== 'done' && (
        <p className={`hop-target ${score > target ? 'is-passed' : ''}`}>
          {score > target ? '✨ ' : '🎯 '}Te verslaan: <strong>{target}</strong> van {targetName}
        </p>
      )}
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <div
        className={`hop ${shake} ${starOn ? 'is-star' : ''}`}
        ref={stage}
        onPointerDown={(e) => {
          if (phase === 'done') return;
          (e.target as Element).setPointerCapture?.(e.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        role="application"
        tabIndex={0}
        aria-label="Coco’s hoprace: tik of druk op spatie om te hoppen, houd vast voor een hogere sprong"
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="hop__scene" aria-hidden="true">
          <Sky distance={s.distance} t={s.t} />
          <Backdrop distance={s.distance} t={s.t} />
          {s.obstacles
            .filter((o) => !o.gone)
            .map((o) => (
              <g key={o.id} transform={`translate(${o.x - s.distance} ${GROUND})`}>
                <ObstacleArt o={o} zone={zone} t={s.t} />
              </g>
            ))}
          {s.treats
            .filter((t) => !t.eaten)
            .map((t) => (
              <g
                key={t.id}
                transform={`translate(${t.x - s.distance + TREAT / 2} ${GROUND - t.y - TREAT / 2 + Math.sin(s.t * 5 + t.id) * 1.5}) scale(0.4)`}
              >
                <Treat food={t.food} />
              </g>
            ))}
          {s.powers
            .filter((p) => !p.taken)
            .map((p) => (
              <g
                key={p.id}
                transform={`translate(${p.x - s.distance + TREAT / 2} ${GROUND - p.y - TREAT / 2 + Math.sin(s.t * 4 + p.id) * 3})`}
              >
                <PowerArt kind={p.kind} />
              </g>
            ))}
          {fast && (
            <g opacity="0.5">
              {[0, 1, 2].map((i) => (
                <path
                  key={i}
                  d={`M${COCO_X - 20 - ((s.t * 900 + i * 40) % 60)} ${GROUND - s.y - 14 - i * 9}h-${16 + i * 6}`}
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )}
          <ellipse
            cx={CX}
            cy={GROUND + 2}
            rx={20 - Math.min(10, s.y / 10)}
            ry="3.5"
            fill="#000"
            opacity={0.22}
          />
          {magnetOn && (
            <circle
              cx={CX}
              cy={GROUND - s.y - 18}
              r={30 + Math.sin(s.t * 10) * 3}
              fill="none"
              stroke="#ffd75e"
              strokeWidth="2"
              strokeDasharray="4 5"
              opacity="0.8"
            />
          )}
          <g
            transform={`translate(${CX} ${GROUND - s.y}) scale(${sx} ${sy}) translate(0 ${-80 * COCO_SCALE}) scale(${COCO_SCALE})`}
            className={starOn ? 'hop__coco is-star' : 'hop__coco'}
          >
            <Coco pose={pose} />
          </g>
          {s.shield && (
            <g>
              <circle
                cx={CX}
                cy={GROUND - s.y - 16}
                r="27"
                fill="#ff8cc0"
                fillOpacity="0.16"
                stroke="#ff8cc0"
                strokeWidth="2"
              />
              <text x={CX + 20} y={GROUND - s.y - 36} fontSize="11">
                💗
              </text>
            </g>
          )}
          {bits.current.map((b) => {
            const o = 1 - b.life / b.max;
            if (b.kind === 'dust')
              return (
                <circle
                  key={b.id}
                  cx={b.x}
                  cy={b.y}
                  r={3 + b.life * 10}
                  fill="#fff"
                  opacity={o * 0.6}
                />
              );
            if (b.kind === 'heart')
              return (
                <text key={b.id} x={b.x} y={b.y} fontSize="10" opacity={o}>
                  💗
                </text>
              );
            return (
              <circle
                key={b.id}
                cx={b.x}
                cy={b.y}
                r={b.kind === 'spark' ? 1.8 : 2.4}
                fill={b.color ?? '#fff'}
                opacity={o}
              />
            );
          })}
          {floats.current.map((f) => (
            <text
              key={f.id}
              x={f.x}
              y={f.y}
              textAnchor="middle"
              className={`hop__float ${f.gold ? 'is-gold' : ''}`}
              opacity={1 - f.life / 0.9}
            >
              {f.text}
            </text>
          ))}
          {s.over && (
            <text x={CX} y={GROUND - 66} textAnchor="middle" fontSize="18">
              💫
            </text>
          )}
          {/* HUD: the streak and the powers */}
          {s.streak > 0 && (
            <g transform="translate(10 12)">
              <rect width={times > 1 ? 74 : 52} height="20" rx="10" fill="#1b0b22" opacity="0.55" />
              <text x="8" y="14" className="hop__hud">
                🔥 {s.streak}
                {times > 1 ? ` ×${times}` : ''}
              </text>
            </g>
          )}
          {(['hug', 'magnet', 'star'] as const)
            .filter((k) => (k === 'hug' ? s.shield : k === 'magnet' ? magnetOn : starOn))
            .map((k, i) => {
              const left =
                k === 'hug'
                  ? 1
                  : ((k === 'magnet' ? s.magnetUntil : s.starUntil) - s.t) / POWER_SECONDS[k];
              return (
                <g key={k} transform={`translate(${W - 34 - i * 30} 24)`}>
                  <circle r="12" fill="#1b0b22" opacity="0.5" />
                  <circle
                    r="12"
                    fill="none"
                    stroke="#ffd75e"
                    strokeWidth="2.5"
                    strokeDasharray={`${left * 75.4} 75.4`}
                    transform="rotate(-90)"
                  />
                  <text y="4" textAnchor="middle" fontSize="11">
                    {k === 'hug' ? '💗' : k === 'magnet' ? '🥕' : '⭐'}
                  </text>
                </g>
              );
            })}
        </svg>
        {banner && (
          <span key={banner.id} className="hop__pop">
            {banner.text}
          </span>
        )}
        {(phase === 'ready' || phase === 'paused') && (
          <div className="hop__start" aria-hidden="true">
            <span>{phase === 'paused' ? '⏸ Tik om verder te gaan' : '▶ Tik om te starten'}</span>
          </div>
        )}
        <TicketStrip tickets={tickets} />
      </div>
      {phase === 'done' && (
        <RoundCard
          title={s.hit ? ENDING[s.hit] : 'Klaar!'}
          score={score}
          record={record}
          stats={[
            { label: 'Gerend', value: `${metres(s.distance)} m` },
            { label: 'Snacks', value: `${s.eaten} (+${s.treatPoints})` },
            { label: 'Beste reeks', value: s.bestStreak },
            { label: 'Bereikt', value: `${ZONES[zone].emoji} ${ZONES[zone].name}` },
          ]}
        />
      )}
      <p className="game-hint">
        Tik om te hoppen · houd vast voor hoger · nog eens tikken in de lucht. Ren onder bijen door,
        spring over egeltjes. 💗 knuffel = één botsing vergeven · 🥕 gouden wortel = snacks komen
        naar je toe · ⭐ = dubbele punten. Tien snacks op rij tellen ×2, vanaf 25 ×3.
      </p>
      {phase === 'done' &&
        (handOver ? (
          <button type="button" className="neon-btn" onClick={() => restart(true)}>
            Nu {nameOf(duel.player, profile)} ▶
          </button>
        ) : (
          <button type="button" className="neon-btn" onClick={() => restart()}>
            Nog een rondje 🐰
          </button>
        ))}
    </GameShell>
  );
}
