import { describe, expect, it } from 'vitest';
import { defaultPet } from '../../data/defaults';
import type { CocoPet } from '../../data/types';
import { ageOf, bondLevel, care, isNapTime, level, moodOf, needsOf, outfitUnlocked } from './care';

const fresh = (): CocoPet => ({
  ...defaultPet,
  treats: { date: '', count: 0 },
  tricks: {},
  log: [],
});
const at = (iso: string) => new Date(iso);

describe('Coco’s needs', () => {
  it('slide down over time and start empty', () => {
    const now = Date.parse('2026-10-22T12:00:00.000Z');
    expect(level(undefined, now, 8)).toBe(0);
    expect(level('2026-10-22T12:00:00.000Z', now, 8)).toBe(100);
    expect(level('2026-10-22T08:00:00.000Z', now, 8)).toBe(50);
    expect(level('2026-10-21T00:00:00.000Z', now, 8)).toBe(0);
  });

  it('turn into a mood', () => {
    expect(moodOf({ tummy: 50, hay: 10, love: 90, play: 90, fur: 90 })).toBe('hungry');
    expect(moodOf({ tummy: 90, hay: 90, love: 10, play: 90, fur: 90 })).toBe('lonely');
    expect(moodOf({ tummy: 90, hay: 90, love: 90, play: 90, fur: 90 })).toBe('happy');
  });

  it('naps in the middle of the day and night, like real rabbits', () => {
    expect(isNapTime(7)).toBe(false);
    expect(isNapTime(13)).toBe(true);
    expect(isNapTime(19)).toBe(false);
    expect(isNapTime(2)).toBe(true);
  });
});

describe('looking after Coco', () => {
  it('feeding fills her tummy, earns love and goes in the diary', () => {
    const now = at('2026-10-22T08:00:00.000Z');
    const result = care(fresh(), { type: 'feed', food: 'romaine' }, 'partner', now);
    expect(result.ok).toBe(true);
    expect(needsOf(result.pet, now.getTime()).tummy).toBe(100);
    expect(result.pet.bond).toBe(3);
    expect(result.pet.log[0]).toMatchObject({ action: 'fed', detail: 'romaine', by: 'partner' });
  });

  it('declines more food when she’s full', () => {
    const now = at('2026-10-22T08:00:00.000Z');
    const fed = care(fresh(), { type: 'feed', food: 'pellets' }, 'you', now).pet;
    const again = care(fed, { type: 'feed', food: 'parsley' }, 'you', now);
    expect(again.ok).toBe(false);
    expect(again.pet).toBe(fed);
  });

  it('allows only two small treats a day', () => {
    const now = at('2026-10-22T08:00:00.000Z');
    let pet = fresh();
    pet = care(pet, { type: 'feed', food: 'carrot' }, 'you', now).pet;
    pet = care(pet, { type: 'feed', food: 'apple' }, 'partner', now).pet;
    expect(care(pet, { type: 'feed', food: 'banana' }, 'you', now).ok).toBe(false);
    const tomorrow = at('2026-10-23T08:00:00.000Z');
    expect(care(pet, { type: 'feed', food: 'banana' }, 'you', tomorrow).ok).toBe(true);
  });

  it('keeps a run of strokes as one cuddle in the diary', () => {
    let pet = fresh();
    pet = care(pet, { type: 'pet' }, 'you', at('2026-10-22T08:00:00.000Z')).pet;
    pet = care(pet, { type: 'pet' }, 'you', at('2026-10-22T08:02:00.000Z')).pet;
    expect(pet.log).toHaveLength(1);
    pet = care(pet, { type: 'pet' }, 'partner', at('2026-10-22T08:03:00.000Z')).pet;
    expect(pet.log).toHaveLength(2);
  });

  it('learns a trick once training reaches 100', () => {
    let pet: CocoPet = { ...fresh(), tricks: { spin: 95 } };
    const result = care(pet, { type: 'train', trick: 'spin', gain: 10 }, 'you');
    expect(result.learned).toBe('spin');
    expect(result.pet.tricks.spin).toBe(100);
    pet = result.pet;
    expect(care(pet, { type: 'train', trick: 'spin', gain: 0 }, 'you').ok).toBe(false);
  });
});

describe('growing up', () => {
  it('knows Coco’s real age from her birthday (1 June 2026)', () => {
    const age = ageOf('2026-06-01', new Date(Date.UTC(2026, 9, 22)))!;
    expect(age.label).toBe('4 months, 3 weeks');
    expect(age.stage).toBe('Youngster');
    expect(age.daysToBirthday).toBe(222);
    expect(age.turning).toBe(1);
    expect(age.isBirthday).toBe(false);
  });

  it('celebrates her birthday', () => {
    const age = ageOf('2026-06-01', new Date(Date.UTC(2027, 5, 1)))!;
    expect(age.isBirthday).toBe(true);
    expect(age.turning).toBe(1);
    expect(age.stage).toBe('Grown-up');
  });

  it('unlocks outfits as the bond grows', () => {
    expect(bondLevel(0).name).toBe('Shy');
    expect(bondLevel(90).name).toBe('Trusting');
    expect(outfitUnlocked('bow', 0, false)).toBe(false);
    expect(outfitUnlocked('bow', 30, false)).toBe(true);
    expect(outfitUnlocked('party', 0, true)).toBe(true);
  });
});
