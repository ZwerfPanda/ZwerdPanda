import type { CSSProperties } from 'react';
import { INK } from '../../components/art/shapes';
import type { Season } from './season';

/*
 * Decorations for Coco's den, by season. Three layers, so everything sits at
 * the right depth: in the window, on the wall, and on the floor.
 */

type Light = 'dawn' | 'day' | 'dusk' | 'night';

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/** Points along the garland, sagging across the left wall. */
function garland(n: number): [number, number][] {
  const p0 = [10, 10];
  const p1 = [110, 44];
  const p2 = [212, 10];
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return [a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]];
  });
}

const FLAGS: Partial<Record<Season, string[]>> = {
  halloween: ['#f08a24', '#5a4580', '#2b2333'],
  birthday: ['#f6b5c6', '#a9d2f2', '#ffe08a', '#c7a6e8', '#a7d8b8'],
  easter: ['#f9d5e0', '#fff1b8', '#cfe8d2', '#d9cdf3'],
};
const BULBS = ['#e8505b', '#f6c454', '#5aa9e6', '#6cc08b'];
const HEART = 'M0 12l-7 -7a4 4 0 0 1 7 -5a4 4 0 0 1 7 5z';

/** Inside the window frame: bats at Halloween, falling snow at Christmas. */
export function SeasonWindow({ season }: { season: Season }) {
  if (season === 'halloween') {
    return (
      <g fill="#2b2333">
        {[
          [262, 58, 1],
          [314, 92, 0.75],
        ].map(([x, y, s], i) => (
          <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
            <g className="den-bat" style={delay(i * 0.2)}>
              <path d="M0 0c-4 -6 -10 -7 -15 -3c3 1 4 4 3 6c-3 -2 -6 -1 -8 1c5 0 8 2 10 5c3 -3 6 -4 10 -3c4 -1 7 0 10 3c2 -3 5 -5 10 -5c-2 -2 -5 -3 -8 -1c-1 -2 0 -5 3 -6c-5 -4 -11 -3 -15 3z" />
            </g>
          </g>
        ))}
      </g>
    );
  }
  if (season === 'christmas') {
    return (
      <g>
        <g clipPath="url(#den-window)">
          {Array.from({ length: 16 }, (_, i) => (
            <circle
              key={i}
              className="den-flake"
              cx={244 + ((i * 37) % 92)}
              cy={36 + ((i * 53) % 90)}
              r={i % 3 ? 1.8 : 2.6}
              fill="#fff"
              style={{ animationDelay: `${-i * 0.55}s`, animationDuration: `${5 + (i % 4)}s` }}
            />
          ))}
        </g>
        <path d="M238 128q12 -7 26 -4q14 -6 26 0q14 -5 26 -1q12 -4 22 1v6h-100z" fill="#fff" />
      </g>
    );
  }
  return null;
}

