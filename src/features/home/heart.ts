import { addMonths, daysUntil, durationBetween } from '../../lib/dates';

/** Round numbers worth a little celebration, besides every hundred days. */
const SPECIAL = [
  50, 111, 222, 333, 444, 555, 777, 888, 999, 1000, 1111, 1234, 1500, 2000, 2222, 2500,
];

/** The next day-count to look forward to: the next hundred, or something sweeter. */
export function nextMilestone(totalDays: number): { day: number; inDays: number; from: number } {
  const hundred = (Math.floor(totalDays / 100) + 1) * 100;
  const special = SPECIAL.find((d) => d > totalDays);
  const day = special && special < hundred ? special : hundred;
  // Progress runs from the previous milestone, so the ring fills up nicely.
  const previous = Math.max(
    Math.floor(totalDays / 100) * 100,
    ...SPECIAL.filter((d) => d <= totalDays),
    0,
  );
  return { day, inDays: day - totalDays, from: previous };
}

/** Our monthly "anniversary": the same day of the month as our start. */
export function nextMonthiversary(start: Date, today: Date): { months: number; inDays: number } {
  const d = durationBetween(start, today);
  if (!d) return { months: 0, inDays: 0 };
  const done = d.years * 12 + d.months;
  if (d.days === 0 && d.totalDays > 0) return { months: done, inDays: 0 };
  return { months: done + 1, inDays: daysUntil(addMonths(start, done + 1), today) };
}

/** A playful estimate: about 70 heartbeats a minute since the day we started. */
export function heartbeatsSince(startMs: number, nowMs: number): number {
  return Math.max(0, Math.round(((nowMs - startMs) / 60_000) * 70));
}
