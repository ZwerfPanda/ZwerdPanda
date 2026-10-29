import { memo, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { Bunny } from '../pet/Bunny';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { RoundCard } from './RoundCard';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { duelScores, planDuel } from './duel';
import {
  ORDER_WORDS,
  PERFECT_SHAKES,
  SHIFT_SECONDS,
  TEAS,
  TOPPINGS,
  binDrink,
  cocoShift,
  inRush,
  isPerfect,
  isReady,
  newShift,
  orderText,
  serve,
  setDrink,
  shake,
  shiftStars,
  tick,
  type BarEvent,
  type BarState,
  type Customer,
  type Drink,
  type Level,
  type Tea,
  type Topping,
} from './boba';
import './boba.css';

/*
 * The Bubble Tea Bar: a shift behind the counter. Pour the tea, add the
 * topping, sugar and ice, give it a shake, then tap the customer it's for.
 */

const teaColor = (tea?: Tea) => TEAS.find((t) => t.id === tea)?.color;

const MISSING: Record<'tea' | 'topping' | 'sugar' | 'ice', string> = {
  tea: 'thee',
  topping: 'topping',
  sugar: 'suiker',
  ice: 'ijs',
};

/** Keys on a computer: 1–5 tea, Q W E topping, A S sugar, Z X ice, space shakes. */
const KEYS: Record<string, Partial<Drink>> = {
  '1': { tea: 'jasmijn' },
  '2': { tea: 'melkthee' },
  '3': { tea: 'matcha' },
  '4': { tea: 'taro' },
  '5': { tea: 'aardbei' },
  q: { topping: 'tapioca' },
  w: { topping: 'popping' },
  e: { topping: 'lychee' },
  a: { sugar: 'weinig' },
  s: { sugar: 'veel' },
  z: { ice: 'weinig' },
  x: { ice: 'veel' },
};
const KEY_OF = (part: Partial<Drink>) =>
  Object.entries(KEYS).find(([, p]) => JSON.stringify(p) === JSON.stringify(part))?.[0];

/* --------------------------------------------------------------- the shop */

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`;
};
/** The window: morning, afternoon, evening, as the shift goes on. */
function windowSky(p: number) {
  const stops = ['#9fd8ff', '#ffe2a8', '#ff9fb8', '#7a6bd0'];
  const i = Math.min(2, Math.floor(p * 3));
  return mix(stops[i], stops[i + 1], p * 3 - i);
}

const Shop = memo(function Shop({ p, rush, open }: { p: number; rush: boolean; open: boolean }) {
  return (
    <svg viewBox="0 0 400 104" className="boba-shop" aria-hidden="true">
      <defs>
        <pattern id="boba-tiles" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#ffe3ee" />
          <path d="M0 0h16v16" fill="none" stroke="#f6c9da" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="400" height="104" fill="url(#boba-tiles)" />
      {/* window */}
      <rect
        x="14"
        y="18"
        width="78"
        height="62"
        rx="8"
        fill={windowSky(p)}
        stroke="#b07bff"
        strokeWidth="4"
      />
      <circle
        cx={30 + p * 50}
        cy={58 - Math.sin(p * Math.PI) * 26}
        r="7"
        fill={p > 0.8 ? '#fff6d8' : '#ffe27a'}
      />
      <path d="M53 18v62M14 49h78" stroke="#b07bff" strokeWidth="3" />
      <path d="M18 78q10 -14 20 0q10 -12 22 0q12 -10 28 0" fill="#7ab868" opacity="0.8" />
      {/* menu board */}
      <rect
        x="112"
        y="14"
        width="96"
        height="66"
        rx="6"
        fill="#2a2433"
        stroke="#8a6a4f"
        strokeWidth="4"
      />
      <text x="160" y="28" textAnchor="middle" fontSize="9" fill="#ffd1e4" fontWeight="700">
        MENU
      </text>
      {TEAS.map((t, i) => (
        <g key={t.id} transform={`translate(122 ${36 + i * 9})`}>
          <circle cx="3" cy="-2.5" r="3" fill={t.color} />
          <text x="10" y="0" fontSize="7" fill="#f3e9ff">
            {t.label}
          </text>
          <text x="76" y="0" fontSize="7" fill="#ffd75e" textAnchor="end">
            ♥
          </text>
        </g>
      ))}
      {/* shelf with jars */}
      <rect x="228" y="56" width="160" height="5" rx="2" fill="#c98a5a" />
      {[
        ['#3a2418', 'pearls'],
        ['#ff8cc0', 'popping'],
        ['#f3f7ea', 'jelly'],
        ['#e9d98a', 'syrup'],
        ['#9fcf7c', 'matcha'],
      ].map(([c], i) => (
        <g key={i} transform={`translate(${236 + i * 30} 30)`}>
          <rect width="20" height="26" rx="5" fill="#ffffff" opacity="0.65" stroke="#d9b8c8" />
          <rect x="3" y="10" width="14" height="13" rx="3" fill={c} />
          <rect x="4" y="-3" width="12" height="5" rx="2" fill="#c98a5a" />
        </g>
      ))}
      {/* plant */}
      <path d="M372 56q-6 -18 4 -26q4 14 -4 26M372 56q8 -14 18 -14q-6 12 -18 14" fill="#6aa457" />
      {/* string lights */}
      <path d="M0 8q50 10 100 0t100 0t100 0t100 0" fill="none" stroke="#5b4a63" strokeWidth="1.2" />
      {Array.from({ length: 16 }, (_, i) => (
        <circle
          key={i}
          className="boba-bulb"
          style={{ animationDelay: `${(i % 4) * 0.35}s` }}
          cx={12 + i * 25}
          cy={8 + Math.sin((i * 25 + 12) / 31.8) * 4 + 4}
          r="3"
          fill={['#ffd75e', '#ff8cc0', '#5ff3ff', '#b07bff'][i % 4]}
        />
      ))}
      {/* neon */}
      <text x="286" y="91" textAnchor="middle" className="boba-neon" fontSize="13.5">
        Bubble Tea Bar
      </text>
      <rect x="352" y="80" width="38" height="14" rx="4" fill={open ? '#6dffa8' : '#5b4a63'} />
      <text x="371" y="90.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#0c2016">
        {open ? 'OPEN' : 'DICHT'}
      </text>
      {rush && (
        <g className="boba-rushsign">
          <rect x="228" y="64" width="62" height="14" rx="4" fill="#ff5f7e" />
          <text x="259" y="74.5" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff">
            🔔 SPITSUUR
          </text>
        </g>
      )}
    </svg>
  );
});

/* ---------------------------------------------------------------- the cup */

function Cup({ drink, pouring }: { drink: Drink; pouring: string | null }) {
  const reduce = useReducedMotion();
  const color = teaColor(drink.tea);
  const ice = drink.ice === 'veel' ? 4 : drink.ice === 'weinig' ? 1 : 0;
  const ready = isReady(drink);
  const perfect = isPerfect(drink);
  const drop = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { y: -60, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { type: 'spring' as const, damping: 12, delay },
        };
  return (
    <motion.svg
      viewBox="0 0 120 170"
      className={`boba-cup ${perfect ? 'is-perfect' : ''}`}
      aria-hidden="true"
      key={`cup-${drink.shakes ?? 0}`}
      initial={reduce || !drink.shakes ? false : { rotate: -10 }}
      animate={{ rotate: 0 }}
      transition={{ type: 'spring', stiffness: 600, damping: 6 }}
    >
      <defs>
        <clipPath id="boba-cup-clip">
          <path d="M24 50h72l-9 110H33z" />
        </clipPath>
        <linearGradient id="boba-glass" x1="0" x2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="30%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {pouring && !reduce && (
        <motion.rect
          key={pouring}
          x="56"
          width="8"
          rx="4"
          fill={teaColor(pouring as Tea) ?? '#fff'}
          initial={{ y: 0, height: 0, opacity: 1 }}
          animate={{ y: [0, 0, 120], height: [0, 120, 0], opacity: [1, 1, 0] }}
          transition={{ duration: 0.55 }}
        />
      )}
      <g clipPath="url(#boba-cup-clip)">
        <rect x="0" y="46" width="120" height="124" fill="#fff8f0" opacity="0.35" />
        {color && (
          <motion.rect
            key={drink.tea}
            x="0"
            width="120"
            height="120"
            fill={color}
            initial={reduce ? false : { y: 170 }}
            animate={{ y: 62 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
        {drink.sugar && (
          <motion.path
            key={drink.sugar}
            d="M30 80q30 14 60 0q-30 30 -60 18"
            fill="#fff"
            opacity={drink.sugar === 'veel' ? 0.55 : 0.25}
            {...drop(0)}
          />
        )}
        {drink.topping === 'tapioca' &&
          Array.from({ length: 14 }, (_, i) => (
            <motion.circle
              key={`t${i}`}
              cx={38 + ((i * 13) % 46)}
              cy={150 - Math.floor(i / 5) * 9}
              r="5"
              fill="#3a2418"
              {...drop((i % 5) * 0.04)}
            />
          ))}
        {drink.topping === 'popping' &&
          Array.from({ length: 12 }, (_, i) => (
            <motion.circle
              key={`p${i}`}
              cx={38 + ((i * 17) % 46)}
              cy={150 - Math.floor(i / 5) * 10}
              r="5.5"
              fill={['#ffb3c7', '#ffd75e', '#ff8cc0'][i % 3]}
              stroke="#fff"
              strokeWidth="1.2"
              {...drop((i % 5) * 0.04)}
            />
          ))}
        {drink.topping === 'lychee' &&
          Array.from({ length: 8 }, (_, i) => (
            <motion.rect
              key={`l${i}`}
              x={36 + ((i * 15) % 44)}
              y={138 - Math.floor(i / 4) * 12}
              width="9"
              height="9"
              rx="2"
              fill="#f3f7ea"
              opacity="0.85"
              {...drop((i % 4) * 0.05)}
            />
          ))}
        {Array.from({ length: ice }, (_, i) => (
          <motion.rect
            key={`i${i}`}
            x={34 + i * 13}
            y={66 + (i % 2) * 7}
            width="15"
            height="14"
            rx="3"
            fill="#eaf8ff"
            stroke="#b8dff2"
            opacity="0.92"
            {...drop(i * 0.05)}
          />
        ))}
        <rect x="0" y="40" width="120" height="130" fill="url(#boba-glass)" />
      </g>
      <path
        d="M24 50h72l-9 110H33z"
        fill="none"
        stroke="#3a2a3a"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {/* the sealed lid and the straw, once it's done */}
      {ready ? (
        <>
          <motion.ellipse
            cx="60"
            cy="50"
            rx="37"
            ry="7"
            fill="#ffd1e4"
            stroke="#3a2a3a"
            strokeWidth="3"
            initial={reduce ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
          />
          <motion.path
            d="M68 6l-7 136"
            stroke="#ff86bb"
            strokeWidth="9"
            strokeLinecap="round"
            initial={reduce ? false : { y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
          />
        </>
      ) : (
        <ellipse
          cx="60"
          cy="50"
          rx="37"
          ry="7"
          fill="#fffcf6"
          fillOpacity="0.6"
          stroke="#3a2a3a"
          strokeWidth="3"
        />
      )}
      {perfect && (
        <text x="100" y="40" fontSize="16">
          ✨
        </text>
      )}
    </motion.svg>
  );
}

/** The tip jar fills up with coins. */
function TipJar({ tips, bump }: { tips: number; bump: number }) {
  const level = Math.min(1, tips / 160);
  return (
    <motion.svg
      viewBox="0 0 60 70"
      className="boba-jar"
      aria-hidden="true"
      key={bump}
      initial={bump ? { scale: 1.15 } : false}
      animate={{ scale: 1 }}
    >
      <rect
        x="10"
        y="14"
        width="40"
        height="50"
        rx="10"
        fill="#ffffff"
        opacity="0.25"
        stroke="#fff"
        strokeOpacity="0.6"
        strokeWidth="2"
      />
      <rect x="14" y="14" width="32" height="6" rx="3" fill="#c98a5a" />
      <clipPath id="boba-jar-clip">
        <rect x="12" y="20" width="36" height="42" rx="8" />
      </clipPath>
      <g clipPath="url(#boba-jar-clip)">
        {Array.from({ length: Math.round(level * 18) }, (_, i) => (
          <ellipse
            key={i}
            cx={18 + ((i * 7) % 26)}
            cy={58 - Math.floor(i / 4) * 6}
            rx="6"
            ry="3"
            fill="#ffd75e"
            stroke="#c99a1e"
            strokeWidth="1"
          />
        ))}
      </g>
      <text x="30" y="10" textAnchor="middle" fontSize="8" fill="#ffd75e" fontWeight="800">
        FOOI
      </text>
    </motion.svg>
  );
}

/* --------------------------------------------------------------- guests */

const CocoFace = memo(function CocoFace() {
  return (
    <svg viewBox="-95 -120 190 215" className="boba-guest__coco" aria-hidden="true">
      <Bunny pose="sit" shadow={false} />
    </svg>
  );
});

function Guest({
  c,
  now,
  vipName,
  ready,
  onServe,
  flash,
}: {
  c: Customer;
  now: number;
  vipName: string;
  ready: boolean;
  onServe: () => void;
  flash?: string;
}) {
  const left = Math.max(0, 1 - (now - c.arrived) / c.patience);
  const who = c.vip ? vipName : c.who === 'coco' ? 'Coco' : 'Klant';
  const ring = 2 * Math.PI * 25;
  const tone = left < 0.3 ? '#ff5f7e' : left < 0.6 ? '#ffd75e' : '#6dd68a';
  return (
    <motion.li
      layout
      className={`boba-guest ${c.vip ? 'is-vip' : ''} ${c.hurry ? 'is-hurry' : ''} ${left < 0.3 ? 'is-cross' : ''}`}
      initial={{ y: -30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 30, opacity: 0, transition: { duration: 0.25 } }}
    >
      <button
        type="button"
        className="boba-guest__btn"
        onClick={onServe}
        data-order={orderText(c.order)}
      >
        {!c.vip && <span className="visually-hidden">{who}: </span>}
        <span className="boba-guest__face" aria-hidden="true">
          <svg viewBox="0 0 60 60" className="boba-guest__ring">
            <circle
              cx="30"
              cy="30"
              r="25"
              fill="none"
              stroke="rgba(58,42,58,0.12)"
              strokeWidth="4"
            />
            <circle
              cx="30"
              cy="30"
              r="25"
              fill="none"
              stroke={tone}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={`${left * ring} ${ring}`}
              transform="rotate(-90 30 30)"
            />
          </svg>
          <span className="boba-guest__avatar">
            {c.vip ? '💖' : c.who === 'coco' ? <CocoFace /> : c.who}
          </span>
          <span className="boba-guest__mood">{left < 0.3 ? '😤' : left < 0.6 ? '🙂' : '😊'}</span>
          {c.hurry && <span className="boba-guest__hurry">⚡</span>}
          {c.vip && <span className="boba-guest__crown">👑</span>}
        </span>
        {c.vip && <span className="boba-guest__vip">{vipName}</span>}
        <span className="boba-ticket">
          <span className="boba-ticket__tea">
            <i style={{ background: teaColor(c.order.tea) }} aria-hidden="true" />
            {ORDER_WORDS.tea(c.order.tea)}
          </span>
          <span>{ORDER_WORDS.topping(c.order.topping)}</span>
          <span>
            <span aria-hidden="true">🍬</span> {c.order.sugar}
            <span className="visually-hidden"> suiker,</span> · <span aria-hidden="true">🧊</span>{' '}
            {c.order.ice}
            <span className="visually-hidden"> ijs</span>
          </span>
        </span>
        {c.hurry && <span className="visually-hidden">, heeft haast</span>}
        {ready && (
          <span className="boba-guest__give">
            Geef <span aria-hidden="true">▶</span>
          </span>
        )}
      </button>
      <AnimatePresence>
        {flash && (
          <motion.span
            className={`boba-guest__flash ${flash.startsWith('✗') ? 'is-wrong' : ''}`}
            initial={{ y: 0, opacity: 0, scale: 0.7 }}
            animate={{ y: -26, opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            {flash}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/* ------------------------------------------------------------- stations */

function TeaTank({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 40 44" aria-hidden="true" className="boba-station__art">
      <rect
        x="6"
        y="2"
        width="28"
        height="30"
        rx="6"
        fill="#fff"
        opacity="0.3"
        stroke="#fff"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <rect x="8" y="10" width="24" height="20" rx="4" fill={color} />
      <rect x="16" y="32" width="8" height="5" fill="#c9c3d6" />
      <rect x="14" y="37" width="12" height="4" rx="2" fill="#8a8396" />
    </svg>
  );
}

function ToppingJar({ topping }: { topping: Topping }) {
  return (
    <svg viewBox="0 0 40 44" aria-hidden="true" className="boba-station__art">
      <rect
        x="6"
        y="8"
        width="28"
        height="32"
        rx="7"
        fill="#fff"
        opacity="0.3"
        stroke="#fff"
        strokeOpacity="0.6"
        strokeWidth="1.5"
      />
      <rect x="9" y="3" width="22" height="6" rx="2" fill="#c98a5a" />
      {topping === 'tapioca' &&
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <circle
            key={i}
            cx={13 + (i % 4) * 5}
            cy={34 - Math.floor(i / 4) * 6}
            r="2.6"
            fill="#3a2418"
          />
        ))}
      {topping === 'popping' &&
        [0, 1, 2, 3, 4, 5, 6].map((i) => (
          <circle
            key={i}
            cx={13 + (i % 4) * 5}
            cy={34 - Math.floor(i / 4) * 6}
            r="2.8"
            fill={['#ffb3c7', '#ffd75e', '#ff8cc0'][i % 3]}
          />
        ))}
      {topping === 'lychee' &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x={11 + (i % 3) * 6}
            y={30 - Math.floor(i / 3) * 7}
            width="5"
            height="5"
            rx="1"
            fill="#f3f7ea"
          />
        ))}
    </svg>
  );
}

function Station<T extends string>({
  label,
  field,
  options,
  value,
  onPick,
  disabled,
  art,
  wide = false,
}: {
  label: string;
  field: 'tea' | 'topping' | 'sugar' | 'ice';
  options: { id: T; label: string }[];
  value?: T;
  onPick: (v: T) => void;
  disabled: boolean;
  art?: (id: T) => React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`boba-station ${wide ? 'is-wide' : ''}`} role="group" aria-label={label}>
      <span className="boba-station__label">{label}</span>
      <div className="boba-station__opts">
        {options.map((o) => {
          const key = KEY_OF({ [field]: o.id });
          return (
            <button
              key={o.id}
              type="button"
              className={`boba-opt ${value === o.id ? 'is-on' : ''} ${art ? 'has-art' : ''}`}
              aria-pressed={value === o.id}
              disabled={disabled}
              onClick={() => onPick(o.id)}
            >
              {art?.(o.id)}
              <span>{o.label}</span>
              {key && (
                <kbd className="boba-kbd" aria-hidden="true">
                  {key.toUpperCase()}
                </kbd>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const LEVELS: { id: Level; label: string }[] = [
  { id: 'weinig', label: 'Weinig' },
  { id: 'veel', label: 'Veel' },
];

/* --------------------------------------------------------------- the game */

export function BubbleTeaBar() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('boba');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
  const duel = useDuelRound('boba', mode);
  const [bar, setBar] = useState<BarState>(newShift);
  const [phase, setPhase] = useState<'ready' | 'open' | 'done'>('ready');
  const [line, setLine] = useState(
    'Klaar voor je dienst? Maak de bestellingen, schud ze, en geef ze aan de juiste klant.',
  );
  const [flashes, setFlashes] = useState<Record<number, string>>({});
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const [pouring, setPouring] = useState<string | null>(null);
  const [jarBump, setJarBump] = useState(0);
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const [record, setRecord] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const barRef = useRef(bar);
  barRef.current = bar;
  const vipName = nameOf('partner', profile);
  const myBest = mode === 'local' ? null : best[me];

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'boba', me) : null;
  const target =
    mode === 'local' && duel.first !== null
      ? duel.first
      : plan?.type === 'answer'
        ? (duelScores(matches.find((m) => m.id === plan.id))[them] ?? null)
        : null;

  const flash = (id: number, text: string) => {
    setFlashes((f) => ({ ...f, [id]: text }));
    window.setTimeout(
      () =>
        setFlashes((f) => {
          const { [id]: _, ...rest } = f;
          return rest;
        }),
      1100,
    );
  };
  const say = (text: string) => setBanner({ id: performance.now(), text });

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 1900);
    return () => window.clearTimeout(t);
  }, [banner]);

  const react = (events: BarEvent[], before: BarState) => {
    for (const e of events) {
      if (e.type === 'arrive') {
        playSfx(e.vip ? 'sparkle' : 'chime', true);
        if (e.vip)
          setLine(
            me === 'partner'
              ? '💖 Een VIP… jijzelf! Je eigen bestelling, dubbele punten.'
              : `💖 ${vipName} komt binnen! Je weet wat ze wil… (dubbele punten)`,
          );
        else if (e.hurry) setLine('⚡ Iemand heeft haast — snel zijn levert dubbele fooi op!');
      } else if (e.type === 'leave') {
        const c = before.customers.find((x) => x.id === e.id);
        playSfx('whoosh', true);
        setLine(`${c?.vip ? vipName : 'Een klant'} heeft te lang gewacht en is weg 😤`);
      } else if (e.type === 'served') {
        playSfx('success', true);
        window.setTimeout(() => playSfx('coin', true), 160);
        setJarBump((n) => n + 1);
        flash(e.id, `+${e.points}${e.perfect ? ' ✨' : ''}`);
        setLine(
          e.vip
            ? `Precies zoals ${vipName} hem wil ♡ +${e.points}`
            : e.perfect
              ? `Perfect geschud! ✨ +${e.points}`
              : e.combo >= 3
                ? `${e.combo} goed op rij! 🔥 +${e.points}`
                : `Lekker! +${e.points}${e.tip >= 7 ? ' (snel!)' : ''}`,
        );
      } else if (e.type === 'wrong') {
        playSfx('error', true);
        flash(e.id, '✗');
        setLine(`Oeps — de ${e.missing.map((m) => MISSING[m]).join(' en de ')} klopte niet`);
      } else if (e.type === 'rush') {
        playSfx('horn', true);
        say('🔔 Spitsuur! Iedereen wil bubble tea');
      } else if (e.type === 'last') {
        say('🔔 Laatste klanten!');
      } else if (e.type === 'end') {
        finish();
      }
    }
  };

  // The clock: customers come in and run out of patience.
  useEffect(() => {
    if (phase !== 'open') return;
    let last = performance.now();
    const t = window.setInterval(() => {
      const now = performance.now();
      const before = barRef.current;
      const out = tick(before, (now - last) / 1000);
      last = now;
      barRef.current = out.state;
      setBar(out.state);
      react(out.events, before);
    }, 100);
    return () => window.clearInterval(t);
  }, [phase]);

  const finish = () => {
    setPhase('done');
    const b = barRef.current;
    const total = b.score;
    setRecord(myBest !== null && myBest !== undefined && total > myBest);
    const how = `Dienst voorbij: ${b.served} drankjes`;
    if (mode !== 'coco') {
      const end = duel.finish(total);
      setLine(`${how} · ${end.text}`);
      setTickets(end.tickets);
      setHandOver(Boolean(end.handOver));
      if (end.tickets) celebrateFrom(stage.current);
      return;
    }
    if (getAuthor()) addScore('boba', total);
    const coco = cocoShift();
    setCocoScore(coco);
    addScore('boba', coco, 'coco');
    const winner = total > coco ? me : total < coco ? 'coco' : 'draw';
    recordResult('boba', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      `${how} · ${
        winner === me
          ? `Jij wint! ${total} tegen ${coco} 🎉`
          : winner === 'coco'
            ? `Coco wint met ${coco} tegen ${total} 🐰🧋`
            : `Gelijk! ${total}–${coco}`
      }`,
    );
  };

  const pick = (part: Partial<Drink>) => {
    if (phase !== 'open') return;
    if (part.tea) {
      playSfx('drop', true);
      setPouring(`${part.tea}`);
      window.setTimeout(() => setPouring(null), 600);
    } else playSfx(part.topping ? 'pop' : part.ice ? 'clunk' : 'tap', true);
    setBar((b) => {
      const next = setDrink(b, part);
      barRef.current = next;
      return next;
    });
  };

  const doShake = () => {
    if (phase !== 'open') return;
    const b = barRef.current;
    if (!b.drink.tea) {
      setLine('Eerst thee in de beker, dan schudden!');
      return;
    }
    const next = shake(b);
    if (next === b) return;
    playSfx(isPerfect(next.drink) ? 'sparkle' : 'whirr', true);
    barRef.current = next;
    setBar(next);
  };

  const give = (id: number) => {
    const b = barRef.current;
    if (phase !== 'open') return;
    if (!isReady(b.drink)) {
      const missing = (['tea', 'topping', 'sugar', 'ice'] as const).filter((k) => !b.drink[k]);
      setLine(`Nog niet klaar: kies nog ${missing.map((m) => MISSING[m]).join(', ')}`);
      playSfx('tap', true);
      return;
    }
    const out = serve(b, id);
    barRef.current = out.state;
    setBar(out.state);
    if (out.event) react([out.event], b);
  };

  const bin = () => {
    if (phase !== 'open' || !Object.keys(barRef.current.drink).length) return;
    playSfx('splat', true);
    const next = binDrink(barRef.current);
    barRef.current = next;
    setBar(next);
  };

  // Keys on a computer.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (phase !== 'open' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, [role="dialog"]')) return;
      const part = KEYS[e.key.toLowerCase()];
      if (part) {
        e.preventDefault();
        pick(part);
      } else if (e.key === ' ' && !el?.closest('button')) {
        e.preventDefault();
        doShake();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        bin();
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  });

  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    const fresh = newShift();
    barRef.current = fresh;
    setBar(fresh);
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setFlashes({});
    setBanner(null);
    setRecord(false);
    setPhase('ready');
    setLine(
      keepDuel
        ? `Nu ${nameOf(duel.player, profile)} achter de bar!`
        : 'Klaar voor je dienst? Maak de bestellingen, schud ze, en geef ze aan de juiste klant.',
    );
  };

  const left = Math.ceil(SHIFT_SECONDS - bar.t);
  const ready = isReady(bar.drink);
  const open = phase === 'open';
  const shakes = bar.drink.shakes ?? 0;
  const rush = open && inRush(bar.t);
  const stars = shiftStars(bar.score);

  return (
    <GameShell
      id="boba"
      title="Bubble Tea Bar"
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
      <DuelPanel kind="boba" mode={mode} first={duel.first} result={duel.result} />
      <div className="skee-status">
        <span className="skee-digits" aria-label={`Score ${bar.score}`}>
          {String(bar.score).padStart(3, '0')}
        </span>
        <span className="boba-clock" aria-label={`${left} seconden over`}>
          <span className={`boba-clock__bar ${rush ? 'is-rush' : ''}`} aria-hidden="true">
            <span style={{ transform: `scaleX(${left / SHIFT_SECONDS})` }} />
          </span>
          ⏱ {left}s{bar.combo >= 2 ? ` · 🔥 ${bar.combo}` : ''}
        </span>
        {cocoScore !== null && (
          <span className="skee-digits skee-digits--coco" aria-label={`Coco ${cocoScore}`}>
            🐰 {String(cocoScore).padStart(3, '0')}
          </span>
        )}
      </div>
      {target !== null && phase !== 'done' && (
        <p className={`hop-target ${bar.score > target ? 'is-passed' : ''}`}>
          {bar.score > target ? '✨ ' : '🎯 '}Te verslaan: <strong>{target}</strong> van{' '}
          {nameOf(mode === 'local' ? me : them, profile)}
        </p>
      )}
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>

      <div className={`boba ${rush ? 'is-rush' : ''}`} ref={stage}>
        <Shop p={bar.t / SHIFT_SECONDS} rush={rush} open={open} />
        <ul className="boba__counter" aria-label="Klanten aan de toonbank">
          <AnimatePresence>
            {bar.customers.map((c) => (
              <Guest
                key={c.id}
                c={c}
                now={bar.t}
                vipName={vipName}
                ready={ready}
                onServe={() => give(c.id)}
                flash={flashes[c.id]}
              />
            ))}
          </AnimatePresence>
          {open && bar.customers.length === 0 && <li className="boba__empty">Even rustig…</li>}
        </ul>
        <div className="boba__wood" aria-hidden="true" />
        {Object.entries(flashes)
          .filter(([id]) => !bar.customers.some((c) => c.id === Number(id)))
          .map(([id, text]) => (
            <span key={id} className={`boba__served ${text.startsWith('✗') ? 'is-wrong' : ''}`}>
              {text}
            </span>
          ))}
        <div className="boba__work">
          <Cup drink={bar.drink} pouring={pouring} />
          <div className="boba__side">
            <div className="boba__made" aria-live="polite">
              {bar.drink.tea ? ORDER_WORDS.tea(bar.drink.tea) : 'Lege beker'}
              {bar.drink.topping && ` · ${ORDER_WORDS.topping(bar.drink.topping)}`}
              {bar.drink.sugar && ` · ${bar.drink.sugar} suiker`}
              {bar.drink.ice && ` · ${bar.drink.ice} ijs`}
              {ready && <strong> — tik op de klant!</strong>}
            </div>
            <div className="boba__tools">
              <button
                type="button"
                className={`boba-shake ${isPerfect(bar.drink) ? 'is-done' : ''}`}
                onClick={doShake}
                disabled={!open || !bar.drink.tea || isPerfect(bar.drink)}
                aria-label={`Schud de beker (${shakes} van ${PERFECT_SHAKES})`}
              >
                🫨 Schud
                <span className="boba-shake__dots" aria-hidden="true">
                  {Array.from({ length: PERFECT_SHAKES }, (_, i) => (
                    <i key={i} className={i < shakes ? 'is-on' : ''} />
                  ))}
                </span>
              </button>
              <button
                type="button"
                className="boba-bin"
                disabled={!open || !Object.keys(bar.drink).length}
                onClick={bin}
              >
                <Trash2 aria-hidden="true" /> Weg
              </button>
            </div>
          </div>
          <TipJar tips={bar.tips} bump={jarBump} />
        </div>
        <div className="boba__controls">
          <Station
            label="Thee"
            field="tea"
            options={TEAS}
            value={bar.drink.tea}
            onPick={(tea) => pick({ tea })}
            disabled={!open}
            art={(id) => <TeaTank color={teaColor(id)!} />}
            wide
          />
          <Station
            label="Topping"
            field="topping"
            options={TOPPINGS}
            value={bar.drink.topping}
            onPick={(topping) => pick({ topping })}
            disabled={!open}
            art={(id) => <ToppingJar topping={id} />}
          />
          <div className="boba__pair">
            <Station
              label="Suiker"
              field="sugar"
              options={LEVELS}
              value={bar.drink.sugar}
              onPick={(sugar) => pick({ sugar })}
              disabled={!open}
            />
            <Station
              label="IJs"
              field="ice"
              options={LEVELS}
              value={bar.drink.ice}
              onPick={(ice) => pick({ ice })}
              disabled={!open}
            />
          </div>
        </div>
        <AnimatePresence>
          {banner && (
            <motion.span
              key={banner.id}
              className="boba__banner"
              initial={reduce ? { opacity: 0 } : { y: -20, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              {banner.text}
            </motion.span>
          )}
        </AnimatePresence>
        {phase === 'ready' && (
          <div className="boba__start">
            <button
              type="button"
              className="neon-btn"
              onClick={() => {
                setPhase('open');
                playSfx('open', true);
                stage.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                setLine('De bar is open! Thee, topping, suiker, ijs — schud — en tik op de klant.');
              }}
            >
              Open de bar ▶
            </button>
          </div>
        )}
        <TicketStrip tickets={tickets} />
      </div>
      {phase === 'done' && (
        <RoundCard
          title={`Dienst voorbij · ${bar.served} drankjes`}
          score={bar.score}
          record={record}
          stars={stars}
          stats={[
            { label: 'Perfect geschud', value: bar.perfect },
            { label: 'Fooi', value: `${bar.tips} 🪙` },
            { label: 'Beste reeks', value: bar.bestCombo },
            { label: 'Weggelopen / fout', value: bar.missed },
            ...(bar.vipServed
              ? [{ label: `${vipName} 👑`, value: `${bar.vipServed}× blij ♡` }]
              : []),
          ]}
        />
      )}

      <p className="game-hint">
        Goed en snel geeft fooi (⚡ haast: dubbel), drie op rij extra, drie keer schudden is
        perfect. Komt {vipName} langs: jasmijn, tapioca, veel suiker, weinig ijs — dubbele punten.
        <span className="boba-keyhint">
          {' '}
          Op een computer: 1–5 thee · Q W E topping · A S suiker · Z X ijs · spatie schudt.
        </span>
      </p>
      {phase === 'done' &&
        (handOver ? (
          <button type="button" className="neon-btn" onClick={() => restart(true)}>
            Nu {nameOf(duel.player, profile)} ▶
          </button>
        ) : (
          <button type="button" className="neon-btn" onClick={() => restart()}>
            Nog een dienst 🧋
          </button>
        ))}
    </GameShell>
  );
}
