import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { useMe } from '../../data/people';
import { useReducedMotion } from '../../hooks/useMotion';
import { ticketsEarned } from './tickets';
import { currentRules } from './ticketRules';
import { Dialog } from '../../components/ui/Dialog';
import { celebrate } from '../../components/ui/feedback';
import { navigate, href } from '../../lib/router';
import { playSfx } from '../../lib/audio/sfx';
import { useNews } from '../news/news';
import { useWelcomeDue } from '../welcome/Welcome';
import { daysUntilGolden, goldenLeft, isGolden, ourDay } from './golden';
import './golden.css';

/*
 * Gouden Woensdag, the event: a golden card the first time the app opens on a
 * Wednesday, a shining banner in the Arcade Hall with a countdown to midnight,
 * and a little badge in the games. On other days, a teaser.
 */

/** The time, ticking every second on a golden day (and every minute otherwise). */
export function useGoldenNow() {
  const [now, setNow] = useState(() => Date.now());
  const golden = isGolden(now);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), golden ? 1000 : 60_000);
    return () => window.clearInterval(t);
  }, [golden]);
  return { now, golden };
}

const pad = (n: number) => String(n).padStart(2, '0');
export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** What Gouden Woensdag multiplies by right now (he can change it). */
export function useGoldenFactor() {
  return useContent((c) => currentRules(c).golden);
}
/** "dubbel", or "×3" when he made it more. */
export const timesWord = (f: number) => (f === 2 ? 'dubbel' : `×${f}`);

/** A golden ticket, with ×2 on it. */
export function GoldenTicket({ size = 1 }: { size?: number }) {
  const factor = useGoldenFactor();
  return (
    <svg
      className="golden-ticket"
      viewBox="0 0 220 120"
      width={220 * size}
      height={120 * size}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gt-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.35" stopColor="#ffd75e" />
          <stop offset="0.7" stopColor="#e9a920" />
          <stop offset="1" stopColor="#fff0a0" />
        </linearGradient>
        <linearGradient id="gt-shine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="gt-clip">
          <path d="M12 6h196a6 6 0 0 0 6 6v30a18 18 0 0 0 0 36v30a6 6 0 0 0-6 6H12a6 6 0 0 0-6-6V78a18 18 0 0 0 0-36V12a6 6 0 0 0 6-6Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#gt-clip)">
        <rect width="220" height="120" fill="url(#gt-gold)" />
        <rect
          className="golden-ticket__shine"
          x="-80"
          width="60"
          height="120"
          fill="url(#gt-shine)"
        />
      </g>
      <path
        d="M12 6h196a6 6 0 0 0 6 6v30a18 18 0 0 0 0 36v30a6 6 0 0 0-6 6H12a6 6 0 0 0-6-6V78a18 18 0 0 0 0-36V12a6 6 0 0 0 6-6Z"
        fill="none"
        stroke="#9a6a08"
        strokeWidth="3"
      />
      <rect
        x="22"
        y="20"
        width="176"
        height="80"
        rx="8"
        fill="none"
        stroke="#9a6a08"
        strokeWidth="1.5"
        strokeDasharray="5 4"
      />
      <text
        x="110"
        y="52"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fill="#6b4300"
        letterSpacing="1.5"
      >
        GOUDEN WOENSDAG
      </text>
      <text x="110" y="90" textAnchor="middle" fontSize="34" fontWeight="900" fill="#6b4300">
        🎟️ ×{factor}
      </text>
    </svg>
  );
}

/** The golden card, once per golden day on each phone. */
export function GoldenHost() {
  const { golden, now } = useGoldenNow();
  const { entries, browsing } = useNews();
  const welcomeDue = useWelcomeDue();
  const [open, setOpen] = useState(false);
  const factor = useGoldenFactor();
  const key = `olu:golden-seen:${ourDay(now)}`;

  useEffect(() => {
    if (!golden || welcomeDue || browsing || entries.length) return;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === '1';
    } catch {
      seen = true; // can't remember it: better not to show it every time
    }
    if (seen) return;
    // After the news (if any) and a moment to settle.
    const t = window.setTimeout(() => {
      setOpen(true);
      playSfx('star', true);
      window.setTimeout(() => celebrate(), 250);
    }, 2400);
    return () => window.clearTimeout(t);
  }, [golden, welcomeDue, browsing, entries.length, key]);

  const close = () => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      // fine
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Gouden Woensdag!"
      eyebrow="vandaag in de arcade"
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={close}>
            Later
          </button>
          <button
            type="button"
            className="btn btn--primary golden-go"
            onClick={() => {
              close();
              navigate('/games');
            }}
          >
            Naar de Arcade ✨
          </button>
        </>
      }
    >
      <div className="golden-card">
        <div className="golden-card__rays" aria-hidden="true" />
        <span className="golden-card__burst" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => (
            <span
              key={i}
              style={
                {
                  '--x': `${Math.cos((i / 10) * Math.PI * 2) * 160}px`,
                  '--y': `${Math.sin((i / 10) * Math.PI * 2) * 120}px`,
                  animationDelay: `${0.8 + (i % 3) * 0.08}s`,
                } as React.CSSProperties
              }
            >
              🪙
            </span>
          ))}
        </span>
        <GoldenTicket />
        <p className="golden-card__lead">
          Vandaag tellen <strong>alle tickets {timesWord(factor)}</strong>. Elk potje tegen elkaar,
          elk antwoord in Wie kent wie — alles ×{factor}.
        </p>
        <p className="golden-card__clock" role="timer">
          Nog <strong>{countdown(goldenLeft(now))}</strong> tot middernacht
        </p>
      </div>
    </Dialog>
  );
}

