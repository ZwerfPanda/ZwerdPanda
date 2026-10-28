import type { KaraokeLine, KaraokePart, Person } from '../../data/types';

/*
 * The words of a song, on time: pasted as plain lines (and timed by tapping
 * along), or as an .lrc file ("[01:23.45] a line"). A line can say who sings
 * it: "A:" for the first voice, "B:" for the second, "Samen:" for both.
 */

export interface DraftLine {
  /** Seconds into the song, or null while not timed yet. */
  at: number | null;
  text: string;
  part: KaraokePart;
}

const TAG = /\[(\d{1,2}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;
const PART = /^\s*(a|b|1|2|samen|both|s)\s*[:)]\s*/i;

function partOf(text: string, fallback: KaraokePart): { text: string; part: KaraokePart } {
  const m = PART.exec(text);
  if (!m) return { text: text.trim(), part: fallback };
  const k = m[1].toLowerCase();
  const part: KaraokePart = k === 'a' || k === '1' ? 'a' : k === 'b' || k === '2' ? 'b' : 'both';
  return { text: text.slice(m[0].length).trim(), part };
}

export function parseLyrics(input: string, fallback: KaraokePart = 'both'): DraftLine[] {
  const out: DraftLine[] = [];
  for (const raw of input.replace(/\r/g, '').split('\n')) {
    const times: number[] = [];
    const rest = raw.replace(TAG, (_, m: string, s: string) => {
      times.push(Number(m) * 60 + Number(s.replace(':', '.')));
      return '';
    });
    // Skip .lrc headers like [ar:Artist].
    if (/^\s*\[[a-z]+:.*\]\s*$/i.test(rest)) continue;
    const { text, part } = partOf(rest, fallback);
    if (!text) continue;
    if (times.length) for (const at of times) out.push({ at, text, part });
    else out.push({ at: null, text, part });
  }
  const timed = out.every((l) => l.at !== null);
  return timed ? out.sort((a, b) => a.at! - b.at!) : out;
}

const two = (n: number) => String(n).padStart(2, '0');

/** As an .lrc text again (to copy, or to edit by hand). */
export function toLrc(lines: DraftLine[]): string {
  return lines
    .map((l) => {
      const prefix = l.part === 'a' ? 'A: ' : l.part === 'b' ? 'B: ' : '';
      if (l.at === null) return prefix + l.text;
      const m = Math.floor(l.at / 60);
      const s = l.at - m * 60;
      return `[${two(m)}:${two(Math.floor(s))}.${two(Math.floor((s % 1) * 100))}] ${prefix}${l.text}`;
    })
    .join('\n');
}

export const isTimed = (lines: DraftLine[]): lines is (DraftLine & { at: number })[] =>
  lines.length > 0 && lines.every((l) => l.at !== null);

/** Which line is being sung at `t` (-1 before the first). */
export function lineAt(lines: KaraokeLine[], t: number): number {
  let found = -1;
  for (let i = 0; i < lines.length; i++) if (lines[i].at <= t) found = i;
  return found;
}

/** How far through line `i` we are (0–1), for the colour sweeping along. */
export function lineProgress(lines: KaraokeLine[], i: number, t: number, songEnd: number): number {
  if (i < 0) return 0;
  const start = lines[i].at;
  const end = Math.min(lines[i + 1]?.at ?? songEnd, start + 8);
  return Math.max(0, Math.min(1, (t - start) / Math.max(0.5, end - start)));
}

/** Seconds until the next line, for the 3-2-1 dots. */
export function untilNext(lines: KaraokeLine[], t: number): number | null {
  const next = lines.find((l) => l.at > t);
  return next ? next.at - t : null;
}

/** Who sings a part in this take. */
export function singerOf(part: KaraokePart, roles?: { a: Person; b: Person }): Person | 'both' {
  if (part === 'both' || !roles) return 'both';
  return roles[part];
}

/** Is this line mine to sing? */
export function isMine(part: KaraokePart, me: Person, roles?: { a: Person; b: Person }): boolean {
  const who = singerOf(part, roles);
  return who === 'both' || who === me;
}

const normal = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * A duet out of any song: lines that come back (the chorus) for both of us,
 * the rest in turns, a verse each (a pause of a few seconds starts the next
 * part; without pauses, two lines each).
 */
export function autoParts<T extends { at: number | null; text: string }>(
  lines: T[],
): (T & { part: KaraokePart })[] {
  const count = new Map<string, number>();
  for (const l of lines) count.set(normal(l.text), (count.get(normal(l.text)) ?? 0) + 1);
  const chorus = (l: T) => (count.get(normal(l.text)) ?? 0) >= 2;
  const gaps = lines.some(
    (l, i) => i > 0 && l.at !== null && lines[i - 1].at !== null && l.at - lines[i - 1].at! >= 4,
  );
  let block = 0;
  let inBlock = 0;
  let prevChorus = false;
  return lines.map((l, i) => {
    if (chorus(l)) {
      prevChorus = true;
      return { ...l, part: 'both' as const };
    }
    const prev = lines[i - 1];
    const newBlock =
      i > 0 &&
      (prevChorus ||
        (gaps
          ? l.at !== null && prev?.at !== null && prev !== undefined && l.at - prev.at! >= 4
          : inBlock >= 2));
    if (newBlock) {
      block++;
      inBlock = 0;
    }
    inBlock++;
    prevChorus = false;
    return { ...l, part: block % 2 ? ('b' as const) : ('a' as const) };
  });
}

/** Every line a bit earlier or later (when the music starts differently). */
export function shiftLines<T extends { at: number | null }>(lines: T[], by: number): T[] {
  return lines.map((l) =>
    l.at === null ? l : { ...l, at: Math.max(0, Math.round((l.at + by) * 100) / 100) },
  );
}

/* ------------------------------------------------- word by word */

export interface SungWord {
  text: string;
  start: number;
  end: number;
}

/**
 * How long a line is sung: never into the next line, and not through a long
 * instrumental pause either (estimated from how much there is to sing).
 */
export function lineDuration(lines: KaraokeLine[], i: number, songEnd: number): number {
  const line = lines[i];
  const gap = (lines[i + 1]?.at ?? songEnd) - line.at;
  const letters = line.text.replace(/\s+/g, '').length;
  const words = line.text.trim().split(/\s+/).length;
  const estimate = Math.min(9, Math.max(1.4, letters * 0.075 + words * 0.12 + 0.4));
  return Math.max(Math.min(0.8, gap), Math.min(gap - 0.15, estimate));
}

/** When each word of line `i` is sung (spread by length, like syllables). */
export function wordsOf(lines: KaraokeLine[], i: number, songEnd: number): SungWord[] {
  const line = lines[i];
  const parts = line.text.trim().split(/\s+/);
  const weights = parts.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length + 1.5);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = lineDuration(lines, i, songEnd);
  let at = line.at;
  return parts.map((text, k) => {
    const len = (weights[k] / total) * span;
    const word = { text, start: at, end: at + len };
    at += len;
    return word;
  });
}

export type Moment =
  | { kind: 'intro'; focus: number; wait: number }
  | { kind: 'singing'; focus: number; words: SungWord[] }
  | { kind: 'waiting'; focus: number; wait: number }
  | { kind: 'end' };

/** What to show at `t`: the line being sung, or the next one with a countdown. */
export function momentAt(lines: KaraokeLine[], t: number, songEnd: number): Moment {
  if (!lines.length) return { kind: 'end' };
  const i = lineAt(lines, t);
  if (i < 0) return { kind: 'intro', focus: 0, wait: lines[0].at - t };
  const words = wordsOf(lines, i, songEnd);
  if (t < words[words.length - 1].end) return { kind: 'singing', focus: i, words };
  if (i + 1 < lines.length) return { kind: 'waiting', focus: i + 1, wait: lines[i + 1].at - t };
  return { kind: 'end' };
}
