import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../data/defaults';
import { normalizeContent } from '../data/normalize';
import { fingerprint } from './fingerprint';
import { mergeContent, stableStringify } from './merge';

describe('universe fingerprint', () => {
  it('is the same for the same universe, whatever the key order', () => {
    const a = createDefaultContent();
    const b = JSON.parse(stableStringify(a));
    expect(fingerprint(normalizeContent(b))).toBe(fingerprint(a));
    expect(fingerprint(a)).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}$/);
  });

  it('changes with any shared change, but not with the phones’ reports', () => {
    const a = createDefaultContent();
    const edited = { ...a, profile: { ...a.profile, partnerName: 'Shenaya ♡' } };
    expect(fingerprint(edited)).not.toBe(fingerprint(a));
    const reported = {
      ...a,
      syncReports: { partner: { at: '2026-10-24T10:00:00.000Z', ok: true, build: 'x' } },
    };
    expect(fingerprint(reported)).toBe(fingerprint(a));
  });

  it('ignores differences that only exist before reading (false vs missing)', () => {
    const a = createDefaultContent();
    const b = { ...a, letters: a.letters.map((l) => ({ ...l, isSample: l.isSample || false })) };
    expect(fingerprint(b)).toBe(fingerprint(a));
  });

  it('survives a trip through storage (normalize) unchanged', () => {
    const a = createDefaultContent();
    expect(fingerprint(normalizeContent(JSON.parse(JSON.stringify(a))))).toBe(fingerprint(a));
  });

  it('keeps each phone’s newest report when merging', () => {
    const base = createDefaultContent();
    const local = {
      ...base,
      syncReports: { you: { at: '2026-10-24T10:00:00.000Z', ok: true, build: 'a' } },
    };
    const remote = {
      ...base,
      syncReports: { partner: { at: '2026-10-24T11:00:00.000Z', ok: false, build: 'a' } },
    };
    const merged = mergeContent(base, local, remote).syncReports;
    expect(merged.you?.ok).toBe(true);
    expect(merged.partner?.ok).toBe(false);
  });
});
