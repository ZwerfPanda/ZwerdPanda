import type { Person } from '../../data/types';

/**
 * UNO for two. With two players, Skip and Reverse both mean "play again";
 * +2 and +4 make the other draw and skip their turn. If you can't (or don't
 * want to) play, you draw one card; you may play it if it fits, or pass.
 */

export type Color = 'red' | 'yellow' | 'green' | 'blue';
export type Value =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'skip'
  | 'reverse'
  | 'draw2'
  | 'wild'
  | 'wild4';

export interface Card {
  id: string;
  color: Color | 'wild';
  value: Value;
}

export interface UnoState {
  deck: Card[];
  discard: Card[];
  hands: Record<Person, Card[]>;
  /** The colour to follow (a wild sets it). */
  color: Color;
  turn: Person;
  winner?: Person;
  /** The current player already drew this turn. */
  drew?: boolean;
  /** Something to show both players, e.g. "+2 voor jou!". */
  last?: string;
  /** The move just made, to tell the other what happened. */
  move?: { who: Person; kind: 'play' | 'draw' | 'pass'; card?: Card };
}

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];
const other = (p: Person): Person => (p === 'you' ? 'partner' : 'you');

export function newDeck(random = Math.random): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const add = (color: Card['color'], value: Value) => cards.push({ id: `c${n++}`, color, value });
  for (const color of COLORS) {
    add(color, '0');
    for (const v of [
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      'skip',
      'reverse',
      'draw2',
    ] as Value[]) {
      add(color, v);
      add(color, v);
    }
  }
  for (let i = 0; i < 4; i++) {
    add('wild', 'wild');
    add('wild', 'wild4');
  }
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

export function deal(first: Person, random = Math.random): UnoState {
  const deck = newDeck(random);
  const hands: Record<Person, Card[]> = { you: deck.splice(0, 7), partner: deck.splice(0, 7) };
  // Start on a plain number card.
  let start = deck.findIndex((c) => c.color !== 'wild' && /^\d$/.test(c.value));
  if (start < 0) start = 0;
  const [top] = deck.splice(start, 1);
  return { deck, discard: [top], hands, color: top.color as Color, turn: first };
}

export const top = (s: UnoState) => s.discard[s.discard.length - 1];

export function canPlay(card: Card, s: UnoState): boolean {
  const t = top(s);
  return card.color === 'wild' || card.color === s.color || card.value === t.value;
}

/** Takes `count` cards from the deck, reshuffling the discard pile if needed. */
function take(s: UnoState, count: number, random = Math.random): { s: UnoState; cards: Card[] } {
  let deck = s.deck.slice();
  let discard = s.discard.slice();
  const cards: Card[] = [];
  for (let i = 0; i < count; i++) {
    if (!deck.length && discard.length > 1) {
      const keep = discard.pop()!;
      deck = discard;
      for (let k = deck.length - 1; k > 0; k--) {
        const j = Math.floor(random() * (k + 1));
        [deck[k], deck[j]] = [deck[j], deck[k]];
      }
      discard = [keep];
    }
    const card = deck.shift();
    if (card) cards.push(card);
  }
  return { s: { ...s, deck, discard }, cards };
}

export function play(s: UnoState, who: Person, cardId: string, chosen?: Color): UnoState | null {
  if (s.winner || s.turn !== who) return null;
  const card = s.hands[who].find((c) => c.id === cardId);
  if (!card || !canPlay(card, s)) return null;
  if (card.color === 'wild' && !chosen) return null;
  const hand = s.hands[who].filter((c) => c.id !== cardId);
  let next: UnoState = {
    ...s,
    hands: { ...s.hands, [who]: hand },
    discard: [...s.discard, card],
    color: card.color === 'wild' ? chosen! : card.color,
    drew: false,
    last: hand.length === 1 ? 'UNO!' : undefined,
    move: { who, kind: 'play', card },
  };
  if (!hand.length) return { ...next, winner: who, last: undefined };
  const them = other(who);
  let again = false;
  if (card.value === 'skip' || card.value === 'reverse') again = true;
  if (card.value === 'draw2' || card.value === 'wild4') {
    const n = card.value === 'draw2' ? 2 : 4;
    const drawn = take(next, n);
    next = {
      ...drawn.s,
      hands: { ...drawn.s.hands, [them]: [...drawn.s.hands[them], ...drawn.cards] },
      last: `+${n}!`,
    };
    again = true;
  }
  return { ...next, turn: again ? who : them };
}

/** Draw one card; if it can't be played, the turn passes right away. */
export function draw(s: UnoState, who: Person): UnoState | null {
  if (s.winner || s.turn !== who || s.drew) return null;
  const drawn = take(s, 1);
  const card = drawn.cards[0];
  const next: UnoState = {
    ...drawn.s,
    hands: { ...drawn.s.hands, [who]: [...drawn.s.hands[who], ...drawn.cards] },
    drew: true,
    last: undefined,
    move: { who, kind: 'draw' },
  };
  if (!card || !canPlay(card, next)) return { ...next, turn: other(who), drew: false };
  return next;
}

export function pass(s: UnoState, who: Person): UnoState | null {
  if (s.winner || s.turn !== who || !s.drew) return null;
  return { ...s, turn: other(who), drew: false, move: { who, kind: 'pass' } };
}

/** Coco's move: a fitting colour card first, wilds last; picks her best colour. */
export function cocoMove(s: UnoState, who: Person): UnoState {
  const hand = s.hands[who];
  const playable = hand.filter((c) => canPlay(c, s));
  const rank = (c: Card) =>
    c.color === 'wild'
      ? c.value === 'wild4'
        ? 4
        : 3
      : c.value === 'draw2' || c.value === 'skip'
        ? 0
        : 1;
  const pick = playable.sort((a, b) => rank(a) - rank(b))[0];
  if (pick) {
    const counts = COLORS.map((col) => hand.filter((c) => c.color === col).length);
    const best = COLORS[counts.indexOf(Math.max(...counts))];
    return play(s, who, pick.id, best) ?? s;
  }
  if (!s.drew) return draw(s, who) ?? s;
  return pass(s, who) ?? s;
}

export function normalizeUno(v: unknown): UnoState | null {
  if (typeof v !== 'object' || v === null) return null;
  const s = v as Partial<UnoState>;
  if (!Array.isArray(s.deck) || !Array.isArray(s.discard) || !s.hands || !s.discard.length)
    return null;
  if (!Array.isArray(s.hands.you) || !Array.isArray(s.hands.partner)) return null;
  if (!COLORS.includes(s.color as Color)) return null;
  if (s.turn !== 'you' && s.turn !== 'partner') return null;
  return s as UnoState;
}
