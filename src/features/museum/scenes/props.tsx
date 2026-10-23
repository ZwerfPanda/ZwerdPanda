import { INK } from '../../../components/art/shapes';
import { S } from './kit';

/** Little things mini us hold or stand among. Each is drawn around (x, y). */

type At = { x: number; y: number; s?: number; r?: number };

const place = ({ x, y, s = 1, r = 0 }: At) => `translate(${x} ${y}) rotate(${r}) scale(${s})`;

export function BubbleTea({ tea = '#e9d79a', ...p }: At & { tea?: string }) {
  return (
    <g transform={place(p)}>
      <path d="M2-34L10-58" stroke="#e05a7d" strokeWidth="5" strokeLinecap="round" />
      <path d="M-12-30H12L9 8H-9Z" fill={tea} {...S} strokeWidth={2} />
      <path d="M-13-34H13V-28H-13Z" fill="#fffdf8" {...S} strokeWidth={2} />
      {[
        [-5, 2],
        [2, 4],
        [6, -1],
        [-1, -3],
        [-6, -5],
        [4, -7],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2.6" fill="#2b1d1a" />
      ))}
      <path d="M-8-24L-6 2" stroke="#fff" strokeOpacity="0.6" strokeWidth="2" />
    </g>
  );
}

export function MatchaCup(p: At) {
  return (
    <g transform={place(p)}>
      <path d="M-11-28H11L8 6H-8Z" fill="#a8c97f" {...S} strokeWidth={2} />
      <path d="M-11-18H11" stroke="#fffdf8" strokeWidth="5" opacity="0.8" />
      <path d="M-13-32H13V-26H-13Z" fill="#fffdf8" {...S} strokeWidth={2} />
      <path d="M-3-24q-4 4 0 8q4-4 0-8z" fill="#6f9160" />
    </g>
  );
}

export function ShopBag({ color = '#f2b8c6', ...p }: At & { color?: string }) {
  return (
    <g transform={place(p)}>
      <path d="M-9-24Q-9-34 0-34T9-24" fill="none" {...S} strokeWidth={2} />
      <path d="M-16-24H16L19 6H-19Z" fill={color} {...S} strokeWidth={2} />
      <path
        d="M-4-8q-4-4-8 0t8 8q12-4 8-8t-8 0z"
        transform="translate(4 -4) scale(0.7)"
        fill="#fff"
      />
    </g>
  );
}

export function RingBox(p: At) {
  return (
    <g transform={place(p)}>
      <path d="M-12-6H12V8H-12Z" fill="#c2416a" {...S} strokeWidth={2} />
      <path d="M-12-6L-10-20H10L12-6Z" fill="#d9577b" {...S} strokeWidth={2} />
      <circle cx="0" cy="-8" r="6" fill="none" stroke="#d6d9e0" strokeWidth="2.6" />
      <path d="M-3-14L0-18L3-14L0-12Z" fill="#cfe9ff" stroke="#8fb7d6" strokeWidth="1" />
      <path className="scene-sparkle" d="M14-24l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffd75e" />
    </g>
  );
}

/** The biggest plushie in the park. */
export function Plush({ color = '#c98b5e', ...p }: At & { color?: string }) {
  const inner = color === '#f7f3ee' ? '#fde3ea' : '#f2d2b6';
  return (
    <g transform={place(p)}>
      <circle cx="-30" cy="-112" r="16" fill={color} {...S} />
      <circle cx="30" cy="-112" r="16" fill={color} {...S} />
      <circle cx="-30" cy="-112" r="8" fill={inner} />
      <circle cx="30" cy="-112" r="8" fill={inner} />
      <ellipse cx="0" cy="-36" rx="46" ry="44" fill={color} {...S} />
      <ellipse cx="0" cy="-30" rx="26" ry="26" fill={inner} />
      <circle cx="0" cy="-90" r="38" fill={color} {...S} />
      <ellipse cx="0" cy="-80" rx="16" ry="12" fill={inner} />
      <circle cx="-13" cy="-98" r="4" fill={INK} />
      <circle cx="13" cy="-98" r="4" fill={INK} />
      <path d="M-4-86h8l-4 4z" fill={INK} />
      <path d="M-5-78q5 4 10 0" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <path d="M-14-58l14 6 14-6v12l-14-6-14 6z" fill="#e05a7d" {...S} strokeWidth={1.8} />
      <ellipse cx="-34" cy="2" rx="16" ry="11" fill={color} {...S} />
      <ellipse cx="34" cy="2" rx="16" ry="11" fill={color} {...S} />
    </g>
  );
}

