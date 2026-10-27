import type {
  AppContent,
  ArcadeTally,
  GameId,
  GameResult,
  Games,
  GamesArchive,
  Person,
  Player,
} from '../../data/types';
import { isGolden, weekKey } from './golden';
import { DEFAULT_RULES, rulesAt, ticketSettings, type TicketSettings } from './ticketRules';
import { getContent } from '../../data/store';

/**
 * Arcade tickets, worked out from what we actually played — so both phones
 * always agree and nothing can be counted twice. Winning gives more, but
 * every game played earns something.
 */
export const TICKETS = {
  win: DEFAULT_RULES.win,
  draw: DEFAULT_RULES.draw,
  played: DEFAULT_RULES.played,
} as const;

/** Games that take a while to play earn a little more. */
export const LONG_GAMES: readonly GameId[] = ['kwartet', 'zeeslag', 'uno', 'bowling', 'bingo'];
export const LONG_BONUS = DEFAULT_RULES.long;

/**
 * What one game is worth to `who`, by the values that counted then (and more
 * on Gouden Woensdag).
 */
export function ticketsFor(
  game: GameId,
  winner: Person | 'draw',
  who: Person,
  at: string | number = Date.now(),
  settings: TicketSettings = ticketSettings(getContent()),
): number {
  const r = rulesAt(settings, at);
  const base = winner === who ? r.win : winner === 'draw' ? r.draw : r.played;
  const worth = base + (LONG_GAMES.includes(game) ? r.long : 0);
  return isGolden(at) ? worth * r.golden : worth;
}

/**
 * A game the two of us really played against each other: each on our own
 * phone (its result carries the match's id). Not against Coco, and not on one
 * phone — there one of us could play both sides alone.
 */
export const playedTogether = (r: GameResult) =>
  r.players.includes('you') &&
  r.players.includes('partner') &&
  !r.players.includes('coco') &&
  r.id.startsWith('match-');

/* ---------------------------------------------------------- the tally */

/** Games together in one week that make the weekly challenge. */
export const WEEK_GOAL = 5;

export const emptyTally = (): ArcadeTally => ({
  together: 0,
  tickets: { you: 0, partner: 0 },
  pairs: {},
  goldenWins: { you: 0, partner: 0 },
  weeks: 0,
  months: {},
});

export const pairKey = (game: GameId, a: Player, b: Player) =>
  a < b ? `${game}|${a}|${b}` : `${game}|${b}|${a}`;

/** Results not yet in the spaarpot (anything older counts only in there). */
export const liveResults = (g: Pick<Games, 'results' | 'archive'>) =>
  g.archive ? g.results.filter((r) => weekKey(r.at) >= g.archive!.upTo) : g.results;

/** What these results add up to: tickets, wins, weekly challenges, months. */
export function tallyResults(results: GameResult[], settings: TicketSettings): ArcadeTally {
  const t = emptyTally();
  const weekCount = new Map<string, number>();
  const sorted = [...results].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  for (const r of sorted) {
    const together = playedTogether(r);
    // Every pair at the table, the two of us only when really playing each other.
    for (let i = 0; i < r.players.length; i++)
      for (let j = i + 1; j < r.players.length; j++) {
        const [a, b] = [r.players[i], r.players[j]];
        const us = a !== 'coco' && b !== 'coco';
        if (us && !together) continue;
        const cell = (t.pairs[pairKey(r.game, a, b)] ??= {});
        const w = r.winner === a || r.winner === b || r.winner === 'draw' ? r.winner : null;
        if (w) cell[w] = (cell[w] ?? 0) + 1;
      }
    if (!together) continue;
    t.together++;
    const golden = isGolden(r.at);
    for (const who of ['you', 'partner'] as const)
      t.tickets[who] += ticketsFor(r.game, r.winner as Person | 'draw', who, r.at, settings);
    if (r.winner === 'you' || r.winner === 'partner') {
      if (golden) t.goldenWins[r.winner]++;
      const m = (t.months[r.at.slice(0, 7)] ??= { you: 0, partner: 0 });
      m[r.winner]++;
    }
    const week = weekKey(r.at);
    const n = (weekCount.get(week) ?? 0) + 1;
    weekCount.set(week, n);
    if (n === WEEK_GOAL) {
      t.weeks++;
      const bonus = rulesAt(settings, r.at).weekly;
      t.tickets.you += bonus;
      t.tickets.partner += bonus;
    }
  }
  return t;
}

