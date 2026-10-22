/**
 * Tiny SVG building blocks shared by every illustration, so hearts, sparkles
 * and stars look identical across the universe.
 */

export const INK = '#3d1f3a';

const HEART_D =
  'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.4 2.5.8-1.3 2.2-2.5 4.4-2.5 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z';
const SPARKLE_D = 'M0-10C.9-3 3-.9 10 0 3 .9.9 3 0 10-.9 3-3 .9-10 0-3-.9-.9-3 0-10z';
const STAR_D = 'M0-10l2.6 6.4 6.9.5-5.3 4.4 1.7 6.7L0 4.4-5.9 8l1.7-6.7-5.3-4.4 6.9-.5z';

interface ShapeProps {
  x: number;
  y: number;
  size?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotate?: number;
  opacity?: number;
  className?: string;
}

/** Heart centred on (x, y); `size` is roughly its width. */
export function HeartShape({
  x,
  y,
  size = 20,
  fill = '#d48d96',
  stroke,
  strokeWidth = 2,
  rotate = 0,
  opacity,
  className,
}: ShapeProps) {
  const s = size / 22;
  return (
    <path
      className={className}
      d={HEART_D}
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s}) translate(-12 -12.5)`}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? strokeWidth / s : undefined}
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

export function SparkleShape({
  x,
  y,
  size = 16,
  fill = '#f8e6bb',
  rotate = 0,
  opacity,
  className,
}: ShapeProps) {
  return (
    <path
      className={className}
      d={SPARKLE_D}
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size / 20})`}
      fill={fill}
      opacity={opacity}
    />
  );
}

export function StarShape({
  x,
  y,
  size = 16,
  fill = '#e8bd6a',
  stroke,
  strokeWidth = 2,
  rotate = 0,
  opacity,
  className,
}: ShapeProps) {
  const s = size / 20;
  return (
    <path
      className={className}
      d={STAR_D}
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke ? strokeWidth / s : undefined}
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

/** Standalone decorative icons for use in HTML. */
export function SparkleIcon({
  size = 18,
  color = 'currentColor',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="-11 -11 22 22"
      aria-hidden="true"
    >
      <SparkleShape x={0} y={0} size={20} fill={color} />
    </svg>
  );
}

export function HeartIcon({
  size = 18,
  color = 'currentColor',
  className = '',
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={HEART_D} fill={color} />
    </svg>
  );
}
