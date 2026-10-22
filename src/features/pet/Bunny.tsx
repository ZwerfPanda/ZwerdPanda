import { useEffect, useId, useState } from 'react';
import type { PetOutfit } from '../../data/types';
import { INK } from '../../components/art/shapes';

/**
 * Coco, drawn as she really is: a dwarf rabbit with a black coat, a soft grey
 * undertone and white paws, short dwarf ears and a round face.
 * Front view, centred on (0, 0), feet resting on y ≈ 80.
 */

export type BunnyPose = 'sit' | 'loaf' | 'stand' | 'flop' | 'eat' | 'groom' | 'thump';
export type BunnyFace = 'open' | 'happy' | 'closed';
export type BunnyHolding = 'hay' | 'leaf' | 'carrot' | 'berry' | null;

const FUR_DARK = '#25212a';
const FUR_MID = '#3a3541';
const FUR_GREY = '#5b5564';
const PAW = '#f7f3ee';
const PAW_SHADE = '#ddd5d0';
const EAR_INNER = '#b88a96';
const NOSE = '#dc8e9c';
const LIGHT_LINE = '#d9d1dd';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

interface Layout {
  body: { cy: number; rx: number; ry: number };
  headY: number;
  ears: 'up' | 'back';
  front: [number, number, number, number] | null;
  hind: [number, number] | null;
}

const LAYOUT: Record<BunnyPose, Layout> = {
  sit: {
    body: { cy: 40, rx: 50, ry: 40 },
    headY: -4,
    ears: 'up',
    front: [-14, 76, 14, 76],
    hind: [36, 74],
  },
  eat: {
    body: { cy: 42, rx: 50, ry: 38 },
    headY: 4,
    ears: 'up',
    front: [-14, 76, 14, 76],
    hind: [36, 74],
  },
  loaf: {
    body: { cy: 50, rx: 56, ry: 30 },
    headY: 6,
    ears: 'back',
    front: [-11, 78, 11, 78],
    hind: null,
  },
  stand: {
    body: { cy: 30, rx: 36, ry: 50 },
    headY: -40,
    ears: 'up',
    front: [-13, 24, 13, 24],
    hind: [20, 78],
  },
  groom: {
    body: { cy: 40, rx: 50, ry: 40 },
    headY: -2,
    ears: 'back',
    front: [-10, 10, 10, 10],
    hind: [36, 74],
  },
  thump: {
    body: { cy: 40, rx: 50, ry: 40 },
    headY: -4,
    ears: 'up',
    front: [-14, 76, 14, 76],
    hind: [36, 74],
  },
  flop: {
    body: { cy: 40, rx: 50, ry: 40 },
    headY: -4,
    ears: 'back',
    front: [-14, 76, 14, 76],
    hind: [36, 74],
  },
};

/** Blinks every few seconds on her own. */
function useBlink(enabled: boolean) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let timer: number;
    const loop = () => {
      timer = window.setTimeout(
        () => {
          setBlink(true);
          timer = window.setTimeout(() => {
            setBlink(false);
            loop();
          }, 140);
        },
        2600 + Math.random() * 3200,
      );
    };
    loop();
    return () => window.clearTimeout(timer);
  }, [enabled]);
  return blink;
}

