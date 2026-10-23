import { useId, useState } from 'react';
import { Save, Trash2 } from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import type { NailArt, NailSet, NailShape } from '../../data/types';
import { INK } from '../../components/art/shapes';
import { celebrateFrom, toast } from '../../components/ui/feedback';
import { createId, nowIso } from '../../lib/id';
import { playSfx } from '../../lib/audio/sfx';
import { updateHer } from './herData';

const SKIN = '#946040';
const SKIN_LIGHT = '#a8734e';

export const NAIL_COLORS: { color: string; name: string }[] = [
  { color: '#e8c4a8', name: 'Nude' },
  { color: '#f2b8c6', name: 'Baby pink' },
  { color: '#e0457b', name: 'Hot pink' },
  { color: '#c0182b', name: 'Rood' },
  { color: '#7a1022', name: 'Cherry' },
  { color: '#1b1a1d', name: 'Zwart' },
  { color: '#fbf8f4', name: 'Wit' },
  { color: '#c7a6e8', name: 'Lila' },
  { color: '#a9d2f2', name: 'Baby blue' },
  { color: '#a7c191', name: 'Matcha' },
  { color: '#c9ccd3', name: 'Chrome' },
  { color: '#d9b45b', name: 'Goud' },
  { color: '#6b3a26', name: 'Mocha' },
];

const SHAPES: { id: NailShape; label: string }[] = [
  { id: 'almond', label: 'Almond' },
  { id: 'square', label: 'Square' },
  { id: 'coffin', label: 'Coffin' },
  { id: 'stiletto', label: 'Stiletto' },
];

const ARTS: { id: NailArt; label: string }[] = [
  { id: 'none', label: 'Effen' },
  { id: 'french', label: 'French' },
  { id: 'heart', label: '♡ Hartje' },
  { id: 'glitter', label: '✦ Glitter' },
  { id: 'star', label: '★ Ster' },
  { id: 'flower', label: '✿ Bloem' },
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

function Art({ art, w, h, color }: { art: NailArt; w: number; h: number; color: string }) {
  const accent = dark(color) ? '#fbf8f4' : '#e0457b';
  switch (art) {
    case 'french':
      return <rect x={-w} y={-h * 1.5} width={w * 2} height={h * 0.62} fill="#fbf8f4" />;
    case 'heart':
      return (
        <path
          transform={`translate(0 ${-h * 0.55}) scale(${w / 26})`}
          d="M0 6C-9 0-11-6-7-9-4-11-1-10 0-7 1-10 4-11 7-9 11-6 9 0 0 6Z"
          fill={accent}
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
          ].map(([x, y], i) => (
            <circle key={i} cx={x * w} cy={-y * h} r={i % 2 ? 1.6 : 2.2} />
          ))}
        </g>
      );
    case 'star':
      return (
        <path
          transform={`translate(0 ${-h * 0.55}) scale(${w / 30})`}
          d="M0-9l2.6 5.6 6 .8-4.4 4.2 1.1 6L0 4.7-5.3 7.6l1.1-6-4.4-4.2 6-.8z"
          fill="#e8bd6a"
        />
      );
    case 'flower':
      return (
        <g transform={`translate(0 ${-h * 0.55}) scale(${w / 28})`}>
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
    default:
      return null;
  }
}

