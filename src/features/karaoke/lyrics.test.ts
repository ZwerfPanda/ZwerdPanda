import { describe, expect, it } from 'vitest';
import { isMine, lineAt, lineProgress, parseLyrics, toLrc, untilNext } from './lyrics';
import { encodeWav, findClaps, medianDelay, resample } from './audio';

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
