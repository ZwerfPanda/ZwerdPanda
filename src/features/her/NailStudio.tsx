import { useId, useRef, useState } from 'react';
import { Droplet, Eraser, Save, Shuffle, Trash2, Undo2 } from 'lucide-react';
import type { NailArt, NailFinish, NailLength, NailSet, NailShape } from '../../data/types';
import { INK } from '../../components/art/shapes';
import { celebrateFrom, toast } from '../../components/ui/feedback';
import { createId, nowIso } from '../../lib/id';
import { playSfx } from '../../lib/audio/sfx';
import { getHer, updateHer, useHer } from './herData';

const SKIN = '#946040';
const SKIN_LIGHT = '#a8734e';
/** A bare nail, after the remover. */
const BARE = '#e9c3b0';

export const NAIL_COLORS: { color: string; name: string }[] = [
  { color: '#e8c4a8', name: 'Nude' },
  { color: '#f2b8c6', name: 'Baby pink' },
  { color: '#f7d6e0', name: 'Milky pink' },
  { color: '#e0457b', name: 'Hot pink' },
  { color: '#c0182b', name: 'Rood' },
  { color: '#7a1022', name: 'Cherry' },
  { color: '#1b1a1d', name: 'Zwart' },
  { color: '#fbf8f4', name: 'Wit' },
  { color: '#c7a6e8', name: 'Lila' },
  { color: '#a9d2f2', name: 'Baby blue' },
  { color: '#1f3f8f', name: 'Navy' },
  { color: '#a7c191', name: 'Matcha' },
  { color: '#ffd8a8', name: 'Peach' },
  { color: '#c9ccd3', name: 'Zilver' },
  { color: '#d9b45b', name: 'Goud' },
  { color: '#6b3a26', name: 'Mocha' },
];

const SHAPES: { id: NailShape; label: string }[] = [
  { id: 'almond', label: 'Almond' },
  { id: 'square', label: 'Square' },
  { id: 'coffin', label: 'Coffin' },
  { id: 'stiletto', label: 'Stiletto' },
];

const LENGTHS: { id: NailLength; label: string; scale: number }[] = [
  { id: 'short', label: 'Kort', scale: 0.72 },
  { id: 'medium', label: 'Medium', scale: 1 },
  { id: 'long', label: 'Lang', scale: 1.38 },
];

const FINISHES: { id: NailFinish; label: string }[] = [
  { id: 'gloss', label: '✨ Glossy' },
  { id: 'matte', label: 'Matte' },
  { id: 'chrome', label: '🪩 Chrome' },
  { id: 'jelly', label: '🍬 Jelly' },
];

const ARTS: { id: NailArt; label: string }[] = [
  { id: 'none', label: 'Effen' },
  { id: 'french', label: 'French' },
  { id: 'ombre', label: 'Ombré' },
  { id: 'heart', label: '♡ Hartje' },
  { id: 'glitter', label: '✦ Glitter' },
  { id: 'dots', label: '• Stipjes' },
  { id: 'star', label: '★ Ster' },
  { id: 'flower', label: '✿ Bloem' },
  { id: 'cherry', label: '🍒 Kers' },
  { id: 'bow', label: '🎀 Strikje' },
  { id: 'gem', label: '💎 Steentje' },
  { id: 'leopard', label: '🐆 Luipaard' },
  { id: 'smiley', label: '☺ Smiley' },
  { id: 'swirl', label: '〰 Swirl' },
];

/** Art that is drawn in the second colour. */
const USES_ACCENT: NailArt[] = ['french', 'ombre', 'dots', 'swirl'];

const COMPLIMENTS = [
  'Iconic. 💅',
  'Deze is echt jij. ✨',
  'Salon-waardig, eerlijk.',
  'Coco is jaloers. 🐰',
  'Main character nails.',
  'Zo mooi dat het eng is.',
];

