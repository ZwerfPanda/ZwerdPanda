import { useId } from 'react';
import type { ArtKey } from '../../data/types';
import { HeartShape, INK, SparkleShape, StarShape } from './shapes';

/**
 * Illustrated placeholder "photos". They stand in for real pictures until
 * we add our own, and are always labelled as samples where they appear.
 */

export const ART_LABELS: Record<ArtKey, string> = {
  phone: 'Illustration: a phone showing a livestream with floating hearts',
  meet: 'Illustration: two map pins joined by a dotted line and a heart',
  mall: 'Illustration: shopping bags with a little heart',
  matcha: 'Illustration: an iced vanilla matcha with extra syrup',
  boba: 'Illustration: a cup of bubble tea',
  arcade: 'Illustration: a glowing arcade machine at night',
  karaoke: 'Illustration: a karaoke microphone with music notes',
  train: 'Illustration: the view from a train window at dusk',
  car: 'Illustration: a little car driving at sunset',
  growth: 'Illustration: a small plant sprouting in a pot',
  coco: 'Illustration: a little dwarf rabbit',
  house: 'Illustration: a little house on a hill under the stars',
  nails: 'Illustration: nail polish bottles and colour swatches',
  stars: 'Illustration: a heart-shaped constellation in the night sky',
  future: 'Illustration: an open book with stars rising from its pages',
};

const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

export function SampleArt({ art, className }: { art: ArtKey; className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      className={className}
      viewBox="0 0 240 240"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={ART_LABELS[art]}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      {SCENES[art](uid)}
    </svg>
  );
}

type Scene = (uid: string) => React.ReactNode;

