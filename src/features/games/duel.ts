import { getContent, updateContent } from '../../data/store';
import type { GameMatch, Person } from '../../data/types';
import { startMatch, updateMatch } from './gameData';
import { TICKETS } from './tickets';

/**
 * A duel at skeeball or bowling: each of us plays one round, whenever and on
 * whichever phone, and once both scores are in the higher one wins. That's a
 * real game against each other, so it earns tickets like the others do.
 */

export type DuelKind = 'skeeball' | 'bowling';
export type DuelScores = Partial<Record<Person, number>>;

const other = (p: Person): Person => (p === 'you' ? 'partner' : 'you');

export function duelScores(m: GameMatch | undefined): DuelScores {
  const raw = (m?.state as { scores?: Record<string, unknown> } | undefined)?.scores ?? {};
  const out: DuelScores = {};
  for (const p of ['you', 'partner'] as const) {
    const v = raw[p];
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[p] = v;
  }
  return out;
}

export const duelWinner = (s: DuelScores): Person | 'draw' | undefined =>
  s.you === undefined || s.partner === undefined
    ? undefined
    : s.you === s.partner
      ? 'draw'
      : s.you > s.partner
        ? 'you'
        : 'partner';

/** Open duels of this game, the oldest first. */
export const openDuels = (matches: GameMatch[], kind: DuelKind) =>
  matches
    .filter((m) => m.kind === kind && !m.winner)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

export type DuelPlan =
  /** They've thrown, we haven't: ours settles it. */
  | { type: 'answer'; id: string }
  /** We already threw in an open duel: this round is just practice. */
  | { type: 'practice'; id: string; mine: number }
  | { type: 'start' };

export function planDuel(matches: GameMatch[], kind: DuelKind, me: Person): DuelPlan {
  const open = openDuels(matches, kind);
  const theirs = open.find((m) => {
    const s = duelScores(m);
    return s[me] === undefined && s[other(me)] !== undefined;
  });
  if (theirs) return { type: 'answer', id: theirs.id };
  const mine = open.find((m) => duelScores(m)[me] !== undefined);
  if (mine) return { type: 'practice', id: mine.id, mine: duelScores(mine)[me]! };
  return { type: 'start' };
}

/** What a duel's result is worth to `me`. */
export const ticketsFor = (winner: Person | 'draw', me: Person) =>
  winner === me ? TICKETS.win : winner === 'draw' ? TICKETS.draw : TICKETS.played;

export type DuelOutcome =
  | { type: 'started' }
  | { type: 'practice'; mine: number }
  | { type: 'settled'; winner: Person | 'draw'; scores: DuelScores; tickets: number };

/** My round is done: put my score in a duel. */
export function playDuelRound(kind: DuelKind, me: Person, score: number): DuelOutcome {
  const plan = planDuel(getContent().games.matches, kind, me);
  if (plan.type === 'practice') return { type: 'practice', mine: plan.mine };
  if (plan.type === 'start') {
    startMatch(kind, { scores: { [me]: score } }, other(me), me);
    return { type: 'started' };
  }
  let settled: DuelOutcome = { type: 'started' };
  updateMatch(plan.id, (m) => {
    const scores = { ...duelScores(m), [me]: score };
    const winner = duelWinner(scores);
    if (winner) settled = { type: 'settled', winner, scores, tickets: ticketsFor(winner, me) };
    return { ...m, state: { scores }, turn: undefined, winner };
  });
  return settled;
}

/**
 * Both of us threw at the same moment, each starting a duel before seeing the
 * other's: the newer one folds into the older. Both phones do exactly the same,
 * so they end up agreeing (and the result counts once: it's the older one's id).
 */
export function foldPlan(matches: GameMatch[], kind: DuelKind) {
  const open = openDuels(matches, kind);
  const only = (p: Person) =>
    open.find((m) => {
      const s = duelScores(m);
      return s[p] !== undefined && s[other(p)] === undefined;
    });
  const a = only('you');
  const b = only('partner');
  if (!a || !b) return null;
  const [into, from] = a.createdAt <= b.createdAt ? [a, b] : [b, a];
  return { into: into.id, from: from.id, scores: { ...duelScores(into), ...duelScores(from) } };
}

export function foldDuels(kind: DuelKind) {
  const plan = foldPlan(getContent().games.matches, kind);
  if (!plan) return;
  updateContent((c) => ({
    ...c,
    games: { ...c.games, matches: c.games.matches.filter((m) => m.id !== plan.from) },
  }));
  updateMatch(plan.into, (m) => ({
    ...m,
    state: { scores: plan.scores },
    turn: undefined,
    winner: duelWinner(plan.scores),
  }));
}
