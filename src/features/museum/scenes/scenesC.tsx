import { INK } from '../../../components/art/shapes';
import { rotate } from '../../us/choreo';
import {
  Backdrop,
  Floor,
  Mini,
  Moment,
  Moon,
  RisingHearts,
  S,
  Say,
  Sign,
  Stars,
  useFrames,
} from './kit';
import { Bat, CanalHouse, HotChoc, Lights, Pumpkin, SantaHat, Suitcase, Tree } from './props';

/** Where a head ends up when it tilts (it turns around the neck). */
function headAt(x: number, cy: number, shY: number, tilt: number) {
  const p = rotate({ x: 0, y: cy }, { x: 0, y: shY }, tilt);
  return { x: x + p.x, y: p.y };
}

/* Madurodam: two giants in a tiny Holland. We left quite quickly. */
export function MiniatureScene() {
  return (
    <g>
      <Backdrop id="sc-mini" from="#a8d8f0" to="#e6f5fb" />
      <Floor color="#9cc98b" y={-90} />
      {/* tiny Holland */}
      <g>
        {[
          [-236, 46, '#a8574a', 'step'],
          [-216, 54, '#d49a5c', 'bell'],
          [-196, 42, '#6d7f97', 'point'],
        ].map(([x, h, c, g]) => (
          <CanalHouse
            key={x as number}
            x={x as number}
            y={-96}
            w={20}
            h={h as number}
            color={c as string}
            gable={g as 'step'}
          />
        ))}
        <g transform="translate(190 -96) scale(0.5)">
          <path d="M-10 0L-6-60H6L10 0Z" fill="#8a6a4f" {...S} />
          <g className="scene-spin" style={{ transformOrigin: '0px -58px' }}>
            <path
              d="M0-58L-3-98H3ZM0-58L40-61V-55ZM0-58L3-18H-3ZM0-58L-40-55V-61Z"
              fill="#fff6e6"
              {...S}
              strokeWidth={1.6}
            />
          </g>
        </g>
        <path d="M-240-50H240" stroke="#7d6a57" strokeWidth="3" />
        <g className="scene-minitrain">
          <rect
            x="-30"
            y="-64"
            width="60"
            height="16"
            rx="5"
            fill="#ffc917"
            {...S}
            strokeWidth={1.6}
          />
          <rect x="-24" y="-60" width="10" height="6" rx="1" fill="#2c3e57" />
          <rect x="-8" y="-60" width="10" height="6" rx="1" fill="#2c3e57" />
          <rect x="8" y="-60" width="10" height="6" rx="1" fill="#2c3e57" />
        </g>
      </g>
      <Mini who="partner" x={-60} face="grin" tilt={6} hands={{ right: { x: 70, y: -200 } }} />
      <Mini who="you" x={80} pose="shrug" face="grin" tilt={-4} />
      <path d="M210-20V-110" stroke="#7a5a3e" strokeWidth="5" />
      <Sign x={196} y={-126} w={110} h={28} text="uitgang →" bg="#5f7d52" size={14} />
      <Say x={-110} y={-330} text="oké… we gaan weer 😅" tx={-70} ty={-262} w={180} />
    </g>
  );
}

/* The pumpkin patch in Almere: spooky, perfect pumpkins, and me being the scariest. */
export function PumpkinScene() {
  const { him } = useFrames();
  const head = headAt(84, him.cy, him.shY, -6);
  return (
    <g>
      <Backdrop id="sc-pumpkin" from="#120a1e" to="#3d1d2c" />
      <Stars n={14} seed={13} fill="#ffe2b8" />
      <Moon x={150} y={-306} r={34} fill="#ffb054" />
      <Bat x={-150} y={-320} s={1.1} />
      <Bat x={-60} y={-290} s={0.8} delay={0.7} />
      <Bat x={60} y={-340} s={0.9} delay={1.4} />
      {/* the maze */}
      <rect x="-240" y="-170" width="160" height="110" fill="#2d4a2a" {...S} />
      <rect x="-200" y="-140" width="36" height="80" fill="#120a1e" />
      <path d="M-120-60V-170" stroke="#4a6a40" strokeWidth="2" />
      <path d="M-170-160V-196" stroke="#7a5a3e" strokeWidth="4" />
      <Sign x={-170} y={-208} w={92} h={26} text="DOOLHOF" bg="#7a4b3a" size={13} />
      {/* a spider web */}
      <g stroke="#d9d0e6" strokeWidth="1.2" fill="none" opacity="0.7">
        <path d="M240-380L180-320M240-380L200-300M240-380L226-300" />
        <path d="M222-362q-8 6-14 0M212-344q-12 10-22 2M204-326q-16 12-30 4" />
      </g>
      {/* fog */}
      <g className="scene-fog" fill="#fff" opacity="0.08">
        <ellipse cx="-120" cy="-40" rx="160" ry="26" />
        <ellipse cx="160" cy="-30" rx="180" ry="24" />
      </g>
      <Floor color="#4a3020" line="#1d0f12" y={-60} />
      {/* the patch */}
      <Pumpkin x={-200} y={-40} s={1.1} lit />
      <Pumpkin x={196} y={-46} s={1.3} lit />
      <Pumpkin x={140} y={-20} s={0.8} />
      <Pumpkin x={-140} y={-16} s={0.7} />
      {/* her, with the perfect pumpkin — and me, jumping out */}
      <Mini
        who="partner"
        x={-62}
        face="talk"
        tilt={-10}
        lean={-5}
        hands={{ right: { x: 8, y: -128 }, left: { x: -10, y: -128 } }}
      />
      <Pumpkin x={-62} y={-106} s={0.95} />
      <Mini who="you" x={84} pose="shrug" face="grin" tilt={-6} />
      {/* the scariest thing in the patch: my mask */}
      <g transform={`translate(${head.x} ${head.y}) rotate(-6)`}>
        <path d="M-34 6Q-36-40 0-42Q36-40 34 6Q30 40 0 44Q-30 40-34 6Z" fill="#f2efe6" {...S} />
        <ellipse cx="-13" cy="-4" rx="9" ry="12" fill="#1d0f12" />
        <ellipse cx="13" cy="-4" rx="9" ry="12" fill="#1d0f12" />
        <path
          d="M-14 22l5-6 5 6 4-6 4 6 4-6 5 6"
          fill="none"
          stroke="#1d0f12"
          strokeWidth="3"
          strokeLinejoin="round"
        />
      </g>
      <Say x={150} y={-370} text="BOE!! 👻" tx={110} ty={-320} w={100} />
      <Say x={-150} y={-300} text="AAAH 😱" tx={-80} ty={-252} w={100} />
    </g>
  );
}

