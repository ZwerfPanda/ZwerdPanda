import type { Player } from '../../data/types';

/**
 * Kwartet under water: eight families of sea creatures, four of each (papa,
 * mama, kind, baby). On your turn you ask the other for a card of a family
 * you already have. Got it? Ask again. Not? "Vissen!" — you take one from the
 * pond, and if that's just the one you asked for, you go again. Four of a
 * family make a kwartet; whoever has the most kwartetten at the end wins.
 *
 * Only the one whose turn it is changes the game, so two phones never write
 * at the same time.
 */

export interface Family {
  id: string;
  emoji: string;
  /** One of them, as on a card: "Papa Krab". */
  name: string;
  tint: string;
}

export const FAMILIES: Family[] = [
  { id: 'tropenvis', emoji: '🐠', name: 'Tropenvis', tint: '#ffd8a8' },
  { id: 'kogelvis', emoji: '🐡', name: 'Kogelvis', tint: '#fff1a8' },
  { id: 'haai', emoji: '🦈', name: 'Haai', tint: '#c9d6e8' },
  { id: 'dolfijn', emoji: '🐬', name: 'Dolfijn', tint: '#c9e4f5' },
  { id: 'walvis', emoji: '🐳', name: 'Walvis', tint: '#bfe3ff' },
  { id: 'octopus', emoji: '🐙', name: 'Octopus', tint: '#f9d0e0' },
  { id: 'krab', emoji: '🦀', name: 'Krab', tint: '#ffc9b8' },
  { id: 'garnaal', emoji: '🦐', name: 'Garnaal', tint: '#ffd6e0' },
];

export interface Member {
  id: string;
  name: string;
  /** What they wear on the card. */
  badge: string;
}

export const MEMBERS: Member[] = [
  { id: 'papa', name: 'Papa', badge: '🎩' },
  { id: 'mama', name: 'Mama', badge: '🎀' },
  { id: 'kind', name: 'Kind', badge: '🎒' },
  { id: 'baby', name: 'Baby', badge: '🍼' },
];

export const ALL_CARDS = FAMILIES.flatMap((f) => MEMBERS.map((m) => `${f.id}:${m.id}`));
export const HAND_SIZE = 7;

export const familyOf = (card: string) => card.slice(0, card.indexOf(':'));
export const memberOf = (card: string) => card.slice(card.indexOf(':') + 1);
export const family = (id: string) => FAMILIES.find((f) => f.id === id)!;
export const member = (id: string) => MEMBERS.find((m) => m.id === id)!;
export const cardName = (card: string) =>
  `${member(memberOf(card)).name} ${family(familyOf(card)).name}`;

export type KwartetEvent =
  /** Asked the other for a card. */
  | { type: 'ask'; who: Player; card: string; got: boolean }
  /** Took one from the pond (lucky: the very card they asked for). */
  | { type: 'fish'; who: Player; card: string; lucky: boolean }
  | { type: 'kwartet'; who: Player; family: string };

