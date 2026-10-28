import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { getContent, updateContent, useContent } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { Dialog } from '../../components/ui/Dialog';
import { celebrate } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../hooks/useMotion';
import { navigate } from '../../lib/router';
import { useNews } from '../news/news';
import { useWelcomeDue } from '../welcome/Welcome';
import { weekLeft } from './golden';
import { MEDALS, medalStats, weekProgress, wonMedals, type Medal } from './medals';
import { currentRules } from './ticketRules';
import { FOLD_AT, foldResults } from './tickets';
import './medals.css';

/* -------------------------------------------------- weekly challenge */

const daysLeft = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  if (h < 24) return h <= 1 ? 'nog even' : `nog ${h} uur`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'nog 1 dag' : `nog ${d} dagen`;
};

export function WeekChallenge() {
  const games = useContent((c) => c.games);
  const bonus = useContent((c) => currentRules(c).weekly);
  const { played, goal, done } = weekProgress({ games });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  if (bonus <= 0) return null;
  return (
    <section className={`week-challenge${done ? ' is-done' : ''}`} aria-labelledby="week-title">
      <div className="week-challenge__head">
        <h2 id="week-title">{done ? '🎉 Weekuitdaging gehaald!' : '🎯 Weekuitdaging'}</h2>
        <span className="week-challenge__left">{daysLeft(weekLeft(now))}</span>
      </div>
      <p>
        {done
          ? `Jullie kregen er allebei ${bonus} 🎟️ bij. Volgende week weer!`
          : `Speel deze week ${goal} potjes tegen elkaar: dan krijgen jullie er allebei ${bonus} 🎟️ bij.`}
      </p>
      <ol className="week-challenge__dots" aria-label={`${Math.min(played, goal)} van ${goal}`}>
        {Array.from({ length: goal }, (_, i) => (
          <li key={i} className={i < played ? 'is-on' : ''}>
            {i < played ? '★' : i + 1}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* -------------------------------------------------- the cabinet */

function MedalBadge({
  medal,
  won,
  progress,
  size = 'md',
}: {
  medal: Medal;
  won: boolean;
  progress?: number;
  size?: 'md' | 'lg';
}) {
  return (
    <span className={`medal medal--${size}${won ? ' is-won' : ''}`} aria-hidden="true">
      <span className="medal__ribbon" />
      <span className="medal__disc">
        <span className="medal__emoji">{won ? medal.emoji : '🔒'}</span>
        {won && <span className="medal__shine" />}
      </span>
      {!won && progress !== undefined && (
        <span className="medal__bar">
          <span style={{ width: `${Math.min(100, (progress / medal.goal) * 100)}%` }} />
        </span>
      )}
    </span>
  );
}

export function MedalCabinet() {
  const games = useContent((c) => c.games);
  const texts = useContent((c) => c.texts);
  const karaoke = useContent((c) => c.karaoke);
  const studio = useContent((c) => c.studio);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const them: Person = me === 'you' ? 'partner' : 'you';
  const stats = useMemo(() => medalStats({ games, texts, karaoke, studio }), [games, texts, karaoke, studio]);
  const won = new Set(wonMedals(stats));
  const count = MEDALS.filter((m) => won.has(m.scope === 'us' ? m.id : `${m.id}:${me}`)).length;

  const row = (medal: Medal) => {
    const key = medal.scope === 'us' ? medal.id : `${medal.id}:${me}`;
    const has = won.has(key);
    const p = Math.min(medal.goal, medal.progress(stats, me));
    const theirs = medal.scope === 'each' && won.has(`${medal.id}:${them}`);
    return (
      <li key={medal.id} className={`medals__item${has ? ' is-won' : ''}`}>
        <MedalBadge medal={medal} won={has} progress={p} />
        <span className="medals__text">
          <strong>{medal.title}</strong>
          <small>{medal.text}</small>
          {!has && medal.goal > 1 && (
            <small className="medals__count">
              {p} / {medal.goal}
            </small>
          )}
          {theirs && (
            <small className="medals__theirs">{nameOf(them, profile)} heeft hem ook</small>
          )}
        </span>
      </li>
    );
  };

  return (
    <section className="medals" aria-labelledby="medals-title">
      <h2 id="medals-title" className="medals__title">
        🎖️ Medaillekast{' '}
        <span>
          {count} / {MEDALS.length}
        </span>
      </h2>
      <h3>Samen</h3>
      <ul className="medals__grid">{MEDALS.filter((m) => m.scope === 'us').map(row)}</ul>
      <h3>Van jou</h3>
      <ul className="medals__grid">{MEDALS.filter((m) => m.scope === 'each').map(row)}</ul>
    </section>
  );
}

/* -------------------------------------------------- winning one */

const SEEN_KEY = 'olu:medals-seen:v1';
const readSeen = (): string[] | null => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return [];
  }
};
const writeSeen = (ids: string[]) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    // fine: worst case it shows again
  }
};

/**
 * Celebrates a medal the moment it's won (on each phone, once), and keeps the
 * results list small by moving old weeks into the spaarpot.
 */
export function MedalHost() {
  const games = useContent((c) => c.games);
  const texts = useContent((c) => c.texts);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const { entries, browsing } = useNews();
  const welcomeDue = useWelcomeDue();
  const reduce = useReducedMotion();
  const [queue, setQueue] = useState<string[]>([]);

  useEffect(() => {
    if (games.results.length > FOLD_AT) updateContent(foldResults);
  }, [games.results.length]);

  const karaoke = useContent((c) => c.karaoke);
  const studio = useContent((c) => c.studio);
  const won = useMemo(
    () => wonMedals(medalStats({ games, texts, karaoke, studio })),
    [games, texts, karaoke, studio],
  );
  useEffect(() => {
    const seen = readSeen();
    // The first time: everything already won is simply there, no parade.
    if (seen === null) return writeSeen(won);
    const fresh = won.filter((id) => !seen.includes(id));
    if (!fresh.length) return;
    writeSeen([...seen, ...fresh]);
    // Many at once is a catch-up (a first sync on a new phone), not a moment.
    if (fresh.length > 3) return;
    // Ours and mine first; the other's are nice to know too.
    const order = (id: string) => (id.endsWith(`:${me === 'you' ? 'partner' : 'you'}`) ? 1 : 0);
    setQueue((q) => [...q, ...fresh.sort((a, b) => order(a) - order(b))]);
  }, [won]);

  const current = !welcomeDue && !browsing && !entries.length ? queue[0] : undefined;
  const [id, who] = (current ?? '').split(':') as [string, Person | undefined];
  const medal = MEDALS.find((m) => m.id === id);

  useEffect(() => {
    if (!medal) return;
    playSfx('unlock', true);
    const t = window.setTimeout(
      () => {
        playSfx('star', true);
        celebrate();
      },
      reduce ? 0 : 700,
    );
    return () => window.clearTimeout(t);
  }, [current]);

  const next = () => setQueue((q) => q.slice(1));
  if (!medal) return null;
  const whose =
    medal.scope === 'us'
      ? 'Voor jullie allebei'
      : who === me
        ? 'Voor jou!'
        : `Voor ${nameOf(who ?? 'you', profile)}`;

  return (
    <Dialog
      open
      onClose={next}
      title="Nieuwe medaille!"
      eyebrow={whose}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              next();
              navigate('/games');
              window.setTimeout(
                () =>
                  document.getElementById('medals-title')?.scrollIntoView({ behavior: 'smooth' }),
                400,
              );
            }}
          >
            Medaillekast
          </button>
          <button type="button" className="btn btn--primary" onClick={next}>
            Yes! 🎉
          </button>
        </>
      }
    >
      <div className="medal-won">
        <span className="medal-won__rays" aria-hidden="true" />
        <motion.span
          className="medal-won__badge"
          initial={reduce ? false : { y: -260, rotate: -25, scale: 0.6 }}
          animate={{ y: 0, rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 160, damping: 11, delay: 0.15 }}
        >
          <MedalBadge medal={medal} won size="lg" />
        </motion.span>
        <motion.p
          className="medal-won__title"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          {medal.title}
        </motion.p>
        <p className="medal-won__text">{medal.text}</p>
      </div>
    </Dialog>
  );
}

/** For tests and the cabinet: the medals as they stand right now. */
export const currentMedals = () => wonMedals(medalStats(getContent()));
