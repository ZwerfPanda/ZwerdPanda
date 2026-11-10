/*
 * Kamertje verhuren (dots and boxes): take turns drawing a line between two
 * dots. Close a box and it's yours, in your colour, and you go again. Most
 * boxes wins.
 *
 * Lines: horizontal h[r * n + c] (r 0..n, c 0..n-1), vertical
 * v[r * (n + 1) + c] (r 0..n-1, c 0..n). Box b = r * n + c.
 */

export type Side = 'you' | 'partner';
export type Owner = Side | null;

export interface DotsState {
  n: number;
  h: Owner[];
  v: Owner[];
  boxes: Owner[];
}

export type Edge = { dir: 'h' | 'v'; i: number };

export const SIZES = [
  { n: 3, label: 'Klein' },
  { n: 5, label: 'Normaal' },
  { n: 6, label: 'Groot' },
] as const;

export const newDots = (n = 5): DotsState => ({
  n,
  h: Array<Owner>((n + 1) * n).fill(null),
  v: Array<Owner>(n * (n + 1)).fill(null),
  boxes: Array<Owner>(n * n).fill(null),
});

const own = (x: unknown): Owner => (x === 'you' || x === 'partner' ? x : null);

export function normalizeDots(raw: unknown): DotsState {
  const r = (raw ?? {}) as Partial<DotsState>;
  const n = [3, 4, 5, 6, 7].includes(r.n as number) ? (r.n as number) : 5;
  const fill = (a: unknown, len: number) =>
    Array.from({ length: len }, (_, i) => own(Array.isArray(a) ? a[i] : null));
  return {
    n,
    h: fill(r.h, (n + 1) * n),
    v: fill(r.v, n * (n + 1)),
    boxes: fill(r.boxes, n * n),
  };
}

/** The four lines around a box. */
export function sidesOf(n: number, b: number): Edge[] {
  const r = Math.floor(b / n);
  const c = b % n;
  return [
    { dir: 'h', i: r * n + c },
    { dir: 'h', i: (r + 1) * n + c },
    { dir: 'v', i: r * (n + 1) + c },
    { dir: 'v', i: r * (n + 1) + c + 1 },
  ];
}

/** The one or two boxes a line borders. */
export function boxesOf(n: number, e: Edge): number[] {
  if (e.dir === 'h') {
    const r = Math.floor(e.i / n);
    const c = e.i % n;
    return [r - 1, r].filter((row) => row >= 0 && row < n).map((row) => row * n + c);
  }
  const r = Math.floor(e.i / (n + 1));
  const c = e.i % (n + 1);
  return [c - 1, c].filter((col) => col >= 0 && col < n).map((col) => r * n + col);
}

const drawn = (s: DotsState, e: Edge) => (e.dir === 'h' ? s.h[e.i] : s.v[e.i]) !== null;
const sidesDrawn = (s: DotsState, b: number) => sidesOf(s.n, b).filter((e) => drawn(s, e)).length;

export function freeEdges(s: DotsState): Edge[] {
  const out: Edge[] = [];
  s.h.forEach((o, i) => o === null && out.push({ dir: 'h', i }));
  s.v.forEach((o, i) => o === null && out.push({ dir: 'v', i }));
  return out;
}

/** Draw a line. `closed` boxes are yours: then you go again. */
export function draw(
  s: DotsState,
  e: Edge,
  side: Side,
): { state: DotsState; closed: number } | null {
  if (drawn(s, e)) return null;
  const h = [...s.h];
  const v = [...s.v];
  if (e.dir === 'h') h[e.i] = side;
  else v[e.i] = side;
  const boxes = [...s.boxes];
  const next = { ...s, h, v, boxes };
  let closed = 0;
  for (const b of boxesOf(s.n, e)) {
    if (boxes[b] === null && sidesDrawn(next, b) === 4) {
      boxes[b] = side;
      closed++;
    }
  }
  return { state: next, closed };
}

export const count = (s: DotsState, side: Side) => s.boxes.filter((b) => b === side).length;
export const isOver = (s: DotsState) => s.boxes.every((b) => b !== null);
export function winnerOf(s: DotsState): Side | 'draw' | null {
  if (!isOver(s)) return null;
  const a = count(s, 'you');
  const b = count(s, 'partner');
  return a === b ? 'draw' : a > b ? 'you' : 'partner';
}

/** How many boxes the other would take, greedily, if we drew `e` now. */
function giveaway(s: DotsState, e: Edge): number {
  let state = draw(s, e, 'you')!.state;
  let taken = 0;
  for (;;) {
    const grab = freeEdges(state).find((f) =>
      boxesOf(state.n, f).some((b) => state.boxes[b] === null && sidesDrawn(state, b) === 3),
    );
    if (!grab) return taken;
    const out = draw(state, grab, 'partner')!;
    state = out.state;
    taken += out.closed;
  }
}

/**
 * Coco's line: close a box when she can, else a line that gives nothing
 * away, else the one that gives away the fewest.
 */
export function cocoEdge(s: DotsState, rng: () => number = Math.random): Edge | null {
  const free = freeEdges(s);
  if (!free.length) return null;
  const pick = <T>(list: T[]) => list[Math.floor(rng() * list.length)];
  const closing = free.filter((e) =>
    boxesOf(s.n, e).some((b) => s.boxes[b] === null && sidesDrawn(s, b) === 3),
  );
  if (closing.length) return pick(closing);
  const safe = free.filter((e) => boxesOf(s.n, e).every((b) => sidesDrawn(s, b) < 2));
  if (safe.length) return pick(safe);
  let best = Infinity;
  let options: Edge[] = [];
  for (const e of free) {
    const cost = giveaway(s, e);
    if (cost < best) {
      best = cost;
      options = [e];
    } else if (cost === best) options.push(e);
  }
  return pick(options);
}
