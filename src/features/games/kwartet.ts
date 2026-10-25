import type { Player } from '../../data/types';

/**
 * Go Fish, with a normal deck of 52. On your turn you ask the other for a
 * rank you hold yourself — kings, aces, threes. They hand over every card
 * of that rank they have, and you go again. Have they none? "Go Fish!": you
 * take one from the pond, and if it's just what you asked for, you go
 * again. Four of a rank make a book; whoever has the most books at the end
 * wins.
 *
 * Only the one whose turn it is changes the game, so two phones never write
 * at the same time. (The match kind is still called 'kwartet'.)
 */

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];
export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

/** A card is "rank-suit", like "K-S". */
export const ALL_CARDS = RANKS.flatMap((r) => SUITS.map((s) => `${r}-${s}`));
export const HAND_SIZE = 7;

export const rankOf = (card: string) => card.slice(0, card.indexOf('-')) as Rank;
export const suitOf = (card: string) => card.slice(card.indexOf('-') + 1) as Suit;

export const SUIT_SIGN: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const isRed = (card: string) => suitOf(card) === 'H' || suitOf(card) === 'D';

/** Each rank has its own sea creature on the card. */
export const CREATURE: Record<Rank, string> = {
  A: '🐙',
  '2': '🦐',
  '3': '🐠',
  '4': '🐡',
  '5': '🦀',
  '6': '🐚',
  '7': '🐢',
  '8': '🦭',
  '9': '🐬',
  '10': '🐳',
  J: '🦞',
  Q: '🦑',
  K: '🦈',
};

const ONE: Record<Rank, string> = {
  A: 'aas',
  '2': 'twee',
  '3': 'drie',
  '4': 'vier',
  '5': 'vijf',
  '6': 'zes',
  '7': 'zeven',
  '8': 'acht',
  '9': 'negen',
  '10': 'tien',
  J: 'boer',
  Q: 'vrouw',
  K: 'koning',
};
const MANY: Record<Rank, string> = {
  A: 'azen',
  '2': 'tweetjes',
  '3': 'drietjes',
  '4': 'viertjes',
  '5': 'vijfjes',
  '6': 'zesjes',
  '7': 'zevens',
  '8': 'achten',
  '9': 'negens',
  '10': 'tienen',
  J: 'boeren',
  Q: 'vrouwen',
  K: 'koningen',
};
/** "een koning", "3 koningen", "koningen". */
export const rankName = (rank: Rank, n?: number) =>
  n === undefined ? MANY[rank] : n === 1 ? `een ${ONE[rank]}` : `${n} ${MANY[rank]}`;

export type GoFishEvent =
  /** Asked the other for a rank; how many they handed over (0: go fish). */
  | { type: 'ask'; who: Player; rank: Rank; got: number }
  /** Took one from the pond (lucky: the very rank they asked for). */
  | { type: 'fish'; who: Player; card: string; lucky: boolean }
  | { type: 'book'; who: Player; rank: Rank };

export interface GoFishState {
  v: 2;
  seats: Player[];
  hands: Record<string, string[]>;
  /** The pond, face down; you fish from the end. */
  pond: string[];
  /** Books laid down, per seat. */
  books: Record<string, Rank[]>;
  turn: number;
  /** ask: pick a rank to ask for · fish: no luck, take one from the pond. */
  phase: 'ask' | 'fish';
  /** What was asked for, while fishing. */
  asked?: Rank;
  /** The last few things that happened, newest last. */
  log: GoFishEvent[];
  winner?: Player | 'draw';
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

export const current = (s: GoFishState) => s.seats[s.turn % s.seats.length];
export const opponent = (s: GoFishState, seat: Player) => s.seats.find((p) => p !== seat)!;

const LOG = 8;
const logged = (s: GoFishState, e: GoFishEvent): GoFishState => ({
  ...s,
  log: [...s.log, e].slice(-LOG),
});

/** Four of a rank leave the hand and become a book. */
function layDown(s: GoFishState, seat: Player): GoFishState {
  let next = s;
  for (const rank of new Set((next.hands[seat] ?? []).map(rankOf))) {
    if (next.hands[seat].filter((c) => rankOf(c) === rank).length < SUITS.length) continue;
    next = logged(
      {
        ...next,
        hands: { ...next.hands, [seat]: next.hands[seat].filter((c) => rankOf(c) !== rank) },
        books: { ...next.books, [seat]: [...(next.books[seat] ?? []), rank] },
      },
      { type: 'book', who: seat, rank },
    );
  }
  return next;
}

/** Ends the game when every book is down; an empty hand takes a card from the pond. */
function settle(s: GoFishState): GoFishState {
  const down = s.seats.reduce((n, p) => n + (s.books[p]?.length ?? 0), 0);
  if (down >= RANKS.length) {
    const [a, b] = s.seats.map((p) => s.books[p]?.length ?? 0);
    return { ...s, winner: a === b ? 'draw' : a > b ? s.seats[0] : s.seats[1] };
  }
  let next = s;
  // Nothing in your hand on your turn: take one from the pond, or skip your turn.
  for (let guard = 0; guard < 4; guard++) {
    const now = current(next);
    if ((next.hands[now] ?? []).length > 0) break;
    if (next.pond.length) {
      const card = next.pond[next.pond.length - 1];
      next = layDown(
        {
          ...next,
          pond: next.pond.slice(0, -1),
          hands: { ...next.hands, [now]: [...(next.hands[now] ?? []), card] },
        },
        now,
      );
    } else next = { ...next, turn: (next.turn + 1) % next.seats.length };
  }
  return next;
}

export function newGoFish(seats: Player[], rng: Rng = Math.random): GoFishState {
  const deck = shuffle(ALL_CARDS, rng);
  const hands: Record<string, string[]> = {};
  const books: Record<string, Rank[]> = {};
  seats.forEach((p, i) => {
    hands[p] = deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE);
    books[p] = [];
  });
  let s: GoFishState = {
    v: 2,
    seats,
    hands,
    pond: deck.slice(seats.length * HAND_SIZE),
    books,
    turn: 0,
    phase: 'ask',
    log: [],
  };
  for (const p of seats) s = layDown(s, p);
  return settle(s);
}

