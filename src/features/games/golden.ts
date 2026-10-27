/**
 * Gouden Woensdag: every Wednesday (our time, in the Netherlands) all tickets
 * count double. It's worked out from when a game was played, so both phones
 * always agree.
 */

const TZ = 'Europe/Amsterdam';
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: TZ });
const dayKey = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TZ,
});

export const GOLDEN_FACTOR = 2;

export function isGolden(when: string | number | Date): boolean {
  const d = new Date(when);
  return !Number.isNaN(d.getTime()) && weekday.format(d) === 'Wed';
}

/** The day, as YYYY-MM-DD in our time zone. */
export const ourDay = (when: string | number | Date = Date.now()) => dayKey.format(new Date(when));

const weeks = new Map<string, string>();
/** The week, as the date of its Monday (YYYY-MM-DD, our time). */
export function weekKey(when: string | number = Date.now()): string {
  const key = String(when);
  const hit = weeks.get(key);
  if (hit) return hit;
  const d = new Date(`${ourDay(when)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const week = d.toISOString().slice(0, 10);
  if (weeks.size > 20_000) weeks.clear();
  weeks.set(key, week);
  return week;
}

/** How long until this week is over (ms): Sunday midnight, our time. */
export function weekLeft(now = Date.now()): number {
  const week = weekKey(now);
  let end = now;
  for (let step = 86_400_000; step >= 60_000; step /= step === 86_400_000 ? 24 : 60) {
    while (weekKey(end + step) === week) end += step;
  }
  return end + 60_000 - now;
}

/** How long until the golden day is over (ms), on a Wednesday. */
export function goldenLeft(now = Date.now()): number {
  if (!isGolden(now)) return 0;
  // Step forward until it isn't Wednesday any more (a minute at a time near the end).
  let end = now;
  for (let step = 3_600_000; step >= 60_000; step /= 60) {
    while (isGolden(end + step)) end += step;
  }
  return end + 60_000 - now;
}

/** Whole days until the next golden day (0 on a Wednesday). */
export function daysUntilGolden(now = Date.now()): number {
  for (let d = 0; d < 8; d++) if (isGolden(now + d * 86_400_000)) return d;
  return 7;
}
