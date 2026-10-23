import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../../data/defaults';
import { normalizeContent } from '../../data/normalize';
import { normalizeHerPrivate } from '../../data/herPrivate';
import { mergeContent } from '../../sync/merge';
import type { AppContent } from '../../data/types';

const at = '2026-10-23T10:00:00.000Z';

function copy(c: AppContent): AppContent {
  return JSON.parse(JSON.stringify(c));
}

describe('her little world', () => {
  it('never lets a private item into the shared content', () => {
    const raw = createDefaultContent();
    raw.her.journal = [
      { id: 'j1', date: '2026-10-23', text: 'gedeeld', createdAt: at },
      { id: 'j2', date: '2026-10-23', text: 'geheim', private: true, createdAt: at },
    ];
    const c = normalizeContent(raw);
    expect(c.her.journal.map((j) => j.id)).toEqual(['j1']);
  });

  it('only keeps ordinary web links on wishes', () => {
    const raw = createDefaultContent();
    raw.her.bucket = [
      { id: 'b1', title: 'Parijs', link: 'https://example.com/paris', done: false, createdAt: at },
      { id: 'b2', title: 'Oeps', link: 'javascript:alert(1)', done: false, createdAt: at },
    ];
    const c = normalizeContent(raw);
    expect(c.her.bucket.find((b) => b.id === 'b1')?.link).toBe('https://example.com/paris');
    expect(c.her.bucket.find((b) => b.id === 'b2')?.link).toBeUndefined();
  });

  it('marks everything in the private store as private', () => {
    const mine = normalizeHerPrivate({
      journal: [{ id: 'j', date: '2026-10-23', text: 'x', createdAt: at }],
      goals: [
        { id: 'g', title: 'Doel', steps: [{ id: 's', text: 'stap', done: true }], createdAt: at },
      ],
    });
    expect(mine.journal[0].private).toBe(true);
    expect(mine.goals[0].private).toBe(true);
    expect(mine.goals[0].steps[0].done).toBe(true);
  });

  it('merges her things from two phones', () => {
    const base = createDefaultContent();
    const local = copy(base);
    const remote = copy(base);
    local.her.theme = 'lavender';
    local.her.bucket = [{ id: 'mine', title: 'Mijn wens', done: false, createdAt: at }];
    remote.her.goals = [{ id: 'g', title: 'Doel', steps: [], done: false, createdAt: at }];
    const merged = mergeContent(base, local, remote);
    expect(merged.her.theme).toBe('lavender');
    expect(merged.her.bucket.map((b) => b.id)).toEqual(['mine']);
    expect(merged.her.goals.map((g) => g.id)).toEqual(['g']);
  });
});

describe('star hunt', () => {
  it('keeps every star either of us found, earliest find first', () => {
    const base = createDefaultContent();
    const local = copy(base);
    const remote = copy(base);
    local.hunt.found = { home: { at: '2026-10-23T12:00:00.000Z', by: 'you' } };
    remote.hunt.found = {
      home: { at: '2026-10-23T09:00:00.000Z', by: 'partner' },
      coco: { at: '2026-10-23T10:00:00.000Z', by: 'partner' },
    };
    const merged = mergeContent(base, local, remote);
    expect(Object.keys(merged.hunt.found).sort()).toEqual(['coco', 'home']);
    expect(merged.hunt.found.home.by).toBe('partner');
  });

  it('drops broken finds from a stored copy', () => {
    const raw = createDefaultContent() as unknown as Record<string, unknown>;
    raw.hunt = { found: { home: { at: 'nope' }, coco: { at } }, reward: 'Yay' };
    const c = normalizeContent(raw);
    expect(Object.keys(c.hunt.found)).toEqual(['coco']);
    expect(c.hunt.reward).toBe('Yay');
  });
});
