import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { CalendarHeart, Repeat } from 'lucide-react';
import { useContent } from '../../data/store';
import { updateProfile } from '../../data/actions';
import {
  daysUntilAnniversary,
  durationBetween,
  formatDate,
  parseIsoDate,
  plural,
} from '../../lib/dates';
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
          Wachten op de dag dat het begon
        </h2>
        <p className="counter__text">
          Vul de datum in waarop {yourName} &amp; {partnerName} begonnen, en dit klokje telt elke
          dag samen bij.
        </p>
        <button type="button" className="btn btn--primary" onClick={() => setDialogOpen(true)}>
          <CalendarHeart aria-hidden="true" />
          Onze datum invullen
        </button>
        <StartDateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </section>
    );
  }

  if (!duration) {
    return (
      <section className="counter counter--empty">
        <h2 className="counter__placeholder">Die startdatum ligt in de toekomst</h2>
        <p className="counter__text">Hij staat op {formatDate(startDate)}. Even checken?</p>
        <button type="button" className="btn btn--soft" onClick={() => setDialogOpen(true)}>
          Datum aanpassen
        </button>
        <StartDateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </section>
    );
  }

  const anniversary = daysUntilAnniversary(start, today);
  const showDays = counterMode === 'days';
  const toggle = () => updateProfile({ counterMode: showDays ? 'ymd' : 'days' });

  const units = [
    { value: duration.years, label: duration.years === 1 ? 'jaar' : 'jaar', hideWhenZero: true },
    {
      value: duration.months,
      label: duration.months === 1 ? 'maand' : 'maanden',
      hideWhenZero: false,
    },
    { value: duration.days, label: duration.days === 1 ? 'dag' : 'dagen', hideWhenZero: false },
  ].filter((u) => !(u.hideWhenZero && u.value === 0));

  const spoken = showDays
    ? plural(duration.totalDays, 'dag', 'dagen')
    : units.map((u) => `${u.value} ${u.label}`).join(', ');

  return (
    <section className="counter" aria-labelledby="counter-title">
      <div className="counter__head">
        <h2 id="counter-title" className="counter__eyebrow hand">
          together for
        </h2>
        <button
          type="button"
          className="counter__toggle"
          onClick={toggle}
          aria-label={showDays ? 'Toon jaren, maanden en dagen' : 'Toon het totaal aan dagen'}
        >
          <Repeat aria-hidden="true" />
          {showDays ? 'j · m · d' : 'dagen'}
        </button>
      </div>
      <p className="visually-hidden" aria-live="polite">
        Samen sinds {spoken}.
      </p>
      <div className="counter__units" aria-hidden="true">
        {showDays ? (
          <div className="counter__unit counter__unit--wide">
            <span className="counter__num">
              <CountUp value={duration.totalDays} />
            </span>
            <span className="counter__label">dagen samen</span>
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
        sinds {formatDate(startDate)} ·{' '}
        {anniversary.years === 0 ? (
          <strong>dag één ♡</strong>
        ) : anniversary.days === 0 ? (
          <strong>Happy anniversary ♡</strong>
        ) : (
          <>
            {anniversary.years === 1 ? 'eerste' : `${ordinal(anniversary.years)}`} jubileum over{' '}
            {plural(anniversary.days, 'dag', 'dagen')}
          </>
        )}
      </p>
    </section>
  );
}

/** Dutch ordinals: 2e, 3e, 10e … */
function ordinal(n: number): string {
  return `${n}e`;
}
