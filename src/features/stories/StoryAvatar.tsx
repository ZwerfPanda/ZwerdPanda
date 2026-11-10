import type { Person } from '../../data/types';
import { useContent } from '../../data/store';
import { Mini, UsProvider } from '../museum/scenes/kit';

/** One of us as a little round face (the mini us head), for the story rings. */
export function StoryAvatar({ who, size = 64 }: { who: Person; size?: number }) {
  const us = useContent((c) => c.us);
  return (
    <svg
      className="story-avatar"
      width={size}
      height={size}
      viewBox={who === 'partner' ? '-62 -290 124 124' : '-62 -342 124 124'}
      aria-hidden="true"
    >
      <circle
        cx="0"
        cy={who === 'partner' ? -228 : -280}
        r="62"
        fill={who === 'partner' ? '#ffe3ec' : '#e8e1ff'}
      />
      <UsProvider us={us}>
        <Mini who={who} x={0} face="happy" toward={1} />
      </UsProvider>
    </svg>
  );
}
