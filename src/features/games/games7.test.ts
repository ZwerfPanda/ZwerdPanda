import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import { getContent, replaceContent } from '../../data/store';
import type { GameMatch, Person } from '../../data/types';
import { receive } from '../../sync/live';
import { foldDuels, foldPlan, planDuel, playDuelRound } from './duel';
import { ticketsEarned } from './tickets';
import {
  FREE,
  LINES,
  bingoLine,
  canStamp,
  cocoStamps,
  current as bingoTurn,
  draw,
  newBingo,
  newCard,
  pass,
  readBingo,
  shout,
  stamp,
  type BingoState,
} from './bingo';
import {
  ALL_CARDS,
  HAND_SIZE,
  RANKS,
  ask,
  cocoAsk,
  current as kwTurn,
  fish,
  newGoFish,
  rankOf,
  readGoFish,
  type GoFishState,
} from './kwartet';

/** A repeatable "random". */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const duel = (id: string, scores: Partial<Record<Person, number>>, at: string): GameMatch => ({
  id,
  kind: 'skeeball',
  state: { scores },
  startedBy: scores.you !== undefined ? 'you' : 'partner',
  createdAt: at,
  updatedAt: at,
});

describe('skeeball and bowling duels', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { setTimeout: () => 0 });
    replaceContent(createDefaultContent(), 'remote');
  });

  it('plans: answer their score, practise while waiting, or start one', () => {
    const theirs = [duel('d1', { partner: 180 }, '2026-10-25T10:00:00.000Z')];
    expect(planDuel(theirs, 'skeeball', 'you')).toEqual({ type: 'answer', id: 'd1' });
    expect(planDuel(theirs, 'skeeball', 'partner')).toEqual({
      type: 'practice',
      id: 'd1',
      mine: 180,
    });
    expect(planDuel(theirs, 'bowling', 'you')).toEqual({ type: 'start' });
    expect(planDuel([], 'skeeball', 'you')).toEqual({ type: 'start' });
  });

  it('gives both of us tickets once both scores are in (the bug: it never did)', () => {
    expect(playDuelRound('skeeball', 'you', 230)).toEqual({ type: 'started' });
    let c = getContent();
    expect(ticketsEarned(c, 'you')).toBe(0);
    expect(c.games.matches[0].turn).toBe('partner');
    // Another round while waiting is practice: it doesn't change the duel.
    expect(playDuelRound('skeeball', 'you', 300)).toEqual({ type: 'practice', mine: 230 });

    const out = playDuelRound('skeeball', 'partner', 180);
    expect(out).toMatchObject({ type: 'settled', winner: 'you', tickets: 4 });
    c = getContent();
    expect(c.games.results).toHaveLength(1);
    expect(c.games.results[0]).toMatchObject({
      game: 'skeeball',
      players: ['you', 'partner'],
      winner: 'you',
    });
    expect(ticketsEarned(c, 'you')).toBe(10);
    expect(ticketsEarned(c, 'partner')).toBe(4);
    // A new round starts a new duel.
    expect(playDuelRound('skeeball', 'partner', 90)).toEqual({ type: 'started' });
  });

  it('is a draw on equal scores', () => {
    playDuelRound('bowling', 'partner', 120);
    expect(playDuelRound('bowling', 'you', 120)).toMatchObject({ winner: 'draw', tickets: 6 });
    expect(ticketsEarned(getContent(), 'partner')).toBe(6);
  });

  it('folds two duels started at the same moment into one, counted once', () => {
    const a = duel('d-a', { you: 200 }, '2026-10-25T10:00:00.000Z');
    const b = duel('d-b', { partner: 250 }, '2026-10-25T10:00:01.000Z');
    expect(foldPlan([b, a], 'skeeball')).toEqual({
      into: 'd-a',
      from: 'd-b',
      scores: { you: 200, partner: 250 },
    });
    const c = getContent();
    replaceContent({ ...c, games: { ...c.games, matches: [a, b] } }, 'remote');
    foldDuels('skeeball');
    foldDuels('skeeball');
    const after = getContent();
    expect(after.games.matches.map((m) => [m.id, m.winner])).toEqual([['d-a', 'partner']]);
    expect(after.games.results.map((r) => r.id)).toEqual(['d-a']);
  });

  it('keeps open duels side by side when one arrives over the live line', () => {
    const a = duel('d-a', { you: 200 }, '2026-10-25T10:00:00.000Z');
    const c = getContent();
    replaceContent({ ...c, games: { ...c.games, matches: [a] } }, 'remote');
    receive({ type: 'match', match: duel('d-b', { partner: 250 }, '2026-10-25T10:00:01.000Z') });
    expect(getContent().games.matches.map((m) => m.id)).toEqual(['d-a', 'd-b']);
  });

  it('survives the trip through normalize (new kinds and games are kept)', () => {
    const raw = {
      games: {
        matches: [duel('d1', { you: 3 }, '2026-10-25T10:00:00.000Z')],
        results: [
          { id: 'r', game: 'bingo', players: ['you', 'partner'], winner: 'you', at: 'x' },
          { id: 'k', game: 'kwartet', players: ['you', 'coco'], winner: 'coco', at: 'x' },
        ],
      },
    };
    const c = normalizeContent(raw);
    expect(c.games.matches.map((m) => m.kind)).toEqual(['skeeball']);
    expect(c.games.results.map((r) => r.game)).toEqual(['bingo', 'kwartet']);
  });
});