export function Popcorn(p: At) {
  return (
    <g transform={place(p)}>
      {[
        [-12, -36],
        [-2, -42],
        [9, -37],
        [-7, -46],
        [5, -48],
        [14, -44],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="7" fill="#fff7d6" {...S} strokeWidth={1.6} />
      ))}
      <path d="M-18-34H18L13 6H-13Z" fill="#fff" {...S} strokeWidth={2} />
      {[-10, 0, 10].map((x) => (
        <path
          key={x}
          d={`M${x - 3} -34L${x * 0.75 - 2} 6H${x * 0.75 + 2}L${x + 3} -34Z`}
          fill="#d9363e"
        />
      ))}
    </g>
  );
}

/** A hot dog with heeeeel veel saus. */
export function Hotdog(p: At) {
  return (
    <g transform={place(p)}>
      <path
        d="M-26 0Q-26-12-14-12H14Q26-12 26 0Q26 8 14 8H-14Q-26 8-26 0Z"
        fill="#e8b46c"
        {...S}
        strokeWidth={2}
      />
      <rect x="-30" y="-9" width="60" height="9" rx="4.5" fill="#b4513a" {...S} strokeWidth={1.8} />
      <path
        d="M-24-9q4-7 8 0t8 0 8 0 8 0 8 0 8 0"
        fill="none"
        stroke="#e23b2e"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M-22-6q4-6 8 0t8 0 8 0 8 0 8 0"
        fill="none"
        stroke="#f2c230"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        className="scene-drip"
        d="M8 6v8"
        stroke="#e23b2e"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
      <path
        className="scene-drip scene-drip--b"
        d="M-12 6v6"
        stroke="#f2c230"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </g>
  );
}