/* A private spa: only us. */
export function SpaScene() {
  return (
    <g>
      <Backdrop id="sc-spa" from="#2e3f4a" to="#5d7a7d" />
      {/* tiles and plants */}
      {Array.from({ length: 6 }, (_, i) => (
        <path
          key={i}
          d={`M-240 ${-340 + i * 50}H240`}
          stroke="#ffffff"
          strokeOpacity="0.07"
          strokeWidth="2"
        />
      ))}
      <Tree x={-206} y={-110} s={0.8} color="#5f8a5a" />
      <Tree x={210} y={-110} s={0.7} color="#6f9a5f" />
      <g
        className="scene-steam"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.35"
      >
        <path d="M-60-200q-10-20 0-40t0-40" />
        <path d="M40-210q-10-20 0-40t0-40" />
        <path d="M120-190q-10-20 0-40" />
      </g>
      {/* us, in the warm water */}
      <Mini who="partner" x={-26} y={44} face="happy" tilt={16} lean={4} />
      <Mini who="you" x={46} y={54} face="happy" tilt={-6} />
      <rect x="-210" y="-118" width="420" height="40" fill="#7fc7c9" opacity="0.88" />
      <path
        d="M-210-118q26-8 52 0t52 0 52 0 52 0 52 0 52 0 52 0 52 0"
        fill="none"
        stroke="#e6fbfb"
        strokeWidth="3"
      />
      <g className="scene-bubbles" fill="#e6fbfb" opacity="0.8">
        {[-150, -96, -40, 20, 84, 140].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={-108}
            r={4 + (i % 3)}
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
      </g>
      {[
        [-120, -110],
        [-70, -104],
        [110, -110],
        [150, -100],
      ].map(([x, y], i) => (
        <path
          key={i}
          d={`M${x} ${y}q-6-6 0-10q6 4 0 10z`}
          fill="#e6627f"
          transform={`rotate(${i * 40} ${x} ${y})`}
        />
      ))}
      <rect x="-222" y="-84" width="444" height="12" rx="6" fill="#e9e1d4" {...S} />
      <rect x="-216" y="-72" width="432" height="92" fill="#cfe3e6" {...S} />
      {[-150, -80, -10, 60, 130].map((x) => (
        <path key={x} d={`M${x} -72V20`} stroke="#b4cfd3" strokeWidth="2" />
      ))}
      {/* candles and towels */}
      {[-180, -150, 150, 180].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={-104} r="12" fill="#ffd75e" opacity="0.25" className="scene-flicker" />
          <path className="scene-flicker" d={`M${x}-110q4 6 0 9q-4-3 0-9z`} fill="#ffb23f" />
          <rect
            x={x - 5}
            y={-102}
            width="10"
            height={14 + (i % 2) * 6}
            fill="#fff6e6"
            stroke={INK}
            strokeWidth="1.4"
          />
        </g>
      ))}
      <g transform="translate(0 -20)">
        <rect x="-50" y="-10" width="44" height="24" rx="12" fill="#fff" {...S} strokeWidth={2} />
        <rect x="6" y="-10" width="44" height="24" rx="12" fill="#f5dad6" {...S} strokeWidth={2} />
      </g>
      <RisingHearts x={10} y={-260} color="#ffd6e7" />
    </g>
  );
}

