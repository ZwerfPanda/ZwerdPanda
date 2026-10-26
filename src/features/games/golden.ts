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
