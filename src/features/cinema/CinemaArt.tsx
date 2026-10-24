import { useContent } from '../../data/store';
import { INK } from '../../components/art/shapes';
import { GENRES, filmsByNewest } from './cinema';
import './cinema.css';

const S = {
  stroke: INK,
  strokeWidth: 2.6,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;

/**
 * The front of our cinema at night, in the stage's viewBox (-240 -380 480 400,
 * feet on y = 0): a marquee in lights with what's on, posters by the doors and
 * a red carpet for mini us to stand on.
 */
export function CinemaFacade({ title, genres }: { title?: string; genres: string[] }) {
  const bulbs = Array.from({ length: 22 }, (_, i) => i);
  const posterFill = (i: number) => {
    const g = GENRES[genres[i] as keyof typeof GENRES];
    return g ? [g.from, g.to] : ['#f7c6d0', '#c45b7c'];
  };
  return (
    <g className="cin-facade">
      <defs>
        <linearGradient id="cin-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c1238" />
          <stop offset="1" stopColor="#3b2150" />
        </linearGradient>
        <linearGradient id="cin-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a2a3c" />
          <stop offset="1" stopColor="#5d1726" />
        </linearGradient>
        <linearGradient id="cin-door" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3a3" />
          <stop offset="1" stopColor="#f2a65a" />
        </linearGradient>
        {[0, 1].map((i) => (
          <linearGradient key={i} id={`cin-poster-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={posterFill(i)[0]} />
            <stop offset="1" stopColor={posterFill(i)[1]} />
          </linearGradient>
        ))}
      </defs>
      <rect x="-240" y="-380" width="480" height="400" fill="url(#cin-night)" />
      {[
        [-226, -364],
        [-190, -352],
        [-214, -330],
        [180, -366],
        [222, -350],
        [200, -332],
      ].map(([cx, cy], i) => (
        <circle
          key={i}
          className="cin-twinkle"
          cx={cx}
          cy={cy}
          r={i % 2 ? 1.8 : 2.6}
          fill="#fff6e2"
        />
      ))}
      {/* the building */}
      <rect x="-226" y="-330" width="452" height="340" fill="url(#cin-wall)" {...S} />
      <path d="M-226 -330H226" stroke="#ffcf70" strokeWidth="5" />
      {/* the marquee, up on the roof so mini us never stand in front of it */}
      <g>
        <path d="M-150 -374H150L138 -316H-138Z" fill="#fff4dc" {...S} />
        <rect x="-130" y="-368" width="260" height="46" rx="6" fill="#1d1428" />
        <text
          x="0"
          y="-350"
          textAnchor="middle"
          fontSize="13"
          fontWeight="800"
          letterSpacing="3"
          fill="#ffcf70"
          fontFamily="system-ui"
        >
          ONZE BIOS ♡
        </text>
        <text
          x="0"
          y="-331"
          textAnchor="middle"
          fontSize="11.5"
          fontWeight="700"
          fill="#fff"
          fontFamily="system-ui"
        >
          {title ? `NU: ${clip(title.toUpperCase(), 24)}` : 'BINNENKORT: ONZE EERSTE FILM'}
        </text>
        {bulbs.map((i) => {
          const top = i < 11;
          const x = -140 + (i % 11) * 28;
          return (
            <circle
              key={i}
              className="cin-bulb"
              style={{ animationDelay: `${(i % 3) * 0.33}s` }}
              cx={x}
              cy={top ? -374 : -316}
              r="4"
              fill="#ffe08a"
            />
          );
        })}
      </g>
      {/* the neon sign on the side */}
      <g transform="translate(-200 -200)">
        <rect x="-14" y="-90" width="34" height="150" rx="8" fill="#2b1236" {...S} />
        {'BIOS'.split('').map((ch, i) => (
          <text
            key={ch}
            className="cin-neon"
            x="3"
            y={-58 + i * 34}
            textAnchor="middle"
            fontSize="24"
            fontWeight="900"
            fill="#ff8fb8"
            fontFamily="system-ui"
          >
            {ch}
          </text>
        ))}
      </g>
      {/* posters by the doors */}
      {[-150, 150].map((x, i) => (
        <g key={x} transform={`translate(${x} -150)`}>
          <rect x="-30" y="-46" width="60" height="88" rx="4" fill="#ffcf70" {...S} />
          <rect x="-24" y="-40" width="48" height="76" rx="2" fill={`url(#cin-poster-${i})`} />
          <path d="M0 -12l-9 -9a5.5 5.5 0 0 1 9 -7a5.5 5.5 0 0 1 9 7z" fill="#fff" opacity="0.85" />
          <rect x="-16" y="6" width="32" height="5" rx="2" fill="#fff" opacity="0.8" />
          <rect x="-11" y="15" width="22" height="3" rx="1.5" fill="#fff" opacity="0.6" />
        </g>
      ))}
      {/* the doors, warm light inside */}
      <rect x="-96" y="-196" width="192" height="196" rx="6" fill="url(#cin-door)" {...S} />
      <path d="M0 -196V0M-48 -196V0M48 -196V0" stroke="#c98b4a" strokeWidth="3" />
      <circle cx="-8" cy="-96" r="4" fill={INK} />
      <circle cx="8" cy="-96" r="4" fill={INK} />
      {/* red carpet, velvet ropes */}
      <path d="M-120 20L-90 -8H90L120 20Z" fill="#c62f45" {...S} />
      {[-200, 200].map((x) => (
        <g key={x}>
          <path d={`M${x} 0V-58`} stroke="#d9a441" strokeWidth="6" />
          <circle cx={x} cy="-62" r="7" fill="#ffcf70" {...S} strokeWidth={2} />
        </g>
      ))}
      <path d="M-200 -50Q-160 -24 -120 -50" fill="none" stroke="#a3172b" strokeWidth="6" />
      <path d="M200 -50Q160 -24 120 -50" fill="none" stroke="#a3172b" strokeWidth="6" />
    </g>
  );
}

/** The facade as a backdrop for mini us, with whatever is on right now. */
export function CinemaBackdrop() {
  const films = useContent((c) => c.cinema.films);
  const newest = filmsByNewest(films);
  return <CinemaFacade title={newest[0]?.title} genres={newest.slice(0, 2).map((f) => f.genre)} />;
}

/**
 * Us from behind, in the front row: her long hair, his curls, our snacks on
 * the armrest between us, and Coco's ears peeking over the next seat.
 */
export function SeatRow({ snacks, close }: { snacks: string[]; close: boolean }) {
  return (
    <svg className="cin-seats" viewBox="-300 -150 600 170" aria-hidden="true">
      {/* Coco, a seat over */}
      <g className="cin-coco">
        <ellipse cx="150" cy="-62" rx="7" ry="22" fill="#e9dccf" transform="rotate(-10 150 -62)" />
        <ellipse cx="166" cy="-62" rx="7" ry="22" fill="#e9dccf" transform="rotate(10 166 -62)" />
        <ellipse cx="150" cy="-62" rx="3" ry="15" fill="#f2b8c6" transform="rotate(-10 150 -62)" />
        <ellipse cx="166" cy="-62" rx="3" ry="15" fill="#f2b8c6" transform="rotate(10 166 -62)" />
      </g>
      {/* her */}
      <g className={`cin-head cin-head--her${close ? ' is-close' : ''}`}>
        <path
          d="M-50 -132c-30 0 -42 22 -42 50c0 26 -6 44 -12 56h108c-6 -12 -12 -30 -12 -56c0 -28 -12 -50 -42 -50z"
          fill="#1c0d15"
          stroke="#c98a8a"
          strokeOpacity="0.45"
          strokeWidth="2"
        />
        <path
          d="M-82 -100q32 -26 64 0"
          fill="none"
          stroke="#3a2621"
          strokeWidth="3"
          opacity="0.7"
        />
      </g>
      {/* him */}
      <g className={`cin-head cin-head--him${close ? ' is-close' : ''}`}>
        {[-28, -14, 0, 14, 28].map((dx) => (
          <circle
            key={dx}
            cx={50 + dx}
            cy={-122 + Math.abs(dx) * 0.3}
            r="11"
            fill="#1c0d15"
            stroke="#c98a8a"
            strokeOpacity="0.45"
            strokeWidth="2"
          />
        ))}
        <ellipse cx="50" cy="-82" rx="36" ry="42" fill="#1c0d15" />
      </g>
      {[-250, -150, -50, 50, 150, 250].map((x) => (
        <Seat key={x} x={x} />
      ))}
      {/* the armrest between us, with our snacks */}
      <rect x="-12" y="-40" width="24" height="60" rx="8" fill="#3d0d17" />
      <text x="0" y="-44" textAnchor="middle" fontSize="26">
        {snacks.slice(0, 3).join('')}
      </text>
      {close && (
        <path
          className="cin-love"
          d="M0 -96l-12 -12a7.5 7.5 0 0 1 12 -9a7.5 7.5 0 0 1 12 9z"
          fill="#ff8fb8"
        />
      )}
    </svg>
  );
}

function Seat({ x }: { x: number }) {
  return (
    <path
      d={`M${x - 46} 20V-40Q${x - 46} -66 ${x - 20} -66H${x + 20}Q${x + 46} -66 ${x + 46} -40V20Z`}
      fill="#7a1626"
      stroke="#2a0710"
      strokeWidth="3"
    />
  );
}
