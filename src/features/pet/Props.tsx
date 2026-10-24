import { useId } from 'react';
import type { PetFood } from '../../data/types';
import { INK } from '../../components/art/shapes';

/**
 * Coco's things, drawn properly: real-looking food, her willow ball and her
 * hutch. Food is drawn around (0, 0) in a ~70-unit box; `bites` (0–3) takes
 * nibbles out of it.
 */

const S = {
  stroke: INK,
  strokeWidth: 2.4,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

function Bites({ id, bites, spots }: { id: string; bites: number; spots: [number, number][] }) {
  return (
    <mask id={id}>
      <rect x="-60" y="-60" width="120" height="120" fill="#fff" />
      {spots.slice(0, bites).map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="9" fill="#000" />
          <circle cx={x + 6} cy={y + 5} r="6" fill="#000" />
          <circle cx={x - 5} cy={y + 6} r="5" fill="#000" />
        </g>
      ))}
    </mask>
  );
}

export function FoodArt({ food, bites = 0 }: { food: PetFood; bites?: number }) {
  const uid = useId().replace(/:/g, '');
  const maskId = `bite-${uid}`;
  const grad = (name: string) => `${name}-${uid}`;
  const masked = bites > 0 ? `url(#${maskId})` : undefined;

  switch (food) {
    case 'carrot':
      return (
        <g>
          <defs>
            <linearGradient id={grad('carrot')} x1="0" x2="1">
              <stop offset="0%" stopColor="#f6a24a" />
              <stop offset="55%" stopColor="#f08a2e" />
              <stop offset="100%" stopColor="#d96e1c" />
            </linearGradient>
            <Bites
              id={maskId}
              bites={bites}
              spots={[
                [0, 34],
                [-2, 20],
                [2, 6],
              ]}
            />
          </defs>
          <g mask={masked}>
            <path d="M-9 -16q9 -6 18 0l-6 52q-3 7 -6 0z" fill={`url(#${grad('carrot')})`} {...S} />
            <path
              d="M-6 -6l5 1M2 4l5 -1M-5 14l4 1M1 24l4 -1"
              stroke="#c25f17"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
          <path d="M-2 -17q-12 -14 -10 -26q8 6 9 20z" fill="#7cb565" {...S} strokeWidth={2} />
          <path d="M1 -18q2 -18 9 -24q4 12 -5 24z" fill="#8fc474" {...S} strokeWidth={2} />
          <path d="M-1 -18q-2 -14 1 -22q5 10 2 22z" fill="#6aa457" {...S} strokeWidth={2} />
        </g>
      );
    case 'apple':
      return (
        <g>
          <defs>
            <Bites
              id={maskId}
              bites={bites}
              spots={[
                [22, -4],
                [12, 4],
                [2, 10],
              ]}
            />
          </defs>
          <g mask={masked}>
            <path d="M-24 6a26 26 0 0 0 48 0z" fill="#d64545" {...S} />
            <path d="M-20 6a22 22 0 0 0 40 0z" fill="#fff4dc" />
            <path d="M-20 6a22 22 0 0 0 40 0" fill="none" stroke="#f3dfae" strokeWidth="2" />
            <path d="M-6 12q6 6 12 0" fill="none" stroke="#e7c98c" strokeWidth="1.6" />
            <path d="M-24 6h48" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
          </g>
        </g>
      );
    case 'banana':
      return (
        <g>
          <defs>
            <Bites
              id={maskId}
              bites={bites}
              spots={[
                [16, -10],
                [16, 6],
                [4, 16],
              ]}
            />
          </defs>
          <g mask={masked}>
            <ellipse cx="0" cy="0" rx="20" ry="18" fill="#f8eec4" {...S} />
            <ellipse cx="0" cy="0" rx="15" ry="13.5" fill="#fbf4d6" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <path
                key={a}
                d="M0 0l0 -6"
                transform={`rotate(${a})`}
                stroke="#c9b26f"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ))}
            <circle r="2" fill="#a8925a" />
          </g>
        </g>
      );
    case 'strawberry':
      return (
        <g>
          <defs>
            <radialGradient id={grad('berry')} cx="40%" cy="35%" r="70%">
              <stop offset="0%" stopColor="#ff7d86" />
              <stop offset="100%" stopColor="#d6303f" />
            </radialGradient>
            <Bites
              id={maskId}
              bites={bites}
              spots={[
                [0, 24],
                [8, 14],
                [-8, 12],
              ]}
            />
          </defs>
          <g mask={masked}>
            <path
              d="M-18 -8q18 -10 36 0q2 22 -18 34q-20 -12 -18 -34z"
              fill={`url(#${grad('berry')})`}
              {...S}
            />
            {[
              [-9, 0],
              [0, -2],
              [9, 0],
              [-5, 9],
              [5, 9],
              [0, 17],
              [-12, -3],
              [12, -3],
            ].map(([x, y]) => (
              <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.2" ry="1.8" fill="#ffe08a" />
            ))}
          </g>
          <path
            d="M-14 -9l6 -8l4 6l4 -9l4 9l4 -6l6 8q-14 6 -28 0z"
            fill="#6aa457"
            {...S}
            strokeWidth={2}
          />
        </g>
      );
    case 'romaine':
      return (
        <g>
          <defs>
            <linearGradient id={grad('leaf')} x1="0" x2="1">
              <stop offset="0%" stopColor="#5d9d4d" />
              <stop offset="100%" stopColor="#9fd27e" />
            </linearGradient>
            <Bites
              id={maskId}
              bites={bites}
              spots={[
                [0, -28],
                [8, -14],
                [-8, -2],
              ]}
            />
          </defs>
          <g mask={masked}>
            <path
              d="M0 34q-22 -14 -18 -40q2 -22 18 -30q16 8 18 30q4 26 -18 40z"
              fill={`url(#${grad('leaf')})`}
              {...S}
            />
            <path d="M0 34v-62" stroke="#e7f3cf" strokeWidth="3.4" strokeLinecap="round" />
            <path
              d="M0 10l-10 -8M0 -4l-9 -9M0 18l9 -8M0 2l10 -9M0 -14l7 -7"
              stroke="#d8edb8"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
        </g>
      );
    case 'parsley':
    case 'coriander':
    case 'basil': {
      const basil = food === 'basil';
      const leaf = food === 'parsley' ? '#3f8a3a' : food === 'coriander' ? '#5ea24c' : '#4f9a43';
      return (
        <g>
          <defs>
            <Bites
              id={maskId}
              bites={bites}
              spots={[
                [0, -22],
                [-12, -10],
                [12, -8],
              ]}
            />
          </defs>
          <g mask={masked}>
            <path
              d="M0 30q-2 -18 0 -30M0 6q-8 -8 -14 -14M0 0q8 -8 13 -16"
              fill="none"
              stroke="#6c9b4c"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            {basil ? (
              <>
                <path d="M0 -2q-20 -6 -18 -24q16 -2 18 24z" fill={leaf} {...S} strokeWidth={2} />
                <path d="M0 -2q20 -6 18 -24q-16 -2 -18 24z" fill="#62ad54" {...S} strokeWidth={2} />
                <path d="M0 -6q-4 -14 -2 -24q8 6 2 24z" fill="#71b960" {...S} strokeWidth={2} />
              </>
            ) : (
              [
                [-14, -10],
                [-8, -18],
                [0, -24],
                [8, -18],
                [14, -12],
                [-4, -12],
                [5, -10],
              ].map(([x, y], i) => (
                <g key={i} transform={`translate(${x} ${y})`}>
                  {[0, 120, 240].map((a) => (
                    <circle
                      key={a}
                      cx={Math.cos((a * Math.PI) / 180) * 3.6}
                      cy={Math.sin((a * Math.PI) / 180) * 3.6}
                      r={food === 'parsley' ? 4 : 4.8}
                      fill={leaf}
                      stroke={INK}
                      strokeWidth="1.2"
                    />
                  ))}
                </g>
              ))
            )}
          </g>
        </g>
      );
    }
    case 'pellets':
      return (
        <g>
          {[
            [-12, 6, 20],
            [-4, 2, -30],
            [5, 7, 60],
            [12, 2, -10],
            [-8, -4, 80],
            [2, -6, 15],
            [10, -6, -55],
            [-1, 10, 35],
          ]
            .slice(0, 8 - bites * 2)
            .map(([x, y, r], i) => (
              <rect
                key={i}
                x={x - 4}
                y={y - 2.4}
                width="8"
                height="4.8"
                rx="2.4"
                transform={`rotate(${r} ${x} ${y})`}
                fill="#a8875a"
                stroke="#6e5434"
                strokeWidth="1.2"
              />
            ))}
        </g>
      );
    case 'hay':
      return (
        <g>
          {Array.from({ length: Math.max(3, 12 - bites * 3) }, (_, i) => {
            const a = -30 + ((i * 37) % 60);
            const len = 26 + ((i * 13) % 14);
            return (
              <path
                key={i}
                d={`M0 0l${Math.cos((a * Math.PI) / 180) * len} ${Math.sin((a * Math.PI) / 180) * len * 0.5}`}
                transform={`translate(${-14 + ((i * 7) % 12)} ${-6 + ((i * 5) % 12)})`}
                stroke={i % 3 ? '#e2c66f' : '#c9a94e'}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      );
  }
}

export function FoodSvg({
  food,
  bites = 0,
  className,
}: {
  food: PetFood;
  bites?: number;
  className?: string;
}) {
  return (
    <svg className={className} viewBox="-34 -46 68 84" aria-hidden="true">
      <FoodArt food={food} bites={bites} />
    </svg>
  );
}

/** A woven willow ball — the classic rabbit toy — with a little bell inside. */
export function WillowBall({ size = 1 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  return (
    <g transform={`scale(${size})`}>
      <defs>
        <radialGradient id={`willow-${uid}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f0d49b" />
          <stop offset="100%" stopColor="#b98a4a" />
        </radialGradient>
        <clipPath id={`ball-${uid}`}>
          <circle r="20" />
        </clipPath>
      </defs>
      <circle r="20" fill="#7a5530" />
      <g clipPath={`url(#ball-${uid})`}>
        <circle r="6" cx="2" cy="3" fill="#f2c94c" stroke="#a07b1c" strokeWidth="1.4" />
        {[-14, -5, 4, 13].map((o) => (
          <path
            key={`a${o}`}
            d={`M${o - 24} -24q${24} ${18} 48 48`}
            fill="none"
            stroke={`url(#willow-${uid})`}
            strokeWidth="4.6"
            strokeLinecap="round"
          />
        ))}
        {[-14, -5, 4, 13].map((o) => (
          <path
            key={`b${o}`}
            d={`M${o + 24} -24q${-24} ${18} -48 48`}
            fill="none"
            stroke={`url(#willow-${uid})`}
            strokeWidth="4.6"
            strokeLinecap="round"
          />
        ))}
        <path d="M-22 0q22 -10 44 0" fill="none" stroke="#e4c07e" strokeWidth="4" />
      </g>
      <circle r="20" fill="none" stroke={INK} strokeWidth="2.6" />
      <ellipse
        cx="-7"
        cy="-9"
        rx="5"
        ry="3"
        fill="#fff"
        opacity="0.35"
        transform="rotate(-30 -7 -9)"
      />
    </g>
  );
}

/** Coco's wooden hutch. `open` swings the door; `peek` shows her ears/face in the doorway. */
export function HutchArt({ open = false, peek = 0 }: { open?: boolean; peek?: number }) {
  return (
    <g>
      <ellipse cx="0" cy="44" rx="46" ry="6" fill="#000" opacity="0.15" />
      <path d="M-38 -4h76v46h-76z" fill="#d6a46a" {...S} />
      {[-26, -12, 2, 16, 30].map((x) => (
        <path key={x} d={`M${x} -2v42`} stroke="#c08f58" strokeWidth="2" />
      ))}
      <path d="M-46 -2l46 -34l46 34z" fill="#c45f6e" {...S} />
      <path d="M-36 -8l36 -26l36 26" fill="none" stroke="#e08a97" strokeWidth="2.4" />
      <rect x="-14" y="-24" width="28" height="11" rx="3" fill="#fff8ee" {...S} strokeWidth={1.8} />
      <text
        x="0"
        y="-15.5"
        textAnchor="middle"
        fontSize="8"
        fontWeight="700"
        fill={INK}
        fontFamily="system-ui, sans-serif"
        letterSpacing="1"
      >
        COCO
      </text>
      {/* doorway */}
      <path d="M-14 42v-22a14 14 0 0 1 28 0v22z" fill="#3c2a1f" {...S} />
      {peek > 0 && (
        <g transform={`translate(0 ${42 - peek * 22})`}>
          <ellipse cx="-6" cy="-10" rx="4.5" ry="11" fill="#2b2730" transform="rotate(-12 -6 -2)" />
          <ellipse cx="6" cy="-10" rx="4.5" ry="11" fill="#2b2730" transform="rotate(12 6 -2)" />
          <ellipse cx="-6" cy="-9" rx="2" ry="6" fill="#b88a96" transform="rotate(-12 -6 -2)" />
          <ellipse cx="6" cy="-9" rx="2" ry="6" fill="#b88a96" transform="rotate(12 6 -2)" />
          {peek > 0.6 && (
            <g>
              <ellipse cx="0" cy="6" rx="13" ry="11" fill="#2b2730" />
              <circle cx="-5" cy="4" r="2.6" fill="#120e15" />
              <circle cx="5" cy="4" r="2.6" fill="#120e15" />
              <circle cx="-4.2" cy="3.2" r="0.9" fill="#fff" />
              <circle cx="5.8" cy="3.2" r="0.9" fill="#fff" />
              <path d="M-1.6 9h3.2l-1.6 2z" fill="#dc8e9c" />
            </g>
          )}
        </g>
      )}
      <rect x="-14" y="20" width="28" height="22" fill="none" />
      {/* door */}
      <g
        style={{
          transformBox: 'view-box',
          transformOrigin: '14px 30px',
          transform: open ? 'scaleX(-0.15)' : 'scaleX(1)',
          transition: 'transform 0.35s ease',
        }}
      >
        <path d="M-14 42v-22a14 14 0 0 1 28 0v22z" fill="#b98352" {...S} />
        <path d="M-8 24h16M-8 32h16" stroke="#9c6b40" strokeWidth="2" />
        <circle cx="8" cy="33" r="1.8" fill="#f2c94c" />
      </g>
      {/* little heart on the wall */}
      <path
        d="M26 14l-5 -5a3 3 0 0 1 5 -3a3 3 0 0 1 5 3z"
        fill="#ef9fb3"
        stroke={INK}
        strokeWidth="1.4"
      />
    </g>
  );
}

/** A soft brush that follows your finger while grooming. */
export function BrushArt() {
  return (
    <g transform="rotate(-30)">
      <rect x="-6" y="0" width="12" height="34" rx="6" fill="#c9895a" {...S} />
      <rect x="-14" y="-16" width="28" height="18" rx="6" fill="#f4e3cf" {...S} />
      {[-10, -5, 0, 5, 10].map((x) => (
        <path key={x} d={`M${x} -16v-7`} stroke="#8a7a6c" strokeWidth="2" strokeLinecap="round" />
      ))}
    </g>
  );
}

const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = (Math.PI / 5) * i - Math.PI / 2;
  const r = i % 2 ? 2 : 4.6;
  return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
}).join('');

/** Halloween: a little witch hat with a bent tip. Brim centred on (0, 4). */
export function WitchHat() {
  return (
    <g>
      <ellipse cy="4" rx="25" ry="5.5" fill="#3a2c54" stroke={INK} strokeWidth="2.5" />
      <path
        d="M-15 3C-11 -10 -7 -24 1 -34C5 -39 12 -38 15 -33C9 -32 6 -26 7 -18C8 -9 11 -3 15 3z"
        fill="#4b3a6b"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M-13.5 -3q13.5 4 27 0" fill="none" stroke="#f29b38" strokeWidth="4" />
      <path d={`${STAR}Z`} transform="translate(0 -15)" fill="#ffd34d" />
    </g>
  );
}

/** Christmas: a red hat with a white trim, its tip flopping over. Trim centred on (0, 2). */
export function SantaHat() {
  return (
    <g>
      <path
        d="M-19 2C-15 -20 2 -36 22 -30C26 -28 26 -22 22 -20C14 -22 10 -12 17 2z"
        fill="#d93b3b"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect
        x="-22"
        y="-3"
        width="44"
        height="10"
        rx="5"
        fill="#fbf8f4"
        stroke={INK}
        strokeWidth="2.5"
      />
      <circle cx="24" cy="-24" r="6" fill="#fbf8f4" stroke={INK} strokeWidth="2" />
    </g>
  );
}