describe('bingo', () => {
  it('deals cards with five numbers per column and a free heart', () => {
    for (let n = 0; n < 30; n++) {
      const card = newCard(Math.random);
      expect(card[FREE]).toBe(0);
      expect(new Set(card).size).toBe(25);
      card.forEach((v, i) => {
        if (i === FREE) return;
        const col = i % 5;
        expect(v).toBeGreaterThanOrEqual(col * 15 + 1);
        expect(v).toBeLessThanOrEqual(col * 15 + 15);
      });
    }
  });

  it('only lets you stamp numbers that were pulled, and BINGO needs a real line', () => {
    let s = newBingo(['you', 'partner'], seeded(3));
    const card = s.cards.you;
    // Pretend the middle row's balls came out.
    s = { ...s, drawn: [card[10], card[11], card[13]] };
    expect(canStamp(s, 'you', 14)).toBe(false);
    s = stamp(s, 'you', 14);
    expect(s.stamped.you).toEqual([FREE]);
    for (const cell of [10, 11, 13]) s = stamp(s, 'you', cell);
    expect(bingoLine(s, 'you')).toBeNull();
    expect(shout(s, 'you').winner).toBeUndefined();
    s = { ...s, drawn: [...s.drawn, card[14]] };
    s = stamp(s, 'you', 14);
    expect(bingoLine(s, 'you')).toEqual([10, 11, 12, 13, 14]);
    expect(shout(s, 'you')).toMatchObject({ winner: 'you', line: [10, 11, 12, 13, 14] });
  });

  it('takes turns pulling every ball once', () => {
    let s: BingoState = newBingo(['you', 'partner'], seeded(9));
    const rng = seeded(11);
    for (let i = 0; i < 75; i++) {
      expect(bingoTurn(s)).toBe(i % 2 ? 'partner' : 'you');
      s = draw(s, rng);
      expect(draw(s, rng)).toBe(s); // one ball per turn
      s = pass(s);
    }
    expect(new Set(s.drawn).size).toBe(75);
    expect(draw(s, rng)).toBe(s);
  });

  it('lets Coco stamp her card and find her bingo by herself', () => {
    let s = newBingo(['you', 'coco'], seeded(5));
    const rng = seeded(7);
    let rounds = 0;
    while (!s.winner && rounds < 200) {
      s = pass(draw(s, rng));
      s = cocoStamps(s, rng);
      if (bingoLine(s, 'coco')) s = shout(s, 'coco');
      rounds++;
    }
    expect(s.winner).toBe('coco');
    expect(LINES.some((l) => l.join() === s.line?.join())).toBe(true);
  });

  it('reads a game back from a match, and refuses junk', () => {
    const s = newBingo(['you', 'partner'], seeded(2));
    expect(readBingo(JSON.parse(JSON.stringify(s)))).toEqual({
      ...s,
      winner: undefined,
      line: undefined,
    });
    expect(readBingo({ seats: ['you'], cards: { you: [1, 2] } })).toBeNull();
    expect(readBingo(null)).toBeNull();
  });
});

