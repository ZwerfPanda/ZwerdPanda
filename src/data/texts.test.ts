import { describe, expect, it } from 'vitest';
import { createDefaultContent } from './defaults';
import { normalizeContent } from './normalize';
import { mergeContent } from '../sync/merge';
import { textId, textKeyOf } from './texts';

describe('his own wording', () => {
  it('keys a text by its words, not by stray spaces', () => {
    expect(textKeyOf('  Mini \n Us  ')).toBe('Mini Us');
    expect(textId('Mini Us')).toBe(textId(' Mini  Us '));
    expect(textId('Mini Us')).not.toBe(textId('Mini us'));
    expect(textId('Mini Us')).toMatch(/^text-[0-9a-z]+$/);
  });

  it('keeps only real edits, with an id that always matches the text', () => {
    const c = normalizeContent({
      ...createDefaultContent(),
      texts: [
        { id: 'whatever', from: ' Onze Agenda ', to: 'Onze planning', at: '2026-10-24T10:00:00Z' },
        { from: 'Leeg', to: '   ', at: '2026-10-24T10:00:00Z' },
        { from: 42, to: 'x' },
      ],
    });
    expect(c.texts).toEqual([
      {
        id: textId('Onze Agenda'),
        from: 'Onze Agenda',
        to: 'Onze planning',
        at: '2026-10-24T10:00:00Z',
      },
    ]);
  });

  it('merges the same edit made on two of his phones into one', () => {
    const base = createDefaultContent();
    const a = structuredClone(base);
    const b = structuredClone(base);
    const id = textId('Mini Us');
    a.texts = [{ id, from: 'Mini Us', to: 'Mini Wij', at: '2026-10-24T10:00:00Z' }];
    b.texts = [{ id, from: 'Mini Us', to: 'Kleine wij', at: '2026-10-24T11:00:00Z' }];
    expect(mergeContent(base, a, b).texts).toHaveLength(1);
  });
});
