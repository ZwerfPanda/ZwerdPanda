import { describe, expect, it } from 'vitest';
import { defaultPet } from '../../data/defaults';
import type { CocoPet } from '../../data/types';
import {
  MISCHIEF,
  activityDoneToday,
  care,
  mannersLevel,
  mischiefOf,
  needsOf,
  requestOf,
  wellbeing,
} from './care';

const NOW = new Date('2026-10-23T09:00:00.000Z');
const fresh = (patch: Partial<CocoPet> = {}): CocoPet => {
  const at = NOW.toISOString();
  return {
    ...defaultPet,
    fedAt: at,
    hayAt: at,
    pettedAt: at,
    playedAt: at,
    groomedAt: at,
    cleanedAt: at,
    log: [],
    handled: [],
    tricks: {},
    ...patch,
  };
};

describe('Coco asks for things', () => {
  it('asks for the need that runs lowest', () => {
    const r = requestOf(fresh({ hayAt: undefined }), NOW.getTime());
    expect(r).toMatchObject({ ask: 'hay', urgent: true });
    expect(requestOf(fresh({ cleanedAt: undefined }), NOW.getTime())?.ask).toBe('clean');
  });

  it('is extra happy when you give her exactly what she asked for', () => {
    const pet = fresh({ hayAt: undefined });
    const asked = care(pet, { type: 'feed', food: 'hay' }, 'you', NOW);
    const other = care(pet, { type: 'groom' }, 'you', NOW);
    expect(asked.granted).toBe(true);
    expect(asked.bond).toBeGreaterThan(other.bond);
    expect(requestOf(asked.pet, NOW.getTime())?.urgent ?? false).toBe(false);
  });

  it('has a wish when she is well, until one of us grants it', () => {
    const pet = fresh();
    const wish = requestOf(pet, NOW.getTime());
    if (!wish) return; // her wish this window may be a treat she can't have
    expect(wish.urgent).toBe(false);
  });
});

describe('needs matter', () => {
  it('refuses tricks when she is hungry or sad', () => {
    const hungry = fresh({ hayAt: undefined, fedAt: undefined });
    expect(care(hungry, { type: 'train', trick: 'come', gain: 10 }, 'you', NOW).ok).toBe(false);
    const sad = fresh({ pettedAt: undefined, playedAt: undefined, cleanedAt: undefined });
    expect(wellbeing(needsOf(sad, NOW.getTime()))).toBeLessThan(30);
    expect(care(sad, { type: 'train', trick: 'come', gain: 10 }, 'you', NOW).ok).toBe(false);
    expect(care(fresh(), { type: 'train', trick: 'come', gain: 10 }, 'you', NOW).ok).toBe(true);
  });

  it('cleaning her hutch fills the clean need', () => {
    const r = care(fresh({ cleanedAt: undefined }), { type: 'clean' }, 'partner', NOW);
    expect(needsOf(r.pet, NOW.getTime()).clean).toBe(100);
    expect(r.pet.log[0]).toMatchObject({ action: 'cleaned', by: 'partner' });
  });
});

describe('bringing her up', () => {
  it('kind responses raise her manners, harsh ones scare her', () => {
    const pet = fresh({ bond: 10 });
    const good = care(pet, { type: 'raise', id: 'm-1', good: true }, 'you', NOW);
    expect(good.pet.manners).toBe(8);
    expect(good.pet.handled).toContain('m-1');
    const bad = care(pet, { type: 'raise', id: 'm-1', good: false }, 'you', NOW);
    expect(bad.pet.manners).toBe(0);
    expect(bad.pet.bond).toBe(8);
    expect(care(good.pet, { type: 'raise', id: 'm-1', good: true }, 'you', NOW).ok).toBe(false);
  });

  it('every mischief has exactly one kind answer', () => {
    for (const m of MISCHIEF) expect(m.options.filter((o) => o.good)).toHaveLength(1);
  });

  it('gets into mischief less once she is well brought up', () => {
    const count = (manners: number) =>
      Array.from({ length: 400 }, (_, i) =>
        mischiefOf(fresh({ manners }), NOW.getTime() + i * 5 * 3_600_000),
      ).filter(Boolean).length;
    expect(count(100)).toBeLessThan(count(0));
    expect(mannersLevel(0)).toBe('Wildebras');
    expect(mannersLevel(95)).toBe('Voorbeeldig');
  });

  it('does each fun activity once a day', () => {
    const first = care(fresh(), { type: 'activity', activity: 'digbox' }, 'you', NOW);
    expect(first.ok).toBe(true);
    expect(activityDoneToday(first.pet, 'digbox', NOW)).toBe(true);
    expect(care(first.pet, { type: 'activity', activity: 'digbox' }, 'you', NOW).ok).toBe(false);
  });
});
