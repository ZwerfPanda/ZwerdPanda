import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { getContent, updateContent, useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { DailyAnswer, Ping } from '../../data/types';
import { createId, hashUnit, nowIso } from '../../lib/id';
import { todayIso } from '../../lib/dates';
import { playSfx } from '../../lib/audio/sfx';
import { toast } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { useToday } from '../../hooks/useToday';

/* -------------------------------------------------------- thinking of you */

const KINDS: Record<Ping['kind'], { emoji: string; label: string; sent: string; got: string }> = {
  heart: { emoji: '💗', label: 'Hartje', sent: 'een hartje', got: 'denkt aan je' },
  hug: { emoji: '🤗', label: 'Knuffel', sent: 'een knuffel', got: 'stuurt je een knuffel' },
  kiss: { emoji: '💋', label: 'Kusje', sent: 'een kusje', got: 'stuurt je een kusje' },
};

let lastSent = 0;

export function sendPing(kind: Ping['kind']): boolean {
  const from = getAuthor();
  if (!from || Date.now() - lastSent < 2500) return false;
  lastSent = Date.now();
  updateContent((c) => ({
    ...c,
    pings: [...c.pings, { id: createId('ping'), from, kind, at: nowIso() }].slice(-60),
  }));
  return true;
}

/** "Ik denk aan je": one tap, and it floats up on the other's screen. */
export function SendLove() {
  const pings = useContent((c) => c.pings);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const today = useToday();
  const reduce = useReducedMotion();
  const [flying, setFlying] = useState<{ id: number; emoji: string } | null>(null);
  const theirName = nameOf(otherPerson(me), profile);
  const todayCount = pings.filter((p) => todayIso(new Date(p.at)) === today).length;
  if (!getAuthor()) return null;

  return (
    <section className="send-love" aria-labelledby="send-love-title">
      <h2 id="send-love-title" className="send-love__title">
        Ik denk aan je
      </h2>
      <p className="send-love__sub">
        {todayCount > 0
          ? `Vandaag al ${todayCount}× aan elkaar gedacht`
          : `Eén tik: ${theirName} ziet het meteen, of zodra die de app opent`}
      </p>
      <div className="send-love__buttons">
        {(Object.keys(KINDS) as Ping['kind'][]).map((kind) => (
          <button
            key={kind}
            type="button"
            className="send-love__btn"
            data-sfx="none"
            onClick={() => {
              if (!sendPing(kind)) return;
              playSfx('heart', true);
              setFlying({ id: Date.now(), emoji: KINDS[kind].emoji });
              toast(
                `${KINDS[kind].sent[0].toUpperCase()}${KINDS[kind].sent.slice(1)} voor ${theirName} 💌`,
              );
            }}
          >
            <span aria-hidden="true">{KINDS[kind].emoji}</span>
            {KINDS[kind].label}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {flying && !reduce && (
          <motion.span
            key={flying.id}
            className="send-love__fly"
            aria-hidden="true"
            initial={{ y: 0, opacity: 1, scale: 0.8 }}
            animate={{ y: -90, opacity: 0, scale: 1.6 }}
            transition={{ duration: 1.1 }}
            onAnimationComplete={() => setFlying(null)}
          >
            {flying.emoji}
          </motion.span>
        )}
      </AnimatePresence>
    </section>
  );
}

const SEEN_KEY = 'olu:pings-seen:v1';
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
};
const writeSeen = (at: string) => {
  try {
    localStorage.setItem(SEEN_KEY, at);
  } catch {
    // Then a heart may float by twice; no harm.
  }
};

/** Wherever she is in the app, his hearts float up on her screen (and the other way round). */
export function PingCatcher() {
  const pings = useContent((c) => c.pings);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState<{ kind: Ping['kind']; count: number; key: string } | null>(
    null,
  );

  useEffect(() => {
    if (!getAuthor()) return;
    const them = otherPerson(me);
    const theirs = pings.filter((p) => p.from === them);
    const latest = theirs[theirs.length - 1];
    const seen = readSeen();
    // On a phone that never saw any, older taps are just history.
    if (seen === null) {
      writeSeen(latest?.at ?? nowIso());
      return;
    }
    const fresh = theirs.filter((p) => p.at > seen);
    if (!fresh.length || document.visibilityState !== 'visible') return;
    writeSeen(fresh[fresh.length - 1].at);
    const last = fresh[fresh.length - 1];
    setShown({ kind: last.kind, count: fresh.length, key: last.id });
    playSfx('heart', true);
  }, [pings, me]);

  // Coming back to the app shows what arrived while it was in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const them = otherPerson(me);
      const seen = readSeen();
      const fresh = getContent().pings.filter((p) => p.from === them && seen && p.at > seen);
      if (!fresh.length) return;
      writeSeen(fresh[fresh.length - 1].at);
      setShown({ kind: fresh[fresh.length - 1].kind, count: fresh.length, key: fresh[0].id });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [me]);

  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => setShown(null), 4200);
    return () => window.clearTimeout(t);
  }, [shown]);

  const name = nameOf(otherPerson(me), profile);
  return (
    <AnimatePresence>
      {/* Outside the card: inside its moving box they couldn't fill the screen. */}
      {shown && !reduce && (
        <span key={`float-${shown.key}`} className="ping-catch__float" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} style={{ left: `${8 + i * 10}%`, animationDelay: `${(i % 4) * 0.25}s` }}>
              {KINDS[shown.kind].emoji}
            </span>
          ))}
        </span>
      )}
      {shown && (
        <motion.div
          key={shown.key}
          className="ping-catch"
          role="status"
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20 }}
          onClick={() => setShown(null)}
        >
          <span className="ping-catch__emoji" aria-hidden="true">
            {KINDS[shown.kind].emoji}
          </span>
          <strong>
            {name} {KINDS[shown.kind].got}
            {shown.count > 1 ? ` (${shown.count}×)` : ''}
          </strong>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* --------------------------------------------------- question of the day */

