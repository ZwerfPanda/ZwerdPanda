import { useMemo } from 'react';
import { PlaceArt, type PlaceId } from './PlaceArt';
import { PLACES } from './places';
import { hillPath, smoothPath, type Point } from './spline';
import { hashUnit } from '../../lib/id';
import { HeartShape, INK } from '../../components/art/shapes';

export type Light = 'day' | 'dusk' | 'night';

export interface WorldLayout {
  width: number;
  height: number;
  horizon: number;
  /** Building scale at the horizon and in the foreground. */
  scale: [far: number, near: number];
  places: Record<PlaceId, Point>;
  path: Point[];
  hills: [y: number, amplitude: number, waves: number, phase: number][];
  track: number;
  stationX: number;
  moon: Point;
  clouds: Point[];
  labelSize: number;
  pathWidth: number;
}

/** Phones: the path climbs from the station in the foreground to home on the horizon. */
export const PORTRAIT: WorldLayout = {
  width: 400,
  height: 760,
  horizon: 236,
  scale: [0.56, 0.92],
  places: {
    house: [205, 226],
    moonpost: [312, 312],
    garden: [94, 318],
    hutch: [300, 410],
    karaoke: [96, 424],
    tree: [306, 548],
    arcade: [94, 552],
    cafe: [298, 660],
    station: [100, 690],
  },
  path: [
    [200, 820],
    [174, 704],
    [236, 672],
    [160, 562],
    [240, 556],
    [160, 434],
    [236, 418],
    [166, 328],
    [246, 322],
    [207, 236],
  ],
  hills: [
    [234, 6, 1.6, 0.4],
    [348, 9, 1.3, 2.2],
    [480, 10, 1.1, 4.1],
    [606, 12, 1.2, 1.1],
  ],
  track: 732,
  stationX: 100,
  moon: [326, 168],
  clouds: [
    [64, 198],
    [292, 212],
  ],
  labelSize: 15,
  pathWidth: 15,
};

/** Wider screens: the same journey as a winding road across three terraces. */
export const LANDSCAPE: WorldLayout = {
  width: 1200,
  height: 700,
  horizon: 256,
  scale: [0.62, 1.02],
  places: {
    house: [952, 262],
    moonpost: [646, 340],
    garden: [334, 350],
    hutch: [306, 474],
    karaoke: [604, 472],
    tree: [908, 486],
    arcade: [938, 622],
    cafe: [562, 630],
    station: [182, 644],
  },
  path: [
    [-20, 702],
    [200, 668],
    [560, 656],
    [936, 646],
    [1108, 604],
    [1094, 522],
    [904, 508],
    [604, 496],
    [306, 498],
    [128, 456],
    [150, 386],
    [334, 372],
    [646, 362],
    [868, 304],
    [954, 274],
  ],
  hills: [
    [258, 8, 1.4, 0.3],
    [330, 9, 1.1, 2.9],
    [420, 12, 0.9, 1.5],
    [560, 13, 1, 4.2],
  ],
  track: 684,
  stationX: 182,
  moon: [1092, 96],
  clouds: [
    [200, 120],
    [760, 170],
  ],
  labelSize: 16,
  pathWidth: 20,
};

function depthScale(layout: WorldLayout, y: number) {
  const t = Math.max(0, Math.min(1, (y - layout.horizon) / (layout.height - 50 - layout.horizon)));
  const [far, near] = layout.scale;
  return far + t * (near - far);
}

interface SceneProps {
  layout: WorldLayout;
  light: Light;
  selected: PlaceId | null;
  onSelect: (id: PlaceId) => void;
  animate: boolean;
}

