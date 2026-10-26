import type { AppContent, GameResult, Person } from '../../data/types';

/**
 * Arcade tickets, worked out from what we actually played — so both phones
 * always agree and nothing can be counted twice. Winning gives more, but
 * every game played earns something.
 */
export const TICKETS = { win: 10, draw: 6, played: 4 } as const;

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
const headToHead = playedTogether;

export function ticketsEarned(c: AppContent, who: Person): number {
  let total = 0;
  // Only potjes against each other earn tickets — playing Coco doesn't count.
  for (const r of c.games.results) {
    if (!headToHead(r) || !r.players.includes(who)) continue;
    total += r.winner === who ? TICKETS.win : r.winner === 'draw' ? TICKETS.draw : TICKETS.played;
  }
  // Wie kent wie is a game show about each other, so it counts too.
  total += c.quiz.answers.filter((a) => a.who === who && a.self && a.guess).length * 2;
  return total;
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
export function tournament(results: GameResult[]): MonthStanding[] {
  const months = new Map<string, MonthStanding>();
  for (const r of results) {
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
