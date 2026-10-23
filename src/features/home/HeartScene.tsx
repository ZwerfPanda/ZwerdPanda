import { useContent } from '../../data/store';
import { Figure } from '../us/Figure';
import { HEART_Y, Heart, HeartDefs } from './heartArt';

/** Mini us, each with a hand on the heart. */
export function HeartScene({ progress }: { progress: number }) {
  const us = useContent((c) => c.us);
  return (
    <>
      <HeartDefs />
      <Heart progress={progress} />
      <g transform="translate(-122 0)">
        <Figure
          who="partner"
          look={us.partner.look}
          heightCm={us.partner.heightCm}
          face="happy"
          toward={1}
          tilt={5}
          hands={{ right: { x: 82, y: HEART_Y + 8 } }}
        />
      </g>
      <g transform="translate(124 0)">
        <Figure
          who="you"
          look={us.you.look}
          heightCm={us.you.heightCm}
          face="smile"
          toward={-1}
          tilt={-4}
          hands={{ left: { x: -84, y: HEART_Y + 10 } }}
        />
      </g>
    </>
  );
}
