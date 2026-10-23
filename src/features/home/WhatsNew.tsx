import { Sparkles, X } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { AppContent, Person } from '../../data/types';
import { markAllSeen, useSince } from '../../data/visits';
import { href, type RoutePath } from '../../lib/router';
import { plural } from '../../lib/dates';
import { useSyncState } from '../../sync/sync';

interface NewThing {
  label: string;
  path: RoutePath;
}

/** What the other person added since this device last looked. */
export function newSince(content: AppContent, from: Person, since: string): NewThing[] {
  const fresh = (item: { by?: Person; createdAt: string }) =>
    item.by === from && item.createdAt > since;
  const things: NewThing[] = [];
  const add = (count: number, one: string, path: RoutePath, many?: string) => {
    if (count > 0) things.push({ label: plural(count, one, many), path });
  };
  add(content.memories.filter(fresh).length, 'herinnering', '/memories', 'herinneringen');
  add(
    content.letters.filter((l) => fresh(l) && l.status === 'shared').length,
    'brief',
    '/letters',
    'brieven',
  );
  add(content.milestones.filter(fresh).length, 'hoofdstuk', '/story', 'hoofdstukken');
  add(content.dreams.filter(fresh).length, 'droom', '/future', 'dromen');
  add(content.capsules.filter(fresh).length, 'tijdcapsule', '/future', 'tijdcapsules');
  add(content.songs.filter(fresh).length, 'liedje', '/music', 'liedjes');
  add(content.coco.notes.filter(fresh).length, 'Coco-momentje', '/coco', 'Coco-momentjes');
  add(content.countdowns.filter(fresh).length, 'countdown', '/', 'countdowns');
  const care = content.pet.log.filter((e) => e.by === from && e.at > since).length;
  if (care > 0) things.push({ label: 'heeft voor Coco gezorgd', path: '/coco' });
  return things;
}

export function WhatsNew() {
  const content = useContent((c) => c);
  const me = useMe();
  const since = useSince();
  const shared = useSyncState().members.length >= 2;
  if (!shared || !since) return null;
  const them = otherPerson(me);
  const things = newSince(content, them, since);
  if (!things.length) return null;
  return (
    <aside className="whats-new" aria-labelledby="whats-new-title">
      <Sparkles className="whats-new__icon" aria-hidden="true" />
      <div className="whats-new__text">
        <p id="whats-new-title" className="whats-new__title">
          Nieuw van {nameOf(them, content.profile)}
        </p>
        <ul className="whats-new__list">
          {things.map((thing) => (
            <li key={thing.label}>
              <a href={href(thing.path)}>{thing.label}</a>
            </li>
          ))}
        </ul>
      </div>
      <button type="button" className="icon-btn" aria-label="Gezien" onClick={markAllSeen}>
        <X />
      </button>
    </aside>
  );
}
