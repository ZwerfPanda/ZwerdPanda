import { GAME_NAMES } from '../games/gameStats';
import { gallerySets } from '../her/nailGallery';
import { Sparkles, X } from 'lucide-react';
import { useContent } from '../../data/store';
import { otherPerson, sweetName, useMe } from '../../data/people';
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
  add(content.museum.stops.filter(fresh).length, 'halte', '/museum', 'haltes');
  add(
    content.pings.filter((p) => p.from === from && p.at > since).length,
    'keer aan je gedacht 💗',
    '/',
    'keer aan je gedacht 💗',
  );
  add(
    content.daily.filter((a) => a.who === from && a.at > since).length,
    'antwoord op de vraag van de dag',
    '/',
    'antwoorden op de vraag van de dag',
  );
  add(
    content.flowers.filter(fresh).length,
    'boeket in het winkeltje',
    '/flowers',
    'boeketten in het winkeltje',
  );
  add(content.datePlans.filter(fresh).length, 'geplande date', '/', 'geplande dates');
  add(
    content.coupons.filter((c) => c.from === from && c.createdAt > since).length,
    'nieuwe bon in de prijzenkast',
    '/games',
    'nieuwe bonnen in de prijzenkast',
  );
  add(
    content.coupons.filter((c) => c.from !== from && c.usedAt && c.usedAt > since).length,
    'bon om in te wisselen 🎟️',
    '/games',
    'bonnen om in te wisselen 🎟️',
  );
  // Love notes are always from him; the nail sets she sends are for him.
  if (from === 'you') {
    add(
      content.her.notes.filter((n) => n.createdAt > since).length,
      'love note',
      '/her',
      'love notes',
    );
    add(
      gallerySets(content.her.nails).filter((s) => s.set.loved && s.set.loved > since).length,
      'hartje voor je nail set 💅',
      '/her',
      'hartjes voor je nail sets 💅',
    );
  } else {
    add(
      content.her.ideas.filter((i) => i.createdAt > since).length,
      'idee voor de app',
      '/her',
      'ideeën voor de app',
    );
    add(
      (content.her.nails.sent ?? []).filter((s) => s.at > since).length,
      'nail set voor jou',
      '/her',
      'nail sets voor jou',
    );
  }
  const answered = new Set(
    content.quiz.answers
      .filter((a) => a.who === from && a.at > since && a.self && a.guess)
      .map((a) => a.question),
  );
  add(answered.size, 'antwoord in het spelletje', '/quiz', 'antwoorden in het spelletje');
  content.games.matches
    .filter((m) => !m.winner && m.turn && m.turn !== from && m.updatedAt > since)
    .forEach((m) => things.push({ label: `jouw beurt bij ${GAME_NAMES[m.kind]}`, path: '/games' }));
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
          Nieuw van {sweetName(them, me, content.us.petNames, content.profile)}
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
