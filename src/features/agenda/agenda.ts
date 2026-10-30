import type { AgendaItem, AppContent, CountdownIcon, Person } from '../../data/types';
import { daysUntil, parseIsoDate } from '../../lib/dates';
import { nextOccurrence, ordinal } from '../home/countdowns';

/*
 * One agenda that gathers everything dated in our universe: our anniversary,
 * our birthdays and Coco's, the dates and countdowns we added, and our own
 * agenda items. Built-ins come from elsewhere and are shown read-only here;
 * only our own items can be edited from the agenda.
 */

export type AgendaKind =
  | 'anniversary'
  | 'met'
  | 'birthday'
  | 'coco'
  | 'date'
  | 'countdown'
  | 'ours';
export type AgendaIcon = CountdownIcon | 'rabbit';

export interface AgendaSource {
  id: string;
  title: string;
  icon: AgendaIcon;
  kind: AgendaKind;
  /** The anchor date, YYYY-MM-DD. */
  base: string;
  /** Repeats every year (an anniversary, a birthday…). */
  yearly: boolean;
  time?: string;
  note?: string;
  by?: Person;
  /** Set when it is one of our own agenda items (so it can be edited). */
  item?: AgendaItem;
}

/** One concrete thing happening on one day. */
export interface AgendaEntry extends AgendaSource {
  /** The exact day it lands on, YYYY-MM-DD. */
  date: string;
  /** Whole years since the anchor (a birthday's age, a jubilee's number). */
  years: number;
}

const COUNTDOWN_ICONS = new Set<CountdownIcon>([
  'heart',
  'star',
  'plane',
  'gift',
  'cake',
  'home',
  'music',
  'matcha',
]);

/** Everything dated, as sources (before they are placed on a day). */
export function agendaSources(content: AppContent): AgendaSource[] {
  const list: AgendaSource[] = [];

  const { startDate: met, togetherDate: together } = content.profile;
  const jubilee = together ?? met;
  if (jubilee)
    list.push({
      id: 'auto-anniversary',
      title: 'Ons jubileum',
      icon: 'heart',
      kind: 'anniversary',
      base: jubilee,
      yearly: true,
    });
  if (met && together)
    list.push({
      id: 'auto-met',
      title: 'De dag dat we elkaar leerden kennen',
      icon: 'star',
      kind: 'met',
      base: met,
      yearly: true,
    });

  list.push({
    id: 'auto-coco',
    title: 'Coco is jarig 🐰',
    icon: 'rabbit',
    kind: 'coco',
    base: content.pet.birthday,
    yearly: true,
  });

  for (const who of ['you', 'partner'] as const) {
    const birthday = content.us[who].birthday;
    if (!birthday) continue;
    const name = who === 'you' ? content.profile.yourName : content.profile.partnerName;
    list.push({
      id: `auto-birthday-${who}`,
      title: `${name} is jarig`,
      icon: 'cake',
      kind: 'birthday',
      base: birthday,
      yearly: true,
      by: who,
    });
  }

  for (const c of content.countdowns) {
    const isDate = c.title.startsWith('Date:');
    list.push({
      id: c.id,
      title: c.title,
      icon: COUNTDOWN_ICONS.has(c.icon) ? c.icon : 'star',
      kind: isDate ? 'date' : 'countdown',
      base: c.date,
      yearly: c.yearly,
      by: c.by,
    });
  }

  for (const a of content.agenda) {
    list.push({
      id: a.id,
      title: a.title,
      icon: a.icon,
      kind: 'ours',
      base: a.date,
      yearly: a.yearly,
      time: a.time,
      note: a.note,
      by: a.by,
      item: a,
    });
  }

  return list;
}

const pad = (n: number) => String(n).padStart(2, '0');
const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

/** The day (1–31) a source lands on in a given month, or null if it doesn't. */
export function dayInMonth(source: AgendaSource, year: number, month: number): number | null {
  const d = parseIsoDate(source.base);
  if (!d) return null;
  const bMonth = d.getUTCMonth() + 1;
  const bDay = d.getUTCDate();
  if (source.yearly) {
    if (bMonth !== month) return null;
    return Math.min(bDay, daysInMonth(year, month));
  }
  return d.getUTCFullYear() === year && bMonth === month ? bDay : null;
}

/** Whole years between the anchor and a year (for ages and jubilee numbers). */
export function yearsAt(source: AgendaSource, year: number): number {
  const d = parseIsoDate(source.base);
  if (!d || !source.yearly) return 0;
  return Math.max(0, year - d.getUTCFullYear());
}

/** How a source reads on a given occurrence (adds the age / jubilee number). */
export function entryTitle(source: AgendaSource, years: number): string {
  if (source.kind === 'anniversary')
    return years <= 0 ? 'Samen sinds vandaag ♡' : `Ons ${ordinal(years)} jubileum`;
  if (source.kind === 'met')
    return years <= 0
      ? 'Vandaag leerden we elkaar kennen ✨'
      : `${years} jaar dat we elkaar kennen ✨`;
  if (source.kind === 'coco') return years <= 0 ? 'Coco geboren 🐰' : `Coco wordt ${years} 🐰`;
  if (source.kind === 'birthday' && years > 0)
    return `${source.title.replace(' is jarig', '')} wordt ${years}`;
  return source.title;
}

/** Every occurrence in a month, by day of month. */
export function monthEntries(
  content: AppContent,
  year: number,
  month: number,
): Map<number, AgendaEntry[]> {
  const byDay = new Map<number, AgendaEntry[]>();
  for (const source of agendaSources(content)) {
    const day = dayInMonth(source, year, month);
    if (day == null) continue;
    const years = yearsAt(source, year);
    const entry: AgendaEntry = {
      ...source,
      date: `${year}-${pad(month)}-${pad(day)}`,
      years,
      title: entryTitle(source, years),
    };
    const list = byDay.get(day) ?? [];
    list.push(entry);
    byDay.set(day, list);
  }
  for (const list of byDay.values()) list.sort(sortEntries);
  return byDay;
}

const sortEntries = (a: AgendaEntry, b: AgendaEntry) =>
  (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.title.localeCompare(b.title);

/** The soonest things coming up (today and after), nearest first. */
export function upcomingAgenda(content: AppContent, today: Date, limit = 8): AgendaEntry[] {
  const out: AgendaEntry[] = [];
  for (const source of agendaSources(content)) {
    const next = nextOccurrence(source.base, source.yearly, today);
    if (!next) continue;
    // A yearly built-in only makes sense once a year has passed (birthday #1, not #0).
    if (source.yearly && (source.kind === 'birthday' || source.kind === 'coco') && next.years === 0)
      continue;
    out.push({
      ...source,
      date: next.date,
      years: next.years,
      title: entryTitle(source, next.years),
    });
  }
  return out
    .sort(
      (a, b) =>
        daysUntil(parseIsoDate(a.date)!, today) - daysUntil(parseIsoDate(b.date)!, today) ||
        sortEntries(a, b),
    )
    .slice(0, limit);
}

export const KIND_LABEL: Record<AgendaKind, string> = {
  anniversary: 'Jubileum',
  met: 'Leren kennen',
  birthday: 'Verjaardag',
  coco: 'Coco',
  date: 'Date',
  countdown: 'Aftellen',
  ours: 'Agenda',
};
