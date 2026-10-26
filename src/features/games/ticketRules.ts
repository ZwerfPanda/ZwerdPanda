import { getContent, updateContent } from '../../data/store';
import { textId } from '../../data/texts';
import type { AppContent, Person, TextEdit } from '../../data/types';

/*
 * How much the arcade pays, set by him. It travels with his own texts
 * ("texts"), the one part of our content the server only lets the person who
 * created the universe change: anything another phone writes there is put back
 * as it was. Each change counts from the moment it's made, so tickets already
 * won keep what they were worth.
 */

export interface TicketRules {
  /** From when these count. */
  at: string;
  win: number;
  draw: number;
  played: number;
  /** Extra for the long games. */
  long: number;
  /** Gouden Woensdag multiplies by this. */
  golden: number;
  /** Per answer in Wie kent wie. */
  quiz: number;
}

export interface TicketSettings {
  rules: TicketRules[];
  /** Tickets he added (or took away) by hand. */
  adjust: Record<Person, number>;
}

export const RULES_KEY = '§arcade-tickets';
export const RULES_ID = textId(RULES_KEY);
/** Not one of his texts on the site, just where the rules live. */
export const isSettingsText = (t: TextEdit) => t.from === RULES_KEY;

export const DEFAULT_RULES: TicketRules = {
  at: '1970-01-01T00:00:00.000Z',
  win: 10,
  draw: 6,
  played: 4,
  long: 4,
  golden: 2,
  quiz: 2,
};

export const LIMITS: Record<Exclude<keyof TicketRules, 'at'>, [number, number]> = {
  win: [0, 1000],
  draw: [0, 1000],
  played: [0, 1000],
  long: [0, 1000],
  golden: [1, 5],
  quiz: [0, 100],
};
export const ADJUST_MAX = 100_000;
const KEEP = 12;

const clamp = (v: unknown, [lo, hi]: [number, number], fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, Math.round(v)))
    : fallback;

function readRules(v: unknown): TicketRules | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.at !== 'string' || Number.isNaN(Date.parse(r.at))) return null;
  const out = { at: r.at } as TicketRules;
  for (const k of Object.keys(LIMITS) as (keyof typeof LIMITS)[])
    out[k] = clamp(r[k], LIMITS[k], DEFAULT_RULES[k]);
  return out;
}

export function ticketSettings(c: Pick<AppContent, 'texts'>): TicketSettings {
  const out: TicketSettings = { rules: [], adjust: { you: 0, partner: 0 } };
  const raw = c.texts.find(isSettingsText)?.to;
  if (!raw) return out;
  try {
    const v = JSON.parse(raw) as { rules?: unknown; adjust?: Record<string, unknown> };
    if (Array.isArray(v.rules))
      out.rules = v.rules
        .map(readRules)
        .filter((r): r is TicketRules => r !== null)
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    for (const p of ['you', 'partner'] as const)
      out.adjust[p] = clamp(v.adjust?.[p], [-ADJUST_MAX, ADJUST_MAX], 0);
  } catch {
    // unreadable: the standard values
  }
  return out;
}

/** The rules that counted at that moment. */
export function rulesAt(s: TicketSettings, at: string | number): TicketRules {
  const t = typeof at === 'number' ? at : Date.parse(at);
  let found = DEFAULT_RULES;
  for (const r of s.rules) if (Date.parse(r.at) <= t) found = r;
  return found;
}

export const currentRules = (c: Pick<AppContent, 'texts'> = getContent()) =>
  rulesAt(ticketSettings(c), Date.now());

function write(c: AppContent, s: TicketSettings): AppContent {
  const entry: TextEdit = {
    id: RULES_ID,
    from: RULES_KEY,
    to: JSON.stringify({ rules: s.rules.slice(-KEEP), adjust: s.adjust }),
    at: new Date().toISOString(),
  };
  return { ...c, texts: [...c.texts.filter((t) => !isSettingsText(t)), entry] };
}

/** New values, counting from now on. */
export function saveRules(next: Omit<TicketRules, 'at'>) {
  updateContent((c) => {
    const s = ticketSettings(c);
    const rules = readRules({ ...next, at: new Date().toISOString() })!;
    return write(c, { ...s, rules: [...s.rules, rules] });
  });
}

/** Add (or take away) tickets by hand. */
export function adjustTickets(who: Person, by: number) {
  updateContent((c) => {
    const s = ticketSettings(c);
    const adjust = {
      ...s.adjust,
      [who]: clamp(s.adjust[who] + by, [-ADJUST_MAX, ADJUST_MAX], s.adjust[who]),
    };
    return write(c, { ...s, adjust });
  });
}
