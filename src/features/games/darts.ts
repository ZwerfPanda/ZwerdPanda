/** The numbers clockwise from the top, as on every pub board. */
export const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/**
 * A real dartboard, measured from the centre with the board's radius as 1.
 * The treble and double rings are a touch wider than in a pub, so a phone
 * thumb has a fair chance.
 */
export const RINGS = {
  bull: 0.05,
  outerBull: 0.11,
  trebleIn: 0.55,
  trebleOut: 0.63,
  doubleIn: 0.91,
  doubleOut: 1,
} as const;

export interface Hit {
  score: number;
  label: string;
}

/** What a dart at (x, y) scores; y grows downward, like on screen. */
export function scoreAt(x: number, y: number): Hit {
  const r = Math.hypot(x, y);
  if (r <= RINGS.bull) return { score: 50, label: 'BULLSEYE' };
  if (r <= RINGS.outerBull) return { score: 25, label: '25' };
  if (r > RINGS.doubleOut) return { score: 0, label: 'mis' };
  // Clockwise from straight up, in degrees.
  const angle = ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  const segment = SEGMENTS[Math.floor((angle + 9) / 18) % 20];
  if (r >= RINGS.trebleIn && r <= RINGS.trebleOut)
    return { score: segment * 3, label: `T${segment}` };
  if (r >= RINGS.doubleIn) return { score: segment * 2, label: `D${segment}` };
  return { score: segment, label: String(segment) };
}

export const TURNS = 5;
export const DARTS_PER_TURN = 3;

/** Normally distributed noise (Box–Muller). */
function gauss(random: () => number) {
  const u = Math.max(1e-9, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Coco aims for the treble 20 with a wobbly paw. */
export function cocoDarts(random = Math.random): Hit[] {
  return Array.from({ length: TURNS * DARTS_PER_TURN }, () => {
    const x = gauss(random) * 0.2;
    const y = -0.59 + gauss(random) * 0.24;
    return scoreAt(x, y);
  });
}
