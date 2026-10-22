import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../data/defaults';
import type { AppContent, Memory } from '../data/types';
import { contentMediaIds, mergeContent, mergeFirstJoin, mergeList, stableEqual } from './merge';

const item = (id: string, text = id) => ({ id, text });
const ids = (list: { id: string }[]) => list.map((i) => i.id);

const memory = (id: string, caption: string): Memory => ({
  id,
  caption,
  albumIds: [],
  media: { type: 'local', mediaId: `media-${id}`, kind: 'image' },
  favorite: false,
  createdAt: '2026-10-22T10:00:00.000Z',
});

describe('stableEqual', () => {
  it('ignores key order and undefined fields', () => {
    expect(stableEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })).toBe(true);
    expect(stableEqual({ a: 1, x: undefined }, { a: 1 })).toBe(true);
    expect(stableEqual({ a: 1 }, { a: 2 })).toBe(false);
  });
});

describe('mergeList', () => {
  const base = [item('a'), item('b'), item('c')];

  it('keeps additions from both sides', () => {
    const local = [item('new-local'), ...base];
    const remote = [...base, item('new-remote')];
    expect(ids(mergeList(base, local, remote))).toEqual(['new-local', 'a', 'b', 'c', 'new-remote']);
  });

  it('applies edits from either side', () => {
    const local = [item('a', 'mine'), item('b'), item('c')];
    const remote = [item('a'), item('b', 'theirs'), item('c')];
    const merged = mergeList(base, local, remote);
    expect(merged.map((i) => i.text)).toEqual(['mine', 'theirs', 'c']);
  });

  it('applies deletions from either side', () => {
    const local = [item('a'), item('c')];
    const remote = [item('a'), item('b')];
    expect(ids(mergeList(base, local, remote))).toEqual(['a']);
  });

  it('keeps an item one side edited while the other deleted it', () => {
    const local = [item('a'), item('b', 'edited here'), item('c')];
    const remote = [item('a'), item('c')];
    expect(mergeList(base, local, remote).find((i) => i.id === 'b')?.text).toBe('edited here');
  });

  it('prefers this device when both edited the same item', () => {
    const local = [item('a', 'mine'), item('b'), item('c')];
    const remote = [item('a', 'theirs'), item('b'), item('c')];
    expect(mergeList(base, local, remote)[0].text).toBe('mine');
  });

  it('keeps a reorder made on either side', () => {
    expect(ids(mergeList(base, [item('c'), item('a'), item('b')], base))).toEqual(['c', 'a', 'b']);
    expect(ids(mergeList(base, base, [item('b'), item('a'), item('c')]))).toEqual(['b', 'a', 'c']);
  });
});

describe('mergeContent', () => {
  it('merges two phones editing different things at once', () => {
    const base = createDefaultContent();
    const local: AppContent = {
      ...base,
      memories: [memory('m-valencio', 'Our first selfie'), ...base.memories],
      profile: { ...base.profile, startDate: '2026-03-10' },
    };
    const remote: AppContent = {
      ...base,
      letters: base.letters.slice(1),
      profile: { ...base.profile, homeGreeting: 'Hi love,' },
    };
    const merged = mergeContent(base, local, remote);
    expect(merged.memories[0].caption).toBe('Our first selfie');
    expect(merged.letters).toHaveLength(base.letters.length - 1);
    expect(merged.profile.startDate).toBe('2026-03-10');
    expect(merged.profile.homeGreeting).toBe('Hi love,');
  });

  it('merges lists nested in Coco and the surprises', () => {
    const base = createDefaultContent();
    const local = {
      ...base,
      coco: { ...base.coco, notes: [{ id: 'n1', text: 'Zoomies', createdAt: 'x' }] },
    };
    const remote = {
      ...base,
      surprises: {
        ...base.surprises,
        stars: [...base.surprises.stars, { id: 's-new', text: 'A new star' }],
      },
    };
    const merged = mergeContent(base, local, remote);
    expect(merged.coco.notes.map((n) => n.text)).toEqual(['Zoomies']);
    expect(merged.surprises.stars.at(-1)?.text).toBe('A new star');
  });
});

describe('mergeFirstJoin', () => {
  it('takes the shared copy, keeps own creations and drops local samples', () => {
    const shared = createDefaultContent();
    shared.memories = [memory('m-shared', 'Shared photo')];
    shared.profile.startDate = '2026-03-10';
    const mine = createDefaultContent();
    mine.memories = [memory('m-mine', 'Taken before connecting'), ...mine.memories];
    const merged = mergeFirstJoin(mine, shared);
    expect(merged.memories.map((m) => m.caption)).toEqual([
      'Taken before connecting',
      'Shared photo',
    ]);
    expect(merged.profile.startDate).toBe('2026-03-10');
  });
});

describe('contentMediaIds', () => {
  it('finds every stored photo reference', () => {
    const c = createDefaultContent();
    c.memories = [memory('a', 'x')];
    c.coco.portrait = { type: 'local', mediaId: 'coco-photo', kind: 'image' };
    expect(contentMediaIds(c).sort()).toEqual(['coco-photo', 'media-a']);
  });
});

