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
import { encodeWav, findClaps, medianDelay, polishVoice, resample } from './audio';

describe('karaoke lyrics', () => {
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

describe('karaoke sound', () => {
  it('writes a proper WAV', async () => {
    const blob = encodeWav(new Float32Array([0, 0.5, -1, 1]), 22050);
    const view = new DataView(await blob.arrayBuffer());
    expect(blob.size).toBe(44 + 8);
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getInt16(44 + 4, true)).toBe(-32768);
    expect(view.getInt16(44 + 6, true)).toBe(32767);
  });

  it('resamples to the voice rate', () => {
    const out = resample(new Float32Array(48000).fill(0.5), 48000, 22050);
    expect(out.length).toBe(22050);
    expect(out[100]).toBeCloseTo(0.5);
  });

  it('measures this phone’s delay from claps', () => {
    const rate = 22050;
    const samples = new Float32Array(rate * 6);
    const ticks = [1, 1.6, 2.2, 2.8, 3.4, 4.0];
    // Claps 180 ms after each tick (one missed, one early stray).
    for (const t of ticks.slice(1))
      samples.fill(0.8, Math.round((t + 0.18) * rate), Math.round((t + 0.19) * rate));
    samples.fill(0.6, Math.round(0.3 * rate), Math.round(0.31 * rate));
    const claps = findClaps(samples, rate);
    expect(medianDelay(claps, ticks)).toBeGreaterThan(170);
    expect(medianDelay(claps, ticks)).toBeLessThan(195);
    expect(medianDelay([], ticks)).toBeNull();
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

describe('a voice made ready', () => {
  it('a quiet voice comes up, rumble goes out', () => {
    const rate = 32000;
    const quiet = new Float32Array(rate * 2);
    for (let i = 0; i < quiet.length; i++)
      quiet[i] =
        0.05 * Math.sin((2 * Math.PI * 440 * i) / rate) +
        0.05 * Math.sin((2 * Math.PI * 20 * i) / rate);
    const out = polishVoice(quiet, rate);
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    // Up to 8× louder (more would only blow up the noise).
    expect(peak).toBeGreaterThan(0.4);
    expect(peak).toBeLessThanOrEqual(1);
    // the 20 Hz rumble is mostly gone: averaged over a 440 Hz cycle, little is left
    const win = Math.round(rate / 440);
    let low = 0;
    for (let i = rate; i < rate + win * 20; i += win) {
      let sum = 0;
      for (let j = 0; j < win; j++) sum += out[i + j];
      low = Math.max(low, Math.abs(sum / win));
    }
    expect(low).toBeLessThan(0.1);
  });

  it('silence stays silence (no noise blown up)', () => {
    const out = polishVoice(new Float32Array(32000), 32000);
    expect(Math.max(...out.map(Math.abs))).toBe(0);
  });
});