const FINGERS = ['Duim', 'Wijsvinger', 'Middelvinger', 'Ringvinger', 'Pink'];

/** Where each finger is, thumb to pinky: base position, width, length, angle. */
const HAND: { x: number; y: number; w: number; len: number; rot: number }[] = [
  { x: 204, y: 186, w: 34, len: 62, rot: 38 },
  { x: 160, y: 120, w: 30, len: 88, rot: 8 },
  { x: 120, y: 112, w: 31, len: 100, rot: 0 },
  { x: 81, y: 122, w: 29, len: 90, rot: -7 },
  { x: 46, y: 140, w: 25, len: 70, rot: -15 },
];

function nailPath(shape: NailShape, w: number, h: number): string {
  const r = w / 2;
  switch (shape) {
    case 'square':
      return `M${-r} 0V${-h + 5}Q${-r} ${-h} ${-r + 5} ${-h}H${r - 5}Q${r} ${-h} ${r} ${-h + 5}V0Q0 5 ${-r} 0Z`;
    case 'coffin':
      return `M${-r} 0L${-r * 0.62} ${-h * 1.12}H${r * 0.62}L${r} 0Q0 5 ${-r} 0Z`;
    case 'stiletto':
      return `M${-r} 0C${-r} ${-h * 0.55} ${-r * 0.2} ${-h * 0.95} 0 ${-h * 1.35}C${r * 0.2} ${-h * 0.95} ${r} ${-h * 0.55} ${r} 0Q0 5 ${-r} 0Z`;
    default:
      return `M${-r} 0C${-r} ${-h * 0.62} ${-r * 0.45} ${-h * 1.08} 0 ${-h * 1.12}C${r * 0.45} ${-h * 1.08} ${r} ${-h * 0.62} ${r} 0Q0 5 ${-r} 0Z`;
  }
}

const dark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110;
};

