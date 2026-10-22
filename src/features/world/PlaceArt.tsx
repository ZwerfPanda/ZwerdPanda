import { CocoFigure } from '../../components/art/SampleArt';
import { HeartShape, INK, StarShape } from '../../components/art/shapes';

/**
 * Our Little World's buildings. Each is drawn standing on (0, 0), roughly
 * 110 units wide and 100 tall, so the scene can place and scale it freely.
 * Windows use `--w-window`, which glows warmer as night falls.
 */

const S = { stroke: INK, strokeWidth: 2.6, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const WINDOW = 'var(--w-window)';

export type PlaceId = 'station' | 'cafe' | 'arcade' | 'karaoke' | 'tree' | 'moonpost' | 'hutch' | 'garden' | 'house';

export function PlaceArt({ id }: { id: PlaceId }) {
  switch (id) {
    case 'station':
      return <Station />;
    case 'cafe':
      return <Cafe />;
    case 'arcade':
      return <Arcade />;
    case 'karaoke':
      return <Karaoke />;
    case 'tree':
      return <MemoryTree />;
    case 'moonpost':
      return <MoonPost />;
    case 'hutch':
      return <Hutch />;
    case 'garden':
      return <Garden />;
    case 'house':
      return <House />;
  }
}

function Shadow({ w = 50 }: { w?: number }) {
  return <ellipse cx="0" cy="1" rx={w} ry="6" fill="#1d0f22" opacity="0.18" />;
}

function Station() {
  return (
    <g>
      <Shadow w={58} />
      <rect x="-58" y="-9" width="116" height="10" rx="2" fill="#e3d4c4" {...S} />
      <rect x="-40" y="-60" width="80" height="51" fill="#fbf4ea" {...S} />
      <rect x="-31" y="-50" width="15" height="17" rx="2" fill={WINDOW} {...S} strokeWidth={2} />
      <rect x="16" y="-50" width="15" height="17" rx="2" fill={WINDOW} {...S} strokeWidth={2} />
      <path d="M-10-9v-22a10 10 0 0 1 20 0v22z" fill="#52294f" {...S} />
      <path d="M-52-60l7-18h90l7 18z" fill="#b9646f" {...S} />
      <path d="M-52-60q6.5 7 13 0t13 0 13 0 13 0 13 0 13 0 13 0 13 0" fill="#fbf4ea" {...S} strokeWidth={2} />
      <circle cx="0" cy="-86" r="10" fill="#fffcf6" {...S} />
      <path d="M0-86v-5M0-86l4 2" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
      <HeartShape x={0} y={-38} size={8} fill="#d48d96" />
    </g>
  );
}

function Cafe() {
  const stripes = [-44, -33, -22, -11, 0, 11, 22, 33];
  return (
    <g>
      <Shadow w={50} />
      <rect x="-40" y="-58" width="80" height="58" fill="#f0f5ea" {...S} />
      <rect x="-31" y="-38" width="26" height="22" rx="3" fill={WINDOW} {...S} strokeWidth={2} />
      <path d="M-31-27h26" stroke={INK} strokeWidth="1.5" opacity="0.4" />
      <path d="M8 0v-30a10 10 0 0 1 20 0v30z" fill="#5f7d52" {...S} />
      <HeartShape x={18} y={-26} size={7} fill="#f8e6bb" />
      <g>
        {stripes.map((x, i) => (
          <path key={x} d={`M${x} -58h11v12q-5.5 5-11 0z`} fill={i % 2 ? '#fffcf6' : '#a7c191'} />
        ))}
        <path d="M-44-58h88v12q-5.5 5-11 0-5.5 5-11 0-5.5 5-11 0-5.5 5-11 0-5.5 5-11 0-5.5 5-11 0-5.5 5-11 0-5.5 5-11 0z" fill="none" {...S} />
      </g>
      <g transform="translate(0 -74)">
        <path d="M-9-12h18l-2.5 22h-13z" fill="#fffcf6" {...S} strokeWidth={2.2} />
        <path d="M-8-4h16l-1.6 14h-12.8z" fill="#a7c191" />
        <path d="M-9-12h18l-2.5 22h-13z" fill="none" {...S} strokeWidth={2.2} />
        <path d="M3-22l-2 10" stroke="#b9646f" strokeWidth="3.2" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Arcade() {
  return (
    <g>
      <Shadow w={46} />
      <rect x="-36" y="-64" width="72" height="64" fill="#52294f" {...S} />
      <rect x="-30" y="-56" width="24" height="22" rx="3" fill="#2d172f" {...S} strokeWidth={2} />
      <g fill="#f5dad6">
        <rect x="-22" y="-51" width="3" height="3" />
        <rect x="-16" y="-51" width="3" height="3" />
        <rect x="-25" y="-48" width="15" height="3" />
        <rect x="-22" y="-45" width="9" height="3" />
        <rect x="-19" y="-42" width="3" height="3" />
      </g>
      <path d="M6 0v-30h22v30z" fill={WINDOW} {...S} />
      <path d="M10-26h14M10-20h14" stroke={INK} strokeWidth="1.4" opacity="0.35" />
      <rect x="-32" y="-82" width="64" height="18" rx="9" fill="#2d172f" {...S} className="place__neon" />
      <text x="0" y="-69" textAnchor="middle" fontSize="10" fontWeight="800" fill="#f8e6bb" fontFamily="system-ui, sans-serif" letterSpacing="2">
        ARCADE
      </text>
      <StarShape x={-34} y={-90} size={9} fill="#f8e6bb" />
      <StarShape x={36} y={-92} size={7} fill="#f8e6bb" />
    </g>
  );
}

function Karaoke() {
  return (
    <g>
      <Shadow w={44} />
      <rect x="-34" y="-56" width="68" height="56" fill="#e4ddf5" {...S} />
      <path d="M-40-56a40 26 0 0 1 80 0z" fill="#8e7cc3" {...S} />
      <path d="M-8 0v-28a8 8 0 0 1 16 0v28z" fill="#3f2140" {...S} />
      <circle cx="-22" cy="-36" r="8" fill={WINDOW} {...S} strokeWidth={2} />
      <circle cx="22" cy="-36" r="8" fill={WINDOW} {...S} strokeWidth={2} />
      <g transform="translate(0 -80) rotate(-18)">
        <rect x="-3.5" y="0" width="7" height="16" rx="3" fill="#3f2140" {...S} strokeWidth={2} />
        <circle cx="0" cy="-3" r="7" fill="#eee6ef" {...S} strokeWidth={2} />
      </g>
      <g className="place__notes" fill={INK}>
        <path d="M24-78v-12l9-3v12" fill="none" stroke={INK} strokeWidth="2" />
        <ellipse cx="21.5" cy="-78" rx="3" ry="2.4" />
        <ellipse cx="30.5" cy="-81" rx="3" ry="2.4" />
        <path d="M-28-84v-10" fill="none" stroke={INK} strokeWidth="2" />
        <ellipse cx="-30.5" cy="-84" rx="3" ry="2.4" />
      </g>
    </g>
  );
}

function MemoryTree() {
  return (
    <g>
      <Shadow w={44} />
      <path d="M-6 0c2-14 2-30-2-46M6 0c-2-14 0-30 6-44" fill="#9a6a55" />
      <path d="M-8 0h16c-3-16-2-34 2-46h-18c3 14 2 32 0 46z" fill="#9a6a55" {...S} />
      <circle cx="-26" cy="-62" r="24" fill="#8fb07a" {...S} />
      <circle cx="24" cy="-64" r="26" fill="#8fb07a" {...S} />
      <circle cx="0" cy="-88" r="28" fill="#a7c191" {...S} />
      <circle cx="-8" cy="-70" r="22" fill="#a7c191" />
      <circle cx="10" cy="-72" r="20" fill="#a7c191" />
      {[
        [-30, -44, -6],
        [20, -40, 5],
        [36, -56, -3],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path d="M0-10v6" stroke={INK} strokeWidth="1.2" />
          <rect x="-6" y="-4" width="12" height="14" fill="#fffcf6" stroke={INK} strokeWidth="1.4" />
          <rect x="-4.5" y="-2.5" width="9" height="8" fill={['#f6c5a6', '#cbbfe9', '#ebbfba'][i]} />
        </g>
      ))}
      <circle cx="-14" cy="-96" r="3.5" fill="#d48d96" />
      <circle cx="16" cy="-84" r="3.5" fill="#d48d96" />
      <circle cx="-34" cy="-70" r="3" fill="#d48d96" />
      <circle cx="4" cy="-108" r="3" fill={WINDOW} className="place__lantern" />
      <circle cx="30" cy="-76" r="3" fill={WINDOW} className="place__lantern" />
    </g>
  );
}

function MoonPost() {
  return (
    <g>
      <Shadow w={40} />
      <path d="M-26 0v-84" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M-26 0v-84" stroke="#6a3a63" strokeWidth="2" strokeLinecap="round" />
      <circle cx="-26" cy="-90" r="14" fill={WINDOW} className="place__lamp-glow" opacity="0.35" />
      <path d="M-34-84h16l-3-10h-10z" fill={WINDOW} {...S} strokeWidth={2} />
      <path d="M-14-108a12 12 0 1 0 6 20 14 14 0 0 1-6-20z" fill="#f8e6bb" {...S} strokeWidth={2} />
      <path d="M14 0v-30" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M0-30v-14a14 14 0 0 1 28 0v14z" fill="#b9646f" {...S} />
      <path d="M28-44v-12h9v6h-9" fill="#f8e6bb" {...S} strokeWidth={2} />
      <g transform="translate(14 -48) rotate(-8)">
        <rect x="-9" y="-8" width="18" height="12" rx="1.5" fill="#fffcf6" stroke={INK} strokeWidth="1.6" />
        <path d="M-9-8l9 7 9-7" fill="none" stroke={INK} strokeWidth="1.4" />
        <HeartShape x={0} y={0} size={5} fill="#d48d96" />
      </g>
    </g>
  );
}

function Hutch() {
  return (
    <g>
      <Shadow w={52} />
      <path d="M-26 0v-10M26 0v-10" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <rect x="-32" y="-46" width="64" height="36" rx="3" fill="#e9c9a8" {...S} />
      <path d="M-38-44l38-26 38 26z" fill="#d48d96" {...S} />
      <rect x="-24" y="-38" width="20" height="22" rx="2" fill="#fffcf6" {...S} strokeWidth={2} />
      <path d="M-24-31h20M-24-24h20M-17-38v22M-10-38v22" stroke={INK} strokeWidth="1" opacity="0.4" />
      <path d="M4-10v-18a10 10 0 0 1 20 0v18z" fill="#6a3a63" {...S} strokeWidth={2} />
      <HeartShape x={0} y={-56} size={8} fill="#fffcf6" />
      <g className="place__coco">
        <CocoFigure x={52} y={-24} scale={0.3} />
      </g>
    </g>
  );
}

function Garden() {
  const flowers: [number, number, string][] = [
    [-30, -34, '#d48d96'],
    [-12, -46, '#f6c5a6'],
    [6, -38, '#cbbfe9'],
    [24, -48, '#d48d96'],
    [40, -32, '#f8e6bb'],
  ];
  return (
    <g>
      <Shadow w={52} />
      {flowers.map(([x, y, color], i) => (
        <g key={i} className="place__flower" style={{ animationDelay: `${i * -0.7}s` }}>
          <path d={`M${x} 0q-3 ${y / 2} 0 ${y}`} stroke="#5f7d52" strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d={`M${x} ${y / 2}q-10-4-12 4 8 2 12-4`} fill="#a7c191" stroke={INK} strokeWidth="1.4" />
          <g transform={`translate(${x} ${y})`}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} cx="0" cy="-6" rx="4.5" ry="6.5" fill={color} stroke={INK} strokeWidth="1.4" transform={`rotate(${a})`} />
            ))}
            <circle r="3.6" fill="#e8bd6a" stroke={INK} strokeWidth="1.4" />
          </g>
        </g>
      ))}
      <g fill="#fffcf6" stroke={INK} strokeWidth="2">
        {[-52, -40, -28, -16, -4, 8, 20, 32, 44].map((x) => (
          <path key={x} d={`M${x} 0v-16l4-4 4 4v16z`} />
        ))}
        <path d="M-54-10h106" strokeWidth="2.4" />
      </g>
    </g>
  );
}

