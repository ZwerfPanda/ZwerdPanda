import { describe, expect, it } from 'vitest';
import { normalizeContent } from './normalize';
import { createDefaultContent } from './defaults';

/** A device that still has the starter content from before the site went Dutch. */
function englishContent() {
  const c = createDefaultContent();
  c.profile.subtitle = 'A little world that belongs to us.';
  c.albums = c.albums.map((a) => (a.id === 'album-dates' ? { ...a, name: 'Our dates' } : a));
  c.milestones = c.milestones.map((m) =>
    m.id === 'ms-meeting' ? { ...m, title: 'Meeting for real' } : m,
  );
  c.surprises.reasons[0] = 'Your laugh. Honestly, it might be my favourite sound.';
  c.lists[0] = { ...c.lists[0], title: 'Baby names we love' };
  return c;
}

describe('starter texts', () => {
  it('turns untouched English starter texts into Dutch', () => {
    const c = normalizeContent(englishContent());
    expect(c.profile.subtitle).toBe('Een kleine wereld die van ons is.');
    expect(c.albums.find((a) => a.id === 'album-dates')?.name).toBe('Onze dates');
    expect(c.milestones.find((m) => m.id === 'ms-meeting')?.title).toBe(
      'Voor het eerst in het echt',
    );
    expect(c.surprises.reasons[0]).toBe('Je lach. Eerlijk, misschien mijn favoriete geluid.');
    expect(c.lists[0].title).toBe('Babynamen die we mooi vinden');
  });

  it('leaves what we wrote or edited alone', () => {
    const raw = englishContent();
    raw.profile.subtitle = 'Ours, forever';
    raw.milestones = raw.milestones.map((m) =>
      m.id === 'ms-meeting' ? { ...m, title: 'Meeting for real', isSample: false } : m,
    );
    raw.surprises.reasons.push('Gewoon omdat.');
    const c = normalizeContent(raw);
    expect(c.profile.subtitle).toBe('Ours, forever');
    expect(c.milestones.find((m) => m.id === 'ms-meeting')?.title).toBe('Meeting for real');
    expect(c.surprises.reasons.at(-1)).toBe('Gewoon omdat.');
  });
});
