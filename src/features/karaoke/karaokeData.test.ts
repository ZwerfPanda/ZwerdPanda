import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import type { AppContent } from '../../data/types';
import { carryForward, contentMediaIds, mergeContent } from '../../sync/merge';

const song = {
  id: 'song-1',
  title: 'Ons Duet',
  track: { mediaId: 'media-track', seconds: 180 },
  lines: [
    { at: 9, text: 'jij', part: 'b' as const },
    { at: 2, text: 'ik', part: 'a' as const },
  ],
  createdAt: '2026-10-27T10:00:00.000Z',
};
const take = {
  id: 'take-1',
  song: 'song-1',
  mode: 'duet' as const,
  roles: { a: 'you' as const, b: 'partner' as const },
  voices: [{ who: 'you' as const, mediaId: 'media-his', seconds: 180, delay: 120, volume: 1 }],
  music: 0.8,
  echo: 0.25,
  createdAt: '2026-10-27T10:05:00.000Z',
};
const withKaraoke = (): AppContent => ({
  ...createDefaultContent(),
  karaoke: { songs: [song], takes: [take] },
});

describe('karaoke data', () => {
  it('survives saving and loading, lines in time order', () => {
    const c = normalizeContent(JSON.parse(JSON.stringify(withKaraoke())));
    expect(c.karaoke.songs[0].lines.map((l) => l.text)).toEqual(['ik', 'jij']);
    expect(c.karaoke.takes[0]).toMatchObject({ mode: 'duet', roles: { a: 'you', b: 'partner' } });
    expect(c.karaoke.takes[0].voices[0].delay).toBe(120);
  });

  it('drops broken pieces', () => {
    const c = normalizeContent({
      ...withKaraoke(),
      karaoke: {
        songs: [{ id: 'x', title: 'zonder muziek' }, song],
        takes: [
          { ...take, voices: [{ who: 'coco', mediaId: 'm' }], roles: { a: 'you', b: 'you' } },
        ],
      },
    });
    expect(c.karaoke.songs.map((s) => s.id)).toEqual(['song-1']);
    expect(c.karaoke.takes[0].voices).toEqual([]);
    expect(c.karaoke.takes[0].roles).toBeUndefined();
  });

  it('syncs: her part joins his, and the files travel', () => {
    const base = withKaraoke();
    const hers = {
      ...base,
      karaoke: {
        ...base.karaoke,
        takes: [
          {
            ...take,
            voices: [
              ...take.voices,
              {
                who: 'partner' as const,
                mediaId: 'media-hers',
                seconds: 180,
                delay: 90,
                volume: 1,
              },
            ],
            mix: { mediaId: 'media-mix', seconds: 180 },
            doneAt: '2026-10-27T11:00:00.000Z',
          },
        ],
      },
    };
    const merged = mergeContent(base, base, hers);
    expect(merged.karaoke.takes[0].voices).toHaveLength(2);
    expect(contentMediaIds(merged)).toEqual(
      expect.arrayContaining(['media-track', 'media-his', 'media-hers', 'media-mix']),
    );
  });

  it('an older app saving without the room never loses it', () => {
    const ours = withKaraoke();
    const theirs = { ...createDefaultContent(), karaoke: { songs: [], takes: [] } };
    expect(carryForward(theirs, ours, 8).karaoke.songs).toHaveLength(1);
  });
});
