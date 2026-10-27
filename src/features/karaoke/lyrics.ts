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