export function WorldScene({ layout, light, selected, onSelect, animate }: SceneProps) {
  const pathD = useMemo(() => smoothPath(layout.path), [layout]);
  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        x: -200 + hashUnit(`wx${i}`) * (layout.width + 400),
        y: -300 + hashUnit(`wy${i}`) * (layout.horizon + 240),
        r: hashUnit(`wr${i}`) > 0.85 ? 1.9 : 1.1,
        d: hashUnit(`wd${i}`) * -6,
      })),
    [layout],
  );
  const fireflies = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: 20 + hashUnit(`fx${i}`) * (layout.width - 40),
        y: layout.horizon + 40 + hashUnit(`fy${i}`) * (layout.height - layout.horizon - 80),
        d: hashUnit(`fd${i}`) * -8,
      })),
    [layout],
  );
  const ordered = (Object.keys(layout.places) as PlaceId[]).sort((a, b) => layout.places[a][1] - layout.places[b][1]);
  const hillClasses = ['w-hill-far', 'w-hill-mid', 'w-hill-near', 'w-hill-front'];

  return (
    <svg
      className="world-svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      preserveAspectRatio="xMidYMid meet"
      data-light={light}
      role="group"
      aria-label="Our Little World: an illustrated map with places to visit"
    >
      <defs>
        <linearGradient id="w-sky" gradientUnits="userSpaceOnUse" x1="0" y1={-300} x2="0" y2={layout.horizon + 20}>
          <stop offset="0" className="w-sky-top" />
          <stop offset="0.62" className="w-sky-mid" />
          <stop offset="1" className="w-sky-bottom" />
        </linearGradient>
        <radialGradient id="w-glow">
          <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffe6a8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky — drawn far wider and taller than the viewBox so any screen shape is covered. */}
      <rect x={-3000} y={-3000} width={layout.width + 6000} height={3000 + layout.horizon + 40} fill="url(#w-sky)" />

      <g className="w-stars">
        {stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} className="w-star" style={{ animationDelay: `${s.d}s` }} />
        ))}
        {animate && <path className="w-shooting" d={`M${layout.width * 0.2} 40 l60 22`} />}
      </g>

      <g className="w-moon" transform={`translate(${layout.moon[0]} ${layout.moon[1]})`}>
        <circle r="46" fill="url(#w-glow)" opacity="0.5" />
        <path d="M-6-22a22 22 0 1 0 22 30 26 26 0 0 1-22-30z" fill="#fcf3dc" />
      </g>
      <g className="w-sun" transform={`translate(${layout.moon[0] - layout.width * 0.12} ${layout.moon[1] + 10})`}>
        <circle r="54" fill="url(#w-glow)" opacity="0.7" />
        <circle r="22" fill="#fde7c4" />
      </g>
      <g className="w-sunset" transform={`translate(${layout.width * 0.22} ${layout.horizon - 6})`}>
        <circle r="90" fill="url(#w-glow)" opacity="0.8" />
        <circle r="30" fill="#fbd3a8" />
      </g>

      <g className="w-clouds">
        {layout.clouds.map(([x, y], i) => (
          <g key={i} className={`w-cloud ${animate ? 'is-drifting' : ''}`} style={{ animationDelay: `${i * -14}s` }}>
            <path
              transform={`translate(${x} ${y}) scale(${i ? 0.8 : 1})`}
              d="M-50 0h100a16 16 0 0 0-14-22 20 20 0 0 0-30-14 24 24 0 0 0-40 8 16 16 0 0 0-16 28z"
            />
          </g>
        ))}
      </g>

      {layout.hills.map(([y, amp, waves, phase], i) => (
        <path key={i} className={hillClasses[i]} d={hillPath(y, amp, waves, phase)} />
      ))}

      {/* The train line, with a little train that pulls in at the station. */}
      <g className="w-track">
        <path d={`M-3000 ${layout.track}H${layout.width + 3000}`} className="w-rail" />
        <path d={`M-3000 ${layout.track + 6}H${layout.width + 3000}`} className="w-rail" />
        <path d={`M-3000 ${layout.track + 3}H${layout.width + 3000}`} className="w-sleepers" />
      </g>
      <g className={`w-train ${animate ? 'is-running' : ''}`} style={{ '--station': `${layout.stationX + 46}px` } as React.CSSProperties}>
        <g transform={`translate(0 ${layout.track - 1})`}>
          {[-112, -74, -36].map((x, i) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <rect x="0" y="-22" width="34" height="20" rx={i === 2 ? 8 : 4} fill={i === 2 ? '#b9646f' : '#fbf4ea'} stroke={INK} strokeWidth="2" />
              <rect x="5" y="-17" width="9" height="7" rx="1.5" className="w-window" />
              <rect x="19" y="-17" width="9" height="7" rx="1.5" className="w-window" />
              <circle cx="8" cy="-1" r="3" fill={INK} />
              <circle cx="26" cy="-1" r="3" fill={INK} />
            </g>
          ))}
        </g>
      </g>

      {/* The path through everything */}
      <path d={pathD} className="w-path-edge" strokeWidth={layout.pathWidth + 5} />
      <path d={pathD} className="w-path" strokeWidth={layout.pathWidth} />
      <path d={pathD} className="w-path-steps" />

      {animate && (
        <g className="w-car">
          <g>
            <path d="M10-3l26-9v24z" className="w-headlights" />
            <rect x="-9" y="-6" width="20" height="12" rx="5" fill="#d48d96" stroke={INK} strokeWidth="1.8" />
            <rect x="0" y="-4.5" width="5" height="9" rx="1.5" fill="#e4ddf5" />
            <HeartShape x={-4} y={0} size={5} fill="#fffcf6" />
          </g>
          <animateMotion dur="46s" repeatCount="indefinite" rotate="auto" path={pathD} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
        </g>
      )}

      {ordered.map((id) => {
        const [x, y] = layout.places[id];
        const s = depthScale(layout, y);
        return (
          <Place key={id} id={id} x={x} y={y} scale={s} selected={selected === id} onSelect={onSelect} />
        );
      })}

      {/* Signs stay readable at every depth, so they're drawn unscaled on top. */}
      <g className="w-signs">
        {ordered.map((id) => {
          const [x, y] = layout.places[id];
          const text = PLACES[id].sign;
          const w = text.length * layout.labelSize * 0.47 + 22;
          const h = layout.labelSize + 9;
          return (
            <g key={id} transform={`translate(${x} ${y + 8 + depthScale(layout, y) * 6})`} className={`w-sign ${selected === id ? 'is-selected' : ''}`} onClick={() => onSelect(id)} aria-hidden="true">
              <rect x={-w / 2} y={0} width={w} height={h} rx={h / 2} />
              <text x={0} y={h / 2 + layout.labelSize * 0.34} textAnchor="middle" fontSize={layout.labelSize}>
                {text}
              </text>
            </g>
          );
        })}
      </g>

      {animate && (
        <g className="w-fireflies">
          {fireflies.map((f, i) => (
            <circle key={i} cx={f.x} cy={f.y} r="2.2" className="w-firefly" style={{ animationDelay: `${f.d}s` }} />
          ))}
        </g>
      )}
    </svg>
  );
}

function Place({ id, x, y, scale, selected, onSelect }: { id: PlaceId; x: number; y: number; scale: number; selected: boolean; onSelect: (id: PlaceId) => void }) {
  const info = PLACES[id];
  return (
    <g
      className={`place ${selected ? 'is-selected' : ''}`}
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      aria-label={`${info.name} — ${info.tagline}`}
      aria-pressed={selected}
      onClick={() => onSelect(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(id);
        }
      }}
    >
      <g transform={`scale(${scale})`}>
        <ellipse className="place__ring" cx="0" cy="2" rx="66" ry="15" />
        <rect className="place__hit" x="-64" y="-118" width="128" height="132" />
        <g className="place__art">
          <PlaceArt id={id} />
        </g>
      </g>
    </g>
  );
}