/** Ranks you may ask for: the ones in your own hand. */
export const askable = (s: GoFishState, seat: Player): Rank[] =>
  RANKS.filter((r) => (s.hands[seat] ?? []).some((c) => rankOf(c) === r));

export function ask(s: GoFishState, rank: Rank): GoFishState {
  if (s.winner || s.phase !== 'ask') return s;
  const who = current(s);
  if (!askable(s, who).includes(rank)) return s;
  const from = opponent(s, who);
  const theirs = (s.hands[from] ?? []).filter((c) => rankOf(c) === rank);
  if (!theirs.length)
    return logged({ ...s, phase: 'fish', asked: rank }, { type: 'ask', who, rank, got: 0 });
  const next = logged(
    {
      ...s,
      hands: {
        ...s.hands,
        [from]: s.hands[from].filter((c) => rankOf(c) !== rank),
        [who]: [...s.hands[who], ...theirs],
      },
    },
    { type: 'ask', who, rank, got: theirs.length },
  );
  return settle(layDown(next, who));
}

export function fish(s: GoFishState): GoFishState {
  if (s.winner || s.phase !== 'fish') return s;
  const who = current(s);
  const passed = (x: GoFishState): GoFishState => ({
    ...x,
    phase: 'ask',
    asked: undefined,
    turn: (x.turn + 1) % x.seats.length,
  });
  if (!s.pond.length) return settle(passed(s));
  const card = s.pond[s.pond.length - 1];
  const lucky = rankOf(card) === s.asked;
  let next = logged(
    {
      ...s,
      pond: s.pond.slice(0, -1),
      hands: { ...s.hands, [who]: [...(s.hands[who] ?? []), card] },
    },
    { type: 'fish', who, card, lucky },
  );
  next = layDown(next, who);
  return settle(lucky ? { ...next, phase: 'ask', asked: undefined } : passed(next));
}

/**
 * What Coco asks for: a rank the other asked about lately (so they hold it),
 * or the rank she has most of. She doesn't remember everything.
 */
export function cocoAsk(s: GoFishState, rng: Rng = Math.random): Rank | null {
  const options = askable(s, 'coco');
  if (!options.length) return null;
  const other = opponent(s, 'coco');
  const hinted = new Set(
    s.log
      .filter((e) => e.type === 'ask' && e.who === other && rng() < 0.75)
      .map((e) => (e as { rank: Rank }).rank),
  );
  const hand = s.hands.coco ?? [];
  const weight = (r: Rank) =>
    (hinted.has(r) ? 3 : 0) + hand.filter((c) => rankOf(c) === r).length + rng() * 1.5;
  return options.slice().sort((a, b) => weight(b) - weight(a))[0];
}

export function readGoFish(raw: unknown): GoFishState | null {
  const s = raw as Partial<GoFishState> | undefined;
  // (An unfinished game of the old fish kwartet isn't this game: it starts anew.)
  if (!s || s.v !== 2 || !Array.isArray(s.seats) || s.seats.length !== 2 || !s.hands) return null;
  const cards = (v: unknown) =>
    Array.isArray(v) ? v.filter((c): c is string => ALL_CARDS.includes(c as string)) : [];
  const ranks = (v: unknown) =>
    Array.isArray(v) ? v.filter((r): r is Rank => RANKS.includes(r as Rank)) : [];
  const hands: Record<string, string[]> = {};
  const books: Record<string, Rank[]> = {};
  for (const p of s.seats) {
    hands[p] = cards((s.hands as Record<string, unknown>)[p]);
    books[p] = ranks((s.books as Record<string, unknown> | undefined)?.[p]);
  }
  return {
    v: 2,
    seats: s.seats,
    hands,
    books,
    pond: cards(s.pond),
    turn: typeof s.turn === 'number' ? s.turn : 0,
    phase: s.phase === 'fish' ? 'fish' : 'ask',
    asked: RANKS.includes(s.asked as Rank) ? s.asked : undefined,
    log: Array.isArray(s.log) ? s.log.slice(-LOG) : [],
    winner: s.winner,
  };
}

/** A hand in order: by rank, then suit. */
export const sortHand = (hand: string[]) =>
  hand
    .slice()
    .sort(
      (a, b) =>
        RANKS.indexOf(rankOf(a)) - RANKS.indexOf(rankOf(b)) ||
        SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)),
    );
