import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useContent } from '../../data/store';
import type { AppContent, Person } from '../../data/types';
import { useMe } from '../../data/people';
import { sealedFor } from '../letters/opened';
import { href, type RoutePath } from '../../lib/router';
import { useToday } from '../../hooks/useToday';
import { formatDate } from '../../lib/dates';
import { hashUnit } from '../../lib/id';
import { MediaView } from '../../components/media/MediaView';
import { SparkleIcon } from '../../components/art/shapes';
import { cocoBirthday } from '../coco/CocoBirthday';

interface Thing {
  kind: string;
  eyebrow: string;
  text: ReactNode;
  picture?: ReactNode;
  link: { to: RoutePath; query?: Record<string, string>; label: string };
}

const yearsAgo = (date: string, today: string) =>
  Number(today.slice(0, 4)) - Number(date.slice(0, 4));

/**
 * Something small, different every day: a memory from this day years ago,
 * a photo, a stop on our line, or a reason I love you. A letter that opened
 * today always comes first.
 */
export function pickDailyThing(c: AppContent, today: string, me: Person): Thing | null {
  // A sealed letter for me whose day is today.
  const opened = c.letters.find(
    (l) => sealedFor(l, me, c.profile) && l.lock.type === 'date' && l.lock.until === today,
  );
  if (opened) {
    return {
      kind: 'letter',
      eyebrow: 'vandaag is het zover',
      text: `Er is een brief voor je opengegaan: “Open when ${opened.occasion}” 💌`,
      link: { to: '/letters', label: 'Open je brief' },
    };
  }

  // Coco's birthday.
  const bday = cocoBirthday(c.pet.birthday, today);
  if (bday?.days === 0) {
    return {
      kind: 'coco',
      eyebrow: 'feest!',
      text: `Coco wordt vandaag ${bday.age}! 🎂🐰`,
      link: { to: '/coco', label: 'Naar het feestje' },
    };
  }

  // On this day, a year (or more) ago.
  const md = today.slice(5);
  const onThisDay = c.memories.find(
    (m) => m.date && m.date.slice(5) === md && m.date.slice(0, 4) < today.slice(0, 4),
  );
  if (onThisDay?.date) {
    const n = yearsAgo(onThisDay.date, today);
    return {
      kind: 'on-this-day',
      eyebrow: n === 1 ? 'vandaag een jaar geleden' : `vandaag ${n} jaar geleden`,
      text: onThisDay.caption,
      picture: <MediaView source={onThisDay.media} alt={onThisDay.caption} />,
      link: { to: '/memories', label: 'Naar onze herinneringen' },
    };
  }

  const options: Thing[] = [];
  c.surprises.reasons.forEach((reason) =>
    options.push({
      kind: 'reason',
      eyebrow: 'vandaag hou ik van…',
      text: reason,
      link: { to: '/surprises', label: 'Open de pot met kleine redenen' },
    }),
  );
  c.memories
    .filter((m) => !m.isSample && m.media.type === 'local')
    .forEach((m) =>
      options.push({
        kind: 'memory',
        eyebrow: m.date ? `weet je nog? ${formatDate(m.date, 'short')}` : 'weet je nog?',
        text: m.caption,
        picture: <MediaView source={m.media} alt={m.caption} />,
        link: { to: '/memories', label: 'Naar onze herinneringen' },
      }),
    );
  // Stops on our line — only once the museum has been found.
  if (c.museum.foundAt) {
    c.museum.stops
      .filter((s) => !s.upcoming && (s.favorite || s.story))
      .forEach((s) =>
        options.push({
          kind: 'stop',
          eyebrow: `halte ${s.name}`,
          text: s.favorite || (s.story.length > 160 ? `${s.story.slice(0, 160)}…` : s.story),
          picture: s.media[0] ? <MediaView source={s.media[0]} alt="" /> : undefined,
          link: { to: '/museum', query: { stop: s.id }, label: 'Stap uit bij deze halte' },
        }),
      );
  }
  if (!options.length) return null;
  return options[Math.floor(hashUnit(`daily-${today}`) * options.length)];
}

export function DailyThing() {
  const content = useContent((c) => c);
  const today = useToday();
  const me = useMe();
  const thing = pickDailyThing(content, today, me);
  if (!thing) return null;
  return (
    <aside className={`today today--${thing.kind}`} aria-labelledby="today-title">
      <SparkleIcon size={26} className="today__spark" color="var(--gold-400)" />
      <h2 id="today-title" className="today__title hand">
        {thing.eyebrow}
      </h2>
      {thing.picture && <div className="today__picture">{thing.picture}</div>}
      <p className="today__text">{thing.text}</p>
      <a className="today__link" href={href(thing.link.to, thing.link.query)}>
        {thing.link.label} <ArrowRight aria-hidden="true" />
      </a>
    </aside>
  );
}
