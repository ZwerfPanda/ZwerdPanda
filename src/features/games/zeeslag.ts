import type { Person } from '../../data/types';

/** Zeeslag on an 8 × 8 sea: small enough to tap on a phone. */
export const SIZE = 8;
export const FLEET = [4, 3, 3, 2, 2] as const;
/** Our fleet: the pancake boats of the Amsterdam canals. */
export const SHIP_NAMES: Record<number, string> = {
  4: 'de Grote Pannenkoekenboot',
  3: 'een Stroopwafelboot',
  2: 'een Poffertjesbootje',
};

export interface Ship {
  cells: number[];
}

export interface SeaState {
  ships: Partial<Record<Person, Ship[]>>;
  shots: Record<Person, number[]>;
}

const rowOf = (i: number) => Math.floor(i / SIZE);
const colOf = (i: number) => i % SIZE;

/** A whole fleet, placed at random without ships touching each other. */
export function randomFleet(random = Math.random): Ship[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const taken = new Set<number>();
    const ships: Ship[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 100 && !placed; tries++) {
        const across = random() < 0.5;
        const r = Math.floor(random() * (across ? SIZE : SIZE - len + 1));
        const c = Math.floor(random() * (across ? SIZE - len + 1 : SIZE));
        const cells = Array.from({ length: len }, (_, k) =>
          across ? r * SIZE + c + k : (r + k) * SIZE + c,
        );
        if (cells.some((cell) => near(cell).some((n) => taken.has(n)))) continue;
        cells.forEach((cell) => taken.add(cell));
        ships.push({ cells });
        placed = true;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return ships;
  }
  throw new Error('no room for the fleet');
}

/** The cell itself and its eight neighbours that are on the sea. */
function near(i: number): number[] {
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const r = rowOf(i) + dr;
      const c = colOf(i) + dc;
      if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) out.push(r * SIZE + c);
    }
  return out;
}

/** Up, down, left, right. */
export function neighbours(i: number): number[] {
  const r = rowOf(i);
  const c = colOf(i);
  return [
    r > 0 ? i - SIZE : -1,
    r < SIZE - 1 ? i + SIZE : -1,
    c > 0 ? i - 1 : -1,
    c < SIZE - 1 ? i + 1 : -1,
  ].filter((n) => n >= 0);
}

export const isSunk = (ship: Ship, shots: number[]) => ship.cells.every((c) => shots.includes(c));
export const allSunk = (ships: Ship[], shots: number[]) =>
  ships.length > 0 && ships.every((s) => isSunk(s, shots));

export type ShotResult = 'miss' | 'hit' | 'sunk';

export function shotResult(ships: Ship[], shots: number[], cell: number): ShotResult {
  const ship = ships.find((s) => s.cells.includes(cell));
  if (!ship) return 'miss';
  return isSunk(ship, [...shots, cell]) ? 'sunk' : 'hit';
}

/**
 * Coco's next shot. She finishes off a ship she has hit (following the line
 * once she has two hits), and otherwise searches in a checkerboard, skipping
 * water around ships she already sank — ships never touch.
 */
export function cocoShot(theirShips: Ship[], shots: number[], random = Math.random): number {
  const fired = new Set(shots);
  const sunk = theirShips.filter((s) => isSunk(s, shots));
  const sunkCells = new Set(sunk.flatMap((s) => s.cells));
  const ruledOut = new Set<number>([...sunkCells].flatMap((c) => near(c)));
  const open = (c: number) => !fired.has(c) && !ruledOut.has(c);
  const hits = shots.filter(
    (c) => !sunkCells.has(c) && theirShips.some((s) => s.cells.includes(c)),
  );
  if (hits.length) {
    if (hits.length >= 2) {
      const across = rowOf(hits[0]) === rowOf(hits[1]);
      const line = hits.filter((h) =>
        across ? rowOf(h) === rowOf(hits[0]) : colOf(h) === colOf(hits[0]),
      );
      const ends = [Math.min(...line), Math.max(...line)];
      const step = across ? 1 : SIZE;
      const candidates = [ends[0] - step, ends[1] + step].filter(
        (c) =>
          c >= 0 && c < SIZE * SIZE && (across ? rowOf(c) === rowOf(hits[0]) : true) && open(c),
      );
      if (candidates.length) return candidates[Math.floor(random() * candidates.length)];
    }
    const around = hits.flatMap((h) => neighbours(h)).filter(open);
    if (around.length) return around[Math.floor(random() * around.length)];
  }
  const all = Array.from({ length: SIZE * SIZE }, (_, i) => i).filter(open);
  const checker = all.filter((i) => (rowOf(i) + colOf(i)) % 2 === 0);
  const pool = checker.length ? checker : all;
  return pool[Math.floor(random() * pool.length)] ?? 0;
}

/** Reads a synced sea, dropping anything that doesn't fit. */
export function normalizeSea(raw: unknown): SeaState {
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const cells = (v: unknown) =>
    Array.isArray(v)
      ? [...new Set(v.filter((c): c is number => Number.isInteger(c) && c >= 0 && c < SIZE * SIZE))]
      : [];
  const fleet = (v: unknown): Ship[] | undefined =>
    Array.isArray(v)
      ? v
          .map((s) => ({ cells: cells(obj(s).cells) }))
          .filter((s) => s.cells.length > 0)
          .slice(0, FLEET.length)
      : undefined;
  const r = obj(raw);
  const ships = obj(r.ships);
  const shots = obj(r.shots);
  const out: SeaState = {
    ships: {},
    shots: { you: cells(shots.you), partner: cells(shots.partner) },
  };
  const you = fleet(ships.you);
  const partner = fleet(ships.partner);
  if (you?.length) out.ships.you = you;
  if (partner?.length) out.ships.partner = partner;
  return out;
}