const SCENES: Record<ArtKey, Scene> = {
  phone: (uid) => (
    <>
      <rect width="240" height="240" fill="#e4ddf5" />
      <circle cx="190" cy="50" r="60" fill="#f3effa" />
      <defs>
        <linearGradient id={`${uid}-scr`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6c5a6" />
          <stop offset="1" stopColor="#ebbfba" />
        </linearGradient>
      </defs>
      <rect x="74" y="26" width="92" height="184" rx="18" fill="#3f2140" {...S} />
      <rect x="82" y="38" width="76" height="160" rx="11" fill={`url(#${uid}-scr)`} />
      <rect x="89" y="46" width="30" height="13" rx="4" fill="#b9646f" />
      <text x="104" y="56" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#fff" fontFamily="system-ui, sans-serif">
        LIVE
      </text>
      <circle cx="120" cy="104" r="20" fill="#fffcf6" opacity="0.8" />
      <circle cx="120" cy="99" r="8" fill="#d48d96" />
      <path d="M106 118c3-8 25-8 28 0" fill="#d48d96" />
      <rect x="88" y="160" width="44" height="10" rx="5" fill="#fffcf6" opacity="0.85" />
      <rect x="88" y="175" width="32" height="10" rx="5" fill="#fffcf6" opacity="0.65" />
      <HeartShape x={146} y={176} size={14} fill="#b9646f" />
      <HeartShape x={140} y={150} size={11} fill="#fffcf6" />
      <HeartShape x={149} y={128} size={9} fill="#e8bd6a" />
      <HeartShape x={141} y={110} size={7} fill="#b9646f" opacity={0.7} />
      <SparkleShape x={44} y={70} size={18} fill="#fffcf6" />
      <SparkleShape x={196} y={170} size={22} fill="#8e7cc3" />
      <SparkleShape x={56} y={190} size={12} fill="#8e7cc3" />
    </>
  ),

  meet: () => (
    <>
      <rect width="240" height="240" fill="#fdf0e6" />
      <path d="M0 180c40-18 80-22 120-12s80 6 120-10v82H0z" fill="#f5dad6" />
      <path d="M0 205c50-12 90-10 130-2s75 4 110-6v43H0z" fill="#ebbfba" />
      <path d="M58 150C70 80 160 60 182 112" fill="none" stroke={INK} strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" />
      <path d="M58 158c-14-16-22-26-22-38a22 22 0 0 1 44 0c0 12-8 22-22 38z" fill="#cbbfe9" {...S} />
      <circle cx="58" cy="120" r="8" fill="#fffcf6" stroke={INK} strokeWidth="2.5" />
      <path d="M182 120c-14-16-22-26-22-38a22 22 0 0 1 44 0c0 12-8 22-22 38z" fill="#d48d96" {...S} />
      <circle cx="182" cy="82" r="8" fill="#fffcf6" stroke={INK} strokeWidth="2.5" />
      <HeartShape x={121} y={70} size={30} fill="#b9646f" stroke={INK} strokeWidth={2.5} />
      <SparkleShape x={96} y={44} size={14} fill="#e8bd6a" />
      <SparkleShape x={150} y={40} size={10} fill="#e8bd6a" />
    </>
  ),

  mall: () => (
    <>
      <rect width="240" height="240" fill="#fbeeec" />
      <circle cx="120" cy="118" r="88" fill="#f5dad6" />
      <rect x="0" y="196" width="240" height="44" fill="#ebbfba" />
      <path d="M128 92c0-24 50-24 50 0" fill="none" {...S} />
      <path d="M116 92h74l8 108h-90z" fill="#cbbfe9" {...S} />
      <path d="M66 82c0-28 58-28 58 0" fill="none" {...S} />
      <path d="M52 82h86l10 120H42z" fill="#d48d96" {...S} />
      <HeartShape x={95} y={140} size={34} fill="#fffcf6" stroke={INK} strokeWidth={2.5} />
      <path d="M154 120h22" stroke="#fffcf6" strokeWidth="4" strokeLinecap="round" />
      <SparkleShape x={196} y={60} size={20} fill="#e8bd6a" />
      <SparkleShape x={36} y={52} size={14} fill="#e8bd6a" />
    </>
  ),

  matcha: (uid) => (
    <>
      <rect width="240" height="240" fill="#f0f5ea" />
      <circle cx="120" cy="128" r="92" fill="#e0ebd4" />
      <rect x="0" y="206" width="240" height="34" fill="#e3d4c4" />
      <defs>
        <linearGradient id={`${uid}-tea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf0dc" />
          <stop offset="0.42" stopColor="#f3ecd2" />
          <stop offset="0.55" stopColor="#bcd3a5" />
          <stop offset="1" stopColor="#8fb07a" />
        </linearGradient>
        <clipPath id={`${uid}-cup`}>
          <path d="M78 78h84l-11 128H89z" />
        </clipPath>
      </defs>
      <path d="M140 22l-14 76" stroke="#b9646f" strokeWidth="9" strokeLinecap="round" />
      <path d="M140 22l-14 76" stroke={INK} strokeWidth="2" strokeLinecap="round" opacity="0.25" />
      <g clipPath={`url(#${uid}-cup)`}>
        <rect x="70" y="92" width="100" height="120" fill={`url(#${uid}-tea)`} />
        <path d="M76 140c18-10 34 8 52-2s28 6 40 0" fill="none" stroke="#fffcf6" strokeWidth="3" opacity="0.6" />
        <rect x="92" y="100" width="18" height="18" rx="4" fill="#fff" opacity="0.6" transform="rotate(-12 101 109)" />
        <rect x="122" y="108" width="16" height="16" rx="4" fill="#fff" opacity="0.5" transform="rotate(14 130 116)" />
      </g>
      <path d="M78 78h84l-11 128H89z" fill="#fff" fillOpacity="0.18" {...S} />
      <path d="M72 78h96" {...S} strokeWidth="4" />
      <path d="M78 76c4-16 80-16 84 0" fill="#fff" fillOpacity="0.5" {...S} />
      <HeartShape x={120} y={166} size={22} fill="#fffcf6" stroke={INK} strokeWidth={2} />
      <path d="M186 74c0 8-6 10-6 14a6 6 0 0 0 12 0c0-4-6-6-6-14z" fill="#e8bd6a" stroke={INK} strokeWidth="2" />
      <path d="M200 100c0 6-5 8-5 11a5 5 0 0 0 10 0c0-3-5-5-5-11z" fill="#e8bd6a" stroke={INK} strokeWidth="2" />
      <text x="190" y="140" textAnchor="middle" fontFamily="'Caveat Variable', cursive" fontSize="17" fill={INK} transform="rotate(-8 190 140)">
        + extra
      </text>
      <text x="192" y="156" textAnchor="middle" fontFamily="'Caveat Variable', cursive" fontSize="17" fill={INK} transform="rotate(-8 192 156)">
        syrup!
      </text>
      <SparkleShape x={44} y={64} size={16} fill="#e8bd6a" />
    </>
  ),

  boba: () => (
    <>
      <rect width="240" height="240" fill="#fbe0cd" />
      <circle cx="120" cy="124" r="90" fill="#fdf0e6" />
      <path d="M136 16l-8 84" stroke="#8e7cc3" strokeWidth="14" strokeLinecap="round" />
      <path d="M80 82h80l-12 124H92z" fill="#e3b58e" {...S} />
      <path d="M80 82h80l-3 30H83z" fill="#f1d3b3" />
      {[
        [102, 190], [118, 194], [134, 189], [96, 176], [112, 178], [128, 176], [143, 174], [105, 163], [122, 164], [137, 160],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="7" fill="#3d1f3a" />
      ))}
      <path d="M80 82h80l-12 124H92z" fill="none" {...S} />
      <ellipse cx="120" cy="82" rx="44" ry="8" fill="#fffcf6" {...S} />
      <HeartShape x={120} y={132} size={20} fill="#fffcf6" stroke={INK} strokeWidth={2} />
      <SparkleShape x={50} y={60} size={18} fill="#e9906c" />
      <SparkleShape x={190} y={180} size={14} fill="#e9906c" />
    </>
  ),

  arcade: (uid) => (
    <>
      <defs>
        <linearGradient id={`${uid}-night`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2d172f" />
          <stop offset="1" stopColor="#52294f" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0" stopColor="#cbbfe9" stopOpacity="0.7" />
          <stop offset="1" stopColor="#cbbfe9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="240" height="240" fill={`url(#${uid}-night)`} />
      <circle cx="120" cy="100" r="90" fill={`url(#${uid}-glow)`} />
      <rect x="0" y="210" width="240" height="30" fill="#1d0f22" />
      <path d="M72 46h96l6 12v152H66V58z" fill="#b9646f" {...S} />
      <rect x="76" y="30" width="88" height="22" rx="6" fill="#e8bd6a" {...S} />
      <text x="120" y="46" textAnchor="middle" fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="12" fill={INK} letterSpacing="2">
        PLAY
      </text>
      <rect x="82" y="66" width="76" height="62" rx="8" fill="#2d172f" {...S} />
      {[
        [0, 1, 0, 1, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [0, 1, 1, 1, 0],
        [0, 0, 1, 0, 0],
      ].map((row, r) =>
        row.map((on, c) => (on ? <rect key={`${r}-${c}`} x={104 + c * 7} y={78 + r * 7} width="6" height="6" fill="#f5dad6" /> : null)),
      )}
      <path d="M66 140h108l8 22H58z" fill="#cbbfe9" {...S} />
      <path d="M92 146v-12" {...S} />
      <circle cx="92" cy="130" r="7" fill="#e9906c" {...S} />
      <circle cx="132" cy="152" r="5" fill="#e8bd6a" stroke={INK} strokeWidth="2" />
      <circle cx="148" cy="148" r="5" fill="#8e7cc3" stroke={INK} strokeWidth="2" />
      <SparkleShape x={38} y={50} size={16} fill="#f8e6bb" />
      <SparkleShape x={206} y={84} size={20} fill="#f8e6bb" />
      <SparkleShape x={196} y={30} size={10} fill="#f8e6bb" />
      <StarShape x={30} y={150} size={10} fill="#f8e6bb" />
    </>
  ),

  karaoke: (uid) => (
    <>
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e7cc3" />
          <stop offset="1" stopColor="#cbbfe9" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" fill={`url(#${uid}-bg)`} />
      <path d="M60 0l40 240H20z" fill="#fff" opacity="0.12" />
      <path d="M180 0l40 240h-80z" fill="#fff" opacity="0.12" />
      <g transform="rotate(-24 120 120)">
        <rect x="111" y="112" width="18" height="96" rx="8" fill="#3f2140" {...S} />
        <rect x="106" y="104" width="28" height="14" rx="4" fill="#d48d96" {...S} />
        <circle cx="120" cy="78" r="30" fill="#eee6ef" {...S} />
        <path d="M96 70h48M93 84h54M104 58h32M104 98h32M110 50v56M130 50v56" stroke={INK} strokeWidth="1.4" opacity="0.35" />
      </g>
      <g fill={INK}>
        <path d="M178 66v-34l22-6v32" fill="none" {...S} />
        <ellipse cx="172" cy="67" rx="7" ry="5.5" />
        <ellipse cx="194" cy="59" rx="7" ry="5.5" />
        <path d="M56 150v-28" fill="none" {...S} />
        <ellipse cx="50" cy="151" rx="7" ry="5.5" />
      </g>
      <StarShape x={190} y={150} size={18} fill="#f8e6bb" />
      <SparkleShape x={42} y={60} size={18} fill="#fffcf6" />
      <SparkleShape x={206} y={206} size={12} fill="#fffcf6" />
    </>
  ),

  train: (uid) => (
    <>
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8e7cc3" />
          <stop offset="0.6" stopColor="#ebbfba" />
          <stop offset="1" stopColor="#f6c5a6" />
        </linearGradient>
        <clipPath id={`${uid}-win`}>
          <rect x="34" y="40" width="172" height="128" rx="26" />
        </clipPath>
      </defs>
      <rect width="240" height="240" fill="#f5dad6" />
      <g clipPath={`url(#${uid}-win)`}>
        <rect x="30" y="36" width="180" height="140" fill={`url(#${uid}-sky)`} />
        <circle cx="168" cy="78" r="13" fill="#fcf3dc" />
        <path d="M30 140v-26h14v-14h12v20h10v-34h16v34h10v-16h14v22h12v-30l10-8 10 8v30h12v-18h16v26h14v-12h10v38z" fill="#6a3a63" opacity="0.75" />
        <path d="M30 150c40-12 80-16 120-8s40 6 60 2v32H30z" fill="#52294f" />
        <path d="M44 90h40M100 70h30M150 110h40" stroke="#fffcf6" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      </g>
      <rect x="34" y="40" width="172" height="128" rx="26" fill="none" stroke="#fffcf6" strokeWidth="10" />
      <rect x="28" y="34" width="184" height="140" rx="32" fill="none" {...S} />
      <rect x="0" y="194" width="240" height="46" fill="#b9646f" />
      <path d="M0 194h240" {...S} />
      <rect x="0" y="186" width="240" height="10" fill="#d48d96" />
      <text x="62" y="222" fontFamily="'Caveat Variable', cursive" fontSize="20" fill="#fffcf6">
        next stop: you
      </text>
    </>
  ),

  car: (uid) => (
    <>
      <defs>
        <linearGradient id={`${uid}-dusk`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cbbfe9" />
          <stop offset="1" stopColor="#f6c5a6" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" fill={`url(#${uid}-dusk)`} />
      <circle cx="176" cy="70" r="26" fill="#fcf3dc" />
      <path d="M0 150c50-20 100-24 150-12s70 6 90 0v102H0z" fill="#ebbfba" />
      <rect x="0" y="176" width="240" height="64" fill="#3f2140" />
      <path d="M14 208h26M64 208h26M114 208h26M164 208h26M214 208h26" stroke="#f8e6bb" strokeWidth="4" strokeLinecap="round" />
      <path d="M184 150l56-20v46z" fill="#f8e6bb" opacity="0.55" />
      <path d="M44 172v-24c0-6 4-10 10-12l18-4 16-20c4-4 8-6 14-6h38c6 0 10 2 14 6l18 20 14 4c6 2 10 6 10 12v24z" fill="#d48d96" {...S} />
      <path d="M96 132l12-16h18v16zM134 132v-16h16c4 0 6 2 8 4l10 12z" fill="#e4ddf5" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="82" cy="174" r="15" fill="#3d1f3a" />
      <circle cx="82" cy="174" r="6" fill="#e4ddf5" />
      <circle cx="162" cy="174" r="15" fill="#3d1f3a" />
      <circle cx="162" cy="174" r="6" fill="#e4ddf5" />
      <circle cx="184" cy="150" r="5" fill="#f8e6bb" stroke={INK} strokeWidth="2" />
      <HeartShape x={30} y={136} size={16} fill="#b9646f" opacity={0.85} />
      <HeartShape x={16} y={116} size={11} fill="#b9646f" opacity={0.55} />
      <SparkleShape x={60} y={50} size={16} fill="#fffcf6" />
    </>
  ),

  growth: () => (
    <>
      <rect width="240" height="240" fill="#fdf0e6" />
      <circle cx="176" cy="62" r="24" fill="#f8e6bb" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path
          key={a}
          d="M176 28v-10"
          stroke="#e8bd6a"
          strokeWidth="4"
          strokeLinecap="round"
          transform={`rotate(${a} 176 62)`}
        />
      ))}
      <rect x="0" y="206" width="240" height="34" fill="#f3e7d8" />
      <path d="M120 150c0-30-2-50 2-70" fill="none" stroke="#5f7d52" strokeWidth="5" strokeLinecap="round" />
      <path d="M120 116c-30 4-46-14-48-36 26-4 44 10 48 36z" fill="#a7c191" {...S} />
      <path d="M121 100c26-2 42-20 42-44-26 0-42 16-42 44z" fill="#a7c191" {...S} />
      <circle cx="123" cy="76" r="9" fill="#d48d96" {...S} />
      <path d="M82 146h76l-10 64H92z" fill="#e9906c" {...S} />
      <rect x="76" y="136" width="88" height="18" rx="5" fill="#f6c5a6" {...S} />
      <HeartShape x={120} y={182} size={20} fill="#fdf0e6" stroke={INK} strokeWidth={2} />
      <SparkleShape x={50} y={90} size={14} fill="#a7c191" />
      <SparkleShape x={196} y={140} size={12} fill="#a7c191" />
    </>
  ),

  coco: () => (
    <>
      <rect width="240" height="240" fill="#fbeeec" />
      <circle cx="120" cy="130" r="90" fill="#f5dad6" />
      <ellipse cx="120" cy="204" rx="78" ry="10" fill="#ebbfba" />
      <CocoFigure x={120} y={128} scale={1} />
      <path d="M186 192c8-22 16-30 24-34" stroke="#5f7d52" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M170 204l18-14c4-3 10 2 7 6l-14 16c-4 4-14-4-11-8z" fill="#e9906c" {...S} />
      <SparkleShape x={44} y={56} size={16} fill="#e8bd6a" />
      <HeartShape x={196} y={64} size={18} fill="#d48d96" />
    </>
  ),

  house: (uid) => (
    <>
      <defs>
        <linearGradient id={`${uid}-eve`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#52294f" />
          <stop offset="0.7" stopColor="#8e7cc3" />
          <stop offset="1" stopColor="#ebbfba" />
        </linearGradient>
      </defs>
      <rect width="240" height="240" fill={`url(#${uid}-eve)`} />
      <path d="M186 40a18 18 0 1 0 14 30 22 22 0 0 1-14-30z" fill="#f8e6bb" />
      <StarShape x={48} y={40} size={10} fill="#f8e6bb" />
      <StarShape x={110} y={26} size={7} fill="#f8e6bb" />
      <StarShape x={150} y={60} size={6} fill="#f8e6bb" />
      <path d="M0 176c40-30 90-40 140-30s70 14 100 6v88H0z" fill="#a7c191" opacity="0.6" />
      <path d="M0 196c50-18 110-22 160-12s60 10 80 4v52H0z" fill="#5f7d52" opacity="0.75" />
      <path d="M150 64v26h14V74z" fill="#d48d96" {...S} />
      <path d="M154 54c-6-8 4-12 0-20" fill="none" stroke="#fffcf6" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <rect x="78" y="110" width="84" height="74" fill="#fbf4ea" {...S} />
      <path d="M68 114l52-46 52 46z" fill="#b9646f" {...S} />
      <rect x="108" y="142" width="24" height="42" rx="12" fill="#3f2140" {...S} />
      <HeartShape x={120} y={156} size={10} fill="#e8bd6a" />
      <rect x="88" y="124" width="16" height="16" rx="3" fill="#f8e6bb" stroke={INK} strokeWidth="2.5" />
      <rect x="136" y="124" width="16" height="16" rx="3" fill="#f8e6bb" stroke={INK} strokeWidth="2.5" />
      <path d="M120 184c-4 20-20 34-36 56" fill="none" stroke="#f6c5a6" strokeWidth="10" strokeLinecap="round" />
    </>
  ),

  nails: () => (
    <>
      <rect width="240" height="240" fill="#f5dad6" />
      <circle cx="80" cy="96" r="70" fill="#fbeeec" />
      <rect x="0" y="198" width="240" height="42" fill="#ebbfba" />
      <rect x="54" y="58" width="22" height="44" rx="5" fill="#3f2140" {...S} />
      <path d="M44 104h42c6 0 10 4 10 10v62c0 8-6 14-14 14H48c-8 0-14-6-14-14v-62c0-6 4-10 10-10z" fill="#b9646f" {...S} />
      <path d="M44 122v44" stroke="#fffcf6" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
      <rect x="112" y="84" width="18" height="34" rx="4" fill="#3f2140" {...S} />
      <path d="M104 120h34c5 0 8 3 8 8v50c0 7-5 12-12 12h-26c-7 0-12-5-12-12v-50c0-5 3-8 8-8z" fill="#cbbfe9" {...S} />
      {['#f6c5a6', '#d48d96', '#8e7cc3', '#e8bd6a', '#a7c191'].map((fill, i) => (
        <g key={fill} transform={`rotate(${-30 + i * 15} 196 196)`}>
          <path d="M187 120c0-12 18-12 18 0v40h-18z" fill={fill} {...S} strokeWidth={2.5} />
        </g>
      ))}
      <circle cx="196" cy="196" r="6" fill="#fffcf6" {...S} />
      <SparkleShape x={150} y={50} size={20} fill="#e8bd6a" />
      <SparkleShape x={30} y={40} size={12} fill="#fffcf6" />
    </>
  ),

  stars: (uid) => {
    const pts: [number, number][] = [
      [120, 150], [80, 116], [70, 82], [92, 60], [120, 76], [148, 60], [170, 82], [160, 116],
    ];
    return (
      <>
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1d0f22" />
            <stop offset="1" stopColor="#52294f" />
          </linearGradient>
        </defs>
        <rect width="240" height="240" fill={`url(#${uid}-sky)`} />
        {[[22, 30], [200, 24], [212, 120], [30, 170], [180, 180], [60, 210], [140, 30], [110, 200]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1.2} fill="#f8e6bb" opacity="0.8" />
        ))}
        <path d="M196 54a16 16 0 1 0 12 27 20 20 0 0 1-12-27z" fill="#f8e6bb" />
        <polygon
          points={pts.map((p) => p.join(',')).join(' ')}
          fill="none"
          stroke="#f8e6bb"
          strokeWidth="1.4"
          strokeDasharray="3 5"
          opacity="0.75"
        />
        {pts.map(([x, y], i) => (
          <StarShape key={i} x={x} y={y} size={i % 2 ? 12 : 16} fill="#f8e6bb" />
        ))}
        <path d="M0 214c40-14 80-16 120-10s80 4 120-6v42H0z" fill="#1d0f22" />
      </>
    );
  },

  future: () => (
    <>
      <rect width="240" height="240" fill="#f3effa" />
      <circle cx="120" cy="100" r="80" fill="#e4ddf5" />
      <path d="M120 186c-26-12-56-14-86-8V92c30-6 60-4 86 8z" fill="#fffcf6" {...S} />
      <path d="M120 186c26-12 56-14 86-8V92c-30-6-60-4-86 8z" fill="#fffcf6" {...S} />
      <path d="M120 100v86" {...S} />
      <path d="M48 112c20-3 40-2 58 4M48 128c20-3 40-2 58 4M48 144c20-3 40-2 58 4" stroke={INK} strokeWidth="1.6" opacity="0.25" />
      <path d="M134 116c18-6 38-7 58-4M134 132c18-6 38-7 58-4" stroke={INK} strokeWidth="1.6" opacity="0.25" />
      <StarShape x={120} y={66} size={20} fill="#e8bd6a" stroke={INK} strokeWidth={2} />
      <StarShape x={92} y={44} size={12} fill="#cbbfe9" />
      <StarShape x={152} y={38} size={14} fill="#d48d96" />
      <SparkleShape x={176} y={74} size={14} fill="#8e7cc3" />
      <SparkleShape x={66} y={70} size={12} fill="#8e7cc3" />
      <text x="120" y="218" textAnchor="middle" fontFamily="'Caveat Variable', cursive" fontSize="20" fill={INK}>
        to be continued…
      </text>
    </>
  ),
};

/**
 * Coco, drawn as a round little dwarf rabbit. Reused in the scrapbook, the
 * rabbit house in Our Little World, and Coco's corner.
 */
export function CocoFigure({ x, y, scale = 1, blink = false }: { x: number; y: number; scale?: number; blink?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="38" cy="58" rx="13" ry="12" fill="#fffcf6" {...S} />
      <ellipse cx="0" cy="44" rx="50" ry="38" fill="#d9b48f" {...S} />
      <g transform="rotate(-14 -18 -44)">
        <ellipse cx="-18" cy="-50" rx="11" ry="25" fill="#d9b48f" {...S} />
        <ellipse cx="-18" cy="-48" rx="5" ry="16" fill="#f5dad6" />
      </g>
      <g transform="rotate(16 18 -44)">
        <ellipse cx="18" cy="-50" rx="11" ry="25" fill="#d9b48f" {...S} />
        <ellipse cx="18" cy="-48" rx="5" ry="16" fill="#f5dad6" />
      </g>
      <ellipse cx="0" cy="-4" rx="38" ry="34" fill="#d9b48f" {...S} />
      <ellipse cx="0" cy="12" rx="17" ry="12" fill="#f0dcc4" />
      {blink ? (
        <>
          <path d="M-20 -8q6 5 12 0M8 -8q6 5 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="-14" cy="-8" r="5.5" fill={INK} />
          <circle cx="14" cy="-8" r="5.5" fill={INK} />
          <circle cx="-12" cy="-10" r="1.8" fill="#fff" />
          <circle cx="16" cy="-10" r="1.8" fill="#fff" />
        </>
      )}
      <path d="M-4 5h8l-4 5z" fill="#d48d96" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M0 10v3M0 13q-4 4-7 1M0 13q4 4 7 1" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="-24" cy="8" r="6" fill="#ebbfba" opacity="0.8" />
      <circle cx="24" cy="8" r="6" fill="#ebbfba" opacity="0.8" />
      <ellipse cx="-16" cy="76" rx="12" ry="7" fill="#f0dcc4" {...S} />
      <ellipse cx="16" cy="76" rx="12" ry="7" fill="#f0dcc4" {...S} />
    </g>
  );
}
