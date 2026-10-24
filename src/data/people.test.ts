import { describe, expect, it } from 'vitest';
import { sweetName } from './people';
import type { PetName } from './types';

const profile = { yourName: 'Valencio', partnerName: 'Shenaya' };
const pets: PetName[] = [
  { id: '1', name: 'baby', from: 'both' },
  { id: '2', name: 'beautiful', from: 'you' },
  { id: '3', name: 'handsome', from: 'partner' },
];

describe('sweetName', () => {
  it('gives the other person the warmest name the viewer uses', () => {
    // She (partner) looking at him (you): her top name is "baby" (both).
    expect(sweetName('you', 'partner', pets, profile)).toBe('Baby');
    // He (you) looking at her: his top is also "baby".
    expect(sweetName('partner', 'you', pets, profile)).toBe('Baby');
  });

  it('falls back to the first name with no pet names', () => {
    expect(sweetName('you', 'partner', [], profile)).toBe('Valencio');
    expect(sweetName('partner', 'you', [], profile)).toBe('Shenaya');
  });

  it('uses a one-sided name when there is no shared one', () => {
    const only: PetName[] = [{ id: 'x', name: 'handsome', from: 'partner' }];
    expect(sweetName('you', 'partner', only, profile)).toBe('Handsome');
    // He has no name for her in this list → her first name.
    expect(sweetName('partner', 'you', only, profile)).toBe('Shenaya');
  });

  it('returns the viewer’s own name for themselves', () => {
    expect(sweetName('you', 'you', pets, profile)).toBe('Valencio');
  });
});
