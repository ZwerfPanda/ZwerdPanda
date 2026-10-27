import type { ArcadeTally, GamesArchive, Person, Player } from './types';

/*
 * The arcade's spaarpot: older game results, added up (see foldResults in
 * features/games/tickets.ts). Here only what the data layer needs: reading it
 * back safely, and choosing between two phones' copies.
 */

const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const PLAYERS: readonly (Player | 'draw')[] = ['you', 'partner', 'coco', 'draw'];
const MAX = 10_000_000;

const count = (v: unknown) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(MAX, Math.max(0, Math.round(v))) : 0;
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const each = (v: unknown): Record<Person, number> => {
  const o = isObj(v) ? v : {};
  return { you: count(o.you), partner: count(o.partner) };
};

export function normalizeArchive(v: unknown): GamesArchive | undefined {
  if (!isObj(v) || typeof v.upTo !== 'string' || !WEEK.test(v.upTo) || !isObj(v.tally))
    return undefined;
  const t = v.tally;
  const pairs: ArcadeTally['pairs'] = {};
  if (isObj(t.pairs))
    for (const [key, cell] of Object.entries(t.pairs).slice(0, 200)) {
      if (key.length > 40 || key.split('|').length !== 3 || !isObj(cell)) continue;
      const out: ArcadeTally['pairs'][string] = {};
      for (const p of PLAYERS) if (cell[p] !== undefined) out[p] = count(cell[p]);
      pairs[key] = out;
    }
  const months: ArcadeTally['months'] = {};
  if (isObj(t.months))
    for (const [m, w] of Object.entries(t.months).slice(0, 600))
      if (MONTH.test(m)) months[m] = each(w);
  return {
    upTo: v.upTo,
    tally: {
      together: count(t.together),
      // Tickets may have been taken back by hand, but never below nothing here.
      tickets: each(t.tickets),
      pairs,
      goldenWins: each(t.goldenWins),
      weeks: count(t.weeks),
      months,
    },
  };
}

/** Of two spaarpotten, the one that went further (the same pick on every phone). */
export function pickArchive(a?: GamesArchive, b?: GamesArchive): GamesArchive | undefined {
  if (!a || !b) return a ?? b;
  if (a.upTo !== b.upTo) return a.upTo > b.upTo ? a : b;
  if (a.tally.together !== b.tally.together) return a.tally.together > b.tally.together ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}
