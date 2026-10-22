import { useMemo } from 'react';
import { hashUnit } from '../../lib/id';
import './starfield.css';

/** A field of softly twinkling stars. Positions are stable per `seed`. */
export function Starfield({
  count = 60,
  seed = 'sky',
  className = '',
}: {
  count?: number;
  seed?: string;
  className?: string;
}) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k: string) => hashUnit(`${seed}-${i}-${k}`);
        const big = r('b') > 0.86;
        return {
          left: `${r('x') * 100}%`,
          top: `${r('y') * 100}%`,
          size: big ? 2.6 + r('s') * 1.6 : 1 + r('s') * 1.4,
          delay: `${-r('d') * 6}s`,
          duration: `${3 + r('t') * 4}s`,
          big,
        };
      }),
    [count, seed],
  );
  return (
    <div className={`starfield ${className}`} aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className={`starfield__star ${s.big ? 'is-big' : ''}`}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
            animationDuration: s.duration,
          }}
        />
      ))}
    </div>
  );
}