export interface KwartetState {
  seats: Player[];
  hands: Record<string, string[]>;
  /** The pond, face down; you fish from the end. */
  pond: string[];
  /** Families laid down, per seat. */
  sets: Record<string, string[]>;
  turn: number;
  /** ask: pick a card to ask for · fish: no luck, take one from the pond. */
  phase: 'ask' | 'fish';
  /** What was asked for, while fishing. */
  asked?: string;
  /** The last few things that happened, newest last. */
  log: KwartetEvent[];
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

export const current = (s: KwartetState) => s.seats[s.turn % s.seats.length];
export const opponent = (s: KwartetState, seat: Player) => s.seats.find((p) => p !== seat)!;

const LOG = 8;
const logged = (s: KwartetState, e: KwartetEvent): KwartetState => ({
  ...s,
  log: [...s.log, e].slice(-LOG),
});

/** Full families leave the hand and go on the table. */
function layDown(s: KwartetState, seat: Player): KwartetState {
  let next = s;
  const hand = next.hands[seat] ?? [];
  for (const f of new Set(hand.map(familyOf))) {
    if (hand.filter((c) => familyOf(c) === f).length < MEMBERS.length) continue;
    next = logged(
      {
        ...next,
        hands: { ...next.hands, [seat]: next.hands[seat].filter((c) => familyOf(c) !== f) },
        sets: { ...next.sets, [seat]: [...(next.sets[seat] ?? []), f] },
      },
      { type: 'kwartet', who: seat, family: f },
    );
  }
  return next;
}

/** Ends the game when every family is down; an empty hand takes a card from the pond. */
function settle(s: KwartetState): KwartetState {
  const down = s.seats.reduce((n, p) => n + (s.sets[p]?.length ?? 0), 0);
  if (down >= FAMILIES.length) {
    const [a, b] = s.seats.map((p) => s.sets[p]?.length ?? 0);
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

export function newKwartet(seats: Player[], rng: Rng = Math.random): KwartetState {
  const deck = shuffle(ALL_CARDS, rng);
  const hands: Record<string, string[]> = {};
  const sets: Record<string, string[]> = {};
  seats.forEach((p, i) => {
    hands[p] = deck.slice(i * HAND_SIZE, (i + 1) * HAND_SIZE);
    sets[p] = [];
  });
  let s: KwartetState = {
    seats,
    hands,
    pond: deck.slice(seats.length * HAND_SIZE),
    sets,
    turn: 0,
    phase: 'ask',
    log: [],
  };
  for (const p of seats) s = layDown(s, p);
  return settle(s);
}

/** Cards you may ask for: from a family you hold, that you don't have yourself. */
export function askable(s: KwartetState, seat: Player): string[] {
  const hand = s.hands[seat] ?? [];
  const families = new Set(hand.map(familyOf));
  return ALL_CARDS.filter((c) => families.has(familyOf(c)) && !hand.includes(c));
}

export function ask(s: KwartetState, card: string): KwartetState {
  if (s.winner || s.phase !== 'ask') return s;
  const who = current(s);
  if (!askable(s, who).includes(card)) return s;
  const from = opponent(s, who);
  const got = (s.hands[from] ?? []).includes(card);
  if (!got) return logged({ ...s, phase: 'fish', asked: card }, { type: 'ask', who, card, got });
  const next = logged(
    {
      ...s,
      hands: {
        ...s.hands,
        [from]: s.hands[from].filter((c) => c !== card),
        [who]: [...s.hands[who], card],
      },
    },
    { type: 'ask', who, card, got },
  );
  return settle(layDown(next, who));
}

export function fish(s: KwartetState): KwartetState {
  if (s.winner || s.phase !== 'fish') return s;
  const who = current(s);
  const passed = (x: KwartetState): KwartetState => ({
    ...x,
    phase: 'ask',
    asked: undefined,
    turn: (x.turn + 1) % x.seats.length,
  });
  if (!s.pond.length) return settle(passed(s));
  const card = s.pond[s.pond.length - 1];
  const lucky = card === s.asked;
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
 * What Coco asks for. She goes for families the other has asked about (so they
 * have some), and for the families she holds most of. She doesn't remember
 * everything.
 */
export function cocoAsk(s: KwartetState, rng: Rng = Math.random): string | null {
  const options = askable(s, 'coco');
  if (!options.length) return null;
  const other = opponent(s, 'coco');
  const hinted = new Set(
    s.log
      .filter((e) => e.type === 'ask' && e.who === other && rng() < 0.75)
      .map((e) => familyOf((e as { card: string }).card)),
  );
  const hand = s.hands.coco ?? [];
  const weight = (c: string) =>
    (hinted.has(familyOf(c)) ? 3 : 0) +
    hand.filter((h) => familyOf(h) === familyOf(c)).length +
    rng() * 1.5;
  return options.slice().sort((a, b) => weight(b) - weight(a))[0];
}

export function readKwartet(raw: unknown): KwartetState | null {
  const s = raw as Partial<KwartetState> | undefined;
  if (!s || !Array.isArray(s.seats) || s.seats.length !== 2 || !s.hands) return null;
  const cards = (v: unknown) =>
    Array.isArray(v) ? v.filter((c): c is string => ALL_CARDS.includes(c as string)) : [];
  const fams = (v: unknown) =>
    Array.isArray(v) ? v.filter((f): f is string => FAMILIES.some((x) => x.id === f)) : [];
  const hands: Record<string, string[]> = {};
  const sets: Record<string, string[]> = {};
  for (const p of s.seats) {
    hands[p] = cards((s.hands as Record<string, unknown>)[p]);
    sets[p] = fams((s.sets as Record<string, unknown> | undefined)?.[p]);
  }
  return {
    seats: s.seats,
    hands,
    sets,
    pond: cards(s.pond),
    turn: typeof s.turn === 'number' ? s.turn : 0,
    phase: s.phase === 'fish' ? 'fish' : 'ask',
    asked: typeof s.asked === 'string' ? s.asked : undefined,
    log: Array.isArray(s.log) ? s.log.slice(-LOG) : [],
    winner: s.winner,
  };
}
