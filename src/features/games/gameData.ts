import { getContent, updateContent, useContent } from '../../data/store';
import { getAuthor, getMe, nameOf } from '../../data/people';
import { notifyOther } from '../../lib/push';
import type { GameMatch, MatchKind, Person, Player, ScoreGame } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { getSyncEngine } from '../../sync/sync';
import { sendMatch } from '../../sync/live';
import { GAME_NAMES, recordResult } from './gameStats';

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
  sendMatch(match);
  pushNow();
  tellOther(undefined, match);
  return match;
}

/**
 * A notification on the other phone: a new game, their turn, or how it ended.
 * Turns in quick games buzz at most once a minute.
 */
function tellOther(before: GameMatch | undefined, after: GameMatch) {
  const me = getMe();
  const them: Person = me === 'you' ? 'partner' : 'you';
  const c = getContent();
  const name = nameOf(me, c.profile);
  const game = GAME_NAMES[after.kind as keyof typeof GAME_NAMES] ?? after.kind;
  const url = `#/games?g=${after.kind}`;
  const tag = `match-${after.id}`;
  if (after.winner && !before?.winner) {
    const how =
      after.winner === 'draw'
        ? 'gelijkspel!'
        : after.winner === me
          ? `${name} heeft gewonnen 🏆`
          : 'jij hebt gewonnen! 🏆';
    notifyOther('match', { title: `${game}: ${how}`, url, tag });
  } else if (!before && !after.winner)
    notifyOther('match', {
      title: `${name} daagt je uit: ${game} 🎮`,
      body: 'Tik om mee te doen',
      url,
      tag,
    });
  else if (after.turn === them && before?.turn !== them)
    notifyOther(
      'turn',
      { title: `Jouw beurt in ${game} 🎮`, body: `${name} heeft gezet`, url, tag },
      60_000,
    );
}

export function updateMatch(id: string, recipe: (m: GameMatch) => GameMatch) {
  let finished: GameMatch | null = null;
  const before = getContent().games.matches.find((m) => m.id === id);
  updateContent((c) => ({
    ...c,
    games: {
      ...c.games,
      matches: c.games.matches.map((m) => {
        if (m.id !== id) return m;
        const next = { ...recipe(m), updatedAt: nowIso() };
        if (next.winner && !m.winner) finished = next;
        return next;
      }),
    },
  }));
  const now = getContent().games.matches.find((m) => m.id === id);
  if (now) sendMatch(now);
  if (now && before) tellOther(before, now);
  const done = finished as GameMatch | null;
  if (done?.winner) recordResult(done.kind, ['you', 'partner'], done.winner, done.id);
  pushNow();
}

/** Turn games feel live: send a move right away, and look for theirs. */
export function pushNow() {
  window.setTimeout(() => void getSyncEngine()?.syncNow(), 300);
}

export function refreshNow() {
  void getSyncEngine()?.syncNow();
}

export function addScore(game: ScoreGame, score: number, as?: Player) {
  const who = as ?? getAuthor();
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

export function useBest(game: ScoreGame): Record<Player, number | null> {
  const scores = useContent((c) => c.games.scores);
  const best = (who: Player) => {
    const mine = scores.filter((s) => s.game === game && s.who === who).map((s) => s.score);
    return mine.length ? Math.max(...mine) : null;
  };
  return { you: best('you'), partner: best('partner'), coco: best('coco') };
}

export function useWins(kind: MatchKind): Record<Person, number> {
  const matches = useContent((c) => c.games.matches);
  const count = (who: Person) => matches.filter((m) => m.kind === kind && m.winner === who).length;
  return { you: count('you'), partner: count('partner') };
}

export const getMatch = (id: string) => getContent().games.matches.find((m) => m.id === id);