function Art({
  art,
  w,
  h,
  color,
  accent,
  gradient,
}: {
  art: NailArt;
  w: number;
  h: number;
  color: string;
  accent: string;
  gradient: string;
}) {
  const pop = dark(color) ? '#fbf8f4' : '#e0457b';
  const at = (y: number, size: number) => `translate(0 ${-h * y}) scale(${w / size})`;
  switch (art) {
    case 'french':
      return <rect x={-w} y={-h * 1.5} width={w * 2} height={h * 0.62} fill={accent} />;
    case 'ombre':
      return <rect x={-w} y={-h * 1.5} width={w * 2} height={h * 1.6} fill={`url(#${gradient})`} />;
    case 'heart':
      return (
        <path
          transform={at(0.55, 26)}
          d="M0 6C-9 0-11-6-7-9-4-11-1-10 0-7 1-10 4-11 7-9 11-6 9 0 0 6Z"
          fill={pop}
        />
      );
    case 'glitter':
      return (
        <g fill="#f6e3a1">
          {[
            [-0.25, 0.3],
            [0.2, 0.45],
            [-0.1, 0.7],
            [0.25, 0.8],
            [0, 0.5],
            [-0.28, 0.85],
            [0.1, 0.25],
            [-0.05, 0.95],
            [0.3, 0.15],
          ].map(([x, y], i) => (
            <circle key={i} cx={x * w} cy={-y * h} r={i % 2 ? 1.5 : 2.1} />
          ))}
        </g>
      );
    case 'dots':
      return (
        <g fill={accent}>
          {[
            [-0.22, 0.25],
            [0.22, 0.4],
            [-0.18, 0.62],
            [0.2, 0.8],
            [-0.05, 1.0],
          ].map(([x, y], i) => (
            <circle key={i} cx={x * w} cy={-y * h} r={w * 0.1} />
          ))}
        </g>
      );
    case 'star':
      return (
        <path
          transform={at(0.55, 30)}
          d="M0-9l2.6 5.6 6 .8-4.4 4.2 1.1 6L0 4.7-5.3 7.6l1.1-6-4.4-4.2 6-.8z"
          fill="#e8bd6a"
        />
      );
    case 'flower':
      return (
        <g transform={at(0.55, 28)}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-5"
              rx="3.4"
              ry="5"
              fill="#fbf8f4"
              transform={`rotate(${a})`}
            />
          ))}
          <circle r="3" fill="#ffd75e" />
        </g>
      );
    case 'cherry':
      return (
        <g transform={at(0.5, 28)}>
          <path d="M-4 2Q-2-8 3-11M4 3Q3-6 3-11" stroke="#3f7a3a" strokeWidth="1.6" fill="none" />
          <path d="M3-11q5-3 8 0-4 3-8 0z" fill="#6aa84f" />
          <circle cx="-4" cy="4" r="4.4" fill="#c0182b" />
          <circle cx="5" cy="5" r="4.4" fill="#d81e3a" />
          <circle cx="-5.4" cy="2.6" r="1.2" fill="#fff" opacity="0.7" />
        </g>
      );
    case 'bow':
      return (
        <g transform={at(0.42, 28)} fill="#f48fb1" stroke={INK} strokeWidth="0.8">
          <path d="M0 0L-9-6Q-11 0-9 6Z" />
          <path d="M0 0L9-6Q11 0 9 6Z" />
          <path d="M-1 1l-3 8M1 1l3 8" strokeWidth="1.6" stroke="#f48fb1" />
          <circle r="2.4" />
        </g>
      );
    case 'gem':
      return (
        <g transform={at(0.28, 26)}>
          <path d="M0-7L6-1 0 7-6-1Z" fill="#d8f1ff" stroke="#9fc7e0" strokeWidth="0.8" />
          <path d="M-6-1H6M0-7V7" stroke="#fff" strokeWidth="0.6" opacity="0.8" />
          <circle cx="-2" cy="-3" r="1.1" fill="#fff" />
        </g>
      );
    case 'leopard':
      return (
        <g fill="none" stroke="#2b1a10" strokeWidth={w * 0.07} strokeLinecap="round">
          {[
            [-0.2, 0.3],
            [0.22, 0.52],
            [-0.12, 0.8],
            [0.18, 1.02],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x * w} ${-y * h})`}>
              <circle r={w * 0.1} fill="#a86b2d" stroke="none" />
              <path d={`M${-w * 0.14} 0a${w * 0.14} ${w * 0.14} 0 0 1 ${w * 0.2} ${-w * 0.1}`} />
              <path d={`M${w * 0.14} 0a${w * 0.14} ${w * 0.14} 0 0 1 ${-w * 0.06} ${w * 0.13}`} />
            </g>
          ))}
        </g>
      );
    case 'smiley':
      return (
        <g transform={at(0.55, 26)}>
          <circle r="7" fill="#ffd75e" stroke={INK} strokeWidth="0.8" />
          <circle cx="-2.4" cy="-1.6" r="0.9" fill={INK} />
          <circle cx="2.4" cy="-1.6" r="0.9" fill={INK} />
          <path d="M-3.2 1.6Q0 4.8 3.2 1.6" stroke={INK} strokeWidth="0.9" fill="none" />
        </g>
      );
    case 'swirl':
      return (
        <path
          d={`M${-w * 0.5} ${-h * 0.2}C${-w * 0.1} ${-h * 0.35} ${w * 0.3} ${-h * 0.1} ${w * 0.5} ${-h * 0.45}M${-w * 0.5} ${-h * 0.7}C${-w * 0.1} ${-h * 0.85} ${w * 0.25} ${-h * 0.55} ${w * 0.5} ${-h * 0.95}`}
          stroke={accent}
          strokeWidth={w * 0.13}
          strokeLinecap="round"
          fill="none"
        />
      );
    default:
      return null;
  }
}

function Finish({
  finish,
  w,
  h,
  sheen,
}: {
  finish: NailFinish;
  w: number;
  h: number;
  sheen: string;
}) {
  const shine = (
    <path
      d={`M${-w * 0.22} ${-h * 0.2}Q${-w * 0.26} ${-h * 0.7} ${-w * 0.05} ${-h * 0.95}`}
      stroke="#fff"
      strokeOpacity={finish === 'jelly' ? 0.8 : 0.55}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
  );
  switch (finish) {
    case 'matte':
      return <rect x={-w} y={-h * 1.5} width={w * 2} height={h * 1.6} fill="#fff" opacity="0.08" />;
    case 'chrome':
      return (
        <>
          <rect x={-w} y={-h * 1.5} width={w * 2} height={h * 1.6} fill={`url(#${sheen})`} />
          {shine}
        </>
      );
    default:
      return shine;
  }
}

