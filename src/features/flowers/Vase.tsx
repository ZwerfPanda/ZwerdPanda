import { VASES } from './flowers';

/** One of six vases for the shop shelves (drawn, so it scales and recolours). */
export function Vase({ index }: { index: number }) {
  const v = VASES[index % VASES.length];
  const shapes = [
    'M30 18h40v58a10 10 0 0 1-10 10H40a10 10 0 0 1-10-10z',
    'M41 10h18v10c14 4 22 16 22 32 0 20-14 34-31 34S19 72 19 52c0-16 8-28 22-32z',
    'M35 4h30v80a4 4 0 0 1-4 4H39a4 4 0 0 1-4-4z',
    'M42 10h16c0 10 17 18 17 40s-12 36-25 36-25-14-25-36 17-30 17-40z',
    'M27 20h46v60a6 6 0 0 1-6 6H33a6 6 0 0 1-6-6z',
    'M30 12h40l-6 76H36z',
  ];
  const d = shapes[index % shapes.length];
  return (
    <svg className="vase" viewBox="0 0 100 92" aria-hidden="true">
      {index % 6 === 5 && (
        <path d="M68 24c16 0 16 28 0 28" fill="none" stroke={v.body} strokeWidth="6" />
      )}
      {index % 6 === 4 && <rect x="24" y="13" width="52" height="8" rx="3" fill={v.rim} />}
      <path d={d} fill={v.body} stroke="#5b3a4a" strokeOpacity="0.35" strokeWidth="1.5" />
      {index % 6 === 0 && (
        <>
          <path d="M32 46h36v30a8 8 0 0 1-8 8H40a8 8 0 0 1-8-8z" fill="#9fd4ea" opacity="0.45" />
          <path d="M44 18v64M50 18v66M56 18v64" stroke="#5f9b5a" strokeWidth="2" opacity="0.6" />
        </>
      )}
      <path d="M38 28v40" stroke={v.rim} strokeWidth="4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
