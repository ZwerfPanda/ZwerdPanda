import type { Letter, Person, Profile } from '../../data/types';

/**
 * A letter is opened by whoever it's for, on their own screen. The writer can
 * always read it back without breaking the seal for the other — so a letter
 * he read while writing is still sealed when she sees it.
 */

/** Who wrote it. Older letters without a name were written before we signed in: by him. */
export function letterAuthor(letter: Letter, profile: Pick<Profile, 'yourName' | 'partnerName'>) {
  if (letter.by) return letter.by;
  const to = letter.recipient.trim().toLowerCase();
  return to && to === profile.yourName.trim().toLowerCase() ? 'partner' : 'you';
}

export const wroteIt = (
  letter: Letter,
  me: Person,
  profile: Pick<Profile, 'yourName' | 'partnerName'>,
) => letterAuthor(letter, profile) === me;

/** When `who` opened it on their screen (never set for the writer). */
export const openedAt = (letter: Letter, who: Person) => letter.openedBy?.[who];

/** Shared, for me, and I haven't opened it yet. */
export const sealedFor = (
  letter: Letter,
  me: Person,
  profile: Pick<Profile, 'yourName' | 'partnerName'>,
) => letter.status === 'shared' && !wroteIt(letter, me, profile) && !openedAt(letter, me);