/** On the wall: a garland, and something extra per season. */
export function SeasonWall({ season }: { season: Season }) {
  const points = garland(9);
  const flags = FLAGS[season];
  return (
    <g>
      <path d="M10 10Q110 44 212 10" fill="none" stroke={INK} strokeWidth="1.6" />
      {season === 'christmas'
        ? points.map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <rect x="-2.2" y="-1" width="4.4" height="4" fill="#5b4a3f" />
              <ellipse
                className="den-bulb"
                style={delay((i % 3) * 0.6)}
                cy="8"
                rx="3.6"
                ry="5"
                fill={BULBS[i % BULBS.length]}
                stroke={INK}
                strokeWidth="1.2"
              />
            </g>
          ))
        : season === 'valentine'
          ? points.map(([x, y], i) => (
              <path
                key={i}
                transform={`translate(${x} ${y})`}
                d={HEART}
                fill={['#e6889b', '#f5b5c3', '#d6455d'][i % 3]}
                stroke={INK}
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            ))
          : flags &&
            points.map(([x, y], i) => (
              <path
                key={i}
                d={`M${x - 7} ${y - 1}L${x + 7} ${y + 1}L${x} ${y + 15}Z`}
                fill={flags[i % flags.length]}
                stroke={INK}
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            ))}

      {season === 'halloween' && (
        <g>
          {/* a cobweb in the corner, and a very small spider */}
          <g
            transform="translate(400 0)"
            fill="none"
            stroke="#9c90a8"
            strokeWidth="1.1"
            opacity="0.85"
          >
            <path d="M0 0L-46 0M0 0L-40 22M0 0L-24 38M0 0L0 46" />
            <path d="M-15 0Q-13 5 -13 7.5Q-9 9 -8 12.5Q-4 13 0 15" />
            <path d="M-30 0Q-26 10 -26 15Q-19 18 -16 25Q-8 27 0 30" />
          </g>
          <g className="den-spider">
            <path d="M380 0v44" stroke="#9c90a8" strokeWidth="1" />
            <path
              d="M374 44l-5 -3M374 48l-6 0M374 52l-5 3M386 44l5 -3M386 48l6 0M386 52l5 3"
              stroke="#2b2333"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="380" cy="48" r="5" fill="#2b2333" />
          </g>
        </g>
      )}

      {season === 'valentine' &&
        [
          [62, 96],
          [140, 112],
          [206, 126],
        ].map(([x, y], i) => (
          <g key={x} transform={`translate(${x} ${y})`}>
            <path
              className="den-float"
              style={delay(i * 0.7)}
              d={HEART}
              fill="#f39aae"
              stroke={INK}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </g>
        ))}

      {season === 'birthday' &&
        (
          [
            [134, 112, '#f6b5c6'],
            [154, 97, '#ffe08a'],
            [174, 114, '#c7a6e8'],
          ] as const
        ).map(([x, y, color], i) => (
          <g key={x} className="den-balloon" style={delay(i * 0.5)}>
            <path
              d={`M${x} ${y + 14}Q${x + 3} ${y + 40} 150 176`}
              fill="none"
              stroke={INK}
              strokeWidth="1.2"
            />
            <ellipse cx={x} cy={y} rx="11" ry="13.5" fill={color} stroke={INK} strokeWidth="2.2" />
            <path
              d={`M${x - 2.5} ${y + 16}h5l-2.5 -3z`}
              fill={color}
              stroke={INK}
              strokeWidth="1.2"
            />
            <ellipse cx={x - 4} cy={y - 5} rx="2.4" ry="4" fill="#fff" opacity="0.6" />
          </g>
        ))}
    </g>
  );
}

function Pumpkin({ x, y, r, glow }: { x: number; y: number; r: number; glow: boolean }) {
  const face = glow ? '#ffd166' : '#5a3412';
  return (
    <g transform={`translate(${x} ${y}) scale(${r / 20})`}>
      <path d="M-2 -15l1 -8h5l-1 8z" fill="#6b8f3a" stroke={INK} strokeWidth="2" />
      <ellipse rx="21" ry="16" fill="#f08a24" stroke={INK} strokeWidth="2.8" />
      <path d="M-8 -15q-7 15 0 30M8 -15q7 15 0 30" fill="none" stroke="#c96a12" strokeWidth="2" />
      <path d="M-11 -3l4 -7l4 7zM3 -3l4 -7l4 7z" fill={face} />
      <path d="M-11 4q11 9 22 0l-4 1l-3 3l-4 -3l-4 3l-3 -3z" fill={face} />
    </g>
  );
}

function Egg({
  x,
  y,
  color,
  band,
  rot,
}: {
  x: number;
  y: number;
  color: string;
  band: string;
  rot: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path
        d="M0 -12C6 -12 10 -3 10 3C10 10 5 13 0 13C-5 13 -10 10 -10 3C-10 -3 -6 -12 0 -12z"
        fill={color}
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M-9.6 1l3 -3l3 3l3 -3l3 3l3 -3l3 3" fill="none" stroke={band} strokeWidth="2" />
      <circle cx="-3" cy="-6" r="1.6" fill={band} />
      <circle cx="4" cy="-5" r="1.4" fill={band} />
      <circle cx="0" cy="8" r="1.6" fill={band} />
    </g>
  );
}

