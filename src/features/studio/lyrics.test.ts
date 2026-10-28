import { describe, expect, it } from 'vitest';
import {
  isMine,
  lineAt,
  lineDuration,
  lineProgress,
  momentAt,
  parseLyrics,
  toLrc,
  untilNext,
  wordsOf,
} from './lyrics';

describe('lyrics', () => {
  it('reads plain lines with parts', () => {
    const lines = parseLyrics('A: Ik zing eerst\nB: dan jij\n\nSamen: en wij\ngewoon');
    expect(lines).toEqual([
      { at: null, text: 'Ik zing eerst', part: 'a' },
      { at: null, text: 'dan jij', part: 'b' },
      { at: null, text: 'en wij', part: 'both' },
      { at: null, text: 'gewoon', part: 'both' },
    ]);
  });

  it('reads .lrc, skips its headers and sorts on time', () => {
    const lines = parseLyrics(
      '[ar:Wij]\n[00:12.50] B: tweede\n[00:03.00][01:00.25] A: eerste en refrein',
    );
    expect(lines.map((l) => [l.at, l.part, l.text])).toEqual([
      [3, 'a', 'eerste en refrein'],
      [12.5, 'b', 'tweede'],
      [60.25, 'a', 'eerste en refrein'],
    ]);
    expect(parseLyrics(toLrc(lines))).toEqual(lines);
  });

  it('follows the song', () => {
    const lines = [
      { at: 2, text: 'een', part: 'a' as const },
      { at: 6, text: 'twee', part: 'b' as const },
    ];
    expect(lineAt(lines, 1)).toBe(-1);
    expect(lineAt(lines, 3)).toBe(0);
    expect(lineAt(lines, 7)).toBe(1);
    expect(lineProgress(lines, 0, 4, 20)).toBeCloseTo(0.5);
    expect(untilNext(lines, 4)).toBe(2);
    expect(isMine('a', 'you', { a: 'you', b: 'partner' })).toBe(true);
    expect(isMine('b', 'you', { a: 'you', b: 'partner' })).toBe(false);
    expect(isMine('b', 'you')).toBe(true);
  });
});

describe('word by word', () => {
  const lines = [
    { at: 2, text: 'Kort', part: 'a' as const },
    {
      at: 3,
      text: 'Een hele lange zin die je zingt voor de muziek weer verder gaat',
      part: 'b' as const,
    },
    { at: 30, text: 'Na de solo', part: 'both' as const },
  ];

  it('a line is sung until the next one, but not through a long pause', () => {
    expect(lineDuration(lines, 0, 60)).toBeCloseTo(0.85);
    const long = lineDuration(lines, 1, 60);
    expect(long).toBeGreaterThan(4);
    expect(long).toBeLessThan(9);
  });

  it('words follow each other, longer words take longer', () => {
    const words = wordsOf(lines, 1, 60);
    expect(words[0].start).toBe(3);
    for (let k = 1; k < words.length; k++) expect(words[k].start).toBeCloseTo(words[k - 1].end);
    const lange = words.find((w) => w.text === 'lange')!;
    const de = words.find((w) => w.text === 'de')!;
    expect(lange.end - lange.start).toBeGreaterThan(de.end - de.start);
  });

  it('line by line: singing, then the next line waits with a countdown', () => {
    expect(momentAt(lines, 1, 60)).toMatchObject({ kind: 'intro', focus: 0, wait: 1 });
    expect(momentAt(lines, 4, 60)).toMatchObject({ kind: 'singing', focus: 1 });
    expect(momentAt(lines, 20, 60)).toMatchObject({ kind: 'waiting', focus: 2, wait: 10 });
    expect(momentAt(lines, 59, 60)).toMatchObject({ kind: 'end' });
  });
});
