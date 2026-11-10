/*
 * Mens erger je niet, for the two of us: he plays yellow, she plays pink,
 * starting on opposite sides of the board. Four pawns each.
 *
 * A pawn is -1 at home, 0..39 on its way round (counted from its own start
 * square), 40..43 in its own finish lane. Roll a 6 to come out; a 6 gives
 * another roll; landing on the other's pawn sends it home ("erger je niet!");
 * the finish lane needs the exact number. With nobody out yet you get three
 * tries to roll that 6.
 */

export type Side = 'you' | 'partner';
export const TRACK = 40;
export const LANE = 4;
export const START: Record<Side, number> = { you: 0, partner: 20 };

export interface LudoState {
  pawns: Record<Side, number[]>;
  /** The roll waiting for a pawn to move (0: nothing waiting, roll first). */
  die: number;
  /** The last number rolled, to show on the die. */
  rolled?: number;
  /** Rolls tried this turn while stuck at home. */
  tries: number;
  /** For the board's little arrow: which pawn moved last, and from where. */
  last?: { side: Side; pawn: number; from: number; to: number; hit?: boolean };
}

export const newLudo = (): LudoState => ({
  pawns: { you: [-1, -1, -1, -1], partner: [-1, -1, -1, -1] },
  die: 0,
  tries: 0,
});

const other = (s: Side): Side => (s === 'you' ? 'partner' : 'you');

export function normalizeLudo(raw: unknown): LudoState {
  const r = (raw ?? {}) as Partial<LudoState>;
  const pawns = (side: Side) =>
    Array.from({ length: 4 }, (_, i) => {
      const v = r.pawns?.[side]?.[i];
      return Number.isInteger(v) && (v as number) >= -1 && (v as number) < TRACK + LANE
        ? (v as number)
        : -1;
    });
  const die =
    Number.isInteger(r.die) && (r.die as number) >= 0 && (r.die as number) <= 6
      ? (r.die as number)
      : 0;
  const tries = Number.isInteger(r.tries) ? Math.max(0, Math.min(3, r.tries as number)) : 0;
  const rolled =
    Number.isInteger(r.rolled) && (r.rolled as number) >= 1 && (r.rolled as number) <= 6
      ? (r.rolled as number)
      : undefined;
  return {
    pawns: { you: pawns('you'), partner: pawns('partner') },
    die,
    tries,
    ...(rolled ? { rolled } : {}),
    ...(r.last ? { last: r.last } : {}),
  };
}

/** The square of the board a pawn stands on (0..39), or null at home / in the lane. */
export const squareOf = (side: Side, pos: number) =>
  pos >= 0 && pos < TRACK ? (START[side] + pos) % TRACK : null;

/** Where this pawn would go with this roll, or null when it can't. */
export function target(s: LudoState, side: Side, pawn: number, roll: number): number | null {
  const pos = s.pawns[side][pawn];
  let to: number;
  if (pos === -1) {
    if (roll !== 6) return null;
    to = 0;
  } else {
    to = pos + roll;
    if (to >= TRACK + LANE) return null;
  }
  // never onto your own pawn
  if (s.pawns[side].some((p, i) => i !== pawn && p === to)) return null;
  return to;
}

export const movable = (s: LudoState, side: Side, roll: number) =>
  [0, 1, 2, 3].filter((i) => target(s, side, i, roll) !== null);

/** All four home: 3 tries for a 6. */
export const stuck = (s: LudoState, side: Side) =>
  s.pawns[side].every((p) => p === -1 || p >= TRACK);

export function roll(
  s: LudoState,
  side: Side,
  value: number,
): {
  state: LudoState;
  /** Nothing to move: the turn passes (or roll again when stuck with tries left). */
  next: 'move' | 'again' | 'pass';
} {
  const state = { ...s, die: value, rolled: value };
  if (movable(state, side, value).length) return { state, next: 'move' };
  // nothing to move: the die is free again
  const free = { ...state, die: 0 };
  if (stuck(s, side) && value !== 6 && s.tries + 1 < 3)
    return { state: { ...free, tries: s.tries + 1 }, next: 'again' };
  return { state: { ...free, tries: 0 }, next: value === 6 ? 'again' : 'pass' };
}