/** On the floor: pumpkins, a tree with presents, eggs, petals or a cake. */
export function SeasonFloor({ season, light }: { season: Season; light: Light }) {
  const glow = light === 'night' || light === 'dusk';
  switch (season) {
    case 'halloween':
      return (
        <g>
          <Pumpkin x={240} y={214} r={20} glow={glow} />
          <Pumpkin x={372} y={252} r={12} glow={glow} />
          {/* two sweets, still in their wrappers */}
          {(
            [
              [204, 232, '#f2a33c'],
              [218, 240, '#c7a6e8'],
            ] as const
          ).map(([x, y, c]) => (
            <path
              key={x}
              d={`M${x} ${y}l4 -3l4 3l-4 3zM${x - 3} ${y - 2}v4l3 -2zM${x + 11} ${y - 2}v4l-3 -2z`}
              fill={c}
              stroke={INK}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          ))}
        </g>
      );
    case 'christmas':
      return (
        <g>
          <g transform="translate(236 216)">
            <rect
              x="-5"
              y="-8"
              width="10"
              height="11"
              fill="#8a5a3b"
              stroke={INK}
              strokeWidth="2.4"
            />
            {[
              [-31, -6, -34],
              [-25, -26, -52],
              [-18, -44, -68],
            ].map(([w, base, top]) => (
              <path
                key={base}
                d={`M${w} ${base}L0 ${top}L${-w} ${base}Q0 ${base + 5} ${w} ${base}z`}
                fill="#3f8f5a"
                stroke={INK}
                strokeWidth="2.6"
                strokeLinejoin="round"
              />
            ))}
            {(
              [
                [-13, -12, '#e8505b'],
                [12, -15, '#f6c454'],
                [-7, -32, '#5aa9e6'],
                [9, -38, '#e8505b'],
                [-1, -54, '#f6c454'],
              ] as const
            ).map(([cx, cy, c], i) => (
              <circle
                key={i}
                className="den-bulb"
                style={delay(i * 0.4)}
                cx={cx}
                cy={cy}
                r="3.4"
                fill={c}
                stroke={INK}
                strokeWidth="1.2"
              />
            ))}
            <path
              d="M0 -80l2.4 5l5.4 .6l-4 3.7l1.1 5.3l-4.9 -2.7l-4.9 2.7l1.1 -5.3l-4 -3.7l5.4 -.6z"
              fill="#ffd34d"
              stroke={INK}
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </g>
          {(
            [
              [194, 206, 18, 14, '#c7a6e8', '#fff'],
              [268, 210, 15, 11, '#e8505b', '#f6c454'],
            ] as const
          ).map(([x, y, w, h, c, ribbon]) => (
            <g key={x}>
              <rect x={x} y={y} width={w} height={h} rx="2" fill={c} stroke={INK} strokeWidth="2" />
              <path
                d={`M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}`}
                stroke={ribbon}
                strokeWidth="2.6"
              />
              <path
                d={`M${x + w / 2} ${y}q-6 -6 -7 -1q3 3 7 1q6 -6 7 -1q-3 3 -7 1`}
                fill="none"
                stroke={INK}
                strokeWidth="1.4"
              />
            </g>
          ))}
        </g>
      );
    case 'valentine':
      return (
        <g>
          {Array.from({ length: 11 }, (_, i) => (
            <ellipse
              key={i}
              cx={70 + ((i * 97) % 260)}
              cy={244 + ((i * 29) % 30)}
              rx="4"
              ry="2.4"
              transform={`rotate(${(i * 47) % 180} ${70 + ((i * 97) % 260)} ${244 + ((i * 29) % 30)})`}
              fill={i % 2 ? '#e86f86' : '#f5a8b8'}
              opacity="0.9"
            />
          ))}
        </g>
      );
    case 'easter':
      return (
        <g>
          <Egg x={48} y={222} color="#f9c6d4" band="#e86f86" rot={-12} />
          <Egg x={214} y={230} color="#bfe0f5" band="#4f8fc0" rot={8} />
          <Egg x={352} y={252} color="#fff0a8" band="#e0a12c" rot={-6} />
          <Egg x={120} y={270} color="#d4c6f2" band="#7d62b8" rot={14} />
        </g>
      );
    case 'birthday':
      return (
        <g>
          {Array.from({ length: 16 }, (_, i) => {
            const x = 52 + ((i * 89) % 300);
            const y = 238 + ((i * 31) % 40);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width="5"
                height="3"
                transform={`rotate(${(i * 53) % 180} ${x} ${y})`}
                fill={['#f6b5c6', '#a9d2f2', '#ffe08a', '#c7a6e8', '#a7d8b8'][i % 5]}
              />
            );
          })}
          {/* a carrot cake, with one candle */}
          <g transform="translate(236 222)">
            <rect
              x="-18"
              y="-14"
              width="36"
              height="20"
              rx="4"
              fill="#f2a65a"
              stroke={INK}
              strokeWidth="2.4"
            />
            <path d="M-18 -8q9 5 18 0q9 5 18 0" fill="none" stroke="#fff6e8" strokeWidth="3" />
            <path d="M-18 -14h36" stroke="#fff6e8" strokeWidth="4" strokeLinecap="round" />
            <rect
              x="-2"
              y="-27"
              width="4"
              height="12"
              rx="1.5"
              fill="#a9d2f2"
              stroke={INK}
              strokeWidth="1.4"
            />
            <path className="den-flame" d="M0 -36q4 4 0 8q-4 -4 0 -8z" fill="#ffc94d" />
          </g>
        </g>
      );
  }
}
