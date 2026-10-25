import { INK } from '../../components/art/shapes';
import type { PetDecor, PetFood } from '../../data/types';
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
  {
    wall: string;
    wallLow: string;
    stripe: string;
    floor: string;
    floorFront: string;
    plank: string;
    rug: string;
    sky: [string, string];
    /** The light falling in through the window. */
    beam: string;
    beamOpacity: number;
  }
> = {
  dawn: {
    wall: '#f9e4da',
    wallLow: '#efcfc4',
    stripe: '#f3d6cb',
    floor: '#dfba95',
    floorFront: '#c99c75',
    plank: '#c49871',
    rug: '#f1c3cb',
    sky: ['#f6b9a6', '#fde3c4'],
    beam: '#ffd6b0',
    beamOpacity: 0.45,
  },
  day: {
    wall: '#f8eee3',
    wallLow: '#ecdccb',
    stripe: '#f1e3d4',
    floor: '#e3c19d',
    floorFront: '#cfa47c',
    plank: '#c99f79',
    rug: '#f3c9d0',
    sky: ['#9fd0ef', '#e2f2fb'],
    beam: '#fff6d8',
    beamOpacity: 0.55,
  },
  dusk: {
    wall: '#eed3cf',
    wallLow: '#dcb7b4',
    stripe: '#e6c6c2',
    floor: '#cda585',
    floorFront: '#b28567',
    plank: '#ad8668',
    rug: '#e3b1bf',
    sky: ['#7d5ea8', '#f3a986'],
    beam: '#ffb889',
    beamOpacity: 0.35,
  },
  night: {
    wall: '#43365a',
    wallLow: '#342a48',
    stripe: '#3d3153',
    floor: '#715968',
    floorFront: '#5a4553',
    plank: '#634b5a',
    rug: '#7c5b78',
    sky: ['#141a3a', '#33356b'],
    beam: '#b9c6ff',
    beamOpacity: 0.18,
  },
};

const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const BULBS = ['#ffd36e', '#ff9db5', '#a8dcff', '#c7f0b0'];

/** Points along a sagging string from (x0,y0) to (x1,y1), lowest at `sag`. */
function along(n: number, x0: number, x1: number, y: number, sag: number): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    return [x0 + (x1 - x0) * t, y + 4 * sag * t * (1 - t)];
  });
}

/**
 * Coco's room: hay rack (filled as much as she has hay), water bottle, tunnel,
 * a box (or her own little house), food bowl and a window that follows the
 * time of day — plus whatever we bought for her with her carrots.
 */