export function Bunny({
  pose = 'sit',
  face = 'open',
  outfit = 'none',
  holding = null,
  chewing = false,
  title,
}: {
  pose?: BunnyPose;
  face?: BunnyFace;
  outfit?: PetOutfit;
  holding?: BunnyHolding;
  chewing?: boolean;
  /** Accessible name; omit when the drawing is decorative. */
  title?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const L = LAYOUT[pose];
  const asleep = pose === 'flop';
  const blink = useBlink(face === 'open' && !asleep);
  const eyes: BunnyFace = asleep ? 'closed' : blink ? 'closed' : face;
  const hy = L.headY;
  const fur = `url(#fur-${uid})`;

  const bunny = (
    <g className={`bunny bunny--${pose}${chewing ? ' is-chewing' : ''}`}>
      {/* hind feet */}
      {L.hind && (
        <g className="bunny__hind">
          <ellipse cx={-L.hind[0]} cy={L.hind[1]} rx="17" ry="8" fill={PAW} {...S} />
          <ellipse
            className={pose === 'thump' ? 'bunny__thump' : undefined}
            cx={L.hind[0]}
            cy={L.hind[1]}
            rx="17"
            ry="8"
            fill={PAW}
            {...S}
          />
        </g>
      )}
      {/* body with its grey undertone */}
      <ellipse cx="0" cy={L.body.cy} rx={L.body.rx} ry={L.body.ry} fill={fur} {...S} />
      <ellipse
        cx="0"
        cy={L.body.cy + 6}
        rx={L.body.rx * 0.55}
        ry={L.body.ry * 0.62}
        fill={FUR_GREY}
        opacity="0.55"
      />
      {/* scarf sits between body and head */}
      {outfit === 'scarf' && (
        <g>
          <path
            d={`M-30 ${hy + 26}q30 16 60 0l2 10q-32 16 -64 0z`}
            fill="#7f9a6c"
            {...S}
            strokeWidth={2.5}
          />
          <path d={`M14 ${hy + 36}l6 22l10 -4l-6 -20z`} fill="#6c8a5b" {...S} strokeWidth={2.5} />
        </g>
      )}
      {/* ears: short and rounded, like a dwarf rabbit's */}
      <g className="bunny__ears">
        <g
          className="bunny__ear bunny__ear--left"
          transform={L.ears === 'up' ? `rotate(-14 -16 ${hy - 28})` : `rotate(-62 -16 ${hy - 26})`}
        >
          <ellipse cx="-16" cy={hy - 43} rx="11" ry="20" fill={fur} {...S} />
          <ellipse cx="-16" cy={hy - 42} rx="4.5" ry="12" fill={EAR_INNER} />
        </g>
        <g
          className="bunny__ear bunny__ear--right"
          transform={L.ears === 'up' ? `rotate(14 16 ${hy - 28})` : `rotate(62 16 ${hy - 26})`}
        >
          <ellipse cx="16" cy={hy - 43} rx="11" ry="20" fill={fur} {...S} />
          <ellipse cx="16" cy={hy - 42} rx="4.5" ry="12" fill={EAR_INNER} />
        </g>
      </g>
      {/* head */}
      <g className="bunny__head">
        <ellipse cx="0" cy={hy} rx="37" ry="32" fill={fur} {...S} />
        <ellipse cx="-19" cy={hy + 10} rx="11" ry="8" fill={FUR_GREY} opacity="0.5" />
        <ellipse cx="19" cy={hy + 10} rx="11" ry="8" fill={FUR_GREY} opacity="0.5" />
        <ellipse cx="0" cy={hy + 13} rx="13" ry="9" fill={FUR_GREY} />
        <circle cx="-25" cy={hy + 12} r="5.5" fill="#c98591" opacity="0.35" />
        <circle cx="25" cy={hy + 12} r="5.5" fill="#c98591" opacity="0.35" />
        {/* eyes */}
        {eyes === 'open' ? (
          <g>
            <circle cx="-14" cy={hy - 4} r="7.5" fill={FUR_GREY} />
            <circle cx="14" cy={hy - 4} r="7.5" fill={FUR_GREY} />
            <circle cx="-14" cy={hy - 4} r="5.8" fill="#120e15" />
            <circle cx="14" cy={hy - 4} r="5.8" fill="#120e15" />
            <circle cx="-12" cy={hy - 6.5} r="2" fill="#fff" />
            <circle cx="16" cy={hy - 6.5} r="2" fill="#fff" />
          </g>
        ) : eyes === 'happy' ? (
          <path
            d={`M-20 ${hy - 2}q6 -8 12 0M8 ${hy - 2}q6 -8 12 0`}
            fill="none"
            stroke={LIGHT_LINE}
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : (
          <path
            d={`M-20 ${hy - 4}q6 5 12 0M8 ${hy - 4}q6 5 12 0`}
            fill="none"
            stroke={LIGHT_LINE}
            strokeWidth="3"
            strokeLinecap="round"
          />
        )}
        {/* nose & mouth */}
        <g className="bunny__nose">
          <path
            d={`M-4.5 ${hy + 8}h9l-4.5 5z`}
            fill={NOSE}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
        <path
          className="bunny__mouth"
          d={`M0 ${hy + 13}v3M0 ${hy + 16}q-4 4 -7 1M0 ${hy + 16}q4 4 7 1`}
          fill="none"
          stroke={LIGHT_LINE}
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* whiskers */}
        <path
          d={`M-12 ${hy + 12}l-20 -3M-12 ${hy + 15}l-19 3M12 ${hy + 12}l20 -3M12 ${hy + 15}l19 3`}
          stroke={LIGHT_LINE}
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.55"
        />
        {holding && (
          <g className="bunny__holding" transform={`translate(0 ${hy + 20})`}>
            {holding === 'hay' && (
              <path
                d="M-16 0l30 -4M-12 3l26 2M-14 -3l24 7"
                stroke="#d8b65c"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            )}
            {holding === 'leaf' && (
              <path d="M-2 -2q16 -10 24 4q-14 10 -24 -4z" fill="#86b06a" {...S} strokeWidth={2} />
            )}
            {holding === 'carrot' && (
              <circle cx="4" cy="2" r="7" fill="#f09a4a" {...S} strokeWidth={2} />
            )}
            {holding === 'berry' && (
              <path d="M-2 -4h14l-7 13z" fill="#e0525f" {...S} strokeWidth={2} />
            )}
          </g>
        )}
        {/* head-top outfits */}
        {outfit === 'bow' && (
          <g transform={`translate(-26 ${hy - 26}) rotate(-18)`}>
            <path d="M0 0l-14 -9v18zM0 0l14 -9v18z" fill="#ef9fb3" {...S} strokeWidth={2.5} />
            <circle r="4.5" fill="#e27d97" {...S} strokeWidth={2} />
          </g>
        )}
        {outfit === 'flowers' && (
          <g>
            {[-24, -8, 8, 24].map((x, i) => (
              <g key={x} transform={`translate(${x} ${hy - 29 + Math.abs(x) * 0.18})`}>
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse
                    key={a}
                    cx="0"
                    cy="-4.5"
                    rx="3.4"
                    ry="4.6"
                    transform={`rotate(${a})`}
                    fill={['#f6c8d4', '#fff1c6', '#d9c8f2', '#f6c8d4'][i]}
                    stroke={INK}
                    strokeWidth="1.2"
                  />
                ))}
                <circle r="2.6" fill="#e8b74c" />
              </g>
            ))}
          </g>
        )}
        {outfit === 'party' && (
          <g transform={`translate(6 ${hy - 34}) rotate(10)`}>
            <path d="M-13 4l13 -36l13 36z" fill="#9fc3e8" {...S} strokeWidth={2.5} />
            <path d="M-8 -9l16 4M-4 -20l8 2" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            <circle cy="-34" r="5" fill="#f6c454" {...S} strokeWidth={2} />
          </g>
        )}
      </g>
      {/* front paws: white */}
      {L.front && (
        <g className="bunny__front">
          <ellipse cx={L.front[0]} cy={L.front[1]} rx="9.5" ry="7" fill={PAW} {...S} />
          <ellipse cx={L.front[2]} cy={L.front[3]} rx="9.5" ry="7" fill={PAW} {...S} />
          <path
            d={`M${L.front[0] - 3} ${L.front[1] + 2}v3M${L.front[0] + 3} ${L.front[1] + 2}v3M${L.front[2] - 3} ${L.front[3] + 2}v3M${L.front[2] + 3} ${L.front[3] + 2}v3`}
            stroke={PAW_SHADE}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );

  return (
    <g role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <radialGradient id={`fur-${uid}`} cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor={FUR_MID} />
          <stop offset="70%" stopColor={FUR_DARK} />
          <stop offset="100%" stopColor="#1c1920" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="84" rx={asleep ? 70 : 54} ry="8" fill="#000" opacity="0.14" />
      {asleep ? <Flop fur={fur} outfit={outfit} /> : bunny}
    </g>
  );
}