export const QUESTIONS = [
  'Wat was vandaag het leukste moment van je dag?',
  'Welk liedje past vandaag bij je?',
  'Als we morgen allebei vrij waren, wat zouden we gaan doen?',
  'Waar heb je vandaag om moeten lachen?',
  'Wat is iets kleins waar je vandaag blij van werd?',
  'Welke snack zou je nu het liefst willen?',
  'Als je nu ergens naartoe kon teleporteren, waar zou dat zijn?',
  'Welk dier zou je vandaag zijn?',
  'Wat wil je deze week nog samen doen?',
  'Waar kijk je deze week naar uit?',
  'Wat is je favoriete herinnering van deze maand?',
  'Welke kleur heeft je dag vandaag?',
  'Wat zou je nu eten als alles kon?',
  'Welke film zouden we vanavond moeten kijken?',
  'Wat denk je dat Coco nu aan het doen is?',
  'Welke emoji beschrijft je dag?',
  'Als we samen een winkeltje hadden, wat zouden we verkopen?',
  'Wat heb je van de ander geleerd?',
  'Wat zou je doen met een dag helemaal voor jezelf?',
  'Welke plek wil je samen nog zien?',
  'Wat was je eerste gedachte toen je vanochtend wakker werd?',
  'Zoet of zout vandaag — en wat precies?',
  'Welk spelletje in de Arcade Hall ga jij vandaag winnen?',
  'Beschrijf de ander in drie woorden.',
  'Welk liedje zing je stiekem altijd mee?',
  'Waar ben je vandaag trots op?',
  'Wat zou de perfecte date van deze week zijn?',
  'Wat is je favoriete geur?',
  'Als vandaag een film was, hoe zou hij heten?',
  'Wat is een kleine wens voor morgen?',
  'Welk dessert kies je nu?',
  'Wat doen we als eerste als we elkaar weer zien?',
  'Welk nagelkleurtje past bij vandaag? 💅',
  'Wat zouden onze mini’s nu moeten doen?',
  'Noem iets wat je vandaag mooi vond om te zien.',
  'Welke bubble tea of matcha zou je nu bestellen?',
  'Welk liedje wil je samen karaoken?',
  'Wat is het liefste dat je vandaag hebt gehoord of gelezen?',
  'Als we een dag lang de baas van de wereld waren, wat zouden we doen?',
  'Wat maakt een gewone dag voor jou een goede dag?',
];

