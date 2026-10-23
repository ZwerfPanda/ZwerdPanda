import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { CalendarHeart, Pencil, Repeat, Ticket } from 'lucide-react';
import { getContent, updateContent, useContent } from '../../data/store';
import { updateProfile } from '../../data/actions';
import {
  daysUntilAnniversary,
  durationBetween,
  formatDate,
  parseIsoDate,
  plural,
} from '../../lib/dates';
import { href, navigate } from '../../lib/router';
import { nowIso } from '../../lib/id';
import { playSfx } from '../../lib/audio/sfx';
import { useToday } from '../../hooks/useToday';
import { useReducedMotion } from '../../hooks/useMotion';
import { StartDateDialog } from './StartDateDialog';
import { Heart, HeartDefs } from './heartArt';
import { heartbeatsSince, nextMilestone, nextMonthiversary } from './heart';

// Mini us load on their own, so Home stays quick.
const HeartScene = lazy(() => import('./HeartScene').then((m) => ({ default: m.HeartScene })));

/** Taps on the heart before it shows what's hidden deep inside. */
const SECRET_TAPS = 7;

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

/** Hours, minutes and seconds of today, ticking — we're still counting. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const two = (n: number) => String(n).padStart(2, '0');
  return (
    <p className="heart__clock" aria-hidden="true">
      <span>+</span> {now.getHours()}
      <small>u</small> {two(now.getMinutes())}
      <small>m</small> {two(now.getSeconds())}
      <small>s</small>
    </p>
  );
}

const nf = new Intl.NumberFormat('nl-NL');

/**
 * The heart of us — "together for…", counted from the start date we enter
 * ourselves. Tap the heart and it beats; keep tapping and it opens up.
 */
export function Counter() {
  const { startDate, counterMode, yourName, partnerName } = useContent((c) => c.profile);
  const museumFound = useContent((c) => Boolean(c.museum.foundAt));
  const todayIso = useToday();
  const reduce = useReducedMotion();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [taps, setTaps] = useState(0);
  const [beat, setBeat] = useState(0);
  const [floaters, setFloaters] = useState<number[]>([]);

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
  const milestone = nextMilestone(duration.totalDays);
  const monthly = nextMonthiversary(start, today);
  const progress =
    (duration.totalDays - milestone.from) / Math.max(1, milestone.day - milestone.from);
  const startMs = new Date(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  ).getTime();
  const beats = heartbeatsSince(startMs, Date.now());
  const showDays = counterMode === 'days';
  const toggle = () => updateProfile({ counterMode: showDays ? 'ymd' : 'days' });
  const ticketOut = taps >= SECRET_TAPS;

  const units = [
    { value: duration.years, label: 'jaar', hideWhenZero: true },
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

  const tapHeart = () => {
    setBeat((b) => b + 1);
    setFloaters((f) => [...f.slice(-5), Date.now()]);
    const next = taps + 1;
    setTaps(next);
    if (next === SECRET_TAPS) {
      playSfx('star', true);
    } else {
      playSfx('heart', true);
    }
  };

  const board = () => {
    if (!getContent().museum.foundAt) {
      updateContent((c) => ({ ...c, museum: { ...c.museum, foundAt: nowIso() } }));
    }
    playSfx('chime', true);
    navigate('/museum');
  };

  return (
    <section className="counter heart" aria-labelledby="counter-title">
      <div className="heart__sky" aria-hidden="true" />
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

      <div className="heart__stage">
        <svg viewBox="-240 -340 480 350" className="heart__svg" aria-hidden="true">
          <g key={beat} className={beat && !reduce ? 'heart__tapped' : undefined}>
            <Suspense
              fallback={
                <>
                  <HeartDefs />
                  <Heart progress={progress} />
                </>
              }
            >
              <HeartScene progress={progress} />
            </Suspense>
          </g>
        </svg>
        <button
          type="button"
          className="heart__tap"
          data-sfx="none"
          onClick={tapHeart}
          aria-label="Ons hart. Tik erop"
        />
        <AnimatePresence>
          {floaters.map((id, i) => (
            <motion.span
              key={id}
              className="heart__floater"
              aria-hidden="true"
              style={{ left: `${44 + ((i * 17) % 12)}%` }}
              initial={{ opacity: 1, y: 0, scale: 0.6 }}
              animate={{ opacity: 0, y: -90, scale: 1.2 }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              onAnimationComplete={() => setFloaters((f) => f.filter((x) => x !== id))}
            >
              ♥
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {ticketOut && (
          <motion.div
            className="heart__ticket"
            initial={{ opacity: 0, y: -30, rotate: -8, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, rotate: -3, scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 160 }}
          >
            <Ticket aria-hidden="true" />
            <div>
              <p className="heart__ticket-kicker">
                {museumFound ? 'je kaartje ligt klaar' : 'diep in ons hart…'}
              </p>
              <p className="heart__ticket-title">Enkele reis · The Love Line</p>
            </div>
            <button type="button" className="btn btn--primary btn--small" onClick={board}>
              Instappen
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
      <LiveClock />

      <ul className="heart__facts">
        <li>
          <span className="heart__fact-icon" aria-hidden="true">
            ✦
          </span>
          {milestone.inDays === 1
            ? `Morgen: ${milestone.day} dagen samen!`
            : `Nog ${milestone.inDays} dagen tot ${milestone.day} dagen samen`}
        </li>
        <li>
          <span className="heart__fact-icon" aria-hidden="true">
            ♡
          </span>
          {monthly.inDays === 0
            ? `Vandaag: ${plural(monthly.months, 'maand', 'maanden')} samen. Happy monthiversary!`
            : `${plural(monthly.months, 'maand', 'maanden')} samen over ${plural(monthly.inDays, 'dag', 'dagen')}`}
        </li>
        <li>
          <span className="heart__fact-icon" aria-hidden="true">
            ❀
          </span>
          {anniversary.years === 0
            ? 'Dag één ♡'
            : anniversary.days === 0
              ? 'Happy anniversary ♡'
              : `${anniversary.years === 1 ? 'Eerste' : `${anniversary.years}e`} jubileum over ${plural(anniversary.days, 'dag', 'dagen')}`}
        </li>
        <li>
          <span className="heart__fact-icon" aria-hidden="true">
            ♥
          </span>
          ≈ {nf.format(beats)} hartslagen samen
        </li>
      </ul>

      <p className="counter__foot heart__foot">
        sinds {formatDate(startDate)}
        <button
          type="button"
          className="heart__edit"
          onClick={() => setDialogOpen(true)}
          aria-label="Onze startdatum aanpassen"
        >
          <Pencil aria-hidden="true" /> aanpassen
        </button>
      </p>
      {museumFound && !ticketOut && (
        <a className="heart__secret-link" href={href('/museum')}>
          <Ticket aria-hidden="true" /> The Love Line
        </a>
      )}
      <StartDateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </section>
  );
}
