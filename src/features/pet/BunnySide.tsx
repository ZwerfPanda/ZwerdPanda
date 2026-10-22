import { useId } from 'react';
import type { PetFood, PetOutfit } from '../../data/types';
import { INK } from '../../components/art/shapes';
import { useBlink } from './Bunny';
import { FoodArt } from './Props';

/**
 * Coco from the side (facing right), for hopping, sniffing and eating.
 * Same colours as the front view: black coat, grey undertone, white paws.
 * Feet rest on y ≈ 80. Limbs, head and ears move by pose with short CSS
 * transitions, so a hop flows crouch → leap → land instead of snapping.
 */

export type SidePose = 'sit' | 'crouch' | 'leap' | 'land' | 'eat' | 'sniff' | 'loaf';

const FUR = '#26222b';
const FUR_MID = '#3b3642';
const GREY = '#5b5564';
const PAW = '#f7f3ee';
const EAR_INNER = '#b88a96';
const NOSE = '#dc8e9c';
const LINE = '#d9d1dd';
const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

type Move = { origin: string; transform: string };
const still: Move = { origin: '0px 0px', transform: 'none' };

/** How each part moves in each pose. */
const POSES: Record<
  SidePose,
  { body: Move; hind: Move; front: Move; head: Move; ears: Move; tail: Move }
> = {
  sit: {
    body: still,
    hind: still,
    front: still,
    head: still,
    ears: { origin: '34px -20px', transform: 'rotate(0deg)' },
    tail: still,
  },
  crouch: {
    body: { origin: '0px 78px', transform: 'scale(1.04, 0.92)' },
    hind: still,
    front: { origin: '24px 44px', transform: 'rotate(6deg)' },
    head: { origin: '28px 10px', transform: 'translate(2px, 6px) rotate(8deg)' },
    ears: { origin: '34px -20px', transform: 'rotate(-28deg)' },
    tail: still,
  },
  leap: {
    body: { origin: '0px 50px', transform: 'rotate(-12deg)' },
    hind: { origin: '-30px 56px', transform: 'translate(-16px, -2px) rotate(-38deg)' },
    front: { origin: '24px 44px', transform: 'rotate(-62deg)' },
    head: { origin: '28px 10px', transform: 'rotate(-4deg)' },
    ears: { origin: '34px -20px', transform: 'rotate(-42deg)' },
    tail: { origin: '-66px 34px', transform: 'translate(-2px, -4px)' },
  },
  land: {
    body: { origin: '20px 76px', transform: 'rotate(9deg)' },
    hind: { origin: '-30px 56px', transform: 'translate(-6px, -14px) rotate(-14deg)' },
    front: { origin: '24px 44px', transform: 'rotate(14deg)' },
    head: { origin: '28px 10px', transform: 'translate(2px, 4px) rotate(10deg)' },
    ears: { origin: '34px -20px', transform: 'rotate(-18deg)' },
    tail: still,
  },
  eat: {
    body: { origin: '0px 78px', transform: 'scale(1.02, 0.96)' },
    hind: still,
    front: { origin: '24px 44px', transform: 'rotate(10deg)' },
    head: { origin: '26px 12px', transform: 'translate(12px, 30px) rotate(26deg)' },
    ears: { origin: '34px -20px', transform: 'rotate(-14deg)' },
    tail: still,
  },
  sniff: {
    body: still,
    hind: still,
    front: still,
    head: { origin: '26px 12px', transform: 'translate(4px, 16px) rotate(16deg)' },
    ears: { origin: '34px -20px', transform: 'rotate(6deg)' },
    tail: still,
  },
  loaf: {
    body: { origin: '0px 78px', transform: 'scale(1.06, 0.86)' },
    hind: { origin: '-30px 70px', transform: 'translate(0px, 4px)' },
    front: { origin: '24px 44px', transform: 'translate(0px, 6px) scale(1, 0.7)' },
    head: { origin: '28px 10px', transform: 'translate(-2px, 14px)' },
    ears: { origin: '34px -20px', transform: 'rotate(-52deg)' },
    tail: still,
  },
};

