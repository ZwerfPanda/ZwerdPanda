import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import type { AppContent, OurRecord } from '../../data/types';
import { carryForward, contentMediaIds, mergeContent } from '../../sync/merge';
import { daysUntilOpen, newForMe, wrapped } from './studioData';

const rec = (over: Partial<OurRecord> = {}): OurRecord => ({
  id: 'record-1',
  title: 'Voor jou',
  by: 'you',
  for: 'partner',
  audio: { mediaId: 'media-song', seconds: 200 },
  cover: { type: 'local', mediaId: 'media-cover', kind: 'image', width: 800, height: 800 },
  sleeve: 2,
  createdAt: '2026-10-27T10:00:00.000Z',
  ...over,
});
const withStudio = (
  records: OurRecord[],
  listens: AppContent['studio']['listens'] = [],
): AppContent => ({
  ...createDefaultContent(),
  studio: { records, listens },
});

describe('the music room', () => {
  it('survives saving and loading, and drops what is broken', () => {
    const c = normalizeContent(
      JSON.parse(
        JSON.stringify({
          ...withStudio([rec({ opensOn: '2026-12-24', replyTo: 'record-0' })]),
          studio: {
            records: [
              rec({ opensOn: '2026-12-24', replyTo: 'record-0' }),
              { id: 'x', title: 'zonder liedje', by: 'you' },
            ],
            listens: [
              { record: 'record-1', who: 'partner', plays: 3, heart: true, note: 'mooi' },
              { record: 'record-1', who: 'coco' },
            ],
          },
        }),
      ),
    );
    expect(c.studio.records).toHaveLength(1);
    expect(c.studio.records[0]).toMatchObject({
      opensOn: '2026-12-24',
      replyTo: 'record-0',
      sleeve: 2,
    });
    expect(c.studio.listens).toEqual([
      {
        id: 'record-1:partner',
        record: 'record-1',
        who: 'partner',
        plays: 3,
        heart: true,
        note: 'mooi',
      },
    ]);
  });

  it('new for me: made by the other, not heard, not still wrapped', () => {
    const today = '2026-10-28';
    const c = withStudio([
      rec({ id: 'a' }),
      rec({ id: 'b', opensOn: '2026-12-24' }),
      rec({ id: 'c', by: 'partner', for: 'you' }),
      rec({ id: 'd', for: 'both' }),
    ]);
    expect(
      newForMe(c, 'partner', today)
        .map((r) => r.id)
        .sort(),
    ).toEqual(['a', 'd']);
    const heard = withStudio(c.studio.records, [
      { id: 'a:partner', record: 'a', who: 'partner', plays: 1 },
    ]);
    expect(newForMe(heard, 'partner', today).map((r) => r.id)).toEqual(['d']);
    expect(wrapped(c.studio.records[1], today)).toBe(true);
    expect(daysUntilOpen(c.studio.records[1], today)).toBe(57);
  });

  it('both of us listening at once never overwrite each other', () => {
    const base = withStudio([rec()]);
    const his = withStudio(base.studio.records, [
      { id: 'record-1:you', record: 'record-1', who: 'you', plays: 1 },
    ]);
    const hers = withStudio(base.studio.records, [
      { id: 'record-1:partner', record: 'record-1', who: 'partner', plays: 2, heart: true },
    ]);
    const merged = mergeContent(base, his, hers);
    expect(merged.studio.listens.map((l) => l.id).sort()).toEqual([
      'record-1:partner',
      'record-1:you',
    ]);
    expect(contentMediaIds(merged)).toEqual(expect.arrayContaining(['media-song', 'media-cover']));
  });

  it('an older app saving without the room never loses it', () => {
    const ours = withStudio([rec()]);
    expect(carryForward(createDefaultContent(), ours, 9).studio.records).toHaveLength(1);
  });
});
