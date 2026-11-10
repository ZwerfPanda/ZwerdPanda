import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import type { Story } from '../../data/types';
import { carryForward, contentMediaIds, mergeContent } from '../../sync/merge';
import {
  freshStories,
  hasSeen,
  startAt,
  storiesByDay,
  storySeconds,
  timeAgo,
  unseenCount,
} from './stories';

const NOW = Date.parse('2026-11-10T18:00:00.000Z');
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const story = (id: string, by: Story['by'], hours: number, extra: Partial<Story> = {}): Story => ({
  id,
  by,
  bg: 'sunset',
  filter: 'none',
  texts: [{ text: 'hoi', x: 0.5, y: 0.5, font: 'clean', color: '#ffffff', boxed: false }],
  stickers: [],
  createdAt: ago(hours),
  ...extra,
});

describe('stories', () => {
  it('a story is new for a day, then only in the archive', () => {
    const items = [
      story('a', 'you', 30),
      story('b', 'you', 5),
      story('c', 'you', 1),
      story('d', 'partner', 2),
    ];
    expect(freshStories(items, 'you', NOW).map((s) => s.id)).toEqual(['b', 'c']);
    expect(freshStories(items, 'partner', NOW).map((s) => s.id)).toEqual(['d']);
  });

  it('knows what I have not seen yet, and starts there', () => {
    const c = createDefaultContent();
    c.stories.items = [story('a', 'partner', 3), story('b', 'partner', 2), story('m', 'you', 1)];
    c.stories.views = [{ id: 'v', story: 'a', by: 'you', at: ago(1) }];
    expect(unseenCount(c, 'you', NOW)).toBe(1);
    expect(hasSeen(c, c.stories.items[2], 'you')).toBe(true); // my own
    expect(startAt(c, freshStories(c.stories.items, 'partner', NOW), 'you')).toBe(1);
    // all seen: from the start again
    c.stories.views.push({ id: 'w', story: 'b', by: 'you', at: ago(1) });
    expect(unseenCount(c, 'you', NOW)).toBe(0);
    expect(startAt(c, freshStories(c.stories.items, 'partner', NOW), 'you')).toBe(0);
  });

  it('shows a photo a few seconds and a clip as long as it is', () => {
    expect(storySeconds(story('a', 'you', 1))).toBe(5);
    const clip = story('v', 'you', 1, {
      media: { type: 'local', mediaId: 'm', kind: 'video' },
      seconds: 12.5,
    });
    expect(storySeconds(clip)).toBe(12.5);
    expect(storySeconds({ ...clip, seconds: 400 })).toBe(60);
  });

  it('reads the time like an app does', () => {
    expect(timeAgo(ago(0), NOW)).toBe('nu');
    expect(timeAgo(ago(0.5), NOW)).toBe('30m');
    expect(timeAgo(ago(5), NOW)).toBe('5u');
    expect(timeAgo(ago(30), NOW)).toBe('gisteren');
  });

  it('groups the archive per day, newest day first', () => {
    const days = storiesByDay([
      story('a', 'you', 0, { createdAt: '2026-08-14T12:00:01.000Z' }),
      story('b', 'you', 0, { createdAt: '2026-11-10T10:00:00.000Z' }),
      story('c', 'you', 0, { createdAt: '2026-08-14T12:00:00.000Z' }),
    ]);
    expect(days.map((d) => d.day)).toEqual(['2026-11-10', '2026-08-14']);
    expect(days[1].stories.map((s) => s.id)).toEqual(['c', 'a']);
  });
});

describe('stories on two phones', () => {
  it('keeps only what makes sense', () => {
    const c = normalizeContent({
      ...createDefaultContent(),
      stories: {
        items: [
          { id: 'ok', by: 'you', texts: [{ text: ' hoi ', color: 'red' }], createdAt: ago(1) },
          {
            id: 'up',
            by: 'partner',
            media: { type: 'local', mediaId: 'm1', kind: 'video' },
            from: 'tiktok',
            seconds: 9,
            createdAt: ago(1),
          },
          { id: 'empty', by: 'you', texts: [], createdAt: ago(1) },
          { id: 'nobody', texts: [{ text: 'x' }] },
        ],
        views: [{ id: 'v', story: 'ok', by: 'partner', at: ago(1) }, { story: 'ok' }],
        reactions: [{ id: 'r', story: 'ok', by: 'partner', emoji: '😍', at: ago(1) }],
        highlights: [{ id: 'h', title: 'Reis', stories: ['up', 'up', 3] }, { title: '' }],
      },
    });
    expect(c.stories.items.map((s) => s.id).sort()).toEqual(['ok', 'up']);
    expect(c.stories.items.find((s) => s.id === 'ok')!.texts[0]).toMatchObject({
      text: 'hoi',
      color: '#ffffff',
    });
    expect(c.stories.items.find((s) => s.id === 'up')).toMatchObject({
      from: 'tiktok',
      seconds: 9,
    });
    expect(c.stories.views).toHaveLength(1);
    expect(c.stories.highlights).toEqual([
      expect.objectContaining({ title: 'Reis', emoji: '💞', stories: ['up'] }),
    ]);
  });

  it('merges stories both phones posted, and their photos travel along', () => {
    const base = createDefaultContent();
    const mine = createDefaultContent();
    const theirs = createDefaultContent();
    mine.stories.items = [
      story('a', 'you', 1, { media: { type: 'local', mediaId: 'pic', kind: 'image' } }),
    ];
    theirs.stories.items = [story('b', 'partner', 1)];
    theirs.stories.views = [{ id: 'sview-a-partner', story: 'a', by: 'partner', at: ago(0) }];
    const out = mergeContent(base, mine, theirs);
    expect(out.stories.items.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(out.stories.views).toHaveLength(1);
    expect(contentMediaIds(out)).toContain('pic');
    // deleting on one phone deletes on both
    const after = mergeContent(
      out,
      { ...out, stories: { ...out.stories, items: [out.stories.items[1]] } },
      out,
    );
    expect(after.stories.items).toHaveLength(1);
  });

  it('an older app that saves without stories keeps ours, and the reply links', () => {
    const ours = createDefaultContent();
    ours.stories.items = [story('a', 'you', 1)];
    ours.chat.messages = [{ id: 'm', from: 'partner', text: 'mooi!', at: ago(0), story: 'a' }];
    const shared = createDefaultContent();
    shared.chat.messages = [{ id: 'm', from: 'partner', text: 'mooi!', at: ago(0) }];
    const out = carryForward(shared, ours, 14);
    expect(out.stories.items).toHaveLength(1);
    expect(out.chat.messages[0].story).toBe('a');
  });
});
