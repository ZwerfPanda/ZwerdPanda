import { describe, expect, it } from 'vitest';
import type { Letter } from '../../data/types';
import { letterAuthor, sealedFor, wroteIt } from './opened';

const profile = { yourName: 'Valencio', partnerName: 'Shenaya' };
const letter = (patch: Partial<Letter> = {}): Letter => ({
  id: 'l1',
  occasion: 'je me mist',
  recipient: 'Shenaya',
  body: '…',
  signature: 'V',
  color: 'blush',
  seal: 'heart',
  status: 'shared',
  lock: { type: 'hold' },
  createdAt: '2026-10-01T00:00:00.000Z',
  ...patch,
});

describe('who opened a letter', () => {
  it('stays sealed for her even though he read it (the old shared mark)', () => {
    const l = letter({ by: 'you', readAt: '2026-10-20T10:00:00.000Z' });
    expect(sealedFor(l, 'partner', profile)).toBe(true);
    expect(sealedFor(l, 'you', profile)).toBe(false);
  });

  it('is open for her once she opened it herself', () => {
    const l = letter({ by: 'you', openedBy: { partner: '2026-10-24T10:00:00.000Z' } });
    expect(sealedFor(l, 'partner', profile)).toBe(false);
  });

  it('knows letters written before signing in were his', () => {
    expect(letterAuthor(letter(), profile)).toBe('you');
    expect(letterAuthor(letter({ recipient: 'Valencio' }), profile)).toBe('partner');
    expect(wroteIt(letter({ by: 'partner', recipient: 'Valencio' }), 'partner', profile)).toBe(
      true,
    );
  });

  it('never counts drafts as waiting', () => {
    expect(sealedFor(letter({ status: 'draft' }), 'partner', profile)).toBe(false);
  });
});
