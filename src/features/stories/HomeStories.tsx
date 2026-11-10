import { useContent } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { href } from '../../lib/router';
import { StoryAvatar } from './StoryAvatar';
import { freshStories, hasSeen } from './stories';
import './homeStories.css';

/** On Home: our stories of today, and a way in. */
export function HomeStories() {
  const me = useMe();
  const other: Person = me === 'you' ? 'partner' : 'you';
  const stories = useContent((c) => c.stories);
  const profile = useContent((c) => c.profile);
  const now = Date.now();
  const mine = freshStories(stories.items, me, now);
  const theirs = freshStories(stories.items, other, now);
  const unseen = theirs.filter((s) => !hasSeen({ stories }, s, me));
  const name = nameOf(other, profile);

  const [title, text] = unseen.length
    ? [
        `${name} heeft ${unseen.length === 1 ? 'een nieuwe story' : `${unseen.length} nieuwe stories`} ✨`,
        'Tik om te kijken',
      ]
    : theirs.length || mine.length
      ? ['Onze stories van vandaag', 'Kijk ze nog eens, of deel er nog een']
      : ['Deel iets van vandaag 📸', 'Een foto, filmpje of tekstje — alleen voor ons'];

  return (
    <a
      className="home-stories"
      href={unseen.length ? href('/stories', { s: unseen[0].id }) : href('/stories')}
    >
      <span className="home-stories__rings" aria-hidden="true">
        <span
          className={`home-stories__ring${unseen.length ? ' is-new' : theirs.length ? ' is-seen' : ''}`}
        >
          <StoryAvatar who={other} size={46} />
        </span>
        <span className={`home-stories__ring${mine.length ? ' is-own' : ''}`}>
          <StoryAvatar who={me} size={46} />
        </span>
      </span>
      <span className="home-stories__text">
        <strong>{title}</strong>
        <span>{text}</span>
      </span>
      <span className="home-stories__go" aria-hidden="true">
        ›
      </span>
    </a>
  );
}
