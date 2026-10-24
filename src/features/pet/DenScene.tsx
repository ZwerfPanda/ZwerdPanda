import { INK } from '../../components/art/shapes';
import type { PetFood } from '../../data/types';
import { FoodArt } from './Props';
import { SeasonFloor, SeasonWall, SeasonWindow } from './DenSeason';
import type { Season } from './season';

/** Where Coco can be in her den, as a % from the left. */
export const SPOTS = {
  hay: 15,
  tunnel: 30,
  center: 50,
  front: 50,
  bowl: 70,
  box: 86,
} as const;
export type Spot = keyof typeof SPOTS;

export type DenLight = 'dawn' | 'day' | 'dusk' | 'night';

export function timeOfDay(hour: number): DenLight {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

const PALETTE: Record<
  DenLight,
  { wall: string; stripe: string; floor: string; plank: string; rug: string; sky: [string, string] }
> = {
  dawn: {
    wall: '#f7dfd6',
    stripe: '#f2d2c8',
    floor: '#d8b18c',
    plank: '#c99f7b',
    rug: '#f1c3cb',
    sky: ['#f6b9a6', '#fde3c4'],
  },
  day: {
    wall: '#f6ebdf',
    stripe: '#efe0d1',
    floor: '#ddb995',
    plank: '#cda681',
    rug: '#f3c9d0',
    sky: ['#9fd0ef', '#e2f2fb'],
  },
  dusk: {
    wall: '#ecd0cc',
    stripe: '#e4c3c0',
    floor: '#c9a07f',
    plank: '#b98f70',
    rug: '#e3b1bf',
    sky: ['#7d5ea8', '#f3a986'],
  },
  night: {
    wall: '#3d3150',
    stripe: '#372c49',
    floor: '#6e5662',
    plank: '#634b57',
    rug: '#7c5b78',
    sky: ['#141a3a', '#33356b'],
  },
};

const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/**
 * Coco's room: hay rack (filled as much as she has hay), water bottle, tunnel,
 * cardboard box, food bowl and a window that follows the time of day.
 */
export function DenScene({
  light,
  hay = 100,
  bowl = null,
  rustle = null,
  season = null,
}: {
  light: DenLight;
  /** Decorations for the time of year (Halloween, Christmas, her birthday…). */
  season?: Season | null;
  /** 0–100: how full the hay rack and water bottle are. */
  hay?: number;
  bowl?: { food: PetFood; bites: number } | null;
  rustle?: 'tunnel' | 'box' | 'hay' | null;
}) {
  const p = PALETTE[light];
  const hayTop = 168 - (Math.max(0, Math.min(100, hay)) / 100) * 50;
  const waterTop = 158 - (Math.max(10, Math.min(100, hay)) / 100) * 36;
  return (
    <svg
      className="den-scene"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="den-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.sky[0]} />
          <stop offset="100%" stopColor={p.sky[1]} />
        </linearGradient>
        <clipPath id="den-window">
          <rect x="236" y="34" width="104" height="96" rx="10" />
        </clipPath>
        <radialGradient id="den-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd98e" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd98e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* wall */}
      <rect width="400" height="200" fill={p.wall} />
      {Array.from({ length: 14 }, (_, i) => (
        <rect key={i} x={i * 30 + 8} y="0" width="12" height="200" fill={p.stripe} />
      ))}

      {/* window */}
      <g>
        <rect x="236" y="34" width="104" height="96" rx="10" fill="url(#den-sky)" {...S} />
        {light === 'night' ? (
          <g>
            <circle cx="312" cy="62" r="12" fill="#fff4cf" />
            <circle cx="318" cy="58" r="10" fill={p.sky[0]} />
            {[
              [252, 52],
              [272, 80],
              [296, 46],
              [262, 104],
              [326, 98],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#fff" />
            ))}
          </g>
        ) : (
          <g>
            <circle
              cx={light === 'dawn' ? 262 : light === 'dusk' ? 316 : 300}
              cy={light === 'day' ? 62 : 104}
              r="14"
              fill={light === 'day' ? '#ffe58a' : '#ffc27a'}
            />
            <path
              d="M246 100q14 -10 30 0q12 -8 24 0"
              fill="none"
              stroke="#fff"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.8"
            />
          </g>
        )}
        {season && <SeasonWindow season={season} />}
        <path d="M288 34v96M236 82h104" stroke={INK} strokeWidth="3" />
        <path d="M226 28q20 50 6 110l-14 0q8 -60 -6 -110z" fill="#e9a7b4" {...S} />
        <path d="M350 28q-20 50 -6 110l14 0q-8 -60 6 -110z" fill="#e9a7b4" {...S} />
        <rect x="220" y="22" width="136" height="9" rx="4.5" fill="#b98b6a" {...S} />
      </g>
      {light === 'night' && <circle cx="288" cy="150" r="140" fill="url(#den-glow)" />}

      {/* a little heart frame */}
      <g transform="translate(176 60)">
        <rect x="-22" y="-20" width="44" height="40" rx="6" fill="#fffaf2" {...S} />
        <path
          d="M0 10l-11 -11a6.5 6.5 0 0 1 11 -7a6.5 6.5 0 0 1 11 7z"
          fill="#e6889b"
          stroke={INK}
          strokeWidth="2"
        />
      </g>

      {season && <SeasonWall season={season} />}

      {/* floor */}
      <rect y="196" width="400" height="104" fill={p.floor} />
      <path d={`M0 196h400`} stroke={INK} strokeWidth="3" />
      {Array.from({ length: 5 }, (_, i) => (
        <path key={i} d={`M0 ${214 + i * 20}h400`} stroke={p.plank} strokeWidth="2" />
      ))}
      <ellipse cx="200" cy="258" rx="160" ry="30" fill={p.rug} opacity="0.9" />
      <ellipse
        cx="200"
        cy="258"
        rx="140"
        ry="22"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeDasharray="6 7"
        opacity="0.6"
      />
      {season && <SeasonFloor season={season} light={light} />}

      {/* hay rack + water bottle */}
      <g className={rustle === 'hay' ? 'den-rustle' : undefined}>
        <path d="M24 118h66l-8 56h-50z" fill="#c69467" {...S} />
        <path
          d={`M31 172v${hayTop - 172}q7 -14 13 0q6 -16 14 0q6 -14 14 0q6 -12 11 0v${172 - hayTop}z`}
          fill="#e9cf7a"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
          style={{ transition: 'd 0.6s ease' }}
        />
        {hay > 30 &&
          [40, 56, 70].map((x, i) => (
            <path
              key={x}
              d={`M${x} ${hayTop + 4}l${i % 2 ? 7 : -6} ${-12 - i * 2}`}
              stroke="#d8b65c"
              strokeWidth="2"
              strokeLinecap="round"
            />
          ))}
        {[36, 50, 64, 78].map((x) => (
          <path key={x} d={`M${x} 122v48`} stroke={INK} strokeWidth="2.5" />
        ))}
        <rect x="100" y="100" width="18" height="62" rx="8" fill="#e6f4fb" {...S} />
        <rect
          x="102"
          y={waterTop}
          width="14"
          height={160 - waterTop}
          rx="6"
          fill="#8fc8ec"
          style={{ transition: 'y 0.6s ease, height 0.6s ease' }}
        />
        <path d="M109 162v18" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      </g>

      {/* tunnel */}
      <g className={rustle === 'tunnel' ? 'den-rustle' : undefined}>
        <path d="M70 210q0 -34 34 -34h64v62h-64q-34 0 -34 -28z" fill="#9cc3a4" {...S} />
        {[92, 112, 132, 152].map((x) => (
          <path key={x} d={`M${x} 177q-8 30 0 60`} fill="none" stroke="#7da786" strokeWidth="3" />
        ))}
        <ellipse cx="168" cy="207" rx="15" ry="31" fill="#46594a" {...S} />
      </g>

      {/* cardboard box with a door */}
      <g className={rustle === 'box' ? 'den-rustle' : undefined}>
        <path d="M300 168h80v66h-80z" fill="#d7a96f" {...S} />
        <path d="M300 168l12 -16h80l-12 16z" fill="#e6bd85" {...S} />
        <path d="M380 168l12 -16v66l-12 16z" fill="#c4935a" {...S} />
        <path d="M318 234v-24a18 18 0 0 1 36 0v24z" fill="#5b4330" {...S} />
      </g>

      {/* food bowl */}
      <g>
        <ellipse cx="282" cy="272" rx="30" ry="9" fill="#a9c8e6" {...S} />
        {bowl && (
          <g transform="translate(282 266) scale(0.62)">
            <FoodArt food={bowl.food} bites={bowl.bites} />
          </g>
        )}
        <path d="M252 272q4 18 30 18q26 0 30 -18" fill="#cfe2f3" {...S} />
      </g>
    </svg>
  );
}
