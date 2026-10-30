import type { AppContent, Countdown, CountdownIcon } from '../../data/types';
import { addMonths, daysUntil, parseIsoDate, toIsoDate } from '../../lib/dates';
import { nextMonthiversary } from './heart';

export interface Upcoming {
  id: string;
  title: string;
  icon: CountdownIcon | 'rabbit';
  /** The date it lands on next (YYYY-MM-DD). */
  date: string;
  days: number;
  /** Built in (anniversary, Coco's birthday) rather than added by us. */
  auto: boolean;
  item?: Countdown;
}

/** Next time a date comes round: the date itself, or (yearly) its next anniversary. */
export function nextOccurrence(
  iso: string,
  yearly: boolean,
  today: Date,
): { date: string; days: number; years: number } | null {
  const start = parseIsoDate(iso);
  if (!start) return null;
  if (!yearly) {
    const days = daysUntil(start, today);
    return days >= 0 ? { date: iso, days, years: 0 } : null;
  }
  let years = Math.max(0, today.getUTCFullYear() - start.getUTCFullYear());
  let next = addMonths(start, years * 12);
  if (next.getTime() < today.getTime()) {
    years += 1;
    next = addMonths(start, years * 12);
  }
  return { date: toIsoDate(next), days: daysUntil(next, today), years };
}

/** Everything we're counting down to, soonest first. */
export function upcoming(content: AppContent, today: Date): Upcoming[] {
  const list: Upcoming[] = [];
  for (const item of content.countdowns) {
    const next = nextOccurrence(item.date, item.yearly, today);
    if (next) {
      list.push({
        id: item.id,
        title: item.title,
        icon: item.icon,
        date: next.date,
        days: next.days,
        auto: false,
        item,
      });
    }
  }
  const { startDate: met, togetherDate: together } = content.profile;
  // Our jubileum: from the day we became a couple (or the one date we have).
  const jubilee = together ?? met;
  if (jubilee) {
    const next = nextOccurrence(jubilee, true, today);
    if (next && next.years > 0) {
      list.push({
        id: 'auto-anniversary',
        title: next.years === 1 ? 'Ons eerste jubileum' : `Ons ${ordinal(next.years)} jubileum`,
        icon: 'heart',
        date: next.date,
        days: next.days,
        auto: true,
      });
    }
  }
  // The next "maandje" in the first two years together.
  const start = together ? parseIsoDate(together) : null;
  if (start && start.getTime() <= today.getTime()) {
    const month = nextMonthiversary(start, today);
    if (month.months > 0 && month.months < 24 && month.months % 12 !== 0) {
      list.push({
        id: 'auto-monthiversary',
        title: `${month.months} maanden samen`,
        icon: 'heart',
        date: toIsoDate(addMonths(start, month.months)),
        days: month.inDays,
        auto: true,
      });
    }
  }
  // And, when we have both, the day we first got to know each other.
  if (met && together) {
    const next = nextOccurrence(met, true, today);
    if (next && next.years > 0) {
      list.push({
        id: 'auto-met',
        title: `${next.years} jaar dat we elkaar kennen`,
        icon: 'star',
        date: next.date,
        days: next.days,
        auto: true,
      });
    }
  }
  const coco = nextOccurrence(content.pet.birthday, true, today);
  if (coco && coco.years > 0) {
    list.push({
      id: 'auto-coco',
      title: `Coco wordt ${coco.years}`,
      icon: 'rabbit',
      date: coco.date,
      days: coco.days,
      auto: true,
    });
  }
  for (const who of ['partner', 'you'] as const) {
    const birthday = content.us[who].birthday;
    const next = birthday ? nextOccurrence(birthday, true, today) : null;
    if (next && next.years > 0) {
      const name = who === 'you' ? content.profile.yourName : content.profile.partnerName;
      list.push({
        id: `auto-birthday-${who}`,
        title: `${name} wordt ${next.years}`,
        icon: 'cake',
        date: next.date,
        days: next.days,
        auto: true,
      });
    }
  }
  return list.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title));
}

/** Dutch ordinals: 2e, 3e, 10e … */
export function ordinal(n: number): string {
  return `${n}e`;
}

export function daysLabel(days: number): string {
  if (days === 0) return 'Vandaag!';
  if (days === 1) return 'Morgen';
  return `${days} dagen`;
}