/** A hand with five painted nails. */
export function NailHand({
  set,
  selected,
  onPick,
  small = false,
  coats,
}: {
  set: NailSet;
  selected?: number | 'all';
  onPick?: (finger: number) => void;
  small?: boolean;
  /** Bumped per nail when it gets a new coat, to replay the brush stroke. */
  coats?: number[];
}) {
  const uid = useId().replace(/:/g, '');
  const scale = LENGTHS.find((l) => l.id === set.length)?.scale ?? 1;
  return (
    <svg
      viewBox="0 -24 250 314"
      className={small ? 'nail-hand nail-hand--small' : 'nail-hand'}
      aria-hidden={small}
    >
      <defs>
        <linearGradient id={`sheen-${uid}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0.15" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.62" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.85" stopColor="#7d8794" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {/* palm and wrist */}
      <path
        d="M40 150Q30 210 60 250L70 290H180L184 250Q214 224 224 196L196 168Q176 150 170 130H40Z"
        fill={SKIN}
        stroke={INK}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      {HAND.map((f, i) => {
        const nailW = f.w * 0.76;
        const baseH = Math.min(36, f.len * 0.42);
        const nailH = baseH * scale;
        const isOn = selected === 'all' || selected === i;
        const color = set.colors[i];
        const gradient = `ombre-${uid}-${i}`;
        return (
          <g key={i} transform={`translate(${f.x} ${f.y}) rotate(${f.rot})`}>
            <rect
              x={-f.w / 2}
              y={-f.len}
              width={f.w}
              height={f.len + 30}
              rx={f.w / 2}
              fill={SKIN}
              stroke={INK}
              strokeWidth="3"
            />
            <path
              d={`M${-f.w * 0.25} ${-f.len * 0.42}q${f.w * 0.25} 4 ${f.w * 0.5} 0`}
              stroke={SKIN_LIGHT}
              strokeWidth="2"
              fill="none"
            />
            {i === 3 && (
              // your Pandora ring
              <g>
                <rect
                  x={-f.w / 2 - 1}
                  y={-6}
                  width={f.w + 2}
                  height="8"
                  rx="4"
                  fill="#d6dbe1"
                  stroke={INK}
                  strokeWidth="1.6"
                />
                <circle cx="0" cy="-3" r="3.4" fill="#f2b8c6" stroke={INK} strokeWidth="1.2" />
              </g>
            )}
            <g
              transform={`translate(0 ${-f.len + baseH + 4})`}
              role={onPick ? 'button' : undefined}
              tabIndex={onPick ? 0 : undefined}
              aria-label={onPick ? `${FINGERS[i]}nagel` : undefined}
              aria-pressed={onPick ? isOn : undefined}
              className={onPick ? 'nail-hand__nail' : undefined}
              data-sfx="none"
              onClick={onPick ? () => onPick(i) : undefined}
              onKeyDown={
                onPick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPick(i);
                      }
                    }
                  : undefined
              }
            >
              <defs>
                <clipPath id={`nail-${uid}-${i}`}>
                  <path d={nailPath(set.shape, nailW, nailH)} />
                </clipPath>
                <linearGradient id={gradient} x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0.25" stopColor={color} />
                  <stop offset="0.85" stopColor={set.accent} />
                </linearGradient>
              </defs>
              {isOn && !small && (
                <path
                  d={nailPath(set.shape, nailW + 10, nailH + 8)}
                  transform="translate(0 4)"
                  fill="none"
                  stroke="#ffd75e"
                  strokeWidth="3"
                  strokeDasharray="4 3"
                  className="nail-hand__picked"
                />
              )}
              {/* the bare nail under the polish */}
              <path d={nailPath(set.shape, nailW, nailH)} fill={BARE} />
              <g key={coats?.[i] ?? 0} className={coats?.[i] ? 'nail-coat' : undefined}>
                <path
                  d={nailPath(set.shape, nailW, nailH)}
                  fill={color}
                  fillOpacity={set.finish === 'jelly' ? 0.68 : 1}
                />
                <g clipPath={`url(#nail-${uid}-${i})`}>
                  <Art
                    art={set.art[i]}
                    w={nailW}
                    h={nailH}
                    color={color}
                    accent={set.accent}
                    gradient={gradient}
                  />
                  <Finish finish={set.finish} w={nailW} h={nailH} sheen={`sheen-${uid}`} />
                </g>
              </g>
              <path
                d={nailPath(set.shape, nailW, nailH)}
                fill="none"
                stroke={INK}
                strokeWidth="2.2"
              />
              {/* a bigger, easier tap target */}
              {onPick && (
                <rect
                  x={-f.w / 2 - 4}
                  y={-nailH * 1.4}
                  width={f.w + 8}
                  height={nailH * 1.6}
                  fill="transparent"
                />
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

const pick = <T,>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

/** A set that would look good: one base, sometimes an accent nail. */
function randomSet(from: NailSet): NailSet {
  const base = pick(NAIL_COLORS).color;
  const accent = pick(NAIL_COLORS.filter((c) => c.color !== base)).color;
  const mainArt = pick<NailArt>(['none', 'none', 'french', 'ombre', 'glitter', 'dots', 'swirl']);
  const feature = pick<NailArt>(['heart', 'star', 'flower', 'cherry', 'bow', 'gem', 'smiley']);
  const accentNail = Math.random() < 0.7;
  return {
    ...from,
    shape: pick(SHAPES).id,
    length: pick(LENGTHS).id,
    finish: pick(FINISHES).id,
    accent,
    colors: from.colors.map((_, i) =>
      accentNail && i === 3 && mainArt === 'none' ? accent : base,
    ),
    art: from.art.map((_, i) => (accentNail && (i === 2 || i === 3) ? feature : mainArt)),
  };
}

type Tab = 'color' | 'art' | 'shape';

/** Her nail studio: design a set nail by nail, and keep the ones she loves. */
export function NailStudio({ visitor }: { visitor: boolean }) {
  const nails = useHer((h) => h.nails);
  const set = nails.current;
  const [selected, setSelected] = useState<number | 'all'>('all');
  const [tab, setTab] = useState<Tab>('color');
  const [history, setHistory] = useState<NailSet[]>([]);
  const [coats, setCoats] = useState<number[]>([0, 0, 0, 0, 0]);
  const [drying, setDrying] = useState(false);
  const lastRecord = useRef(0);
  const dryTimer = useRef<number | undefined>(undefined);

  const isPicked = (i: number) => selected === 'all' || selected === i;

  const change = (patch: (s: NailSet) => NailSet, coat = false) => {
    const current = getHer().nails;
    // Dragging the colour wheel is one change, not fifty.
    const now = Date.now();
    if (now - lastRecord.current > 700) {
      setHistory((h) => [current.current, ...h].slice(0, 30));
    }
    lastRecord.current = now;
    updateHer({ nails: { ...current, current: patch(current.current) } });
    if (coat) {
      setCoats((c) => c.map((n, i) => (isPicked(i) ? n + 1 : n)));
      setDrying(true);
      window.clearTimeout(dryTimer.current);
      dryTimer.current = window.setTimeout(() => setDrying(false), 1400);
    }
  };

  const paint = (color: string, quiet = false) => {
    if (!quiet) playSfx('polish', true);
    change((s) => ({ ...s, colors: s.colors.map((c, i) => (isPicked(i) ? color : c)) }), !quiet);
  };

  const decorate = (art: NailArt) => {
    playSfx('sparkle', true);
    change((s) => ({ ...s, art: s.art.map((a, i) => (isPicked(i) ? art : a)) }), true);
  };

  const undo = () => {
    const [previous, ...rest] = history;
    if (!previous) return;
    playSfx('whoosh', true);
    const current = getHer().nails;
    updateHer({ nails: { ...current, current: previous } });
    setHistory(rest);
  };

  const surprise = () => {
    playSfx('polish', true);
    setSelected('all');
    change((s) => randomSet(s));
    setCoats((c) => c.map((n) => n + 1));
  };

  const remove = () => {
    playSfx('paper', true);
    change(
      (s) => ({
        ...s,
        colors: s.colors.map((c, i) => (isPicked(i) ? BARE : c)),
        art: s.art.map((a, i) => (isPicked(i) ? 'none' : a)),
      }),
      true,
    );
  };

  const save = (el: HTMLElement) => {
    const current = getHer().nails;
    const kept: NailSet = {
      ...current.current,
      id: createId('nails'),
      savedAt: nowIso(),
      colors: [...current.current.colors],
      art: [...current.current.art],
    };
    updateHer({ nails: { ...current, saved: [kept, ...current.saved].slice(0, 24) } });
    celebrateFrom(el);
    toast(`Set bewaard. ${pick(COMPLIMENTS)}`);
  };

  const wear = (s: NailSet) => {
    playSfx('polish', true);
    change(() => ({ ...s, id: 'nails-current', colors: [...s.colors], art: [...s.art] }));
    setCoats((c) => c.map((n) => n + 1));
  };

  const hint =
    selected === 'all'
      ? 'alle nagels — of tik op één nagel'
      : `${FINGERS[selected]} ✎ — tik nog eens voor alle`;

  return (
    <section className="her-card nail-studio" aria-labelledby="nail-title">
      <p className="her-card__eyebrow">nail studio</p>
      <h2 id="nail-title" className="her-card__title">
        Jouw nail set 💅
      </h2>
      <div className="nail-studio__grid">
        <div className="nail-studio__stage">
          <NailHand
            set={set}
            coats={coats}
            selected={visitor ? undefined : selected}
            onPick={
              visitor
                ? undefined
                : (i) => {
                    playSfx('tap', true);
                    setSelected((s) => (s === i ? 'all' : i));
                  }
            }
          />
          {drying && (
            <span className="nail-studio__drying" aria-hidden="true">
              ✨ even laten drogen…
            </span>
          )}
        </div>
        {!visitor && (
          <div className="nail-studio__tools">
            <p className="nail-studio__hint" aria-live="polite">
              {hint}
            </p>
            <div className="nail-tabs" role="tablist" aria-label="Nail studio">
              {(
                [
                  ['color', 'Kleur'],
                  ['art', 'Nail art'],
                  ['shape', 'Vorm & finish'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className="nail-tab"
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'color' && (
              <div className="nail-panel" role="tabpanel">
                <div className="nail-swatches" role="group" aria-label="Kleur">
                  {NAIL_COLORS.map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      className="nail-bottle"
                      style={{ '--polish': c.color } as React.CSSProperties}
                      aria-label={c.name}
                      title={c.name}
                      data-sfx="none"
                      onClick={() => paint(c.color)}
                    />
                  ))}
                  <label className="nail-bottle nail-bottle--custom" title="Eigen kleur">
                    <span className="visually-hidden">Eigen kleur</span>
                    <input
                      type="color"
                      value={selected === 'all' ? set.colors[2] : set.colors[selected]}
                      onChange={(e) => paint(e.target.value, true)}
                      onBlur={() => playSfx('polish', true)}
                    />
                  </label>
                </div>
                <div className="nail-accent">
                  <span>Tweede kleur (french, ombré, stipjes, swirl)</span>
                  <div
                    className="nail-swatches nail-swatches--mini"
                    role="group"
                    aria-label="Tweede kleur"
                  >
                    {NAIL_COLORS.map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        className="nail-dot"
                        style={{ background: c.color }}
                        aria-label={`Tweede kleur: ${c.name}`}
                        aria-pressed={set.accent === c.color}
                        data-sfx="none"
                        onClick={() => {
                          playSfx('tap', true);
                          change((s) => ({ ...s, accent: c.color }), true);
                          if (!set.art.some((a) => USES_ACCENT.includes(a))) {
                            toast('Kies French, Ombré, Stipjes of Swirl om hem te zien ✨');
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'art' && (
              <div className="nail-panel" role="tabpanel">
                <div className="chip-row" role="group" aria-label="Versiering">
                  {ARTS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="chip"
                      data-sfx="none"
                      aria-pressed={selected !== 'all' && set.art[selected] === a.id}
                      onClick={() => decorate(a.id)}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === 'shape' && (
              <div className="nail-panel" role="tabpanel">
                <div className="chip-row" role="group" aria-label="Vorm">
                  {SHAPES.map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      className="chip"
                      aria-pressed={set.shape === sh.id}
                      onClick={() => change((s) => ({ ...s, shape: sh.id }))}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
                <div className="chip-row" role="group" aria-label="Lengte">
                  {LENGTHS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      className="chip"
                      aria-pressed={set.length === l.id}
                      onClick={() => change((s) => ({ ...s, length: l.id }))}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
                <div className="chip-row" role="group" aria-label="Finish">
                  {FINISHES.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className="chip"
                      data-sfx="sparkle"
                      aria-pressed={set.finish === f.id}
                      onClick={() => change((s) => ({ ...s, finish: f.id }), true)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="nail-actions">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={undo}
                disabled={!history.length}
                data-sfx="none"
              >
                <Undo2 aria-hidden="true" /> Terug
              </button>
              <button
                type="button"
                className="btn btn--soft btn--small"
                onClick={surprise}
                data-sfx="none"
              >
                <Shuffle aria-hidden="true" /> Verras me
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={remove}
                data-sfx="none"
              >
                <Eraser aria-hidden="true" /> Remover
              </button>
              <button
                type="button"
                className="btn btn--primary btn--small"
                onClick={(e) => save(e.currentTarget)}
              >
                <Save aria-hidden="true" /> Bewaar deze set
              </button>
            </div>
          </div>
        )}
      </div>
      {nails.saved.length > 0 && (
        <>
          <h3 className="her-card__sub">
            <Droplet aria-hidden="true" className="nail-studio__drop" /> Mijn sets
          </h3>
          <ul className="nail-saved">
            {nails.saved.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="nail-saved__open"
                  disabled={visitor}
                  aria-label="Deze set opnieuw dragen"
                  data-sfx="none"
                  onClick={() => wear(s)}
                >
                  <NailHand set={s} small />
                </button>
                {!visitor && (
                  <button
                    type="button"
                    className="icon-btn nail-saved__remove"
                    aria-label="Set weghalen"
                    onClick={() => {
                      const current = getHer().nails;
                      updateHer({
                        nails: { ...current, saved: current.saved.filter((x) => x.id !== s.id) },
                      });
                    }}
                  >
                    <Trash2 />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
