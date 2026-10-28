import { Gift } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import { href } from '../../lib/router';
import { newForMe } from './studioData';

/** On the home page: a song the other made for you, still unheard. */
export function StudioNudge() {
  const studio = useContent((c) => c.studio);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const fresh = newForMe({ studio }, me);
  if (!fresh.length) return null;
  return (
    <a className="studio-nudge" href={href('/muziekkamer')}>
      <span className="studio-nudge__disc" aria-hidden="true" />
      <span>
        <strong>Er ligt een liedje voor je klaar 🎁</strong>
        <small>van {nameOf(fresh[0].by, profile)} · in de muziekkamer</small>
      </span>
      <Gift aria-hidden="true" />
    </a>
  );
}