export function addTallies(a: ArcadeTally, b: ArcadeTally): ArcadeTally {
  const pairs: ArcadeTally['pairs'] = {};
  for (const src of [a.pairs, b.pairs])
    for (const [k, cell] of Object.entries(src)) {
      const out = (pairs[k] ??= {});
      for (const [w, n] of Object.entries(cell) as [Player | 'draw', number][])
        out[w] = (out[w] ?? 0) + n;
    }
  const months: ArcadeTally['months'] = {};
  for (const src of [a.months, b.months])
    for (const [k, m] of Object.entries(src)) {
      const out = (months[k] ??= { you: 0, partner: 0 });
      out.you += m.you;
      out.partner += m.partner;
    }
  return {
    together: a.together + b.together,
    tickets: { you: a.tickets.you + b.tickets.you, partner: a.tickets.partner + b.tickets.partner },
    pairs,
    goldenWins: {
      you: a.goldenWins.you + b.goldenWins.you,
      partner: a.goldenWins.partner + b.goldenWins.partner,
    },
    weeks: a.weeks + b.weeks,
    months,
  };
}

let memo: {
  results: GameResult[];
  archive?: GamesArchive;
  key: string;
  tally: ArcadeTally;
} | null = null;

/** Everything we ever played: the spaarpot plus what's still in the list. */
export function arcadeTally(c: Pick<AppContent, 'games' | 'texts'>): ArcadeTally {
  const settings = ticketSettings(c);
  const key = JSON.stringify(settings.rules);
  if (
    memo &&
    memo.results === c.games.results &&
    memo.archive === c.games.archive &&
    memo.key === key
  )
    return memo.tally;
  const live = tallyResults(liveResults(c.games), settings);
  const tally = c.games.archive ? addTallies(c.games.archive.tally, live) : live;
  memo = { results: c.games.results, archive: c.games.archive, key, tally };
  return tally;
}

/** The list grows past this, and the oldest weeks go into the spaarpot… */
export const FOLD_AT = 1500;
/** …keeping about this many in the list. */
export const KEEP_LIVE = 1000;

/**
 * Moves the oldest whole weeks of results into the spaarpot. The same results
 * always fold the same way, so two phones doing it at once agree.
 */
export function foldResults(c: AppContent): AppContent {
  const { results, archive } = c.games;
  if (results.length <= FOLD_AT) return c;
  const sorted = [...results].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const upTo = weekKey(sorted[sorted.length - KEEP_LIVE].at);
  if (archive && upTo <= archive.upTo) return c;
  const from = archive?.upTo ?? '';
  const folding = sorted.filter((r) => {
    const w = weekKey(r.at);
    return w >= from && w < upTo;
  });
  const settings = ticketSettings(c);
  const added = tallyResults(folding, settings);
  return {
    ...c,
    games: {
      ...c.games,
      results: results.filter((r) => weekKey(r.at) >= upTo),
      archive: { upTo, tally: archive ? addTallies(archive.tally, added) : added },
    },
  };
}

export { pickArchive } from '../../data/archive';

export function ticketsEarned(c: AppContent, who: Person): number {
  const settings = ticketSettings(c);
  // Only potjes against each other earn tickets — playing Coco doesn't count.
  let total = settings.adjust[who] + arcadeTally(c).tickets[who];
  // Wie kent wie is a game show about each other, so it counts too.
  for (const a of c.quiz.answers)
    if (a.who === who && a.self && a.guess) {
      const r = rulesAt(settings, a.at);
      total += isGolden(a.at) ? r.quiz * r.golden : r.quiz;
    }
  return Math.max(0, total);
}

/** Tickets spent on prizes from the prize counter. */
export function ticketsSpent(c: AppContent, who: Person): number {
  return c.coupons.filter((p) => p.from !== who && p.wonAt).reduce((n, p) => n + p.price, 0);
}

export const ticketBalance = (c: AppContent, who: Person) =>
  Math.max(0, ticketsEarned(c, who) - ticketsSpent(c, who));

/* ------------------------------------------------------------ tournament */

const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

export const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? key;

export interface MonthStanding {
  /** YYYY-MM */
  month: string;
  you: number;
  partner: number;
  /** Who won the month (null while tied or not played). */
  champion: Person | null;
}

/** The two of us, month by month: who won the most games against the other. */
export function tournament(source: GameResult[] | Games): MonthStanding[] {
  const months = new Map<string, MonthStanding>();
  const games: Pick<Games, 'results' | 'archive'> = Array.isArray(source)
    ? { results: source }
    : source;
  for (const [month, w] of Object.entries(games.archive?.tally.months ?? {}))
    months.set(month, { month, you: w.you, partner: w.partner, champion: null });
  for (const r of liveResults(games)) {
    if (!playedTogether(r)) continue;
    const month = r.at.slice(0, 7);
    const m = months.get(month) ?? { month, you: 0, partner: 0, champion: null };
    if (r.winner === 'you') m.you++;
    if (r.winner === 'partner') m.partner++;
    months.set(month, m);
  }
  return [...months.values()]
    .map((m) => ({
      ...m,
      champion:
        m.you === m.partner ? null : m.you > m.partner ? ('you' as const) : ('partner' as const),
    }))
    .sort((a, b) => (a.month < b.month ? 1 : -1));
}