/**
 * The "flop": lying on her side, fully relaxed — what rabbits do when they
 * feel completely safe.
 */
function Flop({ fur, outfit }: { fur: string; outfit: PetOutfit }) {
  return (
    <g className="bunny bunny--flop">
      {/* back feet stretched out */}
      <ellipse cx="58" cy="72" rx="20" ry="7" fill={PAW} {...S} transform="rotate(-8 58 72)" />
      <ellipse cx="0" cy="58" rx="62" ry="27" fill={fur} {...S} />
      <ellipse cx="6" cy="66" rx="40" ry="12" fill={FUR_GREY} opacity="0.5" />
      {/* front paws */}
      <ellipse cx="-50" cy="80" rx="11" ry="6" fill={PAW} {...S} />
      <ellipse cx="-34" cy="81" rx="11" ry="6" fill={PAW} {...S} />
      {/* ears lying back over her shoulders */}
      <ellipse cx="-24" cy="34" rx="22" ry="10" fill={fur} {...S} transform="rotate(-12 -24 34)" />
      <ellipse cx="-22" cy="34" rx="14" ry="4.5" fill={EAR_INNER} transform="rotate(-12 -22 34)" />
      {/* head resting on the floor */}
      <ellipse cx="-50" cy="56" rx="30" ry="26" fill={fur} {...S} />
      <ellipse cx="-62" cy="66" rx="10" ry="7" fill={FUR_GREY} />
      <path
        d="M-62 50q6 5 12 0"
        fill="none"
        stroke={LIGHT_LINE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M-74 62h8l-4 4z" fill={NOSE} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="-42" cy="64" r="5" fill="#c98591" opacity="0.35" />
      {outfit === 'bow' && (
        <g transform="translate(-36 36) rotate(20)">
          <path d="M0 0l-12 -8v16zM0 0l12 -8v16z" fill="#ef9fb3" {...S} strokeWidth={2.5} />
          <circle r="4" fill="#e27d97" {...S} strokeWidth={2} />
        </g>
      )}
    </g>
  );
}

/** Standalone Coco in her own little SVG. */
export function BunnySvg({
  className,
  title,
  ...props
}: React.ComponentProps<typeof Bunny> & { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="-95 -120 190 215"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <Bunny {...props} />
    </svg>
  );
}
