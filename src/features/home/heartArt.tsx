/**
 * The heart of us: a glowing heart with a ring that fills up towards our next
 * milestone. viewBox -240 -340 480 350; the heart sits at (0, -176).
 */

export const HEART_Y = -176;

export function HeartPath({ scale = 1 }: { scale?: number }) {
  return (
    <path
      transform={`scale(${scale})`}
      d="M0 34C-46 6-60-26-44-46-30-62-8-56 0-38 8-56 30-62 44-46 60-26 46 6 0 34Z"
    />
  );
}

/** Just the heart and its ring (also what shows while mini us loads). */
export function Heart({ progress }: { progress: number }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  return (
    <g transform={`translate(0 ${HEART_Y})`}>
      <circle r={r + 16} fill="url(#hs-glow)" />
      <circle r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />
      <circle
        r={r}
        fill="none"
        stroke="url(#hs-ring)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${c * Math.min(1, Math.max(0.02, progress))} ${c}`}
        transform="rotate(-90)"
        className="heart-scene__ring"
      />
      <g className="heart-scene__beat">
        <g fill="url(#hs-heart)" stroke="#3d1734" strokeWidth="3" strokeLinejoin="round">
          <HeartPath scale={1.18} />
        </g>
        <path
          d="M-30-40q-10 6-10 18"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.6"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

export function HeartDefs() {
  return (
    <defs>
      <radialGradient id="hs-glow">
        <stop offset="0.35" stopColor="#ff9fb7" stopOpacity="0.55" />
        <stop offset="1" stopColor="#ff9fb7" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="hs-heart" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#ffb3c4" />
        <stop offset="0.55" stopColor="#ef6f8f" />
        <stop offset="1" stopColor="#c2416a" />
      </linearGradient>
      <linearGradient id="hs-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#f8e6bb" />
        <stop offset="1" stopColor="#e8bd6a" />
      </linearGradient>
    </defs>
  );
}
