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
  FAMILIES,
  HAND_SIZE,
  ask,
  askable,
  cocoAsk,
  current as kwTurn,
  familyOf,
  fish,
  newKwartet,
  readKwartet,
  type KwartetState,
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

describe('kwartet', () => {
  const total = (s: KwartetState) =>
    s.seats.reduce((n, p) => n + s.hands[p].length + s.sets[p].length * 4, 0) + s.pond.length;

  it('deals seven each and keeps every card exactly once', () => {
    const s = newKwartet(['you', 'partner'], seeded(4));
    expect(ALL_CARDS).toHaveLength(FAMILIES.length * 4);
    expect(s.hands.you.length + s.sets.you.length * 4).toBe(HAND_SIZE);
    expect(total(s)).toBe(32);
  });

  it('gives you the card when they have it, and you go again', () => {
    const s: KwartetState = {
      seats: ['you', 'partner'],
      hands: { you: ['krab:papa'], partner: ['krab:mama', 'haai:baby'] },
      pond: ['walvis:kind'],
      sets: { you: [], partner: [] },
      turn: 0,
      phase: 'ask',
      log: [],
    };
    expect(askable(s, 'you')).toEqual(['krab:mama', 'krab:kind', 'krab:baby']);
    expect(ask(s, 'haai:baby')).toBe(s); // not a family you hold
    const got = ask(s, 'krab:mama');
    expect(got.hands.you).toEqual(['krab:papa', 'krab:mama']);
    expect(kwTurn(got)).toBe('you');
    expect(got.phase).toBe('ask');
    // Not there: fish, and the turn passes (unless it's the one you asked for).
    const miss = ask(got, 'krab:baby');
    expect(miss.phase).toBe('fish');
    const fished = fish(miss);
    expect(fished.hands.you).toContain('walvis:kind');
    expect(kwTurn(fished)).toBe('partner');
    const lucky = fish({ ...miss, pond: ['krab:baby'] });
    expect(kwTurn(lucky)).toBe('you');
  });

  it('lays down a kwartet and ends when every family is down', () => {
    const others = FAMILIES.slice(1).map((f) => f.id);
    const s: KwartetState = {
      seats: ['you', 'coco'],
      hands: { you: ['krab:papa', 'krab:mama', 'krab:kind'], coco: ['krab:baby'] },
      pond: [],
      sets: { you: others.slice(0, 3), coco: others.slice(3) },
      turn: 0,
      phase: 'ask',
      log: [],
    };
    const end = ask(s, 'krab:baby');
    expect(end.sets.you).toContain('krab');
    expect(end.log.at(-1)).toMatchObject({ type: 'kwartet', who: 'you', family: 'krab' });
    expect(end.winner).toBe('draw'); // 4–4
  });

  it('plays a whole game against Coco to the end', () => {
    for (let seed = 1; seed < 15; seed++) {
      const rng = seeded(seed);
      let s = newKwartet(['you', 'coco'], rng);
      for (let step = 0; step < 500 && !s.winner; step++) {
        const who = kwTurn(s);
        if (s.phase === 'fish') s = fish(s);
        else {
          const card = who === 'coco' ? cocoAsk(s, rng) : askable(s, who)[0];
          s = card ? ask(s, card) : fish({ ...s, phase: 'fish' });
        }
        expect(total(s)).toBe(32);
      }
      expect(s.winner).toBeDefined();
      expect(s.sets.you.length + s.sets.coco.length).toBe(8);
      for (const p of s.seats) expect(s.hands[p]).toEqual([]);
    }
  });

  it('lets Coco ask about families you asked her about', () => {
    const s: KwartetState = {
      seats: ['you', 'coco'],
      hands: { you: ['haai:papa'], coco: ['krab:papa', 'haai:mama'] },
      pond: [],
      sets: { you: [], coco: [] },
      turn: 1,
      phase: 'ask',
      log: [{ type: 'ask', who: 'you', card: 'haai:mama', got: true }],
    };
    expect(familyOf(cocoAsk(s, () => 0)!)).toBe('haai');
  });

  it('reads a game back from a match', () => {
    const s = newKwartet(['you', 'partner'], seeded(8));
    expect(readKwartet(JSON.parse(JSON.stringify(s)))).toEqual({
      ...s,
      asked: undefined,
      winner: undefined,
    });
    expect(readKwartet({ seats: ['you'] })).toBeNull();
  });
});
