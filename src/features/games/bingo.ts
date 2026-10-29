import type { Player } from '../../data/types';

/**
 * Bingo for two (or one of us and Coco): a 5×5 card each, B 1–15, I 16–30,
 * N 31–45, G 46–60, O 61–75, with a free heart in the middle. Turn by turn
 * one of us pulls a ball; you stamp your own numbers, and the first with a
 * full row, column or diagonal who shouts BINGO wins.
 *
 * Only the one whose turn it is changes the game, so two phones never write
 * at the same time.
 */

export const LETTERS = ['B', 'I', 'N', 'G', 'O'] as const;
export const FREE = 12;
export const LAST_BALL = 75;

export interface BingoState {
  /** In turn order. */
  seats: Player[];
  /** 25 numbers per seat, row by row; the middle one is 0 (free). */
  cards: Record<string, number[]>;
  /** Balls pulled so far, in order. */
  drawn: number[];
  /** Stamped cells per seat (indices into the card). */
  stamped: Record<string, number[]>;
  /** Whose turn: an index into seats. */
  turn: number;
  /** draw: pull a ball · stamp: the ball is out, stamp it, then the turn passes. */
  phase: 'draw' | 'stamp';
  winner?: Player;
  /** The line that won. */
  line?: number[];
}

type Rng = () => number;

function shuffle<T>(list: T[], rng: Rng): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function newCard(rng: Rng): number[] {
  const columns = LETTERS.map((_, c) =>
    shuffle(
      Array.from({ length: 15 }, (_, i) => c * 15 + i + 1),
      rng,
    ).slice(0, 5),
  );
  const card: number[] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) card.push(columns[c][r]);
  card[FREE] = 0;
  return card;
}

export function newBingo(seats: Player[], rng: Rng = Math.random): BingoState {
  const cards: Record<string, number[]> = {};
  const stamped: Record<string, number[]> = {};
  for (const s of seats) {
    cards[s] = newCard(rng);
    stamped[s] = [FREE];
  }
  return { seats, cards, drawn: [], stamped, turn: 0, phase: 'draw' };
}

export const letterOf = (n: number) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];
export const ballName = (n: number) => `${letterOf(n)}-${n}`;

/** Every row, column and diagonal. */
export const LINES: number[][] = [
  ...Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => r * 5 + c)),
  ...Array.from({ length: 5 }, (_, c) => Array.from({ length: 5 }, (_, r) => r * 5 + c)),
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

/** A full line among these stamps (only stamps of balls that were really pulled count). */
export function bingoLine(s: BingoState, seat: Player): number[] | null {
  const card = s.cards[seat];
  if (!card) return null;
  const drawn = new Set(s.drawn);
  const ok = new Set((s.stamped[seat] ?? []).filter((i) => i === FREE || drawn.has(card[i])));
  return LINES.find((line) => line.every((i) => ok.has(i))) ?? null;
}

/** How many more stamps the best line still needs (0: bingo). */
export function closest(s: BingoState, seat: Player): number {
  const stamped = new Set(s.stamped[seat] ?? []);
  return Math.min(...LINES.map((line) => line.filter((i) => !stamped.has(i)).length));
}

export const current = (s: BingoState) => s.seats[s.turn % s.seats.length];

export function draw(s: BingoState, rng: Rng = Math.random): BingoState {
  if (s.winner || s.phase !== 'draw') return s;
  const left = Array.from({ length: LAST_BALL }, (_, i) => i + 1).filter(
    (n) => !s.drawn.includes(n),
  );
  if (!left.length) return s;
  const ball = left[Math.floor(rng() * left.length) % left.length];
  return { ...s, drawn: [...s.drawn, ball], phase: 'stamp' };
}

/** A cell on this card you may stamp: its ball is out and it isn't stamped yet. */
export function canStamp(s: BingoState, seat: Player, cell: number): boolean {
  const card = s.cards[seat];
  if (!card || s.winner) return false;
  return !(s.stamped[seat] ?? []).includes(cell) && s.drawn.includes(card[cell]);
}

export function stamp(s: BingoState, seat: Player, cell: number): BingoState {
  if (!canStamp(s, seat, cell)) return s;
  return { ...s, stamped: { ...s.stamped, [seat]: [...(s.stamped[seat] ?? []), cell] } };
}

/** Shouting BINGO: only true with a real line. */
export function shout(s: BingoState, seat: Player): BingoState {
  if (s.winner) return s;
  const line = bingoLine(s, seat);
  return line ? { ...s, winner: seat, line } : s;
}

export function pass(s: BingoState): BingoState {
  if (s.winner) return s;
  return { ...s, turn: (s.turn + 1) % s.seats.length, phase: 'draw' };
}

/** The ball just pulled, and whether this seat still has it to stamp. */
export function newestFor(s: BingoState, seat: Player): { ball: number; cell: number } | null {
  const ball = s.drawn[s.drawn.length - 1];
  const card = s.cards[seat];
  if (ball === undefined || !card) return null;
  const cell = card.indexOf(ball);
  return cell >= 0 && !(s.stamped[seat] ?? []).includes(cell) ? { ball, cell } : null;
}

/** Numbers on this card whose ball is out but which aren't stamped yet. */
export const missed = (s: BingoState, seat: Player) =>
  (s.cards[seat] ?? []).map((_, i) => i).filter((i) => canStamp(s, seat, i));

/** Automatic play: every number of yours that's out, stamped at once. */
export function autoStamp(s: BingoState, seat: Player): BingoState {
  return missed(s, seat).reduce((next, cell) => stamp(next, seat, cell), s);
}

/**
 * Coco stamps her card: she nearly always sees her number, but now and then
 * she's busy with a carrot and catches up later.
 */
export function cocoStamps(s: BingoState, rng: Rng = Math.random): BingoState {
  let next = s;
  for (const cell of missed(s, 'coco')) if (rng() < 0.85) next = stamp(next, 'coco', cell);
  return next;
}

export function readBingo(raw: unknown): BingoState | null {
  const s = raw as Partial<BingoState> | undefined;
  if (!s || !Array.isArray(s.seats) || !s.cards || typeof s.cards !== 'object') return null;
  const nums = (v: unknown) =>
    Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : [];
  const cards: Record<string, number[]> = {};
  const stamped: Record<string, number[]> = {};
  for (const seat of s.seats) {
    const card = nums((s.cards as Record<string, unknown>)[seat]);
    if (card.length !== 25) return null;
    cards[seat] = card;
    stamped[seat] = nums((s.stamped as Record<string, unknown> | undefined)?.[seat]);
  }
  return {
    seats: s.seats,
    cards,
    stamped,
    drawn: nums(s.drawn),
    turn: typeof s.turn === 'number' ? s.turn : 0,
    phase: s.phase === 'stamp' ? 'stamp' : 'draw',
    winner: s.winner,
    line: s.line ? nums(s.line) : undefined,
  };
}

/** What the caller says with a ball (just for fun). */
const CALLS: Record<number, string> = {
  1: 'de allereerste!',
  7: 'geluksnummer 🍀',
  11: 'twee stokjes',
  13: 'ongeluksgetal… of toch niet?',
  22: 'twee zwaantjes 🦢🦢',
  33: 'twee bultjes',
  44: 'twee stoeltjes',
  50: 'een halve eeuw',
  55: 'twee vlaggetjes',
  66: 'twee kikkertjes 🐸',
  69: 'oh là là 😏',
  75: 'de allerlaatste!',
};
export const callFor = (n: number) => CALLS[n] ?? null;
