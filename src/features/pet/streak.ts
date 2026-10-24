/** Her care streak: days in a row that one of us looked after Coco. */

export interface Medal {
  days: number;
  name: string;
  emoji: string;
}

export const MEDALS: Medal[] = [
  { days: 3, name: 'Lief begin', emoji: '🌱' },
  { days: 7, name: 'Een hele week', emoji: '🥕' },
  { days: 14, name: 'Twee weken trouw', emoji: '💐' },
  { days: 30, name: 'Een maand vol zorg', emoji: '🏆' },
  { days: 100, name: 'Honderd dagen liefde', emoji: '👑' },
];

const shift = (day: string, by: number) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
};

export interface Streak {
  /** Days in a row, up to today (or yesterday, while today can still count). */
  current: number;
  /** The longest run ever. */
  best: number;
  caredToday: boolean;
  /** Medals earned with the longest run. */
  medals: Medal[];
  /** The next medal for the current run. */
  next: Medal | null;
}

export function careStreak(careDays: string[], today: string): Streak {
  const days = new Set(careDays);
  const caredToday = days.has(today);
  let current = 0;
  let day = caredToday ? today : shift(today, -1);
  while (days.has(day)) {
    current++;
    day = shift(day, -1);
  }
  let best = 0;
  let run = 0;
  let previous = '';
  for (const d of [...days].sort()) {
    run = previous && shift(previous, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    previous = d;
  }
  return {
    current,
    best,
    caredToday,
    medals: MEDALS.filter((m) => best >= m.days),
    next: MEDALS.find((m) => current < m.days) ?? null,
  };
}

/* A new medal is celebrated once on each phone. */

const KEY = 'olu:streak-medal:v1';

/** The medal to celebrate now, if this phone hasn't celebrated it yet. */
export function medalToCelebrate(streak: Streak): Medal | null {
  const top = MEDALS.filter((m) => streak.current >= m.days).pop() ?? null;
  const reached = top?.days ?? 0;
  try {
    const seen = localStorage.getItem(KEY);
    // First look on this phone: remember where we are, don't celebrate old medals.
    if (seen === null || Number(seen) >= reached) {
      if (seen === null) localStorage.setItem(KEY, String(reached));
      return null;
    }
    localStorage.setItem(KEY, String(reached));
    return top;
  } catch {
    return null;
  }
}
