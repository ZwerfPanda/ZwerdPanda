import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, Plus, Shuffle } from 'lucide-react';
import { updateContent, useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { Person, QuizAnswer, QuizQuestion } from '../../data/types';
import { TextArea, TextField } from '../../components/ui/Fields';
import { Dialog } from '../../components/ui/Dialog';
import { celebrateFrom, toast } from '../../components/ui/feedback';
import { CocoFigure } from '../../components/art/SampleArt';
import { createId, hashUnit, nowIso } from '../../lib/id';
import { href } from '../../lib/router';
import { playSfx } from '../../lib/audio/sfx';
import { useAmbience } from '../../lib/audio/ambience';
import { ScoreBoard, WhoAreYou } from '../games/GameShell';
import '../games/arcade.css';
import './quiz.css';

type Category = 'food' | 'me' | 'dreams' | 'us' | 'habits' | 'own';

export const CATEGORIES: Record<Category, { label: string; color: string }> = {
  food: { label: 'Eten & drinken', color: '#ffb020' },
  me: { label: 'Over mij', color: '#ff5fa2' },
  dreams: { label: 'Dromen', color: '#b07bff' },
  us: { label: 'Wij', color: '#ff8cc0' },
  habits: { label: 'Gewoontes', color: '#5ff3ff' },
  own: { label: 'Eigen vraag', color: '#5dff9a' },
};

/** Questions about yourself, so the other can guess. Our own can be added. */
export const STARTER_QUESTIONS: { id: string; text: string; category: Category }[] = [
  { id: 'q-food', text: 'Wat is mijn lievelingseten?', category: 'food' },
  { id: 'q-colour', text: 'Wat is mijn lievelingskleur?', category: 'me' },
  { id: 'q-trip', text: 'Waar zou ik het liefst samen op reis gaan?', category: 'dreams' },
  { id: 'q-snack', text: 'Wat is mijn favoriete snack?', category: 'food' },
  { id: 'q-song', text: 'Welk liedje zit altijd in mijn hoofd?', category: 'habits' },
  { id: 'q-morning', text: 'Wat doe ik als eerste als ik wakker word?', category: 'habits' },
  { id: 'q-dream-job', text: 'Wat is mijn droombaan?', category: 'dreams' },
  { id: 'q-series', text: 'Wat is mijn lievelingsfilm of -serie?', category: 'habits' },
  { id: 'q-happy', text: 'Waar word ik meteen blij van?', category: 'me' },
  { id: 'q-memory', text: 'Wat is mijn favoriete herinnering van ons?', category: 'us' },
  { id: 'q-animal', text: 'Welk dier zou ik zijn?', category: 'me' },
  { id: 'q-date', text: 'Mijn ideale date is…', category: 'us' },
  { id: 'q-never', text: 'Wat zou ik nooit eten?', category: 'food' },
  { id: 'q-talent', text: 'Wat is mijn verborgen talent?', category: 'me' },
  { id: 'q-proud', text: 'Waar ben ik stiekem trots op?', category: 'me' },
  { id: 'q-grumpy', text: 'Waar word ik chagrijnig van?', category: 'me' },
  { id: 'q-drink', text: 'Koffie, thee of matcha?', category: 'food' },
  { id: 'q-first', text: 'Wat viel mij als eerste aan jou op?', category: 'us' },
  { id: 'q-fear', text: 'Waar ben ik bang voor?', category: 'me' },
  { id: 'q-sunday', text: 'Mijn perfecte zondag ziet eruit als…', category: 'dreams' },
];

/** The quick round: pick one, then guess what the other picked. */
export const THIS_OR_THAT: { id: string; a: string; b: string }[] = [
  { id: 'tt-sweet', a: 'Zoet', b: 'Zout' },
  { id: 'tt-beach', a: 'Strand', b: 'Stad' },
  { id: 'tt-morning', a: 'Ochtendmens', b: 'Avondmens' },
  { id: 'tt-film', a: 'Film', b: 'Serie' },
  { id: 'tt-summer', a: 'Zomer', b: 'Winter' },
  { id: 'tt-pizza', a: 'Pizza', b: 'Sushi' },
  { id: 'tt-call', a: 'Bellen', b: 'Appen' },
  { id: 'tt-sleep', a: 'Uitslapen', b: 'Vroeg op' },
  { id: 'tt-home', a: 'Thuis chillen', b: 'Uitgaan' },
  { id: 'tt-mountains', a: 'Bergen', b: 'Zee' },
  { id: 'tt-romcom', a: 'Romcom', b: 'Horror' },
  { id: 'tt-dog', a: 'Hond', b: 'Kat' },
  { id: 'tt-gift', a: 'Een cadeautje', b: 'Een lieve brief' },
  { id: 'tt-boba', a: 'Bubble tea', b: 'Matcha latte' },
  { id: 'tt-plan', a: 'Alles plannen', b: 'Spontaan' },
  { id: 'tt-karaoke', a: 'Karaoke', b: 'Arcade' },
  { id: 'tt-cuddle', a: 'Knuffelen op de bank', b: 'Samen op stap' },
  { id: 'tt-train', a: 'Trein', b: 'Auto' },
];

const isQuick = (id: string) => id.startsWith('tt-');

const fold = (s = '') =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();

/** Close enough to count without asking (same words, or one inside the other). */
const looksRight = (guess?: string, truth?: string) => {
  const a = fold(guess);
  const b = fold(truth);
  return Boolean(
    a && b && (a === b || (a.length > 3 && b.includes(a)) || (b.length > 3 && a.includes(b))),
  );
};

/** "Waar ben ik bang voor?" → "Waar is Shenaya bang voor?" */
export function guessWording(text: string, name: string): string {
  const verbs: [RegExp, string][] = [
    [/\bben ik\b/gi, `is ${name}`],
    [/\bik ben\b/gi, `${name} is`],
    [/\bword ik\b/gi, `wordt ${name}`],
    [/\bdoe ik\b/gi, `doet ${name}`],
    [/\bheb ik\b/gi, `heeft ${name}`],
    [/\bik heb\b/gi, `${name} heeft`],
    [/\bga ik\b/gi, `gaat ${name}`],
    [/\bwil ik\b/gi, `wil ${name}`],
    // Dutch: Valencio's, Shenaya's — but Robs.
    [/\bmijn\b/gi, /[aeiouy]$/i.test(name) ? `${name}’s` : `${name}s`],
    [/\bmij\b/gi, name],
    [/\bik\b/gi, name],
  ];
  return verbs.reduce((t, [re, to]) => t.replace(re, to), text);
}

const answerId = (question: string, who: Person) => `${question}:${who}`;

function saveAnswer(question: string, who: Person, patch: Partial<QuizAnswer>) {
  const id = answerId(question, who);
  updateContent((c) => {
    const existing = c.quiz.answers.find((a) => a.id === id);
    const next: QuizAnswer = {
      ...(existing ?? { id, question, who, at: nowIso() }),
      ...patch,
      at: nowIso(),
    };
    return {
      ...c,
      quiz: {
        ...c.quiz,
        answers: existing
          ? c.quiz.answers.map((a) => (a.id === id ? next : a))
          : [...c.quiz.answers, next],
      },
    };
  });
}

/**
 * Points for how well `who` knows the other. Open questions: right 1, close ½,
 * as the other judged it. Dit-of-dat: 1 when the guess matches their pick.
 */
export function score(answers: QuizAnswer[], who: Person): number {
  const them = otherPerson(who);
  return answers
    .filter((a) => a.who === who)
    .reduce((n, a) => {
      if (isQuick(a.question)) {
        const theirs = answers.find((x) => x.id === answerId(a.question, them));
        return n + (a.guess && theirs?.self && a.guess === theirs.self ? 1 : 0);
      }
      return n + (a.judged === 'right' ? 1 : a.judged === 'close' ? 0.5 : 0);
    }, 0);
}

/** How many guesses have an outcome yet (judged, or both picked in the quick round). */
export function decided(answers: QuizAnswer[]): number {
  return answers.filter((a) => {
    if (!a.guess) return false;
    if (!isQuick(a.question)) return Boolean(a.judged);
    return Boolean(answers.find((x) => x.id === answerId(a.question, otherPerson(a.who)))?.self);
  }).length;
}

type Tab = 'open' | 'quick' | 'reveal';

export function QuizPage() {
  useAmbience('arcade');
  return (
    <div className="page arcade-zone game game--quiz show">
      <div className="game__bar">
        <a className="game__back" href={href('/games')}>
          <ArrowLeft aria-hidden="true" /> Arcade Hall
        </a>
      </div>
      <header className="show__stage">
        <span className="show__beam show__beam--l" aria-hidden="true" />
        <span className="show__beam show__beam--r" aria-hidden="true" />
        <p className="show__eyebrow">live vanuit ons universe</p>
        <h1 className="show__title">
          Wie kent <em>wie?</em>
        </h1>
        <p className="show__sub">de show</p>
      </header>
      <WhoAreYou>
        <Show />
      </WhoAreYou>
    </div>
  );
}

function Show() {
  const quiz = useContent((c) => c.quiz);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const them = otherPerson(me);
  const myName = nameOf(me, profile);
  const theirName = nameOf(them, profile);
  const [tab, setTab] = useState<Tab>('open');
  const [adding, setAdding] = useState(false);
  const [skip, setSkip] = useState(0);

  const questions: (QuizQuestion & { category: Category })[] = [
    ...STARTER_QUESTIONS.map((q) => ({ ...q, createdAt: '' })),
    ...quiz.custom.map((q) => ({ ...q, category: 'own' as const })),
  ];
  const find = (q: string, who: Person) => quiz.answers.find((a) => a.id === answerId(q, who));
  const done = (q: string, who: Person) => Boolean(find(q, who)?.self && find(q, who)?.guess);
  const open = questions.filter((q) => !done(q.id, me));
  const next = open.length
    ? open[(Math.floor(hashUnit('quiz') * open.length) + skip) % open.length]
    : null;
  const quickOpen = THIS_OR_THAT.filter((q) => !done(q.id, me));
  const reveals = questions.filter((q) => done(q.id, me) && done(q.id, them));
  const quickReveals = THIS_OR_THAT.filter((q) => done(q.id, me) && done(q.id, them));
  const unjudged = reveals.filter((q) => !find(q.id, them)?.judged).length;
  const waiting =
    questions.filter((q) => done(q.id, me) && !done(q.id, them)).length +
    THIS_OR_THAT.filter((q) => done(q.id, me) && !done(q.id, them)).length;

  const points = { you: score(quiz.answers, 'you'), partner: score(quiz.answers, 'partner') };
  const outcomes = decided(quiz.answers);
  const meter = outcomes ? Math.round(((points.you + points.partner) / outcomes) * 100) : null;
  const leader =
    points.you === points.partner ? null : points.you > points.partner ? 'you' : 'partner';

  const host = !quiz.answers.length
    ? 'Welkom bij Wie kent wie? Ik ben jullie presentator, Coco! 🎤'
    : unjudged > 0
      ? `Er ${unjudged === 1 ? 'ligt 1 antwoord' : `liggen ${unjudged} antwoorden`} klaar om te onthullen! 🥁`
      : waiting > 0
        ? `Spannend… ${theirName} moet nog ${waiting} ${waiting === 1 ? 'vraag' : 'vragen'} doen.`
        : leader
          ? `${nameOf(leader, profile)} staat voor met ${points[leader]} punten! 👑`
          : 'Gelijkspel! Wie pakt de volgende punt? ✨';

  return (
    <>
      <ScoreBoard
        label="punten"
        entries={[
          {
            name: profile.yourName.toUpperCase(),
            value: points.you,
            me: me === 'you',
          },
          {
            name: profile.partnerName.toUpperCase(),
            value: points.partner,
            me: me === 'partner',
          },
        ]}
      />
      {meter !== null && (
        <div
          className="show-meter"
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meter}
          aria-label="Zielsverwanten-meter"
        >
          <span className="show-meter__label">Zielsverwanten-meter</span>
          <span className="show-meter__bar">
            <motion.span
              className="show-meter__fill"
              initial={{ width: 0 }}
              animate={{ width: `${meter}%` }}
              transition={{ type: 'spring', stiffness: 60, damping: 14 }}
            />
          </span>
          <strong>{meter}%</strong>
        </div>
      )}

      <div className="show-host">
        <svg viewBox="-60 -70 120 100" className="show-host__coco" aria-hidden="true">
          <CocoFigure x={0} y={0} scale={0.62} blink />
          <path d="M30 -6l12 -14" stroke="#c9c3d6" strokeWidth="3" strokeLinecap="round" />
          <circle cx="44" cy="-22" r="6" fill="#3a2758" stroke="#c9c3d6" strokeWidth="2" />
        </svg>
        <AnimatePresence mode="wait">
          <motion.p
            key={host}
            className="show-host__line"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            aria-live="polite"
          >
            {host}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="game__modes" role="tablist" aria-label="Rondes">
        {(
          [
            ['open', '📝 Vragen', open.length],
            ['quick', '⚡ Dit of dat', quickOpen.length],
            ['reveal', '🥁 Onthullen', unjudged],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="game__mode"
            data-sfx="none"
            onClick={() => {
              playSfx('coin', true);
              setTab(id);
            }}
          >
            {label}
            {n > 0 && <span className="show-badge">{n}</span>}
          </button>
        ))}
      </div>

      {tab === 'open' &&
        (next ? (
          <QuestionCard
            key={next.id}
            question={next}
            category={next.category}
            number={questions.length - open.length + 1}
            total={questions.length}
            me={me}
            theirName={theirName}
            existing={find(next.id, me)}
            onSkip={() => setSkip((s) => s + 1)}
          />
        ) : (
          <p className="game-panel">Je hebt alle vragen gehad! Voeg er zelf een paar toe. ✨</p>
        ))}

      {tab === 'quick' &&
        (quickOpen.length ? (
          <QuickCard
            key={quickOpen[0].id}
            q={quickOpen[0]}
            number={THIS_OR_THAT.length - quickOpen.length + 1}
            me={me}
            theirName={theirName}
            existing={find(quickOpen[0].id, me)}
          />
        ) : (
          <p className="game-panel">Alle dit-of-dat-vragen gedaan! ⚡ Kijk bij Onthullen.</p>
        ))}

      {tab === 'reveal' && (
        <section aria-label="Onthullen" className="show-reveals">
          {reveals.length + quickReveals.length === 0 && (
            <p className="game-panel">
              Nog niks te onthullen. Zodra jullie allebei een vraag hebben gedaan, staat hij hier
              klaar.
            </p>
          )}
          {quickReveals.length > 0 && (
            <QuickReveals
              items={quickReveals}
              find={find}
              me={me}
              myName={myName}
              theirName={theirName}
            />
          )}
          <ul className="show-list">
            {reveals
              .slice()
              .reverse()
              .map((q) => (
                <Reveal
                  key={q.id}
                  question={q}
                  category={q.category}
                  mine={find(q.id, me)!}
                  theirs={find(q.id, them)!}
                  myName={myName}
                  theirName={theirName}
                />
              ))}
          </ul>
        </section>
      )}

      {waiting > 0 && (
        <p className="game-hint">
          ⏳ {waiting} {waiting === 1 ? 'vraag wacht' : 'vragen wachten'} nog op {theirName}.
        </p>
      )}

      <button type="button" className="neon-btn neon-btn--small" onClick={() => setAdding(true)}>
        <Plus aria-hidden="true" /> Eigen vraag toevoegen
      </button>
      <AddQuestion open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function CategoryChip({ category }: { category: Category }) {
  return (
    <span
      className="show-chip"
      style={{ '--c': CATEGORIES[category].color } as React.CSSProperties}
    >
      {CATEGORIES[category].label}
    </span>
  );
}

function QuestionCard({
  question,
  category,
  number,
  total,
  me,
  theirName,
  existing,
  onSkip,
}: {
  question: QuizQuestion;
  category: Category;
  number: number;
  total: number;
  me: Person;
  theirName: string;
  existing?: QuizAnswer;
  onSkip: () => void;
}) {
  const [step, setStep] = useState<'self' | 'guess'>(existing?.self ? 'guess' : 'self');
  const [text, setText] = useState(
    existing?.self && step === 'guess' ? (existing.guess ?? '') : (existing?.self ?? ''),
  );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) return;
    if (step === 'self') {
      saveAnswer(question.id, me, { self: text.trim() });
      playSfx('pop', true);
      setStep('guess');
      setText('');
    } else {
      saveAnswer(question.id, me, { guess: text.trim() });
      celebrateFrom(e.currentTarget);
      playSfx('success', true);
      toast(`Opgeslagen — nu is ${theirName} aan de beurt 💌`);
    }
  };

  // "my" questions read naturally as theirs on the guessing step.
  const asThem = guessWording(question.text, theirName);

  return (
    <AnimatePresence mode="wait">
      <motion.form
        key={step}
        className={`show-card show-card--${step}`}
        onSubmit={submit}
        initial={{ opacity: 0, rotateX: -20, y: 14 }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        exit={{ opacity: 0, rotateX: 20 }}
        transition={{ duration: 0.32 }}
      >
        <div className="show-card__top">
          <CategoryChip category={category} />
          <span className="show-card__count">
            vraag {Math.min(number, total)}/{total}
          </span>
        </div>
        <p className="show-card__step">
          {step === 'self' ? 'stap 1 · over jezelf' : `stap 2 · raad wat ${theirName} zegt`}
        </p>
        <h2 className="show-card__q">{step === 'self' ? question.text : asThem}</h2>
        <TextField
          label={step === 'self' ? 'Jouw antwoord' : `Wat zegt ${theirName}?`}
          value={text}
          onChange={setText}
          maxLength={200}
          autoFocus
        />
        <div className="game-actions">
          {step === 'self' && (
            <button type="button" className="neon-btn neon-btn--small show-skip" onClick={onSkip}>
              <Shuffle aria-hidden="true" /> Andere vraag
            </button>
          )}
          <button type="submit" className="neon-btn" disabled={!text.trim()}>
            {step === 'self' ? 'Volgende' : 'Klaar!'}
          </button>
        </div>
      </motion.form>
    </AnimatePresence>
  );
}

function QuickCard({
  q,
  number,
  me,
  theirName,
  existing,
}: {
  q: (typeof THIS_OR_THAT)[number];
  number: number;
  me: Person;
  theirName: string;
  existing?: QuizAnswer;
}) {
  const step = existing?.self ? 'guess' : 'self';
  const pick = (choice: string, el: HTMLElement) => {
    if (step === 'self') {
      saveAnswer(q.id, me, { self: choice });
      playSfx('pop', true);
    } else {
      saveAnswer(q.id, me, { guess: choice });
      playSfx('sparkle', true);
      celebrateFrom(el);
    }
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        className="show-card show-card--quick"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.22 }}
      >
        <div className="show-card__top">
          <span className="show-chip" style={{ '--c': '#ffd75e' } as React.CSSProperties}>
            ⚡ Dit of dat
          </span>
          <span className="show-card__count">
            {number}/{THIS_OR_THAT.length}
          </span>
        </div>
        <h2 className="show-card__q">
          {step === 'self' ? 'Wat kies jij?' : `Wat koos ${theirName}?`}
        </h2>
        <div className="show-vs">
          <button
            type="button"
            className="show-pick show-pick--a"
            data-sfx="none"
            onClick={(e) => pick(q.a, e.currentTarget)}
          >
            {q.a}
          </button>
          <span className="show-vs__or" aria-hidden="true">
            of
          </span>
          <button
            type="button"
            className="show-pick show-pick--b"
            data-sfx="none"
            onClick={(e) => pick(q.b, e.currentTarget)}
          >
            {q.b}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function QuickReveals({
  items,
  find,
  me,
  myName,
  theirName,
}: {
  items: typeof THIS_OR_THAT;
  find: (q: string, who: Person) => QuizAnswer | undefined;
  me: Person;
  myName: string;
  theirName: string;
}) {
  const them = otherPerson(me);
  return (
    <div className="show-quick">
      <h2 className="show-h">⚡ Dit of dat</h2>
      <ul className="show-quick__list">
        {items.map((q) => {
          const mine = find(q.id, me)!;
          const theirs = find(q.id, them)!;
          const iKnew = mine.guess === theirs.self;
          const theyKnew = theirs.guess === mine.self;
          return (
            <li key={q.id} className="show-quick__row">
              <span className="show-quick__q">
                {q.a} <i>of</i> {q.b}
              </span>
              <span className={`show-quick__who ${theyKnew ? 'is-right' : 'is-wrong'}`}>
                <small>{myName}</small>
                {mine.self} {theyKnew ? '✓' : '✗'}
              </span>
              <span className={`show-quick__who ${iKnew ? 'is-right' : 'is-wrong'}`}>
                <small>{theirName}</small>
                {theirs.self} {iKnew ? '✓' : '✗'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="game-hint">✓ betekent: de ander raadde het goed.</p>
    </div>
  );
}

function Reveal({
  question,
  category,
  mine,
  theirs,
  myName,
  theirName,
}: {
  question: QuizQuestion;
  category: Category;
  mine: QuizAnswer;
  theirs: QuizAnswer;
  myName: string;
  theirName: string;
}) {
  const [shown, setShown] = useState(Boolean(mine.judged || theirs.judged));
  // I judge their guess about me; they judge my guess about them.
  const judge = (verdict: 'right' | 'close' | 'wrong', el: HTMLElement) => {
    saveAnswer(question.id, theirs.who, { judged: verdict });
    if (verdict === 'right') celebrateFrom(el);
    playSfx(verdict === 'wrong' ? 'boing' : 'success', true);
  };
  const auto = looksRight(theirs.guess, mine.self);

  return (
    <li className="show-reveal">
      <div className="show-card__top">
        <CategoryChip category={category} />
      </div>
      <p className="show-reveal__q">{question.text}</p>
      {!shown ? (
        <button
          type="button"
          className="neon-btn show-reveal__open"
          data-sfx="sparkle"
          onClick={() => setShown(true)}
        >
          🥁 Onthul!
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, rotateY: 90 }}
          animate={{ opacity: 1, rotateY: 0 }}
          transition={{ duration: 0.45 }}
        >
          <div className="show-reveal__row">
            <span>
              <small>{myName} zei</small>
              <strong>{mine.self}</strong>
            </span>
            <span>
              <small>{theirName} gokte</small>
              <strong>{theirs.guess}</strong>
            </span>
          </div>
          <div className="show-judge" role="group" aria-label={`Klopt de gok van ${theirName}?`}>
            {(
              [
                ['right', '✓ Goed!'],
                ['close', '≈ Bijna'],
                ['wrong', '✗ Fout'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`show-judge__btn show-judge__btn--${v}`}
                data-sfx="none"
                aria-pressed={theirs.judged === v}
                onClick={(e) => judge(v, e.currentTarget)}
              >
                {v === 'right' && auto && !theirs.judged ? <Check aria-hidden="true" /> : null}
                {label}
              </button>
            ))}
          </div>
          <div className="show-reveal__row show-reveal__row--other">
            <span>
              <small>{theirName} zei</small>
              <strong>{theirs.self}</strong>
            </span>
            <span>
              <small>jij gokte</small>
              <strong>{mine.guess}</strong>
            </span>
          </div>
          <p className="show-reveal__verdict">
            {mine.judged
              ? `${theirName} vond jouw gok: ${mine.judged === 'right' ? 'goed! ✓' : mine.judged === 'close' ? 'bijna' : 'fout'}`
              : `${theirName} beoordeelt jouw gok nog.`}
          </p>
        </motion.div>
      )}
    </li>
  );
}

function AddQuestion({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const q: QuizQuestion = {
      id: createId('question'),
      text: text.trim(),
      by: getAuthor(),
      createdAt: nowIso(),
    };
    updateContent((c) => ({ ...c, quiz: { ...c.quiz, custom: [...c.quiz.custom, q] } }));
    toast('Vraag toegevoegd ✨');
    setText('');
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Een eigen vraag"
      eyebrow="wie kent wie"
      size="sm"
      footer={
        <button type="submit" form="quiz-add" className="btn btn--primary">
          Toevoegen
        </button>
      }
    >
      <form id="quiz-add" className="form" onSubmit={save}>
        <TextArea
          label="De vraag (over jezelf)"
          value={text}
          onChange={setText}
          rows={2}
          placeholder="bv. Wat is mijn lievelingsplek in Den Haag?"
          hint="Schrijf hem met “mijn/ik” — bij het raden wordt het vanzelf de naam van de ander."
        />
      </form>
    </Dialog>
  );
}