export function DenScene({
  light,
  hay = 100,
  bowl = null,
  rustle = null,
  season = null,
  decor = [],
}: {
  light: DenLight;
  /** Decorations for the time of year (Halloween, Christmas, her birthday…). */
  season?: Season | null;
  /** 0–100: how full the hay rack and water bottle are. */
  hay?: number;
  bowl?: { food: PetFood; bites: number } | null;
  rustle?: 'tunnel' | 'box' | 'hay' | null;
  decor?: readonly PetDecor[];
}) {
  const p = PALETTE[light];
  const has = (d: PetDecor) => decor.includes(d);
  const hayTop = 168 - (Math.max(0, Math.min(100, hay)) / 100) * 50;
  const waterTop = 158 - (Math.max(10, Math.min(100, hay)) / 100) * 36;
  const dark = light === 'night' || light === 'dusk';
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
        <linearGradient id="den-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.wall} />
          <stop offset="100%" stopColor={p.wallLow} />
        </linearGradient>
        <linearGradient id="den-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.floor} />
          <stop offset="100%" stopColor={p.floorFront} />
        </linearGradient>
        <linearGradient id="den-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={p.beam} stopOpacity={p.beamOpacity} />
          <stop offset="100%" stopColor={p.beam} stopOpacity="0" />
        </linearGradient>
        <clipPath id="den-window">
          <rect x="236" y="34" width="104" height="96" rx="10" />
        </clipPath>
        <radialGradient id="den-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd98e" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffd98e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="den-vignette" cx="50%" cy="55%" r="75%">
          <stop offset="65%" stopColor="#3d1f3a" stopOpacity="0" />
          <stop offset="100%" stopColor="#3d1f3a" stopOpacity={dark ? 0.32 : 0.14} />
        </radialGradient>
        <radialGradient id="den-bulb">
          <stop offset="0%" stopColor="#fff3c4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffd36e" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* wall, a little darker towards the floor */}
      <rect width="400" height="200" fill="url(#den-wall)" />
      {Array.from({ length: 14 }, (_, i) => (
        <rect
          key={i}
          x={i * 30 + 8}
          y="0"
          width="12"
          height="200"
          fill={p.stripe}
          opacity="0.8"
        />
      ))}

      {/* window */}
      <g>
        <rect x="232" y="30" width="112" height="104" rx="12" fill="#fffaf2" {...S} />
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
            {/* a tree outside */}
            <g clipPath="url(#den-window)">
              <ellipse cx="336" cy="126" rx="26" ry="20" fill="#9cc79a" opacity="0.8" />
              <ellipse cx="246" cy="130" rx="20" ry="12" fill="#a9d1a4" opacity="0.7" />
            </g>
          </g>
        )}
        {season && <SeasonWindow season={season} />}
        <path d="M288 34v96M236 82h104" stroke={INK} strokeWidth="3" />
        <path d="M232 134h112l6 8H226z" fill="#fffaf2" {...S} />
        <path d="M226 28q20 50 6 110l-14 0q8 -60 -6 -110z" fill="#e9a7b4" {...S} />
        <path d="M350 28q-20 50 -6 110l14 0q-8 -60 6 -110z" fill="#e9a7b4" {...S} />
        <path d="M222 60q8 4 12 0M354 60q-8 4 -12 0" stroke={INK} strokeWidth="2" fill="none" />
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

      {/* a plant on a high shelf, out of her reach */}
      {has('plant') && (
        <g>
          <rect x="360" y="92" width="38" height="6" rx="2" fill="#b98b6a" {...S} strokeWidth="2.5" />
          <path d="M366 98l4 10M392 98l-4 10" stroke={INK} strokeWidth="2" />
          <g className="den-sway">
            <path
              d="M379 74q-12 -14 -4 -26q6 10 4 26zM379 74q10 -16 20 -12q-8 12 -20 12zM379 74q-16 -4 -20 -14q12 0 20 14z"
              fill="#7fb37a"
              stroke={INK}
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </g>
          <path d="M368 74h22l-3 18h-16z" fill="#e48b6f" {...S} strokeWidth="2.5" />
        </g>
      )}

      {/* floor, with a skirting board and planks running towards you */}
      <rect y="196" width="400" height="104" fill="url(#den-floor)" />
      {[204, 214, 227, 244, 266].map((y) => (
        <path key={y} d={`M0 ${y}h400`} stroke={p.plank} strokeWidth="1.6" opacity="0.7" />
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const x = 20 + i * 45;
        return (
          <path
            key={i}
            d={`M${x} 196L${200 + (x - 200) * 1.9} 300`}
            stroke={p.plank}
            strokeWidth="1.4"
            opacity="0.45"
          />
        );
      })}
      <rect y="186" width="400" height="12" fill={dark ? '#d9c8d6' : '#fffaf2'} />
      <path d="M0 186h400M0 198h400" stroke={INK} strokeWidth="2.5" />
      {/* sunlight (or moonlight) from the window */}
      <path d="M236 198h104l60 102H200z" fill="url(#den-beam)" />

      {/* her bedding: a fleece mat, or the soft rug we bought */}
      {has('rug') ? (
        <g>
          <ellipse cx="200" cy="262" rx="150" ry="30" fill="#f7b8c6" {...S} strokeWidth="2.5" />
          <ellipse cx="200" cy="262" rx="122" ry="23" fill="#fde3ea" />
          <ellipse cx="200" cy="262" rx="94" ry="16" fill="#f7b8c6" />
          <ellipse cx="200" cy="262" rx="64" ry="10" fill="#fde3ea" />
          {Array.from({ length: 18 }, (_, i) => {
            const a = (i / 18) * Math.PI * 2;
            return (
              <path
                key={i}
                d={`M${200 + Math.cos(a) * 150} ${262 + Math.sin(a) * 30}l${Math.cos(a) * 6} ${Math.sin(a) * 3}`}
                stroke="#e38aa1"
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : (
        <g>
          <ellipse cx="200" cy="260" rx="160" ry="30" fill={p.rug} opacity="0.9" />
          <ellipse
            cx="200"
            cy="260"
            rx="140"
            ry="22"
            fill="none"
            stroke="#fff"
            strokeWidth="2"
            strokeDasharray="6 7"
            opacity="0.6"
          />
        </g>
      )}
      {season && <SeasonFloor season={season} light={light} />}

      {/* soft shadows where things touch the floor */}
      <g fill="#3d1f3a" opacity="0.13">
        <ellipse cx="120" cy="240" rx="56" ry="6" />
        <ellipse cx="346" cy="236" rx="52" ry="6" />
        <ellipse cx="282" cy="290" rx="34" ry="5" />
      </g>

      {/* a hammock over the tunnel */}
      {has('hammock') && (
        <g className="den-swing">
          <path d="M126 112l12 26M222 112l-12 26" stroke={INK} strokeWidth="2" />
          <circle cx="126" cy="111" r="3" fill="#b98b6a" stroke={INK} strokeWidth="1.5" />
          <circle cx="222" cy="111" r="3" fill="#b98b6a" stroke={INK} strokeWidth="1.5" />
          <path d="M134 136q40 34 80 0q-40 14 -80 0z" fill="#b7d8ef" {...S} strokeWidth="2.5" />
          <path d="M146 142q28 16 56 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.8" />
        </g>
      )}

      {/* hay rack + water bottle */}
      <g className={rustle === 'hay' ? 'den-rustle' : undefined}>
        <rect x="20" y="112" width="74" height="8" rx="3" fill="#a77b55" {...S} strokeWidth="2.5" />
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
        <path d="M104 106v40" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <path d="M109 162v18" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        {hay < 30 && (
          <text x="70" y="104" className="den-scene__empty" textAnchor="middle">
            leeg!
          </text>
        )}
      </g>

      {/* tunnel */}
      <g className={rustle === 'tunnel' ? 'den-rustle' : undefined}>
        <path d="M70 210q0 -34 34 -34h64v62h-64q-34 0 -34 -28z" fill="#9cc3a4" {...S} />
        {[92, 112, 132, 152].map((x) => (
          <path key={x} d={`M${x} 177q-8 30 0 60`} fill="none" stroke="#7da786" strokeWidth="3" />
        ))}
        <path d="M84 192q20 -12 76 -12" stroke="#c4e0c9" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="168" cy="207" rx="15" ry="31" fill="#46594a" {...S} />
      </g>

      {/* her own little house — or the cardboard box with a door */}
      {has('house') ? (
        <g className={rustle === 'box' ? 'den-rustle' : undefined}>
          <path d="M300 172h86v62h-86z" fill="#e2b37e" {...S} />
          {[186, 200, 214].map((y) => (
            <path key={y} d={`M302 ${y}h82`} stroke="#c8935c" strokeWidth="2" />
          ))}
          <path d="M292 176l51 -42l51 42z" fill="#d8707f" {...S} />
          <path d="M306 168l37 -30l37 30" stroke="#f3a0ad" strokeWidth="3" fill="none" />
          <path d="M324 234v-26a19 19 0 0 1 38 0v26z" fill="#5b4330" {...S} />
          <path d="M343 150a6 6 0 1 0 0.1 0z" fill="#fffaf2" stroke={INK} strokeWidth="2" />
          <text x="343" y="229" textAnchor="middle" className="den-scene__sign">
            COCO
          </text>
        </g>
      ) : (
        <g className={rustle === 'box' ? 'den-rustle' : undefined}>
          <path d="M300 168h80v66h-80z" fill="#d7a96f" {...S} />
          <path d="M300 168l12 -16h80l-12 16z" fill="#e6bd85" {...S} />
          <path d="M380 168l12 -16v66l-12 16z" fill="#c4935a" {...S} />
          <path d="M318 234v-24a18 18 0 0 1 36 0v24z" fill="#5b4330" {...S} />
        </g>
      )}

      {/* food bowl */}
      <g>
        <ellipse cx="282" cy="272" rx="30" ry="9" fill="#a9c8e6" {...S} />
        {bowl && (
          <g transform="translate(282 266) scale(0.62)">
            <FoodArt food={bowl.food} bites={bowl.bites} />
          </g>
        )}
        <path d="M252 272q4 18 30 18q26 0 30 -18" fill="#cfe2f3" {...S} />
        <text x="282" y="286" textAnchor="middle" className="den-scene__sign den-scene__sign--bowl">
          ♡
        </text>
      </g>

      {/* a basket of toys */}
      {has('toys') && (
        <g>
          <circle cx="356" cy="262" r="8" fill="#d8b65c" stroke={INK} strokeWidth="2" />
          <path d="M350 258l12 8M350 266l12 -8" stroke="#a5822e" strokeWidth="1.5" />
          <rect x="368" y="250" width="12" height="12" rx="2" fill="#a8dcff" stroke={INK} strokeWidth="2" />
          <path d="M342 264h52l-6 24h-40z" fill="#c69467" {...S} strokeWidth="2.5" />
          <path d="M346 272h44M348 280h40" stroke="#a77b55" strokeWidth="2" />
          <path d="M350 264q18 -22 36 0" stroke={INK} strokeWidth="2.5" fill="none" />
        </g>
      )}

      {/* fairy lights draped over the curtain rod */}
      {has('garland') && (
        <g>
          <path d="M214 40Q306 84 398 40" stroke={INK} strokeWidth="1.5" fill="none" />
          {along(10, 214, 398, 40, 22).map(([x, y], i) => (
            <g key={i}>
              {dark && (
                <circle
                  cx={x}
                  cy={y + 5}
                  r="11"
                  fill="url(#den-bulb)"
                  className="den-twinkle"
                  style={{ animationDelay: `${(i % 4) * 0.4}s` }}
                />
              )}
              <ellipse
                cx={x}
                cy={y + 5}
                rx="3.2"
                ry="4.4"
                fill={BULBS[i % BULBS.length]}
                stroke={INK}
                strokeWidth="1.2"
              />
            </g>
          ))}
        </g>
      )}

      {/* the edges of the room fall into a soft shadow */}
      <rect width="400" height="300" fill="url(#den-vignette)" />
    </svg>
  );
}

/** Where the droppings lie, in the room's own coordinates. */
const DROPPINGS: [number, number][] = [
  [58, 282],
  [226, 254],
  [130, 266],
  [330, 290],
  [178, 292],
  [250, 300],
];

/**
 * The bits of the room you can touch: her hay rack and bottle (tap to refill),
 * and any droppings (tap each one away). Drawn on top of the room with the
 * same coordinates, so they always line up.
 */
export function DenHotspots({
  droppings,
  swept,
  onRefill,
  onSweep,
  disabled,
}: {
  droppings: number;
  swept: readonly number[];
  onRefill: () => void;
  onSweep: (index: number) => void;
  disabled: boolean;
}) {
  const press = (fn: () => void) => ({
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled) fn();
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!disabled) fn();
    },
  });
  return (
    <svg className="den-hotspots" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
      <g
        className="den-hot den-hot--rack"
        role="button"
        tabIndex={0}
        aria-label="Hooi en water bijvullen"
        aria-disabled={disabled || undefined}
        {...press(onRefill)}
      >
        <rect x="16" y="94" width="110" height="92" rx="12" className="den-hot__area" />
      </g>
      {DROPPINGS.slice(0, droppings).map(([x, y], i) =>
        swept.includes(i) ? null : (
          <g
            key={i}
            className="den-hot den-hot--poop"
            role="button"
            tabIndex={0}
            aria-label="Keuteltje opruimen"
            {...press(() => onSweep(i))}
          >
            <circle cx={x} cy={y - 4} r="17" className="den-hot__area" />
            <g transform={`translate(${x} ${y - 4})`} aria-hidden="true">
              <circle cx="-4" cy="1" r="3.4" fill="#6b4a32" />
              <circle cx="3" cy="2" r="3.2" fill="#5d3f2a" />
              <circle cx="0" cy="-4" r="3" fill="#77533a" />
              <circle cx="-1" cy="-5" r="0.9" fill="#fff" opacity="0.5" />
            </g>
          </g>
        ),
      )}
    </svg>
  );
}
