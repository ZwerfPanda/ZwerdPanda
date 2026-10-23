/** Four in a row: 7 columns × 6 rows, row 0 at the top. */
export const COLS = 7;
export const ROWS = 6;

export type Cell = 'you' | 'partner' | null;

export const emptyBoard = (): Cell[] => Array(COLS * ROWS).fill(null);

/** The row a piece dropped in this column lands on, or -1 when full. */
export function landingRow(board: Cell[], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (!board[r * COLS + col]) return r;
  return -1;
}

export function drop(board: Cell[], col: number, who: Exclude<Cell, null>): Cell[] | null {
  const row = landingRow(board, col);
  if (row < 0) return null;
  const next = board.slice();
  next[row * COLS + col] = who;
  return next;
}

/** The four winning cells, if someone has four in a row. */
export function winningLine(board: Cell[]): number[] | null {
  const at = (r: number, c: number) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS ? board[r * COLS + c] : null;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const who = at(r, c);
      if (!who) continue;
      for (const [dr, dc] of dirs) {
        const line = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
        if (line.every(([rr, cc]) => at(rr, cc) === who))
          return line.map(([rr, cc]) => rr * COLS + cc);
      }
    }
  }
  return null;
}

export const isFull = (board: Cell[]) => board.every(Boolean);

export function normalizeBoard(v: unknown): Cell[] {
  const arr = Array.isArray(v) ? v : [];
  return Array.from({ length: COLS * ROWS }, (_, i) =>
    arr[i] === 'you' || arr[i] === 'partner' ? arr[i] : null,
  );
}

type Side = Exclude<Cell, null>;

/** How good a board looks for `me`: open threes and twos, the centre column. */
function evaluate(board: Cell[], me: Side, them: Side): number {
  let score = 0;
  for (let r = 0; r < ROWS; r++) if (board[r * COLS + 3] === me) score += 3;
  const windows: number[][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
        [1, 1],
        [1, -1],
      ]) {
        const w = [0, 1, 2, 3].map((k) => [r + dr * k, c + dc * k]);
        if (w.every(([rr, cc]) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS))
          windows.push(w.map(([rr, cc]) => rr * COLS + cc));
      }
  for (const w of windows) {
    const mine = w.filter((i) => board[i] === me).length;
    const theirs = w.filter((i) => board[i] === them).length;
    const empty = 4 - mine - theirs;
    if (mine === 3 && empty === 1) score += 6;
    else if (mine === 2 && empty === 2) score += 2;
    if (theirs === 3 && empty === 1) score -= 8;
  }
  return score;
}

function minimax(
  board: Cell[],
  depth: number,
  alpha: number,
  beta: number,
  turn: Side,
  me: Side,
  them: Side,
): number {
  const line = winningLine(board);
  if (line) return board[line[0]] === me ? 10_000 + depth : -10_000 - depth;
  if (isFull(board) || depth === 0) return evaluate(board, me, them);
  const order = [3, 2, 4, 1, 5, 0, 6];
  if (turn === me) {
    let best = -Infinity;
    for (const c of order) {
      const next = drop(board, c, me);
      if (!next) continue;
      best = Math.max(best, minimax(next, depth - 1, alpha, beta, them, me, them));
      alpha = Math.max(alpha, best);
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const c of order) {
    const next = drop(board, c, them);
    if (!next) continue;
    best = Math.min(best, minimax(next, depth - 1, alpha, beta, me, me, them));
    beta = Math.min(beta, best);
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Coco's column. She always takes a win and blocks yours, looks a few moves
 * ahead, and sometimes picks a not-quite-best move — she's a bunny, after all.
 */
export function cocoColumn(board: Cell[], coco: Side, human: Side, random = Math.random): number {
  const legal = [0, 1, 2, 3, 4, 5, 6].filter((c) => landingRow(board, c) >= 0);
  for (const c of legal) if (winningLine(drop(board, c, coco)!)) return c;
  for (const c of legal) if (winningLine(drop(board, c, human)!)) return c;
  const scored = legal.map((c) => ({
    c,
    s: minimax(drop(board, c, coco)!, 4, -Infinity, Infinity, human, coco, human) + random() * 4,
  }));
  scored.sort((a, b) => b.s - a.s);
  // One time in five, the second-best idea.
  return scored[random() < 0.2 && scored[1] ? 1 : 0].c;
}
