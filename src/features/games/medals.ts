import type { AppContent, ArcadeTally, GameId, Person } from '../../data/types';
import { weekKey } from './golden';
import { WEEK_GOAL, arcadeTally, liveResults, playedTogether, tournament } from './tickets';

/*
 * Arcade medals: worked out from what we played (the spaarpot included), so
 * both phones agree and a medal, once won, stays won.
 */

export interface Medal {
  id: string;
  emoji: string;
  title: string;
  text: string;
  /** One for the two of us, or one each. */
  scope: 'us' | 'each';
  goal: number;
  progress: (s: MedalStats, who: Person) => number;
}

export interface MedalStats {
  tally: ArcadeTally;
  /** Official karaoke recordings: all, and the ones we sang together. */
  records: number;
  duets: number;
  /** Months won (before this one). */
  monthsWon: Record<Person, number>;
}

const US = (game: GameId) => `${game}|partner|you`;
const winsIn = (t: ArcadeTally, game: GameId, who: Person) => t.pairs[US(game)]?.[who] ?? 0;
const wins = (t: ArcadeTally, who: Person) =>
  Object.entries(t.pairs)
    .filter(([k]) => k.endsWith('|partner|you'))
    .reduce((n, [, cell]) => n + (cell[who] ?? 0), 0);
const draws = (t: ArcadeTally) =>
  Object.entries(t.pairs)
    .filter(([k]) => k.endsWith('|partner|you'))
    .reduce((n, [, cell]) => n + (cell.draw ?? 0), 0);
const gamesWon = (t: ArcadeTally, who: Person) =>
  Object.entries(t.pairs).filter(([k, cell]) => k.endsWith('|partner|you') && (cell[who] ?? 0) > 0)
    .length;

const together = (goal: number, emoji: string, title: string): Medal => ({
  id: `samen-${goal}`,
  emoji,
  title,
  text: goal === 1 ? 'Jullie eerste potje tegen elkaar' : `${goal} potjes tegen elkaar gespeeld`,
  scope: 'us',
  goal,
  progress: (s) => s.tally.together,
});

