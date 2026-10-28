import type { AppContent, GameId, Person } from '../../data/types';
import { GAME_NAMES } from '../games/gameStats';
import { MEDALS, medalStats, wonMedals } from '../games/medals';
import { liveResults, playedTogether } from '../games/tickets';

/*
 * Ons jaar: the year in our universe, worked out from what's in the app. Only
 * what we added ourselves counts (no examples), and nothing is guessed.
 */

export interface YearStats {
  year: number;
  /** Days we were together in this year (from our start date), and in all. */
  days: number;
  daysTotal: number;
  memories: { count: number; favorites: number; busiestMonth: number | null };
  letters: Record<Person, number>;
  songs: { count: number; favorite: { title: string; artist: string } | null };
  dates: string[];
  games: {
    together: number;
    wins: Record<Person, number>;
    favorite: GameId | null;
    medals: number;
    medalsOf: number;
  };
  questions: number;
  flowers: { count: number; favorite: string | null };
  cinema: { nights: number; films: number };
  coco: number;
  records: { made: number; forYou: Record<'you' | 'partner', number> };
}

const inYear = (iso: string | undefined, year: number) => !!iso && iso.startsWith(String(year));
const DAY = 86_400_000;

function mostCommon<T>(items: T[]): T | null {
  const counts = new Map<T, number>();
  let best: T | null = null;
  for (const it of items) {
    const n = (counts.get(it) ?? 0) + 1;
    counts.set(it, n);
    if (best === null || n > counts.get(best)!) best = it;
  }
  return best;
}

export function yearStats(c: AppContent, year: number, now = Date.now()): YearStats {
  const start = c.profile.startDate ? Date.parse(`${c.profile.startDate}T12:00:00Z`) : NaN;
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T12:00:00Z`);
  const from = Math.max(start, Date.parse(`${year}-01-01T12:00:00Z`));
  const to = Math.min(today, Date.parse(`${year}-12-31T12:00:00Z`));
  const days = Number.isNaN(start) || to < from ? 0 : Math.round((to - from) / DAY) + 1;
  const daysTotal =
    Number.isNaN(start) || today < start ? 0 : Math.round((today - start) / DAY) + 1;

  const memories = c.memories.filter((m) => !m.isSample && inYear(m.date ?? m.createdAt, year));
  const letters = c.letters.filter(
    (l) => !l.isSample && l.status === 'shared' && inYear(l.createdAt, year),
  );
  const songs = c.songs.filter((s) => inYear(s.createdAt, year));
  const fav = [...songs].reverse().find((s) => s.favorite) ?? null;

  // Games: those still in the list, plus the wins already in the spaarpot.
  const results = liveResults(c.games).filter((r) => playedTogether(r) && inYear(r.at, year));
  const wins = { you: 0, partner: 0 };
  for (const r of results) if (r.winner === 'you' || r.winner === 'partner') wins[r.winner]++;
  let together = results.length;
  for (const [month, w] of Object.entries(c.games.archive?.tally.months ?? {}))
    if (month.startsWith(String(year))) {
      wins.you += w.you;
      wins.partner += w.partner;
      together += w.you + w.partner;
    }
  const medalsWon = wonMedals(medalStats(c, now));

  const daily = new Map<string, Set<Person>>();
  for (const a of c.daily)
    if (inYear(a.date, year)) daily.set(a.date, (daily.get(a.date) ?? new Set()).add(a.who));

  const bouquets = c.flowers.filter((b) => inYear(b.date ?? b.createdAt, year));

  return {
    year,
    days,
    daysTotal,
    memories: {
      count: memories.length,
      favorites: memories.filter((m) => m.favorite).length,
      busiestMonth: mostCommon(memories.map((m) => Number((m.date ?? m.createdAt).slice(5, 7)))),
    },
    letters: {
      you: letters.filter((l) => l.by === 'you').length,
      partner: letters.filter((l) => l.by === 'partner').length,
    },
    songs: { count: songs.length, favorite: fav && { title: fav.title, artist: fav.artist } },
    dates: c.datePlans
      .filter(
        (d) => !d.skipped && inYear(d.date, year) && Date.parse(`${d.date}T12:00:00Z`) <= today,
      )
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => d.title),
    games: {
      together,
      wins,
      favorite: mostCommon(results.map((r) => r.game)),
      medals: MEDALS.filter((m) => medalsWon.some((id) => id === m.id || id.startsWith(`${m.id}:`)))
        .length,
      medalsOf: MEDALS.length,
    },
    questions: [...daily.values()].filter((who) => who.size === 2).length,
    flowers: { count: bouquets.length, favorite: mostCommon(bouquets.flatMap((b) => b.flowers)) },
    cinema: {
      nights: c.cinema.nights.filter((n) => inYear(n.at, year)).length,
      films: c.cinema.films.filter((f) => inYear(f.createdAt, year)).length,
    },
    coco: c.pet.careDays.filter((d) => inYear(d, year)).length,
    records: {
      made: c.studio.records.filter((r) => inYear(r.madeOn ?? r.createdAt, year)).length,
      forYou: {
        you: c.studio.records.filter((r) => r.by === 'you' && inYear(r.madeOn ?? r.createdAt, year))
          .length,
        partner: c.studio.records.filter(
          (r) => r.by === 'partner' && inYear(r.madeOn ?? r.createdAt, year),
        ).length,
      },
    },
  };
}

/** Years with something in them, newest first (always this year). */
export function ourYears(c: AppContent, now = Date.now()): number[] {
  const thisYear = new Date(now).getFullYear();
  const first = Math.min(
    thisYear,
    c.profile.startDate ? Number(c.profile.startDate.slice(0, 4)) : thisYear,
  );
  const out: number[] = [];
  for (let y = thisYear; y >= Math.max(first, thisYear - 20); y--) out.push(y);
  return out;
}

export const gameName = (g: GameId) => GAME_NAMES[g];
