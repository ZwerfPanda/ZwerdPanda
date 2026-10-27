import { describe, expect, it } from 'vitest';
import { searchLyrics } from './lrclib';
import { autoParts, parseLyrics, shiftLines } from './lyrics';

const reply = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe('looking a song up', () => {
  it('asks LRCLIB and puts the ones on time first, each once', async () => {
    let asked = '';
    const fetcher = (async (url: string) => {
      asked = url;
      return new Response(
        JSON.stringify([
          {
            id: 1,
            trackName: 'Perfect',
            artistName: 'Ed Sheeran',
            duration: 263,
            plainLyrics: 'I found a love',
            syncedLyrics: null,
          },
          {
            id: 2,
            trackName: 'Perfect',
            artistName: 'Ed Sheeran',
            duration: 263,
            plainLyrics: 'I found a love',
            syncedLyrics: '[00:05.00] I found a love',
          },
          {
            id: 3,
            trackName: 'Perfect',
            artistName: 'Ed Sheeran',
            duration: 263.4,
            plainLyrics: 'x',
            syncedLyrics: '[00:05.00] x',
          },
          {
            id: 4,
            trackName: 'Perfect (Instrumental)',
            artistName: 'Ed Sheeran',
            instrumental: true,
          },
          { id: 5, trackName: 'Leeg', artistName: 'Niemand' },
          { id: 6, trackName: 'Perfect Duet', artistName: 'Ed Sheeran & Beyoncé', duration: 259, plainLyrics: 'baby' },
        ]),
      );
    }) as unknown as typeof fetch;
    const found = await searchLyrics('perfect ed sheeran', fetcher);
    expect(asked).toBe('https://lrclib.net/api/search?q=perfect%20ed%20sheeran');
    // The same version without times, or twice with times, shows once: the one on time.
    expect(found.map((f) => f.id)).toEqual([2, 6]);
    expect(found[0]).toMatchObject({ title: 'Perfect', artist: 'Ed Sheeran', duration: 263 });
  });

  it('says so when it can’t search', async () => {
    await expect(searchLyrics('abc', reply({}, 500))).rejects.toThrow(/500/);
    const offline = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(searchLyrics('abc', offline)).rejects.toThrow(/verbinding/);
    expect(await searchLyrics('a', reply([]))).toEqual([]);
  });
});

describe('a duet out of any song', () => {
  it('chorus together, verses in turns', () => {
    const lines = parseLyrics(
      [
        '[00:10.00] Eerste couplet een',
        '[00:12.00] Eerste couplet twee',
        '[00:20.00] Dit is het refrein!',
        '[00:22.00] Nog een refreinregel',
        '[00:30.00] Tweede couplet een',
        '[00:32.00] Tweede couplet twee',
        '[00:40.00] Dit is het refrein',
        '[00:42.00] Nog een refreinregel',
      ].join('\n'),
    );
    expect(autoParts(lines).map((l) => l.part)).toEqual([
      'a',
      'a',
      'both',
      'both',
      'b',
      'b',
      'both',
      'both',
    ]);
  });

  it('without pauses: two lines each', () => {
    const lines = parseLyrics(
      '[00:01.00] een\n[00:02.00] twee\n[00:03.00] drie\n[00:04.00] vier\n[00:05.00] vijf',
    );
    expect(autoParts(lines).map((l) => l.part)).toEqual(['a', 'a', 'b', 'b', 'a']);
  });

  it('moves the whole text, never before the start', () => {
    const lines = parseLyrics('[00:00.20] een\n[00:03.00] twee');
    expect(shiftLines(lines, -0.5).map((l) => l.at)).toEqual([0, 2.5]);
    expect(shiftLines(lines, 0.5).map((l) => l.at)).toEqual([0.7, 3.5]);
  });
});
