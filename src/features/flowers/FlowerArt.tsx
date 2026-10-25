import { FLOWER_KINDS } from './flowers';

/*
 * Drawn flowers, one for each kind in the shop, and a bouquet made of them.
 * Every head is drawn around (0, 0) at about 20 units across.
 */

const INK = '#5b2a3a';

export function FlowerHead({ kind, hue = 0 }: { kind: string; hue?: number }) {
  const name = FLOWER_KINDS.find((f) => f.name.toLowerCase() === kind.toLowerCase())?.name;
  // A little variety between stems of the same kind (plain colours: older Safari too).
  const VARIANTS: Record<string, string[]> = {
    '#ff6f91': ['#ff6f91', '#ffb347', '#f7f0e8', '#c45bd6'],
    '#ff8a3d': ['#ff8a3d', '#ff5c8a', '#ffd23f'],
    '#f2a7c4': ['#f2a7c4', '#c9b6f2', '#ffe08a'],
  };
  const tint = (base: string) => {
    const list = VARIANTS[base] ?? [base];
    return list[Math.abs(Math.round(hue / 7)) % list.length];
  };
  switch (name) {
    case 'Rozen':
      return (
        <g>
          <circle r="10" fill="#d8323c" stroke={INK} strokeWidth="1" />
          <path
            d="M-5 -2q5 -7 10 0q-3 6 -8 3q4 -2 2 -5"
            fill="none"
            stroke="#8f1d2a"
            strokeWidth="1.4"
          />
          <path d="M-8 3q8 6 16 0" fill="none" stroke="#8f1d2a" strokeWidth="1.2" />
        </g>
      );
    case 'Tulpen':
      return (
        <path
          d="M-8 -2q0 -10 4 -9l4 5l4 -5q4 -1 4 9q0 9 -8 10q-8 -1 -8 -10z"
          fill={tint('#ff6f91')}
          stroke={INK}
          strokeWidth="1"
        />
      );
    case 'Pioenrozen':
      return (
        <g stroke={INK} strokeWidth="0.8">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-6"
              rx="5.5"
              ry="6"
              fill="#f7b6cc"
              transform={`rotate(${a})`}
            />
          ))}
          <circle r="5" fill="#f28fb1" />
        </g>
      );
    case 'Zonnebloemen':
      return (
        <g>
          {Array.from({ length: 12 }, (_, i) => (
            <ellipse
              key={i}
              cx="0"
              cy="-8"
              rx="2.6"
              ry="5"
              fill="#ffc93c"
              stroke="#c98b1a"
              strokeWidth="0.6"
              transform={`rotate(${i * 30})`}
            />
          ))}
          <circle r="5.5" fill="#6b3a1a" />
          <circle r="5.5" fill="none" stroke="#3b1f0e" strokeDasharray="1 1.4" />
        </g>
      );
    case 'Lelies':
      return (
        <g stroke={INK} strokeWidth="0.8">
          {[0, 72, 144, 216, 288].map((a) => (
            <path
              key={a}
              d="M0 0l-3 -10l3 -3l3 3z"
              fill="#fff4f0"
              transform={`rotate(${a}) scale(1.1)`}
            />
          ))}
          <circle r="2" fill="#e8a33c" stroke="none" />
        </g>
      );
    case 'Gerbera’s':
      return (
        <g>
          {Array.from({ length: 14 }, (_, i) => (
            <ellipse
              key={i}
              cx="0"
              cy="-7"
              rx="1.8"
              ry="5"
              fill={tint('#ff8a3d')}
              transform={`rotate(${i * (360 / 14)})`}
            />
          ))}
          <circle r="3.6" fill="#5a3a10" />
        </g>
      );
    case 'Hortensia':
      return (
        <g>
          {[
            [0, 0],
            [-5, -4],
            [5, -4],
            [-6, 3],
            [6, 3],
            [0, -8],
            [0, 7],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              {[0, 90, 180, 270].map((a) => (
                <ellipse
                  key={a}
                  cx="0"
                  cy="-1.8"
                  rx="1.6"
                  ry="2"
                  fill="#8fb4f0"
                  transform={`rotate(${a + 45})`}
                />
              ))}
            </g>
          ))}
        </g>
      );
    case 'Lavendel':
      return (
        <g>
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse
              key={i}
              cx={i % 2 ? 1.6 : -1.6}
              cy={6 - i * 3.4}
              rx="2"
              ry="2.6"
              fill="#a98be0"
            />
          ))}
        </g>
      );
    default:
      return (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx="0"
              cy="-5"
              r="4.4"
              fill={tint('#f2a7c4')}
              transform={`rotate(${a})`}
            />
          ))}
          <circle r="3" fill="#ffd75e" />
        </g>
      );
  }
}

/** A bouquet of these flowers: stems gathered, leaves, and paper round them. */
export function BouquetArt({
  flowers,
  paper = '#f7e4d0',
  ribbon = '#e6889b',
  bare = false,
}: {
  flowers: string[];
  paper?: string;
  ribbon?: string;
  /** Without the paper (when it stands in a vase). */
  bare?: boolean;
}) {
  const kinds = flowers.length ? flowers : ['Gemengd'];
  // In a vase a bouquet is always a good handful, even when we only noted the kinds.
  const stems = (
    bare && kinds.length < 6 ? Array.from({ length: 7 }, (_, i) => kinds[i % kinds.length]) : kinds
  ).slice(0, 9);
  // Heads fanned out in a dome, nearest the middle a little higher.
  const spots = stems.map((_, i) => {
    const n = stems.length;
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = (t - 0.5) * 1.9;
    const r = 30 + (i % 2) * 7;
    return { x: 50 + Math.sin(a) * r, y: 52 - Math.cos(a) * r * 0.85 };
  });
  return (
    <svg className="bouquet-art" viewBox="0 0 100 100" aria-hidden="true">
      {spots.map((s, i) => (
        <path
          key={`s${i}`}
          d={`M${s.x} ${s.y}Q${(s.x + 50) / 2} ${70} 50 ${bare ? 100 : 86}`}
          stroke="#5f9b5a"
          strokeWidth="2"
          fill="none"
        />
      ))}
      {spots.map((s, i) => (
        <ellipse
          key={`l${i}`}
          cx={(s.x + 50) / 2 + (i % 2 ? 5 : -5)}
          cy={(s.y + 70) / 2 + 6}
          rx="7"
          ry="2.8"
          fill="#7bb373"
          transform={`rotate(${i % 2 ? 30 : -30} ${(s.x + 50) / 2} ${(s.y + 70) / 2 + 6})`}
        />
      ))}
      {spots.map((s, i) => (
        <g key={`h${i}`} transform={`translate(${s.x} ${s.y}) scale(${0.95 + (i % 3) * 0.08})`}>
          <FlowerHead kind={stems[i]} hue={(i * 17) % 30} />
        </g>
      ))}
      {!bare && (
        <>
          <path
            d="M22 58L50 100L78 58Q50 70 22 58z"
            fill={paper}
            stroke={INK}
            strokeOpacity="0.35"
            strokeWidth="1"
          />
          <path d="M30 62L50 100" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5" />
          <path d="M42 84q8 4 16 0l-2 5q-6 2 -12 0z" fill={ribbon} />
          <path d="M50 86l-7 9M50 86l7 9" stroke={ribbon} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
