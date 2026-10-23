import { describe, expect, it } from 'vitest';
import { createDefaultContent } from './defaults';
import { addMissing, whatsMissing } from './restorePoints';

const photo = (id: string) => ({ type: 'local' as const, mediaId: id, kind: 'image' as const });

describe('bringing back what went missing', () => {
  it('brings back deleted letters and lost photos, keeping everything new', () => {
    const old = createDefaultContent();
    old.museum.stops = old.museum.stops.map((s) =>
      s.id === 'stop-pumpkin' ? { ...s, media: [photo('p1'), photo('p2')] } : s,
    );
    const now = createDefaultContent();
    const deleted = now.letters[0];
    now.letters = now.letters.slice(1);
    now.museum.stops = now.museum.stops.map((s) =>
      s.id === 'stop-pumpkin' ? { ...s, story: 'Nieuw verhaal', media: [photo('p3')] } : s,
    );

    const merged = addMissing(now, old);
    const pumpkin = merged.museum.stops.find((s) => s.id === 'stop-pumpkin')!;
    expect(pumpkin.story).toBe('Nieuw verhaal');
    expect(pumpkin.media.map((m) => (m.type === 'local' ? m.mediaId : ''))).toEqual([
      'p3',
      'p1',
      'p2',
    ]);
    expect(merged.letters[0].id).toBe(deleted.id);
    expect(merged.letters).toHaveLength(old.letters.length);
  });

  it('never removes anything that is there now', () => {
    const old = createDefaultContent();
    const now = createDefaultContent();
    now.memories = [
      {
        id: 'm-new',
        caption: 'Nieuw',
        albumIds: [],
        media: photo('x'),
        favorite: false,
        createdAt: '2026-10-23T10:00:00.000Z',
      },
      ...now.memories,
    ];
    const merged = addMissing(now, old);
    expect(merged.memories.map((m) => m.id)).toContain('m-new');
    expect(merged.memories).toHaveLength(now.memories.length);
  });

  it('says what it would bring back', () => {
    const old = createDefaultContent();
    old.museum.stops[0] = { ...old.museum.stops[0], media: [photo('a')] };
    const now = createDefaultContent();
    now.museum.stops = now.museum.stops.slice(1);
    expect(whatsMissing(now, old)).toEqual({ haltes: 1, "foto's": 1 });
  });
});
