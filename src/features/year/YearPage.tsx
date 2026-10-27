import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, X } from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf } from '../../data/people';
import type { Person } from '../../data/types';
import { PageHeader } from '../../components/ui/Fields';
import { playSfx } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../hooks/useMotion';
import { gameName, ourYears, yearStats, type YearStats } from './yearStats';
import './year.css';

/*
 * Ons jaar: our year as a little story of cards, tap by tap. Every number
 * comes from what we put in the app ourselves.
 */

const MONTHS = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
];

interface Card {
  key: string;
  theme: string;
  emoji: string;
  eyebrow: string;
  number?: number;
  unit?: string;
  lines: string[];
}

type Names = Record<Person, string>;

function cards(s: YearStats, names: Names): Card[] {
  const out: Card[] = [
    {
      key: 'intro',
      theme: 'intro',
      emoji: '✨',
      eyebrow: `${names.you} & ${names.partner}`,
      lines: [`Ons ${s.year}`, 'Tik om verder te gaan'],
    },
  ];
  if (s.days > 0)
    out.push({
      key: 'days',
      theme: 'rose',
      emoji: '💞',
      eyebrow: 'samen',
      number: s.days,
      unit: s.days === 1 ? 'dag' : 'dagen',
      lines: [
        `samen in ${s.year}`,
        s.daysTotal > s.days ? `en ${s.daysTotal.toLocaleString('nl-NL')} dagen in totaal` : '',
      ],
    });
  if (s.memories.count > 0)
    out.push({
      key: 'memories',
      theme: 'peach',
      emoji: '📸',
      eyebrow: 'herinneringen',
      number: s.memories.count,
      unit: s.memories.count === 1 ? 'herinnering' : 'herinneringen',
      lines: [
        s.memories.busiestMonth ? `de meeste in ${MONTHS[s.memories.busiestMonth - 1]}` : '',
        s.memories.favorites ? `${s.memories.favorites} met een hartje ♡` : '',
      ],
    });
  const letters = s.letters.you + s.letters.partner;
  if (letters > 0)
    out.push({
      key: 'letters',
      theme: 'lilac',
      emoji: '💌',
      eyebrow: 'brieven',
      number: letters,
      unit: letters === 1 ? 'brief' : 'brieven',
      lines: [
        [
          s.letters.you ? `${s.letters.you} van ${names.you}` : '',
          s.letters.partner ? `${s.letters.partner} van ${names.partner}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ],
    });
  if (s.dates.length > 0)
    out.push({
      key: 'dates',
      theme: 'sunset',
      emoji: '🥂',
      eyebrow: 'dates',
      number: s.dates.length,
      unit: s.dates.length === 1 ? 'date' : 'dates',
      lines: s.dates.slice(-3),
    });
  if (s.songs.count > 0)
    out.push({
      key: 'songs',
      theme: 'night',
      emoji: '🎶',
      eyebrow: 'muziek',
      number: s.songs.count,
      unit: s.songs.count === 1 ? 'liedje' : 'liedjes',
      lines: [
        'toegevoegd aan onze muziek',
        s.songs.favorite
          ? `met een hartje: ${s.songs.favorite.title} — ${s.songs.favorite.artist}`
          : '',
      ],
    });
  if (s.games.together > 0) {
    const { you, partner } = s.games.wins;
    out.push({
      key: 'games',
      theme: 'arcade',
      emoji: '🕹️',
      eyebrow: 'de arcade',
      number: s.games.together,
      unit: s.games.together === 1 ? 'potje' : 'potjes',
      lines: [
        'tegen elkaar gespeeld',
        you === partner
          ? `${you}–${partner}: precies gelijk!`
          : `${you > partner ? names.you : names.partner} won er het meest: ${Math.max(you, partner)}–${Math.min(you, partner)}`,
        s.games.favorite ? `jullie spel: ${gameName(s.games.favorite)}` : '',
        `${s.games.medals} van de ${s.games.medalsOf} medailles in de kast`,
      ],
    });
  }
  if (s.questions > 0)
    out.push({
      key: 'questions',
      theme: 'mint',
      emoji: '💬',
      eyebrow: 'vraag van de dag',
      number: s.questions,
      unit: s.questions === 1 ? 'vraag' : 'vragen',
      lines: ['door jullie allebei beantwoord'],
    });
  if (s.flowers.count > 0)
    out.push({
      key: 'flowers',
      theme: 'blossom',
      emoji: '💐',
      eyebrow: 'bloemen',
      number: s.flowers.count,
      unit: s.flowers.count === 1 ? 'boeket' : 'boeketten',
      lines: [s.flowers.favorite ? `het vaakst: ${s.flowers.favorite}` : ''],
    });
  if (s.cinema.nights + s.cinema.films > 0)
    out.push({
      key: 'cinema',
      theme: 'velvet',
      emoji: '🍿',
      eyebrow: 'onze bioscoop',
      number: s.cinema.nights || s.cinema.films,
      unit: s.cinema.nights ? (s.cinema.nights === 1 ? 'filmavond' : 'filmavonden') : 'films',
      lines: [
        s.cinema.nights && s.cinema.films ? `en ${s.cinema.films} nieuwe films op het doek` : '',
      ],
    });
  if (s.karaoke.records > 0)
    out.push({
      key: 'karaoke',
      theme: 'velvet',
      emoji: '🎤',
      eyebrow: 'de karaoke kamer',
      number: s.karaoke.records,
      unit: s.karaoke.records === 1 ? 'opname' : 'opnames',
      lines: [
        s.karaoke.duets ? `waarvan ${s.karaoke.duets} samen gezongen` : 'officieel opgenomen',
      ],
    });
  if (s.coco > 0)
    out.push({
      key: 'coco',
      theme: 'meadow',
      emoji: '🐰',
      eyebrow: 'Coco',
      number: s.coco,
      unit: s.coco === 1 ? 'dag' : 'dagen',
      lines: ['goed voor Coco gezorgd'],
    });
  out.push({
    key: 'outro',
    theme: 'intro',
    emoji: '♡',
    eyebrow: `${names.you} & ${names.partner}`,
    lines: [`Op naar ${s.year + 1}`, 'samen'],
  });
  return out.map((c) => ({ ...c, lines: c.lines.filter(Boolean) }));
}

function CountUp({ to }: { to: number }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return setN(to);
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 1200);
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, reduce]);
  return <>{n.toLocaleString('nl-NL')}</>;
}

const SLIDE_MS = 7000;

function Story({ deck, onClose }: { deck: Card[]; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();
  const card = deck[i];
  const last = i === deck.length - 1;
  const closeRef = useRef<HTMLButtonElement>(null);

  const go = (d: number) => {
    const next = i + d;
    if (next < 0) return;
    if (next >= deck.length) return onClose();
    setI(next);
    playSfx(next === deck.length - 1 ? 'star' : 'pop', true);
  };

  useEffect(() => {
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  useEffect(() => {
    if (paused || last || reduce) return;
    const t = window.setTimeout(() => go(1), SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [i, paused, reduce]);

  return (
    <div
      className={`year-story year-story--${card.theme}`}
      role="dialog"
      aria-modal="true"
      aria-label="Ons jaar"
    >
      <div className="year-story__bars" aria-hidden="true">
        {deck.map((c, n) => (
          <span key={c.key} className={n < i ? 'is-done' : ''}>
            {n === i && (
              <span
                className={`year-story__fill${paused || reduce || last ? ' is-still' : ''}`}
                style={{ animationDuration: `${SLIDE_MS}ms` }}
                key={`${i}-${paused}`}
              />
            )}
          </span>
        ))}
      </div>
      <button
        ref={closeRef}
        type="button"
        className="year-story__close"
        onClick={onClose}
        aria-label="Sluiten"
      >
        <X />
      </button>
      <span className="year-story__sparkles" aria-hidden="true">
        {Array.from({ length: 12 }, (_, n) => (
          <span key={n} style={{ left: `${(n * 37) % 100}%`, animationDelay: `${-n * 0.7}s` }}>
            {n % 2 ? '✦' : '·'}
          </span>
        ))}
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={card.key}
          className="year-card"
          initial={reduce ? false : { opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.98 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          aria-live="polite"
        >
          <motion.span
            className="year-card__emoji"
            aria-hidden="true"
            initial={reduce ? false : { scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 12, delay: 0.15 }}
          >
            {card.emoji}
          </motion.span>
          <p className="year-card__eyebrow">{card.eyebrow}</p>
          {card.number !== undefined && (
            <p className="year-card__number">
              <strong>
                <CountUp to={card.number} />
              </strong>{' '}
              <span>{card.unit}</span>
            </p>
          )}
          {card.lines.map((line, n) => (
            <motion.p
              key={line}
              className={
                n === 0 && card.number === undefined ? 'year-card__title' : 'year-card__line'
              }
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + n * 0.25 }}
            >
              {line}
            </motion.p>
          ))}
        </motion.div>
      </AnimatePresence>
      <button
        type="button"
        className="year-story__tap year-story__tap--back"
        onClick={() => go(-1)}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        aria-label="Vorige"
      >
        <ChevronLeft aria-hidden="true" />
      </button>
      <button
        type="button"
        className="year-story__tap year-story__tap--next"
        onClick={() => go(1)}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
        aria-label={last ? 'Klaar' : 'Volgende'}
      >
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

export function YearPage() {
  const content = useContent((c) => c);
  const profile = useContent((c) => c.profile);
  const years = useMemo(() => ourYears(content), [content.profile.startDate]);
  // In January, last year is the one to look back on.
  const [year, setYear] = useState(() =>
    new Date().getMonth() === 0 && years.length > 1 ? years[1] : years[0],
  );
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => yearStats(content, year), [content, year]);
  const names: Names = { you: nameOf('you', profile), partner: nameOf('partner', profile) };
  const deck = cards(stats, names);

  useEffect(() => {
    document.documentElement.classList.toggle('year-open', open);
    return () => document.documentElement.classList.remove('year-open');
  }, [open]);

  return (
    <div className="page year-page">
      <PageHeader
        eyebrow="terugkijken"
        title={
          <>
            Ons <em>{year}</em>
          </>
        }
        lede="Ons jaar in een paar kaartjes: alles wat we samen in ons universe hebben gezet, opgeteld."
      />
      {years.length > 1 && (
        <div className="chip-row year-page__years" role="group" aria-label="Kies een jaar">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className="chip"
              aria-pressed={y === year}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="year-page__start"
        onClick={() => {
          setOpen(true);
          playSfx('chime', true);
        }}
      >
        <span className="year-page__start-glow" aria-hidden="true" />
        <Play aria-hidden="true" />
        <span>
          <strong>Bekijk ons {year}</strong>
          <small>{deck.length - 2} kaartjes</small>
        </span>
      </button>
      <ul className="year-page__peek">
        {deck.slice(1, -1).map((c) => (
          <li key={c.key}>
            <span aria-hidden="true">{c.emoji}</span>
            <strong>{c.number?.toLocaleString('nl-NL')}</strong> {c.unit}
          </li>
        ))}
      </ul>
      {open && createPortal(<Story deck={deck} onClose={() => setOpen(false)} />, document.body)}
    </div>
  );
}
