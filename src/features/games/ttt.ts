/*
 * Boter kaas en eieren: three in a row on a 3×3 board. In the "verdwijn"
 * variant each of us only ever has three pieces: a fourth one makes your
 * oldest disappear, so there's no draw, only cleverness.
 */

export type Side = 'you' | 'partner';
export type Cell = Side | null;

export interface TttState {
  cells: Cell[];
  /** Where pieces were put, oldest first (for the fading variant). */
  order: number[];
  fade: boolean;
}

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export const FADE_KEEP = 3;

export const newTtt = (fade = false): TttState => ({
  cells: Array<Cell>(9).fill(null),
  order: [],
  fade,
});

export function normalizeTtt(raw: unknown): TttState {
  const r = (raw ?? {}) as Partial<TttState>;
  const cells = Array.from({ length: 9 }, (_, i) => {
    const c = Array.isArray(r.cells) ? r.cells[i] : null;
    return c === 'you' || c === 'partner' ? c : null;
  });
  const order = (Array.isArray(r.order) ? r.order : []).filter(
    (i): i is number => Number.isInteger(i) && i >= 0 && i < 9 && cells[i] !== null,
  );
  return { cells, order: [...new Set(order)], fade: Boolean(r.fade) };
}

export function winLine(cells: Cell[]): readonly number[] | null {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return line;
  }
  return null;
}

export const isFull = (s: TttState) => !s.fade && s.cells.every(Boolean);

/** The piece of `side` that disappears with its next move (fading variant). */
export function fadingNext(s: TttState, side: Side): number | null {
  if (!s.fade) return null;
  const mine = s.order.filter((i) => s.cells[i] === side);
  return mine.length >= FADE_KEEP ? mine[0] : null;
}

/** Put a piece down; null when that's not allowed. */
export function place(s: TttState, i: number, side: Side): TttState | null {
  if (i < 0 || i > 8 || s.cells[i] !== null || winLine(s.cells)) return null;
  const cells = [...s.cells];
  let order = [...s.order];
  const gone = fadingNext(s, side);
  if (gone !== null) {
    cells[gone] = null;
    order = order.filter((x) => x !== gone);
  }
  cells[i] = side;
  order.push(i);
  return { ...s, cells, order };
}

const other = (p: Side): Side => (p === 'you' ? 'partner' : 'you');

/** Perfect play for the classic board: +1 win for `me`, −1 loss, 0 draw. */
function minimax(cells: Cell[], turn: Side, me: Side, depth: number): number {
  const line = winLine(cells);
  if (line) return cells[line[0]] === me ? 10 - depth : depth - 10;
  if (cells.every(Boolean)) return 0;
  let best = turn === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    cells[i] = turn;
    const v = minimax(cells, other(turn), me, depth + 1);
    cells[i] = null;
    best = turn === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

/**
 * Coco's move. She plays well, but now and then she's distracted by a carrot
 * (`slip` is the chance of a random move), so she can be beaten.
 */
export function cocoMove(s: TttState, coco: Side, rng: () => number = Math.random, slip = 0.22) {
  const free = s.cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (!free.length) return -1;
  // Always take a win, always block one.
  for (const who of [coco, other(coco)]) {
    for (const i of free) {
      const next = place(s, i, who);
      if (next && winLine(next.cells)) return i;
    }
  }
  if (rng() < slip) return free[Math.floor(rng() * free.length)];
  if (s.fade) {
    // Center, then a corner, then anything.
    for (const i of [4, 0, 2, 6, 8]) if (free.includes(i)) return i;
    return free[Math.floor(rng() * free.length)];
  }
  let best = -Infinity;
  let pick = free[0];
  for (const i of free) {
    const cells = [...s.cells];
    cells[i] = coco;
    const v = minimax(cells, other(coco), coco, 0) + rng() * 0.1;
    if (v > best) {
      best = v;
      pick = i;
    }
  }
  return pick;
}
