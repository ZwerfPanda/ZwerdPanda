import { useState } from 'react';
import { getContent, updateContent, useContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import { Dialog } from '../../components/ui/Dialog';
import { celebrateFrom } from '../../components/ui/feedback';
import { StarShape } from '../../components/art/shapes';
import { playSfx } from '../../lib/audio/sfx';
import { href } from '../../lib/router';
import { nowIso } from '../../lib/id';
import { HIDDEN_STARS, STAR_COUNT } from './stars';
import './hunt.css';

/**
 * One hidden star. It twinkles very faintly until someone taps it; then it's
 * found for both of us, and once all of them are found the reward opens.
 */
export function HuntStar({
  id,
  className = '',
  style,
}: {
  id: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const found = useContent((c) => Boolean(c.hunt.found[id]));
  const [moment, setMoment] = useState<{ count: number } | null>(null);
  const reward = useContent((c) => c.hunt.reward);
  const star = HIDDEN_STARS.find((s) => s.id === id);
  if (!star) return null;

  const find = (el: HTMLElement) => {
    if (getContent().hunt.found[id]) return;
    updateContent((c) => ({
      ...c,
      hunt: { ...c.hunt, found: { ...c.hunt.found, [id]: { at: nowIso(), by: getAuthor() } } },
    }));
    playSfx('star', true);
    celebrateFrom(el);
    setMoment({ count: Object.keys(getContent().hunt.found).length });
  };

  const complete = moment ? moment.count >= STAR_COUNT : false;

  return (
    <>
      {!found && (
        <button
          type="button"
          className={`hunt-star ${className}`}
          data-sfx="none"
          style={style}
          aria-label="Een verstopt sterretje"
          onClick={(e) => {
            // Stars sit inside cards and pictures that open things themselves.
            e.stopPropagation();
            find(e.currentTarget);
          }}
        >
          <svg viewBox="-12 -12 24 24" aria-hidden="true">
            <StarShape x={0} y={0} size={10} fill="currentColor" />
          </svg>
        </button>
      )}
      <Dialog
        open={Boolean(moment)}
        onClose={() => setMoment(null)}
        title={complete ? 'Alle sterren gevonden ✦' : 'Een verstopt sterretje ✦'}
        eyebrow="star hunt"
        size="sm"
      >
        {moment && (
          <div className="hunt-found">
            <div className="hunt-found__stars" aria-hidden="true">
              {HIDDEN_STARS.map((s, i) => (
                <span key={s.id} className={i < moment.count ? 'is-on' : ''}>
                  ✦
                </span>
              ))}
            </div>
            <p className="hunt-found__count">
              {moment.count} van {STAR_COUNT} gevonden
            </p>
            {complete ? (
              <p className="hunt-found__reward">{reward}</p>
            ) : (
              <p>
                Er zijn er nog {STAR_COUNT - moment.count} verstopt in ons universe. Hints staan bij{' '}
                <a href={href('/surprises', { hunt: '1' })} onClick={() => setMoment(null)}>
                  Little Surprises
                </a>
                .
              </p>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