export function Drumstick(p: At) {
  return (
    <g transform={place(p)}>
      <path d="M-2 4L-2 16" stroke="#f5ead8" strokeWidth="6" strokeLinecap="round" />
      <circle cx="-5" cy="18" r="3.4" fill="#f5ead8" />
      <circle cx="1" cy="18" r="3.4" fill="#f5ead8" />
      <path
        d="M-12-8Q-14-26 0-26Q14-26 10-6Q8 6-2 6Q-10 6-12-8Z"
        fill="#c7782f"
        {...S}
        strokeWidth={2}
      />
      <path
        d="M-6-18q2-3 5-2M2-12q3-2 5 0"
        fill="none"
        stroke="#e1a25b"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

export function ChickenBucket(p: At) {
  return (
    <g transform={place(p)}>
      {[-16, -2, 12].map((x, i) => (
        <path
          key={x}
          d={`M${x - 9} -40Q${x} -${58 + i * 3} ${x + 9} -40Z`}
          fill="#c7782f"
          {...S}
          strokeWidth={1.8}
        />
      ))}
      <path d="M-30-40H30L24 10H-24Z" fill="#fff" {...S} />
      {[-18, -6, 6, 18].map((x) => (
        <path
          key={x}
          d={`M${x - 4} -40L${x * 0.8 - 3} 10H${x * 0.8 + 3}L${x + 4} -40Z`}
          fill="#d9363e"
        />
      ))}
      <path d="M-30-40H30L24 10H-24Z" fill="none" {...S} />
    </g>
  );
}

export function Candle(p: At) {
  return (
    <g transform={place(p)}>
      <circle cx="0" cy="-26" r="14" fill="#ffd75e" opacity="0.25" className="scene-flicker" />
      <path className="scene-flicker" d="M0-34q6 8 0 12q-6-4 0-12z" fill="#ffb23f" />
      <rect x="-5" y="-22" width="10" height="24" rx="2" fill="#fff6e6" {...S} strokeWidth={1.8} />
    </g>
  );
}

export function PastaPlate(p: At) {
  return (
    <g transform={place(p)}>
      <ellipse cx="0" cy="0" rx="34" ry="10" fill="#fffdf8" {...S} strokeWidth={2} />
      <path d="M-22-2Q-20-16 0-18Q20-16 22-2Q0 4-22-2Z" fill="#f3e3b0" {...S} strokeWidth={1.8} />
      <path
        d="M-14-6q6-6 12 0t12 0M-10-11q5-4 10 0t10 0"
        fill="none"
        stroke="#e8cf86"
        strokeWidth="2"
      />
      {[
        [-8, -9],
        [6, -12],
        [12, -6],
        [-2, -4],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="#6f9a4c" />
      ))}
      <path
        className="scene-steam"
        d="M-6-24q-4-6 0-12t0-12M6-24q-4-6 0-12"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.8"
      />
    </g>
  );
}

export function Burger(p: At) {
  return (
    <g transform={place(p)}>
      <ellipse cx="0" cy="2" rx="30" ry="8" fill="#fffdf8" {...S} strokeWidth={2} />
      <path d="M-18-2H18Q20 2 16 4H-16Q-20 2-18-2Z" fill="#e2a65a" {...S} strokeWidth={1.8} />
      <rect x="-19" y="-8" width="38" height="7" rx="3" fill="#6b3a26" {...S} strokeWidth={1.8} />
      <path d="M-20-9q5 4 10 0t10 0 10 0 10 0" fill="#7fb85a" stroke="#4f7f37" strokeWidth="1.6" />
      <path d="M-18-10Q-16-28 0-28Q16-28 18-10Z" fill="#e2a65a" {...S} strokeWidth={1.8} />
      <circle cx="-6" cy="-20" r="1.4" fill="#fff6d0" />
      <circle cx="4" cy="-23" r="1.4" fill="#fff6d0" />
    </g>
  );
}

export function Pumpkin({ lit = false, ...p }: At & { lit?: boolean }) {
  return (
    <g transform={place(p)}>
      {lit && (
        <circle cx="0" cy="-14" r="30" fill="#ffb23f" opacity="0.28" className="scene-flicker" />
      )}
      <path
        d="M-2-30q2-10 8-12"
        fill="none"
        stroke="#5f7d52"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <ellipse cx="-12" cy="-14" rx="14" ry="16" fill="#e9772b" {...S} strokeWidth={2} />
      <ellipse cx="12" cy="-14" rx="14" ry="16" fill="#e9772b" {...S} strokeWidth={2} />
      <ellipse cx="0" cy="-14" rx="12" ry="17" fill="#f08a36" {...S} strokeWidth={2} />
      {lit && (
        <g fill="#ffd75e">
          <path d="M-12-20l5-6 4 6z" />
          <path d="M3-20l5-6 4 6z" />
          <path d="M-12-8q12 9 24 0l-4 2-4-3-4 3-4-3-4 3z" />
        </g>
      )}
    </g>
  );
}

export function Bat({ x, y, s = 1, delay = 0 }: At & { delay?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="scene-bat" style={{ animationDelay: `${delay}s` }}>
        <path
          d="M0 0q-6-8-14-6q-4-6-12-4q6 4 4 10q6-2 10 2q4-2 12-2zM0 0q6-8 14-6q4-6 12-4q-6 4-4 10q-6-2-10 2q-4-2-12-2z"
          fill="#1d0f22"
        />
        <circle cx="0" cy="0" r="4" fill="#1d0f22" />
      </g>
    </g>
  );
}

export function Flamingo({ flip = false, ...p }: At & { flip?: boolean }) {
  return (
    <g transform={`${place(p)} scale(${flip ? -1 : 1} 1)`}>
      <path
        d="M0 0V-46M0-30l10-8"
        fill="none"
        stroke="#e57c95"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="0" cy="-58" rx="22" ry="14" fill="#f49ab0" {...S} strokeWidth={2} />
      <path
        d="M-12-62q-12-4-6-24q4-14 14-12q6 2 4 8"
        fill="none"
        stroke="#f49ab0"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M-12-62q-12-4-6-24q4-14 14-12q6 2 4 8"
        fill="none"
        stroke={INK}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="0"
        opacity="0.25"
      />
      <path d="M6-96l8 4-4 6z" fill={INK} />
      <circle cx="3" cy="-98" r="1.6" fill={INK} />
      <path d="M14-60q8 0 10 6" fill="none" stroke="#e57c95" strokeWidth="2" />
    </g>
  );
}

export function Suitcase({ color = '#e05a7d', ...p }: At & { color?: string }) {
  return (
    <g transform={place(p)}>
      <path d="M-8-62V-74H8V-62" fill="none" {...S} strokeWidth={2.4} />
      <rect x="-24" y="-62" width="48" height="60" rx="8" fill={color} {...S} />
      <path d="M-24-40H24" stroke={INK} strokeWidth="2" />
      <circle cx="-10" cy="-26" r="6" fill="#ffd75e" />
      <path d="M6-28l3-3 3 3-3 3z" fill="#fff" />
      <circle cx="-14" cy="2" r="4" fill="#3a3a44" />
      <circle cx="14" cy="2" r="4" fill="#3a3a44" />
    </g>
  );
}

export function HotChoc(p: At) {
  return (
    <g transform={place(p)}>
      <path
        className="scene-steam"
        d="M-4-26q-4-6 0-10t0-10M5-26q-4-6 0-10"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M-11-22H11L9 4H-9Z" fill="#c2416a" {...S} strokeWidth={2} />
      <path d="M11-16q8 0 8 6t-8 6" fill="none" {...S} strokeWidth={2} />
      <ellipse cx="0" cy="-22" rx="11" ry="3" fill="#6b3a26" />
      <path d="M-6-12l2-3 2 3-2 3zM4-6l2-3 2 3-2 3z" fill="#fff" />
    </g>
  );
}

/** A Santa hat, sat on a head centred at (x, y) with head radius r. */
export function SantaHat({
  x,
  y,
  r,
  tilt = 0,
}: {
  x: number;
  y: number;
  r: number;
  tilt?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <path
        d={`M${-r} ${-r * 0.55}Q${-r * 0.2} ${-r * 2.2} ${r * 1.1} ${-r * 1.45}Q${r * 0.6} ${-r * 1.2} ${r} ${-r * 0.55}Z`}
        fill="#d9363e"
        {...S}
      />
      <rect
        x={-r * 1.08}
        y={-r * 0.78}
        width={r * 2.16}
        height={r * 0.42}
        rx={r * 0.2}
        fill="#fffdf8"
        {...S}
        strokeWidth={2}
      />
      <circle cx={r * 1.12} cy={-r * 1.42} r={r * 0.24} fill="#fffdf8" {...S} strokeWidth={2} />
    </g>
  );
}

/** A string of fairy lights from (x1, y1) to (x2, y2). */
export function Lights({
  x1,
  y1,
  x2,
  y2,
  sag = 24,
  colors = ['#ffd75e', '#ff8fa8', '#8fd3ff', '#b7f08f'],
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  sag?: number;
  colors?: string[];
}) {
  const n = Math.max(4, Math.round(Math.abs(x2 - x1) / 26));
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  const pt = (t: number) => ({
    x: (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2,
    y: (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2,
  });
  return (
    <g>
      <path
        d={`M${x1} ${y1}Q${mx} ${my} ${x2} ${y2}`}
        fill="none"
        stroke="#3a2e2a"
        strokeWidth="1.6"
      />
      {Array.from({ length: n }, (_, i) => {
        const p = pt((i + 0.5) / n);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y + 4}
            r="4"
            fill={colors[i % colors.length]}
            className="scene-bulb"
            style={{ animationDelay: `${(i % 3) * 0.5}s` }}
          />
        );
      })}
    </g>
  );
}

export function Tree({ x, y, s = 1, color = '#6fa56a' }: At & { color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-6" y="-40" width="12" height="40" fill="#7a5a3e" />
      <circle cx="0" cy="-66" r="34" fill={color} />
      <circle cx="-22" cy="-48" r="22" fill={color} />
      <circle cx="22" cy="-48" r="22" fill={color} />
    </g>
  );
}

/** A tall, narrow Amsterdam canal house with a gable. */
export function CanalHouse({
  x,
  y,
  w = 54,
  h = 150,
  color,
  gable = 'step',
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  color: string;
  gable?: 'step' | 'bell' | 'point';
}) {
  const top =
    gable === 'step'
      ? `M0 ${-h}V${-h - 10}H${w * 0.18}V${-h - 20}H${w * 0.36}V${-h - 32}H${w * 0.64}V${-h - 20}H${w * 0.82}V${-h - 10}H${w}V${-h}`
      : gable === 'bell'
        ? `M0 ${-h}Q${w * 0.1} ${-h - 18} ${w * 0.3} ${-h - 22}Q${w * 0.5} ${-h - 44} ${w * 0.7} ${-h - 22}Q${w * 0.9} ${-h - 18} ${w} ${-h}`
        : `M0 ${-h}L${w / 2} ${-h - 30}L${w} ${-h}`;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`${top}V0H0Z`} fill={color} {...S} strokeWidth={2} />
      {[0, 1, 2, 3].map((row) =>
        [0, 1].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={w * 0.16 + col * w * 0.4}
            y={-h + 14 + row * (h / 4.3)}
            width={w * 0.28}
            height={h / 7}
            rx="2"
            fill="#ffe7a8"
            stroke={INK}
            strokeWidth="1.4"
          />
        )),
      )}
    </g>
  );
}
