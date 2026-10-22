export type Point = [number, number];

/** A smooth SVG path through every point (Catmull–Rom converted to cubic Béziers). */
export function smoothPath(points: Point[], tension = 0.5): string {
  if (points.length < 2) return '';
  const p = [points[0], ...points, points[points.length - 1]];
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < p.length - 2; i++) {
    const [x0, y0] = p[i - 1];
    const [x1, y1] = p[i];
    const [x2, y2] = p[i + 1];
    const [x3, y3] = p[i + 2];
    const c1x = x1 + ((x2 - x0) / 6) * tension * 2;
    const c1y = y1 + ((y2 - y0) / 6) * tension * 2;
    const c2x = x2 - ((x3 - x1) / 6) * tension * 2;
    const c2y = y2 - ((y3 - y1) / 6) * tension * 2;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${x2} ${y2}`;
  }
  return d;
}

/** A gentle wavy hill top spanning far beyond the viewBox, filled down to `bottom`. */
export function hillPath(
  y: number,
  amplitude: number,
  waves: number,
  phase: number,
  from = -1200,
  to = 2400,
  bottom = 2400,
): string {
  const steps = 48;
  let d = `M${from} ${bottom} L${from} ${y}`;
  for (let i = 0; i <= steps; i++) {
    const x = from + ((to - from) * i) / steps;
    const t = (x / 400) * waves + phase;
    const yy = y + Math.sin(t) * amplitude + Math.sin(t * 2.3 + 1.7) * amplitude * 0.35;
    d += ` L${x.toFixed(1)} ${yy.toFixed(1)}`;
  }
  return `${d} L${to} ${bottom} Z`;
}
