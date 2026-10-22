import type { AppContent, Countdown, CountdownIcon } from '../../data/types';
import { addMonths, daysUntil, parseIsoDate, toIsoDate } from '../../lib/dates';

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
  const start = content.profile.startDate;
  if (start) {
    const next = nextOccurrence(start, true, today);
    if (next && next.years > 0) {
      list.push({
        id: 'auto-anniversary',
        title:
          next.years === 1 ? 'Our first anniversary' : `Our ${ordinal(next.years)} anniversary`,
        icon: 'heart',
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
      title: `Coco turns ${coco.years}`,
      icon: 'rabbit',
      date: coco.date,
      days: coco.days,
      auto: true,
    });
  }
  return list.sort((a, b) => a.days - b.days || a.title.localeCompare(b.title));
}

export function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

export function daysLabel(days: number): string {
  if (days === 0) return 'Today!';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}