/* Two weeks of holiday in December. */
export function HolidayScene() {
  return (
    <g>
      <Backdrop id="sc-holiday" from="#ffb98c" to="#ffe6c4" />
      <circle cx="0" cy="-220" r="60" fill="#fff1c7" opacity="0.8" />
      <g className="scene-plane">
        <path
          d="M0 0L60-6L74 0L60 6ZM28-4L14-24H24L44-4ZM28 4L14 24H24L44 4ZM62-4L56-14H62L68-4Z"
          fill="#fff"
          {...S}
          strokeWidth={1.8}
        />
      </g>
      {/* the departures board */}
      <rect x="10" y="-372" width="220" height="60" rx="8" fill="#1f2a44" {...S} />
      <text
        x="24"
        y="-346"
        fontFamily="var(--font-body)"
        fontWeight="700"
        fontSize="14"
        fill="#ffd27a"
      >
        DEC
      </text>
      <text
        x="66"
        y="-346"
        fontFamily="var(--font-body)"
        fontWeight="700"
        fontSize="14"
        fill="#fff"
      >
        ✈ 2 weken · samen
      </text>
      <text
        x="24"
        y="-324"
        fontFamily="var(--font-body)"
        fontWeight="700"
        fontSize="12"
        fill="#9fe39a"
        className="scene-blink"
      >
        on time ♡
      </text>
      <Floor color="#e8d6c2" />
      <Suitcase x={-150} y={0} s={1.2} />
      <Suitcase x={160} y={0} s={1.3} color="#5b9bd5" />
      <Mini who="partner" x={-62} pose="wave" face="grin" tilt={4} />
      <Mini who="you" x={70} pose="peace" face="grin" tilt={-4} />
      <Say x={-120} y={-300} text="vakantie, here we come ☀️" tx={-70} ty={-262} w={200} />
    </g>
  );
}

/* A cute Christmas date. */
export function ChristmasScene() {
  const { her, him } = useFrames();
  const hers = headAt(-62, her.cy, her.shY, 6);
  const his = headAt(70, him.cy, him.shY, -4);
  return (
    <g>
      <Backdrop id="sc-xmas" from="#14213d" to="#2f4b7c" />
      <Stars n={12} seed={21} />
      {/* the tree */}
      <g transform="translate(-170 -40)">
        <path d="M0-270L-60-150H-30L-80-60H80L30-150H60Z" fill="#2f7a4a" {...S} />
        <path
          d="M0-284l6 14 15 1-12 9 4 15-13-8-13 8 4-15-12-9 15-1z"
          fill="#ffd75e"
          className="scene-sparkle"
        />
        {[
          [-20, -190, '#e05a7d'],
          [16, -170, '#ffd75e'],
          [-36, -110, '#8fd3ff'],
          [30, -100, '#e05a7d'],
          [0, -130, '#fff'],
        ].map(([x, y, c], i) => (
          <circle
            key={i}
            cx={x as number}
            cy={y as number}
            r="6"
            fill={c as string}
            stroke={INK}
            strokeWidth="1.4"
          />
        ))}
        <rect x="-10" y="-60" width="20" height="26" fill="#7a5a3e" />
      </g>
      {/* a market stall */}
      <path d="M100-200H240V-60H100Z" fill="#7a4b3a" {...S} />
      <path d="M90-200L120-244H240V-200Z" fill="#d9363e" {...S} />
      <Lights x1={-240} y1={-300} x2={240} y2={-290} sag={30} />
      <Floor color="#eef3fb" line="#b9c6dc" />
      <Mini who="partner" x={-62} face="happy" tilt={6} hands={{ right: { x: 18, y: -150 } }} />
      <HotChoc x={-44} y={-144} s={1} />
      <Mini who="you" x={70} face="grin" tilt={-4} hands={{ left: { x: -20, y: -182 } }} />
      <HotChoc x={50} y={-176} s={1} />
      <SantaHat x={hers.x} y={hers.y} r={her.headR} tilt={6} />
      <SantaHat x={his.x} y={his.y} r={him.headR} tilt={-4} />
      {/* snow */}
      <g className="scene-snow" fill="#fff">
        {Array.from({ length: 26 }, (_, i) => (
          <circle
            key={i}
            cx={-230 + ((i * 71) % 460)}
            cy={-380 + ((i * 37) % 120)}
            r={1.6 + (i % 3)}
            style={{ animationDelay: `${-(i % 7) * 0.9}s`, animationDuration: `${5 + (i % 4)}s` }}
          />
        ))}
      </g>
      <RisingHearts x={0} y={-300} color="#ff9fb7" />
    </g>
  );
}

/* Any date: just us, heart hands. */
export function DateScene() {
  return (
    <g>
      <Backdrop id="sc-date" from="#ffe1ea" to="#fdf0e6" />
      {[
        [-190, -300],
        [180, -320],
        [-150, -180],
        [200, -170],
      ].map(([x, y], i) => (
        <path
          key={i}
          d="M0 8C-12 0-14-8-9-12-5-15-1-13 0-9 1-13 5-15 9-12 14-8 12 0 0 8Z"
          transform={`translate(${x} ${y}) scale(${1.6 - (i % 2) * 0.5})`}
          fill="#f7b6c6"
        />
      ))}
      <Floor color="#f3d3dc" />
      <Moment kind="heart" />
      <RisingHearts x={0} y={-300} />
    </g>
  );
}