function House() {
  return (
    <g>
      <Shadow w={50} />
      <path d="M22-66v-22h12v14" fill="#d48d96" {...S} />
      <g className="place__smoke" fill="#fffcf6" opacity="0.7">
        <circle cx="28" cy="-96" r="5" />
        <circle cx="33" cy="-106" r="6.5" />
        <circle cx="29" cy="-118" r="8" />
      </g>
      <rect x="-36" y="-54" width="72" height="54" fill="#fbf4ea" {...S} />
      <path d="M-46-50L0-90l46 40z" fill="#b9646f" {...S} />
      <circle cx="0" cy="-64" r="7" fill={WINDOW} {...S} strokeWidth={2} />
      <rect x="-28" y="-40" width="16" height="16" rx="2" fill={WINDOW} {...S} strokeWidth={2} />
      <rect x="12" y="-40" width="16" height="16" rx="2" fill={WINDOW} {...S} strokeWidth={2} />
      <path d="M-28-32h16M20-40v16" stroke={INK} strokeWidth="1.4" opacity="0.4" />
      <path d="M-8 0v-20a8 8 0 0 1 16 0v20z" fill="#52294f" {...S} />
      <HeartShape x={0} y={-15} size={7} fill="#e8bd6a" />
      <path d="M-44 0c6-8 10-8 14 0M30 0c6-8 10-8 14 0" fill="#a7c191" {...S} strokeWidth={2} />
    </g>
  );
}
