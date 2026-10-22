import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { CalendarHeart, Repeat } from 'lucide-react';
import { useContent } from '../../data/store';
import { updateProfile } from '../../data/actions';
import { daysUntilAnniversary, durationBetween, formatDate, parseIsoDate, plural } from '../../lib/dates';
import { useToday } from '../../hooks/useToday';
import { useReducedMotion } from '../../hooks/useMotion';
import { StartDateDialog } from './StartDateDialog';

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = String(value);
      return;
    }
    const controls = animate(0, value, {
      duration: Math.min(1.6, 0.6 + value / 400),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <span ref={ref}>{value}</span>;
}

/** "Together for…" — calculated from the start date we enter ourselves. */
export function Counter() {
  const { startDate, counterMode, yourName, partnerName } = useContent((c) => c.profile);
  const todayIso = useToday();
  const [dialogOpen, setDialogOpen] = useState(false);

  const start = parseIsoDate(startDate);
  const today = parseIsoDate(todayIso)!;
  const duration = start ? durationBetween(start, today) : null;

  if (!start) {
    return (
      <section className="counter counter--empty" aria-labelledby="counter-title">
        <p className="counter__eyebrow hand">our counter</p>
        <h2 id="counter-title" className="counter__placeholder">
          Waiting for the day it all began
        </h2>
        <p className="counter__text">
          Add the date {yourName} &amp; {partnerName} started, and this little clock will keep count of every day
          together.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => setDialogOpen(true)}>
          <CalendarHeart aria-hidden="true" />
          Add our date
        </button>
        <StartDateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </section>
    );
  }

  if (!duration) {
    return (
      <section className="counter counter--empty">
        <h2 className="counter__placeholder">That start date is in the future</h2>
        <p className="counter__text">It's set to {formatDate(startDate)}. Mind checking it?</p>
        <button type="button" className="btn btn--soft" onClick={() => setDialogOpen(true)}>
          Fix our date
        </button>
        <StartDateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </section>
    );
  }

  const anniversary = daysUntilAnniversary(start, today);
  const showDays = counterMode === 'days';
  const toggle = () => updateProfile({ counterMode: showDays ? 'ymd' : 'days' });

  const units = [
    { value: duration.years, label: duration.years === 1 ? 'year' : 'years', hideWhenZero: true },
    { value: duration.months, label: duration.months === 1 ? 'month' : 'months', hideWhenZero: false },
    { value: duration.days, label: duration.days === 1 ? 'day' : 'days', hideWhenZero: false },
  ].filter((u) => !(u.hideWhenZero && u.value === 0));

  const spoken = showDays
    ? plural(duration.totalDays, 'day')
    : units.map((u) => `${u.value} ${u.label}`).join(', ');

  return (
    <section className="counter" aria-labelledby="counter-title">
      <div className="counter__head">
        <h2 id="counter-title" className="counter__eyebrow hand">
          together for
        </h2>
        <button type="button" className="counter__toggle" onClick={toggle} aria-label={showDays ? 'Show years, months and days' : 'Show total days'}>
          <Repeat aria-hidden="true" />
          {showDays ? 'y · m · d' : 'days'}
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        Together for {spoken}.
      </p>
      <div className="counter__units" aria-hidden="true">
        {showDays ? (
          <div className="counter__unit counter__unit--wide">
            <span className="counter__num">
              <CountUp value={duration.totalDays} />
            </span>
            <span className="counter__label">days together</span>
          </div>
        ) : (
          units.map((u) => (
            <div className="counter__unit" key={u.label}>
              <span className="counter__num">
                <CountUp value={u.value} />
              </span>
              <span className="counter__label">{u.label}</span>
            </div>
          ))
        )}
      </div>
      <p className="counter__foot">
        since {formatDate(startDate)} ·{' '}
        {anniversary.years === 0 ? (
          <strong>day one ♡</strong>
        ) : anniversary.days === 0 ? (
          <strong>Happy anniversary ♡</strong>
        ) : (
          <>
            {anniversary.years === 1 ? 'first' : `${ordinal(anniversary.years)}`} anniversary in {plural(anniversary.days, 'day')}
          </>
        )}
      </p>
    </section>
  );
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${suffix}`;
}