/** A hand with five painted nails. */
export function NailHand({
  set,
  selected,
  onPick,
  small = false,
}: {
  set: NailSet;
  selected?: number | 'all';
  onPick?: (finger: number) => void;
  small?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 250 290"
      className={small ? 'nail-hand nail-hand--small' : 'nail-hand'}
      aria-hidden={small}
    >
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
        const nailH = Math.min(36, f.len * 0.42);
        const isOn = selected === 'all' || selected === i;
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
              transform={`translate(0 ${-f.len + nailH + 4})`}
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
              </defs>
              {isOn && !small && (
                <path
                  d={nailPath(set.shape, nailW + 10, nailH + 8)}
                  transform="translate(0 4)"
                  fill="none"
                  stroke="#ffd75e"
                  strokeWidth="3"
                  strokeDasharray="4 3"
                />
              )}
              <path
                d={nailPath(set.shape, nailW, nailH)}
                fill={set.colors[i]}
                stroke={INK}
                strokeWidth="2.2"
              />
              <g clipPath={`url(#nail-${uid}-${i})`}>
                <Art art={set.art[i]} w={nailW} h={nailH} color={set.colors[i]} />
                <path
                  d={`M${-nailW * 0.22} ${-nailH * 0.2}Q${-nailW * 0.26} ${-nailH * 0.7} ${-nailW * 0.05} ${-nailH * 0.95}`}
                  stroke="#fff"
                  strokeOpacity="0.55"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
              </g>
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

/** Her nail studio: design a set nail by nail, and keep the ones she loves. */
export function NailStudio({ visitor }: { visitor: boolean }) {
  const nails = useContent((c) => c.her.nails);
  const set = nails.current;
  const [selected, setSelected] = useState<number | 'all'>('all');

  const change = (patch: (s: NailSet) => NailSet) => {
    const current = getContent().her.nails;
    updateHer({ nails: { ...current, current: patch(current.current) } });
  };

  const paint = (color: string) => {
    playSfx('write', true);
    change((s) => ({
      ...s,
      colors: s.colors.map((c, i) => (selected === 'all' || selected === i ? color : c)),
    }));
  };

  const decorate = (art: NailArt) => {
    playSfx('sparkle', true);
    change((s) => ({
      ...s,
      art: s.art.map((a, i) => (selected === 'all' || selected === i ? art : a)),
    }));
  };

  const save = (el: HTMLElement) => {
    const current = getContent().her.nails;
    const kept: NailSet = {
      ...current.current,
      id: createId('nails'),
      savedAt: nowIso(),
      colors: [...current.current.colors],
      art: [...current.current.art],
    };
    updateHer({ nails: { ...current, saved: [kept, ...current.saved].slice(0, 24) } });
    celebrateFrom(el);
    toast('Set bewaard. Iconic. 💅');
  };

  return (
    <section className="her-card nail-studio" aria-labelledby="nail-title">
      <p className="her-card__eyebrow">nail studio</p>
      <h2 id="nail-title" className="her-card__title">
        Jouw nail set 💅
      </h2>
      <div className="nail-studio__grid">
        <NailHand
          set={set}
          selected={visitor ? undefined : selected}
          onPick={visitor ? undefined : (i) => setSelected(i)}
        />
        {!visitor && (
          <div className="nail-studio__tools">
            <div className="chip-row">
              <button
                type="button"
                className="chip"
                aria-pressed={selected === 'all'}
                onClick={() => setSelected('all')}
              >
                Alle nagels
              </button>
              <span className="nail-studio__hint">
                {selected === 'all' ? 'of tik op één nagel' : `${FINGERS[selected]} ✎`}
              </span>
            </div>
            <div className="nail-swatches" role="group" aria-label="Kleur">
              {NAIL_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  className="nail-swatch"
                  style={{ background: c.color }}
                  aria-label={c.name}
                  title={c.name}
                  data-sfx="none"
                  onClick={() => paint(c.color)}
                />
              ))}
            </div>
            <div className="chip-row" role="group" aria-label="Versiering">
              {ARTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="chip"
                  data-sfx="none"
                  onClick={() => decorate(a.id)}
                >
                  {a.label}
                </button>
              ))}
            </div>
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
            <button
              type="button"
              className="btn btn--primary btn--small"
              onClick={(e) => save(e.currentTarget)}
            >
              <Save aria-hidden="true" /> Bewaar deze set
            </button>
          </div>
        )}
      </div>
      {nails.saved.length > 0 && (
        <>
          <h3 className="her-card__sub">Mijn sets</h3>
          <ul className="nail-saved">
            {nails.saved.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="nail-saved__open"
                  disabled={visitor}
                  aria-label="Deze set opnieuw dragen"
                  onClick={() =>
                    change(() => ({
                      ...s,
                      id: 'nails-current',
                      colors: [...s.colors],
                      art: [...s.art],
                    }))
                  }
                >
                  <NailHand set={s} small />
                </button>
                {!visitor && (
                  <button
                    type="button"
                    className="icon-btn nail-saved__remove"
                    aria-label="Set weghalen"
                    onClick={() => {
                      const current = getContent().her.nails;
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