describe('go fish', () => {
  const total = (s: GoFishState) =>
    s.seats.reduce((n, p) => n + s.hands[p].length + s.books[p].length * 4, 0) + s.pond.length;
  const game = (over: Partial<GoFishState>): GoFishState => ({
    v: 2,
    seats: ['you', 'partner'],
    hands: { you: [], partner: [] },
    pond: [],
    books: { you: [], partner: [] },
    turn: 0,
    phase: 'ask',
    log: [],
    ...over,
  });

  it('deals seven each from a deck of 52, the rest in the pond', () => {
    const s = newGoFish(['you', 'partner'], seeded(4));
    expect(ALL_CARDS).toHaveLength(52);
    expect(s.hands.you.length + s.books.you.length * 4).toBe(HAND_SIZE);
    expect(s.pond.length).toBe(38);
    expect(total(s)).toBe(52);
  });

  it('hands over every card of the asked rank, and you go again', () => {
    const s = game({
      hands: { you: ['K-S'], partner: ['K-C', 'K-D', '3-H'] },
      pond: ['7-S'],
    });
    expect(ask(s, '3')).toBe(s); // you can only ask for what you hold
    const got = ask(s, 'K');
    expect(got.hands.you.sort()).toEqual(['K-C', 'K-D', 'K-S']);
    expect(got.hands.partner).toEqual(['3-H']);
    expect(got.log.at(-1)).toMatchObject({ type: 'ask', rank: 'K', got: 2 });
    expect(kwTurn(got)).toBe('you');
  });

  it('go fish: take one, and the turn passes unless it is what you asked for', () => {
    const s = game({ hands: { you: ['Q-H'], partner: ['2-S'] }, pond: ['7-S'] });
    const miss = ask(s, 'Q');
    expect(miss.phase).toBe('fish');
    expect(miss.log.at(-1)).toMatchObject({ got: 0 });
    const fished = fish(miss);
    expect(fished.hands.you).toContain('7-S');
    expect(kwTurn(fished)).toBe('partner');
    const lucky = fish({ ...miss, pond: ['Q-S'] });
    expect(kwTurn(lucky)).toBe('you');
    expect(lucky.log.at(-1)).toMatchObject({ type: 'fish', lucky: true });
  });

  it('four of a rank make a book, and the most books wins', () => {
    const rest = RANKS.filter((r) => r !== 'A');
    const s = game({
      seats: ['you', 'coco'],
      hands: { you: ['A-S', 'A-H', 'A-D'], coco: ['A-C'] },
      books: { you: rest.slice(0, 6), coco: rest.slice(6) },
    });
    const end = ask(s, 'A');
    expect(end.books.you).toContain('A');
    expect(end.log.at(-1)).toMatchObject({ type: 'book', who: 'you', rank: 'A' });
    expect(end.winner).toBe('you'); // 7–6
  });

  it('plays whole games against Coco to the end', () => {
    for (let seed = 1; seed < 15; seed++) {
      const rng = seeded(seed);
      let s = newGoFish(['you', 'coco'], rng);
      for (let step = 0; step < 800 && !s.winner; step++) {
        const who = kwTurn(s);
        if (s.phase === 'fish') s = fish(s);
        else {
          const rank = who === 'coco' ? cocoAsk(s, rng) : rankOf(s.hands[who][0]);
          s = rank ? ask(s, rank) : fish({ ...s, phase: 'fish' });
        }
        expect(total(s)).toBe(52);
      }
      expect(s.winner).toBeDefined();
      expect(s.books.you.length + s.books.coco.length).toBe(13);
    }
  });

  it('lets Coco ask for what you asked her about', () => {
    const s = game({
      seats: ['you', 'coco'],
      hands: { you: ['9-S'], coco: ['5-H', '9-D'] },
      turn: 1,
      log: [{ type: 'ask', who: 'you', rank: '9', got: 0 }],
    });
    expect(cocoAsk(s, () => 0)).toBe('9');
  });

  it('reads a game back from a match, and starts over on an old fish-kwartet game', () => {
    const s = newGoFish(['you', 'partner'], seeded(8));
    expect(readGoFish(JSON.parse(JSON.stringify(s)))).toEqual({
      ...s,
      asked: undefined,
      winner: undefined,
    });
    expect(readGoFish({ seats: ['you', 'partner'], hands: { you: ['krab:papa'] } })).toBeNull();
  });
});