const moved = (move: Move): React.CSSProperties => ({
  transformBox: 'view-box',
  transformOrigin: move.origin,
  transform: move.transform,
});

export function BunnySide({
  pose = 'sit',
  food,
  chewing = false,
  outfit = 'none',
  sniffing = false,
}: {
  pose?: SidePose;
  food?: { food: PetFood; bites: number } | null;
  chewing?: boolean;
  outfit?: PetOutfit;
  sniffing?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const blink = useBlink(true);
  const P = POSES[pose];
  const fur = `url(#side-fur-${uid})`;
  const airborne = pose === 'leap';

  return (
    <g
      className={`bunny-side bunny-side--${pose}${sniffing || pose === 'sniff' ? ' is-sniffing' : ''}${chewing ? ' is-chewing' : ''}`}
    >
      <defs>
        <radialGradient id={`side-fur-${uid}`} cx="45%" cy="25%" r="80%">
          <stop offset="0%" stopColor={FUR_MID} />
          <stop offset="70%" stopColor={FUR} />
          <stop offset="100%" stopColor="#1b181f" />
        </radialGradient>
      </defs>
      <g className="bunny-side__body" style={moved(P.body)}>
        {/* far legs, a little darker for depth */}
        <ellipse cx="24" cy="79" rx="9" ry="5" fill="#d9d1cb" {...S} strokeWidth={2.4} />
        {/* tail */}
        <g className="bunny-side__part" style={moved(P.tail)}>
          <circle cx="-66" cy="34" r="10" fill={fur} {...S} />
          <circle cx="-68" cy="38" r="4.5" fill={GREY} opacity="0.6" />
        </g>
        {/* body */}
        <path
          d="M-66 52C-70 14-44-14-14-14C10-14 26-4 32 14C38 34 34 62 22 74C4 82-40 82-56 74C-64 68-66 60-66 52Z"
          fill={fur}
          {...S}
        />
        <ellipse cx="-4" cy="58" rx="30" ry="15" fill={GREY} opacity="0.45" />
        <ellipse cx="22" cy="36" rx="10" ry="18" fill={GREY} opacity="0.35" />
        {/* hind leg: haunch + big white foot */}
        <g className="bunny-side__part" style={moved(P.hind)}>
          <path
            d="M-60 50C-62 28-40 22-24 30C-10 38-12 66-24 72C-40 78-58 70-60 50Z"
            fill={fur}
            {...S}
          />
          <path d="M-50 40q10 -8 22 -2" fill="none" stroke={GREY} strokeWidth="2.4" opacity="0.7" />
          <ellipse cx="-30" cy="78" rx="28" ry="6.5" fill={PAW} {...S} />
        </g>
        {/* front leg with white paw */}
        <g className="bunny-side__part" style={moved(P.front)}>
          <path d="M16 40q-4 22 6 38h12q2-20-6-40z" fill={fur} {...S} />
          <ellipse cx="32" cy="79" rx="10" ry="5.5" fill={PAW} {...S} />
          <path d="M30 77v3M35 77v3" stroke="#d6cdc7" strokeWidth="1.4" strokeLinecap="round" />
        </g>
        {/* head */}
        <g className="bunny-side__part" style={moved(P.head)}>
          <g className="bunny-side__part bunny-side__ears" style={moved(P.ears)}>
            <ellipse
              cx="26"
              cy="-40"
              rx="8"
              ry="20"
              fill="#1d1a21"
              {...S}
              transform="rotate(-24 26 -22)"
            />
            <ellipse
              cx="36"
              cy="-42"
              rx="9.5"
              ry="21"
              fill={fur}
              {...S}
              transform="rotate(-8 36 -22)"
            />
            <ellipse
              cx="37"
              cy="-41"
              rx="4.2"
              ry="13"
              fill={EAR_INNER}
              transform="rotate(-8 36 -22)"
            />
          </g>
          <ellipse cx="40" cy="-8" rx="25" ry="23" fill={fur} {...S} />
          <ellipse cx="58" cy="4" rx="14" ry="12" fill={fur} {...S} />
          <path d="M44 -14q14 -8 22 6" fill={fur} />
          <ellipse cx="48" cy="6" rx="11" ry="8" fill={GREY} opacity="0.5" />
          <ellipse cx="62" cy="9" rx="8" ry="6" fill={GREY} opacity="0.7" />
          {/* eye */}
          {blink ? (
            <path
              d="M42 -12q5 4 10 0"
              fill="none"
              stroke={LINE}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          ) : (
            <g>
              <ellipse cx="47" cy="-12" rx="7" ry="7.6" fill={GREY} />
              <ellipse cx="47.5" cy="-12" rx="5.4" ry="6" fill="#120e15" />
              <circle cx="49.5" cy="-14.5" r="1.9" fill="#fff" />
            </g>
          )}
          <circle cx="54" cy="8" r="4.5" fill="#c98591" opacity="0.35" />
          {/* nose, mouth, whiskers */}
          <ellipse
            className="bunny-side__nose"
            cx="71"
            cy="0"
            rx="3.4"
            ry="2.6"
            fill={NOSE}
            stroke={INK}
            strokeWidth="1.4"
          />
          <path
            className="bunny-side__mouth"
            d="M70 4q-1 5-6 6"
            fill="none"
            stroke={LINE}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M62 3l20-5M62 6l20 1M62 9l17 6"
            stroke={LINE}
            strokeWidth="1.1"
            strokeLinecap="round"
            opacity="0.55"
          />
          {food && (
            <g
              className={chewing ? 'bunny-side__food is-chewing' : 'bunny-side__food'}
              transform={
                food.food === 'hay'
                  ? 'translate(70 10) scale(0.8)'
                  : 'translate(76 14) scale(0.7) rotate(70)'
              }
            >
              <FoodArt food={food.food} bites={food.bites} />
            </g>
          )}
          {outfit === 'bow' && (
            <g transform="translate(30 -24) rotate(-30)">
              <path d="M0 0l-11 -7v14zM0 0l11 -7v14z" fill="#ef9fb3" {...S} strokeWidth={2.2} />
              <circle r="3.8" fill="#e27d97" {...S} strokeWidth={1.8} />
            </g>
          )}
          {outfit === 'flowers' &&
            [18, 30, 42].map((x, i) => (
              <g key={x} transform={`translate(${x} ${-28 + Math.abs(x - 30) * 0.2})`}>
                {[0, 72, 144, 216, 288].map((a) => (
                  <ellipse
                    key={a}
                    cy="-4"
                    rx="3"
                    ry="4"
                    transform={`rotate(${a})`}
                    fill={['#f6c8d4', '#fff1c6', '#d9c8f2'][i]}
                    stroke={INK}
                    strokeWidth="1.1"
                  />
                ))}
                <circle r="2.3" fill="#e8b74c" />
              </g>
            ))}
          {outfit === 'party' && (
            <g transform="translate(40 -32) rotate(18)">
              <path d="M-11 4l11 -30l11 30z" fill="#9fc3e8" {...S} strokeWidth={2.2} />
              <circle cy="-28" r="4.5" fill="#f6c454" {...S} strokeWidth={1.8} />
            </g>
          )}
        </g>
        {outfit === 'scarf' && (
          <path d="M16 6q14 6 22 18l-8 6q-8 -10 -20 -14z" fill="#7f9a6c" {...S} strokeWidth={2.4} />
        )}
      </g>
      {airborne && (
        <path
          d="M-96 40h-14M-94 54h-22M-92 68h-12"
          stroke={LINE}
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.6"
        />
      )}
    </g>
  );
}
