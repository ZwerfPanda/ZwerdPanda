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