/** In the Arcade Hall: the shining banner on a golden day, a teaser on the others. */
export function GoldenBanner() {
  const { golden, now } = useGoldenNow();
  const days = daysUntilGolden(now);
  const factor = useGoldenFactor();
  const ref = useRef<HTMLDivElement>(null);
  if (!golden)
    return (
      <p className="golden-teaser">
        ✨ Gouden Woensdag {days === 1 ? 'is morgen' : `over ${days} dagen`} — dan tellen alle
        tickets {timesWord(factor)}
      </p>
    );
  return (
    <div className="golden-banner" ref={ref} role="status">
      <span className="golden-banner__sparkles" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${i * 0.31}s` }}>
            ✦
          </span>
        ))}
      </span>
      <GoldenTicket size={0.62} />
      <div className="golden-banner__text">
        <strong>Gouden Woensdag</strong>
        <span>Alle tickets ×{factor} — vandaag!</span>
        <span className="golden-banner__clock">
          nog <b>{countdown(goldenLeft(now))}</b>
        </span>
      </div>
    </div>
  );
}

/** A small badge in the games themselves, when playing together counts double. */
export function GoldenBadge() {
  const { golden } = useGoldenNow();
  const factor = useGoldenFactor();
  if (!golden) return null;
  return (
    <a className="golden-badge" href={href('/games', { g: 'prizes' })}>
      ✨ Gouden Woensdag · tickets ×{factor}
    </a>
  );
}

/* -------------------------------------------------- tickets coming in */

/**
 * Whenever tickets come in (the other phone's move settles a game, or your
 * own), they rain down for a moment: golden and ×2 on a Wednesday.
 */
export function TicketRain() {
  const me = useMe();
  const earned = useContent((c) => ticketsEarned(c, me));
  const reduce = useReducedMotion();
  const last = useRef<number | null>(null);
  const factor = useGoldenFactor();
  const [shower, setShower] = useState<{ key: number; gain: number; golden: boolean } | null>(null);

  useEffect(() => {
    const before = last.current;
    last.current = earned;
    // Not on first sight, not when it goes down (a prize was won), and not for a
    // big catch-up (a first sync brings in everything at once).
    if (before === null || earned <= before || earned - before > 60) return;
    const golden = isGolden(Date.now());
    setShower({ key: Date.now(), gain: earned - before, golden });
    playSfx('coin', true);
    window.setTimeout(() => playSfx(golden ? 'star' : 'sparkle', true), 350);
    const t = window.setTimeout(() => setShower(null), reduce ? 1600 : 3000);
    return () => window.clearTimeout(t);
  }, [earned]);

  return (
    <AnimatePresence>
      {shower && (
        <motion.div
          key={shower.key}
          className={`ticket-rain ${shower.golden ? 'is-golden' : ''}`}
          aria-live="polite"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {!reduce &&
            Array.from({ length: shower.golden ? 22 : 12 }, (_, i) => (
              <motion.span
                key={i}
                className="ticket-rain__drop"
                style={{ left: `${(i * 47) % 100}%` }}
                initial={{ y: -80, rotate: (i % 2 ? -1 : 1) * 30, opacity: 0 }}
                animate={{ y: '110vh', rotate: (i % 2 ? 1 : -1) * 220, opacity: [0, 1, 1, 0.8] }}
                transition={{
                  duration: 1.8 + (i % 5) * 0.25,
                  delay: (i % 7) * 0.12,
                  ease: 'easeIn',
                }}
              >
                🎟️
              </motion.span>
            ))}
          <motion.div
            className="ticket-rain__gain"
            initial={{ scale: 0.2, rotate: -10 }}
            animate={{ scale: [0.2, 1.25, 1], rotate: [-10, 4, 0] }}
            transition={{ duration: 0.7 }}
          >
            <b>+{shower.gain} 🎟️</b>
            {shower.golden && <span>Gouden Woensdag · ×{factor} ✨</span>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A number that counts up to its new value. */
export function useCountUp(value: number, ms = 900) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      from.current = Math.round(a + (value - a) * (1 - (1 - k) ** 3));
      setShown(from.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

/** Gold coins drifting down through the hall on a golden day. */
export function GoldenCoins() {
  const { golden } = useGoldenNow();
  if (!golden) return null;
  return (
    <span className="golden-coins" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          style={{
            left: `${(i * 29) % 100}%`,
            animationDelay: `${-(i * 1.3)}s`,
            animationDuration: `${9 + (i % 4) * 2}s`,
            fontSize: `${0.9 + (i % 3) * 0.3}rem`,
          }}
        >
          {i % 3 ? '🪙' : '✨'}
        </span>
      ))}
    </span>
  );
}
