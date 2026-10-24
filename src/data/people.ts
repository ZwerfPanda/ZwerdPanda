import { useSyncExternalStore } from 'react';
import type { PetName, Person, Profile } from './types';

/**
 * Who is holding this device: `you` (who set the site up) or `partner`.
 * Without sharing it's always `you`. Once signed in, the sync layer works it
 * out (whoever created the shared universe is `you`) and it's remembered here,
 * so it's right offline too.
 */

const KEY = 'olu:me:v1';
const listeners = new Set<() => void>();

function read(): Person | null {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'partner' || value === 'you' ? value : null;
  } catch {
    return null;
  }
}

/** null until this device has signed in to a shared universe once. */
let known: Person | null = read();
let me: Person = known ?? 'you';

export function getMe(): Person {
  return me;
}

/**
 * Who to credit for something new. Unknown (no "from …" label) until this
 * device has signed in once — so nothing gets the wrong name.
 */
export function getAuthor(): Person | undefined {
  return known ?? undefined;
}

export function setMe(next: Person) {
  if (next === known) return;
  known = next;
  me = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Fine: it's worked out again on the next sign-in.
  }
  listeners.forEach((listener) => listener());
}

export function useMe(): Person {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => me,
  );
}

export function nameOf(person: Person, profile: Pick<Profile, 'yourName' | 'partnerName'>): string {
  return person === 'you' ? profile.yourName : profile.partnerName;
}

export function otherPerson(person: Person): Person {
  return person === 'you' ? 'partner' : 'you';
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * A warm name instead of a bare first name — "Valencio" can feel cold. From
 * `me`'s side: the other person becomes the sweet name `me` calls them (the
 * one we use most, so it's stable), and `me` themself becomes "mij". Falls
 * back to the first name when there are no pet names, and to "jij"/"jou" for
 * the viewer when there's no name either.
 */
export function sweetName(
  target: Person,
  me: Person,
  petNames: PetName[],
  profile: Pick<Profile, 'yourName' | 'partnerName'>,
  self: 'mij' | 'ik' = 'mij',
): string {
  if (target === me) return nameOf(me, profile) || (self === 'ik' ? 'ik' : 'jij');
  const mine = petNames.find((p) => p.from === me || p.from === 'both');
  return mine ? capital(mine.name) : nameOf(target, profile);
}
