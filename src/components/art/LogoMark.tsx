import { HeartShape, SparkleShape } from './shapes';

/** The little planet with a heart moon — our universe's emblem. */
export function LogoMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <linearGradient id="logo-planet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6c5a6" />
          <stop offset="0.55" stopColor="#d48d96" />
          <stop offset="1" stopColor="#8e7cc3" />
        </linearGradient>
      </defs>
      <ellipse
        cx="24"
        cy="26"
        rx="21"
        ry="7"
        fill="none"
        stroke="#e8bd6a"
        strokeWidth="2.2"
        transform="rotate(-18 24 26)"
      />
      <circle cx="24" cy="26" r="13" fill="url(#logo-planet)" />
      <path
        d="M13.5 30.5c6 2.6 15 2.6 21.5-1.5"
        fill="none"
        stroke="#fffcf6"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M4.03 32.49A21 7 -18 0 0 43.97 19.51"
        fill="none"
        stroke="#e8bd6a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <HeartShape x={39} y={9} size={9} fill="#d48d96" />
      <SparkleShape x={8} y={10} size={7} fill="#e8bd6a" />
    </svg>
  );
}
