import { createContext, useContext, type ReactNode } from 'react';
import type { Person, UsContent } from '../../../data/types';
import { INK } from '../../../components/art/shapes';
import { Figure, bodyFrame, type Face, type Piece, type Pose } from '../../us/Figure';
import { choreograph, type Step } from '../../us/choreo';
import type { MomentKind } from '../../us/lines';

/**
 * The building blocks of a museum scene. Every scene uses the stage's viewBox
 * (-240 -380 480 400), with feet on y = 0, so mini us are drawn true to size.
 */

export const S = {
  stroke: INK,
  strokeWidth: 2.6,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

const UsCtx = createContext<UsContent | null>(null);

export function UsProvider({ us, children }: { us: UsContent; children: ReactNode }) {
  return <UsCtx.Provider value={us}>{children}</UsCtx.Provider>;
}

export function useUs(): UsContent {
  const us = useContext(UsCtx);
  if (!us) throw new Error('Scene needs <UsProvider>');
  return us;
}

type P = { x: number; y: number };

export interface MiniProps {
  who: Person;
  x: number;
  y?: number;
  /** Size; 1 is true to life on the stage. */
  s?: number;
  pose?: Pose;
  face?: Face;
  toward?: 1 | -1;
  lean?: number;
  tilt?: number;
  dip?: number;
  tiptoe?: number;
  hands?: { left?: P; right?: P };
  pieces?: Piece[];
}

/** One of us, somewhere in a scene. */
export function Mini({ who, x, y = 0, s = 1, toward, ...rest }: MiniProps) {
  const us = useUs();
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Figure
        who={who}
        look={us[who].look}
        heightCm={us[who].heightCm}
        toward={toward ?? (who === 'partner' ? 1 : -1)}
        {...rest}
      />
    </g>
  );
}

/** Where a hand ends up in the scene, for a hand target given to `Mini`. */
export const at = (x: number, y: number, s: number, hand: P): P => ({
  x: x + hand.x * s,
  y: y + hand.y * s,
});

/** Our real heights in stage units, to line things up with heads and hands. */
export function useFrames() {
  const us = useUs();
  return {
    her: bodyFrame('partner', us.partner.heightCm),
    him: bodyFrame('you', us.you.heightCm),
  };
}

/**
 * One of mini us's moments (a hug, a forehead kiss, heart hands…) frozen at
 * its sweetest step, shifted to `dx` and scaled around the feet.
 */
export function Moment({
  kind,
  dx = 0,
  y = 0,
  s = 1,
  tweak,
}: {
  kind: MomentKind;
  dx?: number;
  y?: number;
  s?: number;
  tweak?: (step: Step) => Step;
}) {
  const us = useUs();
  const steps = choreograph(kind, { partner: us.partner.heightCm, you: us.you.heightCm });
  let step = steps[steps.length - 1].step;
  if (tweak) step = tweak(step);
  return (
    <g transform={`translate(${dx} ${y}) scale(${s})`}>
      {step.order.map(([who, pieces]) => {
        const f = step.fig[who];
        return (
          <g key={`${who}-${pieces?.join('') ?? 'all'}`} transform={`translate(${f.x} 0)`}>
            <Figure
              who={who}
              look={us[who].look}
              heightCm={us[who].heightCm}
              pieces={pieces}
              pose={f.pose}
              face={f.face}
              toward={who === 'partner' ? 1 : -1}
              lean={f.lean}
              tilt={f.tilt}
              dip={f.dip}
              tiptoe={f.tiptoe}
              hands={f.hands}
            />
          </g>
        );
      })}
    </g>
  );
}

/* ----------------------------------------------------------------- decor */

export function Backdrop({ from, to, id }: { from: string; to: string; id: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect x="-240" y="-380" width="480" height="400" fill={`url(#${id})`} />
    </>
  );
}

export function Floor({ color, line = INK, y = -8 }: { color: string; line?: string; y?: number }) {
  return (
    <>
      <rect x="-240" y={y} width="480" height={28 - y} fill={color} />
      <path d={`M-240 ${y}H240`} stroke={line} strokeWidth="2.6" />
    </>
  );
}

export function Stars({
  n = 14,
  seed = 1,
  fill = '#fff6e2',
}: {
  n?: number;
  seed?: number;
  fill?: string;
}) {
  return (
    <g className="scene-twinkle">
      {Array.from({ length: n }, (_, i) => {
        const x = -230 + ((i * 97 + seed * 31) % 460);
        const y = -370 + ((i * 53 + seed * 17) % 170);
        return <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 2.2 : 1.3} fill={fill} />;
      })}
    </g>
  );
}

export function Moon({
  x,
  y,
  r = 22,
  fill = '#fff3c7',
}: {
  x: number;
  y: number;
  r?: number;
  fill?: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 14} fill={fill} opacity="0.18" />
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x + r * 0.35} cy={y - r * 0.2} r={r * 0.18} fill="#000" opacity="0.06" />
    </g>
  );
}

/** Little hearts that float up from a point, forever. */
export function RisingHearts({
  x,
  y,
  color = '#e6627f',
}: {
  x: number;
  y: number;
  color?: string;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          className="scene-heart"
          style={{ animationDelay: `${i * 0.9}s` }}
          transform={`translate(${(i - 1) * 16} 0)`}
          d="M0 6C-9 0-11-6-7-9-4-11-1-10 0-7 1-10 4-11 7-9 11-6 9 0 0 6Z"
          fill={color}
        />
      ))}
    </g>
  );
}

/** A speech bubble with a tail pointing down to (tx, ty). */
export function Say({
  x,
  y,
  text,
  tx,
  ty,
  w,
  size = 15,
}: {
  x: number;
  y: number;
  text: string;
  tx: number;
  ty: number;
  w?: number;
  size?: number;
}) {
  const width = w ?? Math.max(44, text.length * size * 0.55 + 22);
  return (
    <g className="scene-say">
      <path
        d={`M${x - width / 2 + 14} ${y + 14}L${tx} ${ty}L${x - width / 2 + 34} ${y + 14}`}
        fill="#fffdf8"
        {...S}
        strokeWidth={2}
      />
      <rect
        x={x - width / 2}
        y={y - 16}
        width={width}
        height="32"
        rx="16"
        fill="#fffdf8"
        {...S}
        strokeWidth={2}
      />
      <text
        x={x}
        y={y + 5}
        textAnchor="middle"
        fontSize={size}
        fontFamily="var(--font-hand)"
        fontWeight="600"
        fill={INK}
      >
        {text}
      </text>
    </g>
  );
}

/** A sign with words on it (station signs, shop names). */
export function Sign({
  x,
  y,
  w,
  h = 30,
  text,
  bg,
  fg = '#fff',
  size = 15,
  font = 'var(--font-body)',
  weight = 800,
  rx = 5,
}: {
  x: number;
  y: number;
  w: number;
  h?: number;
  text: string;
  bg: string;
  fg?: string;
  size?: number;
  font?: string;
  weight?: number;
  rx?: number;
}) {
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={rx}
        fill={bg}
        {...S}
        strokeWidth={2}
      />
      <text
        x={x}
        y={y + size * 0.36}
        textAnchor="middle"
        fontSize={size}
        fontFamily={font}
        fontWeight={weight}
        fill={fg}
      >
        {text}
      </text>
    </g>
  );
}
