import { INK } from '../../components/art/shapes';

/** Backdrops for mini us, from places in our photos. viewBox: -240 -380 480 400. */
export type Scene = 'home' | 'tram' | 'mirror';

export const SCENES: { id: Scene; label: string }[] = [
  { id: 'home', label: 'Thuis' },
  { id: 'tram', label: 'Tramhalte' },
  { id: 'mirror', label: 'Paskamer' },
];

const S = {
  stroke: INK,
  strokeWidth: 2.6,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

export function Scenery({ scene }: { scene: Scene }) {
  if (scene === 'tram') {
    return (
      <g>
        <defs>
          <linearGradient id="us-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8fc3ec" />
            <stop offset="100%" stopColor="#dff0fb" />
          </linearGradient>
        </defs>
        <rect x="-240" y="-380" width="480" height="400" fill="url(#us-sky)" />
        <path
          d="M-210 -330q16 -10 32 0q12 -8 26 0"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
        />
        <path
          d="M110 -300q16 -10 32 0q12 -8 26 0"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
        />
        {/* trees */}
        <circle cx="-190" cy="-150" r="56" fill="#6fa56a" />
        <circle cx="-140" cy="-180" r="44" fill="#7fb877" />
        <rect x="-176" y="-110" width="12" height="70" fill="#7a5a3e" />
        {/* overhead wire poles */}
        <path d="M150 -330V-40M60 -320V-40" stroke="#7d8c86" strokeWidth="5" />
        <path d="M-240 -300H240M-240 -290H240" stroke="#59605e" strokeWidth="1.5" />
        <path d="M150 -300h-40M60 -290h-30" stroke="#7d8c86" strokeWidth="3" />
        {/* tracks and platform */}
        <rect x="-240" y="-60" width="480" height="80" fill="#c7c0b4" />
        <path d="M-240 -40H240" stroke="#f3e2a4" strokeWidth="6" strokeDasharray="10 6" />
        <path d="M-240 -60H240" stroke={INK} strokeWidth="2.6" />
        <path d="M-240 -88H240M-240 -76H240" stroke="#6c6763" strokeWidth="3" />
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} d={`M${-236 + i * 31} -92v20`} stroke="#8a7562" strokeWidth="4" />
        ))}
        {/* stop sign */}
        <g transform="translate(196 -70)">
          <path d="M0 0V-150" stroke="#55606a" strokeWidth="5" />
          <rect x="-26" y="-190" width="52" height="40" rx="6" fill="#2b5aa6" {...S} />
          <text
            x="0"
            y="-173"
            textAnchor="middle"
            fontSize="10"
            fontWeight="800"
            fill="#fff"
            fontFamily="system-ui"
          >
            HALTE
          </text>
          <text x="0" y="-160" textAnchor="middle" fontSize="8" fill="#fff" fontFamily="system-ui">
            Den Haag
          </text>
        </g>
      </g>
    );
  }
  if (scene === 'mirror') {
    return (
      <g>
        <rect x="-240" y="-380" width="480" height="400" fill="#efe5dc" />
        {/* curtains like the fitting rooms in our photos */}
        {[-240, 170].map((x) => (
          <g key={x}>
            <rect x={x} y="-380" width="70" height="400" fill="#c99b98" />
            {[10, 26, 42, 58].map((dx) => (
              <path key={dx} d={`M${x + dx} -380v400`} stroke="#b3807d" strokeWidth="3" />
            ))}
          </g>
        ))}
        <path d="M-240 -372H240" stroke="#2b2a2d" strokeWidth="4" />
        {/* mirror */}
        <rect
          x="-150"
          y="-370"
          width="300"
          height="372"
          rx="8"
          fill="#e9eef1"
          stroke="#c9a27a"
          strokeWidth="10"
        />
        <path
          d="M-120 -340l60 -20M-110 -300l90 -30"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.7"
        />
        <rect x="-240" y="-20" width="480" height="40" fill="#d8d0c8" />
      </g>
    );
  }
  return (
    <g>
      <rect x="-240" y="-380" width="480" height="400" fill="#f6e9df" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={i} x={-236 + i * 30} y="-380" width="12" height="320" fill="#f1e0d4" />
      ))}
      {/* window with the evening sky */}
      <rect x="-200" y="-330" width="110" height="120" rx="10" fill="#f3b48f" {...S} />
      <circle cx="-150" cy="-250" r="16" fill="#ffd67e" />
      <path d="M-145 -330v120M-200 -270h110" stroke={INK} strokeWidth="3" />
      {/* framed heart */}
      <rect x="110" y="-320" width="64" height="56" rx="6" fill="#fffaf2" {...S} />
      <path
        d="M142 -278l-13 -13a8 8 0 0 1 13 -9a8 8 0 0 1 13 9z"
        fill="#e6889b"
        stroke={INK}
        strokeWidth="2"
      />
      {/* plant */}
      <path d="M190 -60h34l-6 -40h-22z" fill="#d8a06c" {...S} />
      <path
        d="M207 -100q-20 -40 -6 -70q10 30 6 70zM207 -100q20 -40 6 -70q-10 30 -6 70z"
        fill="#79ad6c"
        {...S}
      />
      {/* floor and rug */}
      <rect x="-240" y="-60" width="480" height="80" fill="#d9b48f" />
      <path d="M-240 -60H240" stroke={INK} strokeWidth="2.6" />
      <ellipse cx="0" cy="-6" rx="210" ry="22" fill="#f1c3cb" />
      <ellipse
        cx="0"
        cy="-6"
        rx="186"
        ry="15"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeDasharray="6 7"
        opacity="0.6"
      />
    </g>
  );
}