export const questionFor = (date: string) =>
  QUESTIONS[Math.floor(hashUnit(`question-${date}`) * QUESTIONS.length) % QUESTIONS.length];

const answerOf = (daily: DailyAnswer[], date: string, who: 'you' | 'partner') =>
  daily.find((a) => a.id === `${date}:${who}`);

/** One small question a day; you see each other's answer once you've both answered. */
export function DailyQuestion() {
  const daily = useContent((c) => c.daily);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const today = useToday();
  const them = otherPerson(me);
  const theirName = nameOf(them, profile);
  const [text, setText] = useState('');
  const [history, setHistory] = useState(false);
  const mine = answerOf(daily, today, me);
  const theirs = answerOf(daily, today, them);
  if (!getAuthor()) return null;

  const answer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const entry: DailyAnswer = {
      id: `${today}:${me}`,
      date: today,
      who: me,
      text: text.trim(),
      at: nowIso(),
    };
    updateContent((c) => ({
      ...c,
      daily: [...c.daily.filter((a) => a.id !== entry.id), entry],
    }));
    setText('');
    playSfx(theirs ? 'success' : 'pop', true);
  };

  const past = [...new Set(daily.map((a) => a.date))]
    .filter((d) => d < today && answerOf(daily, d, 'you') && answerOf(daily, d, 'partner'))
    .sort()
    .reverse()
    .slice(0, 7);

  return (
    <section className="daily-q" aria-labelledby="daily-q-title">
      <p className="daily-q__eyebrow">vraag van de dag</p>
      <h2 id="daily-q-title" className="daily-q__q">
        {questionFor(today)}
      </h2>
      {!mine ? (
        <form className="daily-q__form" onSubmit={answer}>
          <label className="visually-hidden" htmlFor="daily-answer">
            Jouw antwoord
          </label>
          <textarea
            id="daily-answer"
            rows={2}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              theirs
                ? `${theirName} heeft al geantwoord — jij nu! 👀`
                : 'Jouw antwoord… (de ander ziet het pas als die ook antwoordt)'
            }
          />
          <button type="submit" className="btn btn--primary btn--small" disabled={!text.trim()}>
            Antwoord
          </button>
        </form>
      ) : (
        <div className="daily-q__answers">
          <p className="daily-q__bubble daily-q__bubble--me">
            <small>Jij</small>
            {mine.text}
          </p>
          {theirs ? (
            <motion.p
              className="daily-q__bubble"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <small>{theirName}</small>
              {theirs.text}
            </motion.p>
          ) : (
            <p className="daily-q__wait">
              🔒 Het antwoord van {theirName} zie je zodra die ook geantwoord heeft.
            </p>
          )}
        </div>
      )}
      {past.length > 0 && (
        <>
          <button
            type="button"
            className="link-btn daily-q__more"
            aria-expanded={history}
            onClick={() => setHistory((h) => !h)}
          >
            {history ? 'Verberg eerdere vragen' : `Eerdere vragen (${past.length})`}
          </button>
          {history && (
            <ul className="daily-q__history">
              {past.map((d) => (
                <li key={d}>
                  <strong>{questionFor(d)}</strong>
                  <span>
                    {profile.yourName}: {answerOf(daily, d, 'you')?.text}
                  </span>
                  <span>
                    {profile.partnerName}: {answerOf(daily, d, 'partner')?.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