/** Move a pawn by the rolled number. `again`: a 6 was rolled, roll once more. */
export function move(
  s: LudoState,
  side: Side,
  pawn: number,
): {
  state: LudoState;
  hit: boolean;
  again: boolean;
} | null {
  const to = target(s, side, pawn, s.die);
  if (to === null) return null;
  const from = s.pawns[side][pawn];
  const mine = s.pawns[side].map((p, i) => (i === pawn ? to : p));
  let theirs = s.pawns[other(side)];
  let hit = false;
  const sq = squareOf(side, to);
  if (sq !== null) {
    theirs = theirs.map((p) => {
      if (squareOf(other(side), p) === sq) {
        hit = true;
        return -1;
      }
      return p;
    });
  }
  const pawns = { [side]: mine, [other(side)]: theirs } as Record<Side, number[]>;
  return {
    state: {
      pawns,
      die: 0,
      tries: 0,
      rolled: s.die,
      last: { side, pawn, from, to, ...(hit ? { hit } : {}) },
    },
    hit,
    again: s.die === 6,
  };
}

export const home = (s: LudoState, side: Side) => s.pawns[side].filter((p) => p >= TRACK).length;
export const won = (s: LudoState, side: Side) => home(s, side) === 4;

/**
 * Coco's choice: send someone home if she can, else come out, else the
 * pawn that gets furthest (but into the lane first when it fits).
 */
export function cocoPawn(s: LudoState, side: Side): number | null {
  const options = movable(s, side, s.die);
  if (!options.length) return null;
  const score = (i: number) => {
    const to = target(s, side, i, s.die)!;
    const sq = squareOf(side, to);
    const hits = sq !== null && s.pawns[other(side)].some((p) => squareOf(other(side), p) === sq);
    const from = s.pawns[side][i];
    return (hits ? 1000 : 0) + (from === -1 ? 500 : 0) + (to >= TRACK ? 300 : 0) + to;
  };
  return options.sort((a, b) => score(b) - score(a))[0];
}

export const rollDie = (rng: () => number = Math.random) => 1 + Math.floor(rng() * 6);

/* ----------------------------------------------------- where it's drawn */

/** The 40 track squares on an 11×11 grid, starting at yellow's start, clockwise. */
export const TRACK_CELLS: [number, number][] = (() => {
  const path: [number, number][] = [];
  const add = (c: number, r: number) => path.push([c, r]);
  // yellow starts bottom-left of the cross, going up
  for (let r = 10; r >= 6; r--) add(4, r);
  for (let c = 3; c >= 0; c--) add(c, 6);
  add(0, 5);
  for (let c = 0; c <= 4; c++) add(c, 4);
  for (let r = 3; r >= 0; r--) add(4, r);
  add(5, 0);
  for (let r = 0; r <= 4; r++) add(6, r);
  for (let c = 7; c <= 10; c++) add(c, 4);
  add(10, 5);
  for (let c = 10; c >= 6; c--) add(c, 6);
  for (let r = 7; r <= 10; r++) add(6, r);
  add(5, 10);
  return path;
})();

/** Each side's finish lane, from the edge to the middle. */
export const LANE_CELLS: Record<Side, [number, number][]> = {
  you: [
    [5, 9],
    [5, 8],
    [5, 7],
    [5, 6],
  ],
  partner: [
    [5, 1],
    [5, 2],
    [5, 3],
    [5, 4],
  ],
};

/** The four home squares in each corner. */
export const HOME_CELLS: Record<Side, [number, number][]> = {
  you: [
    [0, 9],
    [1, 9],
    [0, 10],
    [1, 10],
  ],
  partner: [
    [9, 0],
    [10, 0],
    [9, 1],
    [10, 1],
  ],
};

export function cellOf(side: Side, pos: number, pawn: number): [number, number] {
  if (pos === -1) return HOME_CELLS[side][pawn];
  if (pos >= TRACK) return LANE_CELLS[side][pos - TRACK];
  return TRACK_CELLS[(START[side] + pos) % TRACK];
}
