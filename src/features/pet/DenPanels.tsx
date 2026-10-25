import { useEffect, useRef } from 'react';
import { GraduationCap } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf } from '../../data/people';
import type { PetFood, PetTrick } from '../../data/types';
import { timeAgo, todayIso } from '../../lib/dates';
import { FoodSvg } from './Props';
import { FOODS, TREATS_PER_DAY, TRICKS, TRICK_ORDER, describeCare } from './care';

/** The panels under Coco's room: food, training and the care diary. */

export const GREENS: PetFood[] = ['pellets', 'romaine', 'parsley', 'coriander', 'basil'];
export const TREATS: PetFood[] = ['carrot', 'apple', 'banana', 'strawberry'];

export const bondNames = ['Verlegen', 'Nieuwsgierig', 'Vertrouwd', 'Best friends', 'Family'];

export function FeedTray({ today, onFeed }: { today: string; onFeed: (food: PetFood) => void }) {
  const treats = useContent((c) => c.pet.treats);
  const used = treats.date === todayIso() || treats.date === today ? treats.count : 0;
  return (
    <div className="den-feed">
      <div className="den-feed__group">
        <h3>Elke dag</h3>
        <div className="den-options">
          <button
            type="button"
            className="den-option den-option--food"
            onClick={() => onFeed('hay')}
          >
            <FoodSvg food="hay" className="den-option__food" /> {FOODS.hay.label} &amp; water
          </button>
          {GREENS.map((food) => (
            <button
              key={food}
              type="button"
              className="den-option den-option--food"
              onClick={() => onFeed(food)}
            >
              <FoodSvg food={food} className="den-option__food" /> {FOODS[food].label}
            </button>
          ))}
        </div>
      </div>
      <div className="den-feed__group">
        <h3>
          Snoepjes{' '}
          <span className="den-feed__count">
            {Math.min(used, TREATS_PER_DAY)}/{TREATS_PER_DAY} vandaag
          </span>
        </h3>
        <div className="den-options">
          {TREATS.map((food) => (
            <button
              key={food}
              type="button"
              className="den-option den-option--food"
              onClick={() => onFeed(food)}
            >
              <FoodSvg food={food} className="den-option__food" />
              {FOODS[food].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const TRAIN_PERIOD = 1400;

export function TrainTray({
  tricks,
  active,
  busy,
  reduce,
  onStart,
  onRep,
  onShow,
  onStop,
}: {
  tricks: Partial<Record<PetTrick, number>>;
  active: PetTrick | null;
  busy: boolean;
  reduce: boolean;
  onStart: (trick: PetTrick) => void;
  onRep: (quality: number) => void;
  onShow: (trick: PetTrick) => void;
  onStop: () => void;
}) {
  const started = useRef(performance.now());
  useEffect(() => {
    started.current = performance.now();
  }, [active]);

  if (active) {
    const click = () => {
      if (reduce) return onRep(1);
      // Where is the marker? A triangle wave matching the CSS animation.
      const phase = ((performance.now() - started.current) % (TRAIN_PERIOD * 2)) / TRAIN_PERIOD;
      const position = phase <= 1 ? phase : 2 - phase;
      const off = Math.abs(position - 0.5);
      onRep(off < 0.09 ? 1 : off < 0.2 ? 0.5 : 0);
    };
    return (
      <div className="den-train">
        <p className="den-train__title">
          <GraduationCap aria-hidden="true" /> {TRICKS[active].label}
          <span>{tricks[active] ?? 0}%</span>
        </p>
        <p className="den-train__cue">{TRICKS[active].cue}</p>
        {!reduce && (
          <div className="den-train__meter" aria-hidden="true">
            <span className="den-train__sweet" />
            <span
              className="den-train__marker"
              style={{ animationDuration: `${TRAIN_PERIOD}ms` }}
              key={String(active)}
            />
          </div>
        )}
        <div className="settings-actions">
          <button type="button" className="btn btn--primary" onClick={click} disabled={busy}>
            Klik &amp; beloon
          </button>
          <button type="button" className="btn btn--quiet btn--small" onClick={onStop}>
            Klaar met trainen
          </button>
        </div>
        {!reduce && <p className="den-train__hint">Druk als het streepje in het roze vak staat.</p>}
      </div>
    );
  }

  return (
    <ul className="den-tricks">
      {TRICK_ORDER.map((trick) => {
        const value = tricks[trick] ?? 0;
        const learned = value >= 100;
        return (
          <li key={trick}>
            <div className="den-tricks__info">
              <span className="den-tricks__name">
                {TRICKS[trick].label} {learned && <span className="tag">geleerd ✓</span>}
              </span>
              <span className="den-meter__bar" aria-hidden="true">
                <span style={{ width: `${value}%` }} />
              </span>
            </div>
            {learned ? (
              <button
                type="button"
                className="btn btn--soft btn--small"
                onClick={() => onShow(trick)}
                disabled={busy}
              >
                Laat zien
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--soft btn--small"
                onClick={() => onStart(trick)}
                aria-label={`${TRICKS[trick].label} trainen, ${value}% geleerd`}
              >
                Trainen
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CareDiary({ limit = 6 }: { limit?: number }) {
  const log = useContent((c) => c.pet.log);
  const profile = useContent((c) => c.profile);
  if (!log.length) {
    return (
      <p className="den__diary-empty muted">
        Coco’s zorgdagboek is nog leeg — alles wat jullie voor haar doen komt hier te staan.
      </p>
    );
  }
  return (
    <div className="den__diary">
      <ul>
        {log.slice(0, limit).map((entry) => (
          <li key={entry.id}>
            <span>
              <span className={`den__who den__who--${entry.by ?? 'you'}`}>
                {nameOf(entry.by ?? 'you', profile)}
              </span>{' '}
              {describeCare(entry)}
            </span>
            <time dateTime={entry.at}>{timeAgo(entry.at)}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}
