import { describe, expect, it } from 'vitest';
import { CHANGELOG, unseenChanges, type ChangeEntry } from './changelog';

describe('what’s new', () => {
  const log: ChangeEntry[] = [
    { id: '2026-12-1', when: 'december', title: 'C', items: [] },
    { id: '2026-11-1', when: 'november', title: 'B', items: [] },
    { id: '2026-10-2', when: 'oktober', title: 'A', items: [] },
  ];

  it('shows what came after the last update this phone saw', () => {
    expect(unseenChanges('2026-10-2', log).map((e) => e.title)).toEqual(['C', 'B']);
    expect(unseenChanges('2026-12-1', log)).toEqual([]);
    // Never looked: just the newest, not the whole history.
    expect(unseenChanges(null, log).map((e) => e.title)).toEqual(['C']);
  });

  it('keeps the real changelog newest first with unique ids and links', () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect([...ids].sort().reverse()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of CHANGELOG) {
      expect(entry.items.length).toBeGreaterThan(0);
      for (const item of entry.items) expect(item.text.length).toBeLessThan(140);
    }
  });
});
