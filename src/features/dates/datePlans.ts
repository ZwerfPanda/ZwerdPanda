import type { AppContent, DatePlan, Person } from '../../data/types';
import { createId, nowIso } from '../../lib/id';

/** A planned date, as it stands now: its countdown decides the day (it can be moved). */
export interface PlannedDate {
  plan: DatePlan;
  date: string;
}

const COUNTDOWN_TITLE_MAX = 80;

/** Plans that still count: a plan whose countdown was removed was called off. */
export function activePlans(c: AppContent): PlannedDate[] {
  const countdowns = new Map(c.countdowns.map((d) => [d.id, d]));
  const out: PlannedDate[] = [];
  for (const plan of c.datePlans) {
    if (plan.countdownId) {
      const countdown = countdowns.get(plan.countdownId);
      if (!countdown) continue;
      out.push({ plan, date: countdown.date });
    } else {
      out.push({ plan, date: plan.date });
    }
  }
  return out;
}

/** Dates that were (yesterday or before) and still wait for a photo memory. */
export function waitingForMemory(c: AppContent, today: string): PlannedDate[] {
  return activePlans(c)
    .filter((p) => p.date < today && !p.plan.memoryId && !p.plan.skipped)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Puts a date in our agenda, with its own countdown on the home page. */
export function addDatePlan(
  c: AppContent,
  title: string,
  date: string,
  by: Person | undefined,
): { content: AppContent; plan: DatePlan } {
  const at = nowIso();
  const countdownId = createId('countdown');
  const plan: DatePlan = { id: createId('date'), title, date, countdownId, by, createdAt: at };
  return {
    plan,
    content: {
      ...c,
      datePlans: [...c.datePlans, plan],
      countdowns: [
        ...c.countdowns,
        {
          id: countdownId,
          title: `Date: ${title}`.slice(0, COUNTDOWN_TITLE_MAX),
          date,
          yearly: false,
          icon: 'heart',
          by,
          createdAt: at,
        },
      ],
    },
  };
}

export const patchPlan = (c: AppContent, id: string, patch: Partial<DatePlan>): AppContent => ({
  ...c,
  datePlans: c.datePlans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
});

/** Is this list one with date ideas on it? */
export const isDateList = (list: { id: string; title: string }) =>
  list.id === 'list-date-ideas' || /\bdates?\b|date-/i.test(list.title);

/** A new memory for a date we had: its title and day, filled in. */
export interface DatePreset {
  planId: string;
  caption: string;
  date: string;
}

export function datePreset(c: AppContent, planId: string | null): DatePreset | null {
  const found = planId ? activePlans(c).find((p) => p.plan.id === planId) : undefined;
  return found ? { planId: found.plan.id, caption: found.plan.title, date: found.date } : null;
}