export const MEDALS: Medal[] = [
  together(1, '🎮', 'Eerste potje'),
  together(25, '🕹️', 'Echte gamers'),
  together(100, '💯', 'Honderd samen'),
  together(500, '🏟️', 'Vaste klanten'),
  together(1000, '👑', 'Arcadelegendes'),
  {
    id: 'week-1',
    emoji: '📅',
    title: 'Weekuitdaging',
    text: `Een week met ${WEEK_GOAL} potjes samen`,
    scope: 'us',
    goal: 1,
    progress: (s) => s.tally.weeks,
  },
  {
    id: 'week-4',
    emoji: '🔥',
    title: 'Op dreef',
    text: '4 weekuitdagingen gehaald',
    scope: 'us',
    goal: 4,
    progress: (s) => s.tally.weeks,
  },
  {
    id: 'week-12',
    emoji: '🌟',
    title: 'Een kwartaal lang',
    text: '12 weekuitdagingen gehaald',
    scope: 'us',
    goal: 12,
    progress: (s) => s.tally.weeks,
  },
  {
    id: 'gelijk',
    emoji: '🤝',
    title: 'Gelijk opgaan',
    text: 'Een potje dat gelijk eindigde',
    scope: 'us',
    goal: 1,
    progress: (s) => draws(s.tally),
  },
  {
    id: 'duet-1',
    emoji: '🎤',
    title: 'Eerste duet',
    text: 'Samen een officiële karaoke-opname gemaakt',
    scope: 'us',
    goal: 1,
    progress: (s) => s.duets,
  },
  {
    id: 'album',
    emoji: '💿',
    title: 'Ons eigen album',
    text: '10 officiële karaoke-opnames',
    scope: 'us',
    goal: 10,
    progress: (s) => s.records,
  },
  {
    id: 'win-1',
    emoji: '🏅',
    title: 'Eerste winst',
    text: 'Een potje van de ander gewonnen',
    scope: 'each',
    goal: 1,
    progress: (s, who) => wins(s.tally, who),
  },
  {
    id: 'win-50',
    emoji: '🥇',
    title: 'Vijftig keer',
    text: '50 potjes van de ander gewonnen',
    scope: 'each',
    goal: 50,
    progress: (s, who) => wins(s.tally, who),
  },
  {
    id: 'win-250',
    emoji: '🏆',
    title: 'Onverslaanbaar',
    text: '250 potjes van de ander gewonnen',
    scope: 'each',
    goal: 250,
    progress: (s, who) => wins(s.tally, who),
  },
  {
    id: 'gofish-10',
    emoji: '🐟',
    title: 'Visser',
    text: '10 keer Go Fish gewonnen',
    scope: 'each',
    goal: 10,
    progress: (s, who) => winsIn(s.tally, 'kwartet', who),
  },
  {
    id: 'uno-10',
    emoji: '🃏',
    title: 'UNO-baas',
    text: '10 keer UNO gewonnen',
    scope: 'each',
    goal: 10,
    progress: (s, who) => winsIn(s.tally, 'uno', who),
  },
  {
    id: 'bingo-5',
    emoji: '🎱',
    title: 'BINGO!',
    text: '5 keer bingo gewonnen',
    scope: 'each',
    goal: 5,
    progress: (s, who) => winsIn(s.tally, 'bingo', who),
  },
  {
    id: 'zeeslag-10',
    emoji: '🥞',
    title: 'Admiraal Pannenkoek',
    text: '10 keer Pannenkoekenslag gewonnen',
    scope: 'each',
    goal: 10,
    progress: (s, who) => winsIn(s.tally, 'zeeslag', who),
  },
  {
    id: 'allround',
    emoji: '🌈',
    title: 'Allrounder',
    text: 'In 6 verschillende spellen gewonnen',
    scope: 'each',
    goal: 6,
    progress: (s, who) => gamesWon(s.tally, who),
  },
  {
    id: 'golden-1',
    emoji: '✨',
    title: 'Gouden winst',
    text: 'Gewonnen op een Gouden Woensdag',
    scope: 'each',
    goal: 1,
    progress: (s, who) => s.tally.goldenWins[who],
  },
  {
    id: 'golden-10',
    emoji: '💛',
    title: 'Goudhaantje',
    text: '10 keer gewonnen op Gouden Woensdag',
    scope: 'each',
    goal: 10,
    progress: (s, who) => s.tally.goldenWins[who],
  },
  {
    id: 'maand',
    emoji: '🗓️',
    title: 'Kampioen van de maand',
    text: 'Een hele maand de meeste potjes gewonnen',
    scope: 'each',
    goal: 1,
    progress: (s, who) => s.monthsWon[who],
  },
];

export function medalStats(
  c: Pick<AppContent, 'games' | 'texts'> & Partial<Pick<AppContent, 'karaoke'>>,
  now = Date.now(),
): MedalStats {
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  const monthsWon = { you: 0, partner: 0 };
  for (const m of tournament(c.games))
    if (m.month < thisMonth && m.champion) monthsWon[m.champion]++;
  const official = (c.karaoke?.takes ?? []).filter((t) => t.doneAt && t.mix);
  return {
    tally: arcadeTally(c),
    monthsWon,
    records: official.length,
    duets: official.filter((t) => t.mode !== 'solo').length,
  };
}

/** Every medal won, as "id" (ours) or "id:who" (one of us). */
export function wonMedals(s: MedalStats): string[] {
  const out: string[] = [];
  for (const m of MEDALS)
    if (m.scope === 'us') {
      if (m.progress(s, 'you') >= m.goal) out.push(m.id);
    } else
      for (const who of ['you', 'partner'] as const)
        if (m.progress(s, who) >= m.goal) out.push(`${m.id}:${who}`);
  return out;
}

/** This week's challenge: games together so far. */
export function weekProgress(c: Pick<AppContent, 'games'>, now = Date.now()) {
  const week = weekKey(now);
  const played = liveResults(c.games).filter(
    (r) => playedTogether(r) && weekKey(r.at) === week,
  ).length;
  return { played, goal: WEEK_GOAL, done: played >= WEEK_GOAL };
}