describe('mergePet', () => {
  const fed = (c: AppContent, at: string, by: 'you' | 'partner', bond: number): AppContent => ({
    ...c,
    pet: {
      ...c.pet,
      fedAt: at,
      bond: c.pet.bond + bond,
      log: [{ id: `log-${by}-${at}`, action: 'fed', detail: 'romaine', by, at }, ...c.pet.log],
    },
  });

  it('counts care from both phones at the same time', () => {
    const base = createDefaultContent();
    base.pet.bond = 10;
    const local = fed(base, '2026-10-22T09:00:00.000Z', 'you', 3);
    const remote = fed(base, '2026-10-22T09:05:00.000Z', 'partner', 4);
    const merged = mergeContent(base, local, remote).pet;
    expect(merged.bond).toBe(17);
    expect(merged.fedAt).toBe('2026-10-22T09:05:00.000Z');
    expect(merged.log.map((e) => e.by)).toEqual(['partner', 'you']);
  });

  it('adds up trick training and treats, within limits', () => {
    const base = createDefaultContent();
    base.pet.tricks = { spin: 80 };
    base.pet.treats = { date: '2026-10-22', count: 0 };
    const local = {
      ...base,
      pet: { ...base.pet, tricks: { spin: 95 }, treats: { date: '2026-10-22', count: 1 } },
    };
    const remote = {
      ...base,
      pet: {
        ...base.pet,
        tricks: { spin: 90, boop: 10 },
        treats: { date: '2026-10-22', count: 1 },
      },
    };
    const merged = mergeContent(base, local, remote).pet;
    expect(merged.tricks).toEqual({ spin: 100, boop: 10 });
    expect(merged.treats).toEqual({ date: '2026-10-22', count: 2 });
  });

  it('keeps the newest day of treats when the days differ', () => {
    const base = createDefaultContent();
    const local = { ...base, pet: { ...base.pet, treats: { date: '2026-10-21', count: 2 } } };
    const remote = { ...base, pet: { ...base.pet, treats: { date: '2026-10-22', count: 1 } } };
    expect(mergeContent(base, local, remote).pet.treats).toEqual({ date: '2026-10-22', count: 1 });
  });

  it('merges countdowns and the welcome like everything else', () => {
    const base = createDefaultContent();
    const countdown = {
      id: 'cd-1',
      title: 'Next date',
      date: '2026-11-01',
      yearly: false,
      icon: 'heart' as const,
      createdAt: '2026-10-22T10:00:00.000Z',
    };
    const local = { ...base, countdowns: [countdown] };
    const remote = { ...base, welcome: { ...base.welcome, seenAt: '2026-10-22T11:00:00.000Z' } };
    const merged = mergeContent(base, local, remote);
    expect(merged.countdowns.map((c) => c.id)).toEqual(['cd-1']);
    expect(merged.welcome.seenAt).toBe('2026-10-22T11:00:00.000Z');
  });
});

describe('lists and mini us', () => {
  const item = (id: string, text: string) => ({
    id,
    text,
    hearts: [] as ('you' | 'partner')[],
    done: false,
    createdAt: '2026-10-22T00:00:00.000Z',
  });

  it('merges items added and hearted on both phones', () => {
    const base = createDefaultContent();
    base.lists[0].items = [item('i1', 'Noor')];
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.lists[0].items.push(item('i2', 'Amara'));
    local.lists[0].items[0].hearts = ['you'];
    remote.lists[0].items.push(item('i3', 'Liya'));
    remote.lists.push({
      id: 'l2',
      title: 'Films',
      icon: 'film',
      items: [],
      createdAt: base.lists[0].createdAt,
    });
    const merged = mergeContent(base, local, remote);
    expect(merged.lists.map((l) => l.id)).toEqual(['list-baby-names', 'l2']);
    expect(merged.lists[0].items.map((i) => i.text).sort()).toEqual(['Amara', 'Liya', 'Noor']);
    expect(merged.lists[0].items.find((i) => i.id === 'i1')?.hearts).toEqual(['you']);
  });

  it('merges looks, details and the chat from both phones', () => {
    const base = createDefaultContent();
    const local = structuredClone(base);
    const remote = structuredClone(base);
    local.us.partner.look = { ...local.us.partner.look, outfit: 'blue-dress' };
    remote.us.you.birthday = '2003-09-03';
    local.us.chat = [{ id: 'c1', who: 'you', text: 'Hi baby', at: '2026-10-22T10:00:00.000Z' }];
    remote.us.chat = [
      { id: 'c2', who: 'partner', text: 'Hi handsome', at: '2026-10-22T11:00:00.000Z' },
    ];
    const merged = mergeContent(base, local, remote);
    expect(merged.us.partner.look.outfit).toBe('blue-dress');
    expect(merged.us.you.birthday).toBe('2003-09-03');
    expect(merged.us.chat.map((c) => c.id)).toEqual(['c2', 'c1']);
  });
});
