import { useEffect, useRef, useState } from 'react';
import { useContent } from '../../data/store';
import { nameOf } from '../../data/people';
import { Dialog } from '../../components/ui/Dialog';
import { href, useRoute } from '../../lib/router';
import { formatTimestamp } from '../../lib/dates';
import { HIDDEN_STARS, STAR_COUNT } from './stars';
import './hunt.css';

/** The star map: which stars we found where, and hints for the rest. */
export function HuntBoard() {
  const hunt = useContent((c) => c.hunt);
  const profile = useContent((c) => c.profile);
  const route = useRoute();
  const ref = useRef<HTMLElement>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const count = HIDDEN_STARS.filter((s) => hunt.found[s.id]).length;
  const complete = count >= STAR_COUNT;

  useEffect(() => {
    if (route.params.get('hunt'))
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [route.params]);

  return (
    <section ref={ref} className="hunt-board" aria-labelledby="hunt-title" id="hunt">
      <p className="hunt-board__eyebrow">star hunt</p>
      <h2 id="hunt-title" className="hunt-board__title">
        Verstopte sterren
      </h2>
      <p className="hunt-board__lede">
        Overal in ons universe zit een sterretje verstopt — op elke pagina eentje, op een geheim
        plekje. Wat de één vindt, telt voor ons allebei.{' '}
        {complete ? 'En jullie hebben ze allemaal!' : `Nog ${STAR_COUNT - count} te gaan.`}
      </p>
      <div
        className="hunt-board__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={STAR_COUNT}
        aria-valuenow={count}
        aria-label="Gevonden sterren"
      >
        <span style={{ width: `${(count / STAR_COUNT) * 100}%` }} />
      </div>
      <ul className="hunt-board__grid">
        {HIDDEN_STARS.map((s) => {
          const find = hunt.found[s.id];
          return (
            <li key={s.id} className={`hunt-slot ${find ? 'is-found' : ''}`}>
              <span className="hunt-slot__star" aria-hidden="true">
                ✦
              </span>
              <span className="hunt-slot__place">
                {find ? (
                  s.place
                ) : (
                  <a href={href(s.path)} className="hunt-slot__go">
                    {s.place}
                  </a>
                )}
              </span>
              {find ? (
                <span className="hunt-slot__who">
                  {find.by ? `${nameOf(find.by, profile)} · ` : ''}
                  {formatTimestamp(find.at)}
                </span>
              ) : (
                <button
                  type="button"
                  className="hunt-slot__hint"
                  onClick={() => setHint(hint === s.id ? null : s.id)}
                  aria-expanded={hint === s.id}
                >
                  {hint === s.id ? s.hint : 'Hint?'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {complete && (
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setRewardOpen(true)}
          data-sfx="star"
        >
          ✦ Open de beloning
        </button>
      )}
      <Dialog
        open={rewardOpen}
        onClose={() => setRewardOpen(false)}
        title="Alle sterren gevonden ✦"
        eyebrow="star hunt"
        size="sm"
      >
        <p className="hunt-found__reward">{hunt.reward}</p>
      </Dialog>
    </section>
  );
}

/** "✦ 3/12" — a little nudge on Home. */
export function HuntChip() {
  const count = useContent((c) => HIDDEN_STARS.filter((s) => c.hunt.found[s.id]).length);
  return (
    <a className="hunt-chip" href={href('/surprises', { hunt: '1' })}>
      <span aria-hidden="true">✦</span>{' '}
      {count >= STAR_COUNT
        ? 'Alle sterren gevonden!'
        : count === 0
          ? `Er zijn ${STAR_COUNT} sterretjes verstopt…`
          : `${count} van ${STAR_COUNT} sterretjes gevonden`}
    </a>
  );
}
