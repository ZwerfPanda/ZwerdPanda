import { getContent, updateContent, useContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import type { GameMatch, MatchKind, Person, ScoreGame } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { getSyncEngine } from '../../sync/sync';

/** The newest match of a kind (finished or not). */
export function useMatch(kind: MatchKind): GameMatch | undefined {
  const matches = useContent((c) => c.games.matches);
  return latest(matches, kind);
}

function latest(matches: GameMatch[], kind: MatchKind) {
  return matches
    .filter((m) => m.kind === kind)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export function startMatch(
  kind: MatchKind,
  state: Record<string, unknown>,
  turn: Person,
  startedBy: Person,
): GameMatch {
  const now = nowIso();
  const match: GameMatch = {
    id: createId('match'),
    kind,
    state,
    turn,
    startedBy,
    createdAt: now,
    updatedAt: now,
  };
  updateContent((c) => ({
    ...c,
    games: {
      ...c.games,
      // An unfinished match of this kind makes way for the new one.
      matches: [...c.games.matches.filter((m) => m.kind !== kind || m.winner), match].slice(-100),
    },
  }));
  pushNow();
  return match;
}

export function updateMatch(id: string, recipe: (m: GameMatch) => GameMatch) {
  updateContent((c) => ({
    ...c,
    games: {
      ...c.games,
      matches: c.games.matches.map((m) =>
        m.id === id ? { ...recipe(m), updatedAt: nowIso() } : m,
      ),
    },
  }));
  pushNow();
}

/** Turn games feel live: send a move right away, and look for theirs. */
export function pushNow() {
  window.setTimeout(() => void getSyncEngine()?.syncNow(), 300);
}

export function refreshNow() {
  void getSyncEngine()?.syncNow();
}

export function addScore(game: ScoreGame, score: number) {
  const who = getAuthor();
  if (!who) return;
  updateContent((c) => ({
    ...c,
    games: {
      ...c.games,
      scores: [...c.games.scores, { id: createId('score'), game, who, score, at: nowIso() }].slice(
        -500,
      ),
    },
  }));
}

export function useBest(game: ScoreGame): Record<Person, number | null> {
  const scores = useContent((c) => c.games.scores);
  const best = (who: Person) => {
    const mine = scores.filter((s) => s.game === game && s.who === who).map((s) => s.score);
    return mine.length ? Math.max(...mine) : null;
  };
  return { you: best('you'), partner: best('partner') };
}

export function useWins(kind: MatchKind): Record<Person, number> {
  const matches = useContent((c) => c.games.matches);
  const count = (who: Person) => matches.filter((m) => m.kind === kind && m.winner === who).length;
  return { you: count('you'), partner: count('partner') };
}

export const getMatch = (id: string) => getContent().games.matches.find((m) => m.id === id);
