import { useMemo, useState } from 'react';
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
import { ChatBarButton, PresencePill } from '../chat/ArcadeChat';
import {
  CATEGORIES,
  SCALES,
  STARTER_QUESTIONS,
  THIS_OR_THAT,
  WHO_OF_US,
  categoryOf,
  kindOf,
  type Category,
} from './questions';
import '../games/arcade.css';
import './quiz.css';

export { CATEGORIES, SCALES, STARTER_QUESTIONS, THIS_OR_THAT, WHO_OF_US };

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

/** Verbs as they come before "ik" in our questions, and how they go with a name. */
const VERB_FOR_NAME: Record<string, string> = {
  ben: 'is',
  heb: 'heeft',
  word: 'wordt',
  doe: 'doet',
  ga: 'gaat',
  sta: 'staat',
  zie: 'ziet',
  kan: 'kan',
  kun: 'kan',
  zou: 'zou',
  wil: 'wil',
  mag: 'mag',
  moet: 'moet',
  hou: 'houdt',
  houd: 'houdt',
  vind: 'vindt',
  vond: 'vond',
  weet: 'weet',
  vergeet: 'vergeet',
  smelt: 'smelt',
  heet: 'heet',
  eet: 'eet',
};

/** Any other verb: the stem gets a t (unless it already ends in one). */
const withT = (stem: string) =>
  /[td]$/.test(stem) ? (stem.endsWith('d') ? `${stem}t` : stem) : `${stem}t`;

/** Words that can stand before "ik" without being its verb. */
const NOT_VERBS = new Set([
  'dat',
  'als',
  'of',
  'voor',
  'wat',
  'waar',
  'toen',
  'omdat',
  'want',
  'en',
]);

/** "Waar ben ik bang voor?" → "Waar is Shenaya bang voor?" */
export function guessWording(text: string, name: string): string {
  return (
    text
      // "word ik", "kies ik", "vind ik" → "wordt Shenaya", "kiest Shenaya", "vindt Shenaya"
      .replace(/\b([A-Za-zÀ-ÿ]+) ik\b/g, (_all, verb: string) => {
        const lower = verb.toLowerCase();
        if (NOT_VERBS.has(lower)) return `${verb} ${name}`;
        const to = VERB_FOR_NAME[lower] ?? withT(lower);
        const cased = verb[0] === verb[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
        return `${cased} ${name}`;
      })
      .replace(/\bik ben\b/gi, `${name} is`)
      .replace(/\bik heb\b/gi, `${name} heeft`)
      // Dutch: Valencio's, Shenaya's — but Robs.
      .replace(/\bmijn\b/gi, /[aeiouy]$/i.test(name) ? `${name}’s` : `${name}s`)
      .replace(/\bmij\b/gi, name)
      .replace(/\bik\b/gi, name)
  );
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
 * as the other judged it. Dit-of-dat and wie-van-ons: 1 when the guess matches
 * their pick. Schaal: 1 spot on, ½ one off.
 */
export function score(answers: QuizAnswer[], who: Person): number {
  const them = otherPerson(who);
  return answers
    .filter((a) => a.who === who)
    .reduce(
      (n, a) =>
        n +
        (pointsFor(
          a,
          answers.find((x) => x.id === answerId(a.question, them)),
        ) ?? 0),
      0,
    );
}

/** What one guess earned (0, ½ or 1), or null while it's still open. */
export function pointsFor(mine: QuizAnswer, theirs?: QuizAnswer): number | null {
  if (!mine.guess) return null;
  const kind = kindOf(mine.question);
  if (kind === 'open')
    return mine.judged === 'right' ? 1 : mine.judged === 'close' ? 0.5 : mine.judged ? 0 : null;
  if (!theirs?.self) return null;
  if (kind === 'scale') {
    const off = Math.abs(Number(mine.guess) - Number(theirs.self));
    return off === 0 ? 1 : off === 1 ? 0.5 : 0;
  }
  return mine.guess === theirs.self ? 1 : 0;
}

/** How many guesses have an outcome yet (judged, or both picked in the quick rounds). */
export function decided(answers: QuizAnswer[]): number {
  return answers.filter(
    (a) =>
      pointsFor(
        a,
        answers.find((x) => x.id === answerId(a.question, otherPerson(a.who))),
      ) !== null,
  ).length;
}

/** How well we know each other per category: points out of guesses with an outcome. */
export function byCategory(answers: QuizAnswer[]) {
  const out = new Map<Category, { points: number; of: number }>();
  for (const a of answers) {
    const p = pointsFor(
      a,
      answers.find((x) => x.id === answerId(a.question, otherPerson(a.who))),
    );
    if (p === null) continue;
    const c = categoryOf(a.question);
    const cell = out.get(c) ?? { points: 0, of: 0 };
    out.set(c, { points: cell.points + p, of: cell.of + 1 });
  }
  return [...out.entries()]
    .map(([category, v]) => ({ category, ...v, pct: Math.round((v.points / v.of) * 100) }))
    .sort((a, b) => b.pct - a.pct || b.of - a.of);
}

type Tab = 'open' | 'quick' | 'scale' | 'who' | 'reveal';

const ROUNDS: { id: Exclude<Tab, 'reveal'>; label: string }[] = [
  { id: 'open', label: '📝 Vragen' },
  { id: 'quick', label: '⚡ Dit of dat' },
  { id: 'scale', label: '🎚️ Schaal' },
  { id: 'who', label: '👫 Wie van ons' },
];

interface AnyQuestion {
  id: string;
  category: Category;
}

/** The next one to do from a list: in the chosen category, a fresh pick each skip. */
function nextOf<T extends AnyQuestion>(list: T[], category: Category | 'all', skip: number) {
  const pool = category === 'all' ? list : list.filter((q) => q.category === category);
  if (!pool.length) return null;
  return pool[(Math.floor(hashUnit(`quiz-${category}`) * pool.length) + skip) % pool.length];
}

function CategoryBar({
  list,
  value,
  onChange,
}: {
  list: AnyQuestion[];
  value: Category | 'all';
  onChange: (c: Category | 'all') => void;
}) {
  const counts = new Map<Category, number>();
  for (const q of list) counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  const cats = (Object.keys(CATEGORIES) as Category[]).filter((c) => counts.get(c));
  return (
    <div className="show-cats" role="group" aria-label="Categorie">
      <button
        type="button"
        className={`show-cat ${value === 'all' ? 'is-on' : ''}`}
        aria-pressed={value === 'all'}
        onClick={() => onChange('all')}
      >
        🎲 Alles <small>{list.length}</small>
      </button>
      {cats.map((c) => (
        <button
          key={c}
          type="button"
          className={`show-cat ${value === c ? 'is-on' : ''}`}
          style={{ '--c': CATEGORIES[c].color } as React.CSSProperties}
          aria-pressed={value === c}
          onClick={() => onChange(c)}
        >
          <span aria-hidden="true">{CATEGORIES[c].emoji}</span> {CATEGORIES[c].label}{' '}
          <small>{counts.get(c)}</small>
        </button>
      ))}
    </div>
  );
}

export function QuizPage() {
  useAmbience('arcade');
  return (
    <div className="page arcade-zone game game--quiz show">
      <div className="game__bar">
        <a className="game__back" href={href('/games')}>
          <ArrowLeft aria-hidden="true" /> Arcade Hall
        </a>
        <ChatBarButton />
      </div>
      <PresencePill game="quiz" />
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
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [skip, setSkip] = useState(0);

  const questions: (QuizQuestion & { category: Category })[] = useMemo(
    () => [
      ...STARTER_QUESTIONS.map((q) => ({ ...q, createdAt: '' })),
      ...quiz.custom.map((q) => ({ ...q, category: 'own' as const })),
    ],
    [quiz.custom],
  );
  const find = (q: string, who: Person) => quiz.answers.find((a) => a.id === answerId(q, who));
  const done = (q: string, who: Person) => Boolean(find(q, who)?.self && find(q, who)?.guess);

  const left = {
    open: questions.filter((q) => !done(q.id, me)),
    quick: THIS_OR_THAT.filter((q) => !done(q.id, me)),
    scale: SCALES.filter((q) => !done(q.id, me)),
    who: WHO_OF_US.filter((q) => !done(q.id, me)),
  };
  const all = questions.length + THIS_OR_THAT.length + SCALES.length + WHO_OF_US.length;
  const doneByMe = all - left.open.length - left.quick.length - left.scale.length - left.who.length;

  const both = <T extends AnyQuestion>(list: T[]) =>
    list.filter((q) => done(q.id, me) && done(q.id, them));
  const reveals = both(questions);
  const unjudged = reveals.filter((q) => !find(q.id, them)?.judged).length;
  const waiting = [...questions, ...THIS_OR_THAT, ...SCALES, ...WHO_OF_US].filter(
    (q) => done(q.id, me) && !done(q.id, them),
  ).length;

  const points = { you: score(quiz.answers, 'you'), partner: score(quiz.answers, 'partner') };
  const outcomes = decided(quiz.answers);
  const meter = outcomes ? Math.round(((points.you + points.partner) / outcomes) * 100) : null;
  const leader =
    points.you === points.partner ? null : points.you > points.partner ? 'you' : 'partner';
  const cats = byCategory(quiz.answers).filter((c) => c.of >= 2);

  const host = !quiz.answers.length
    ? `Welkom bij Wie kent wie? Ik ben jullie presentator, Coco! 🎤 ${all} vragen in ${Object.keys(CATEGORIES).length - 1} categorieën.`
    : unjudged > 0
      ? `Er ${unjudged === 1 ? 'ligt 1 antwoord' : `liggen ${unjudged} antwoorden`} klaar om te onthullen! 🥁`
      : cats.length >= 2 && hashUnit(`host-${outcomes}`) < 0.4
        ? `Jullie kennen elkaar het best bij ${CATEGORIES[cats[0].category].emoji} ${CATEGORIES[cats[0].category].label} (${cats[0].pct}%)!`
        : waiting > 0
          ? `Spannend… ${theirName} moet nog ${waiting} ${waiting === 1 ? 'vraag' : 'vragen'} doen.`
          : leader
            ? `${nameOf(leader, profile)} staat voor met ${points[leader]} punten! 👑`
            : 'Gelijkspel! Wie pakt de volgende punt? ✨';

  const roundList: AnyQuestion[] = tab === 'reveal' ? [] : left[tab];
  // a category with nothing left in this round falls back to all
  const cat =
    category !== 'all' && !roundList.some((q) => q.category === category) ? 'all' : category;
  const next = tab === 'reveal' ? null : nextOf(roundList, cat, skip);

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

      <p className="show-progress">
        <span className="show-progress__bar" aria-hidden="true">
          <span style={{ width: `${(doneByMe / all) * 100}%` }} />
        </span>
        <span>
          Jij deed er <strong>{doneByMe}</strong> van de {all} vragen
        </span>
      </p>

      <div className="show-rounds" role="tablist" aria-label="Rondes">
        {[...ROUNDS, { id: 'reveal' as const, label: '🥁 Onthullen' }].map(({ id, label }) => {
          const n = id === 'reveal' ? unjudged : left[id].length;
          return (
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
                setSkip(0);
              }}
            >
              {label}
              {n > 0 && <span className="show-badge">{n}</span>}
            </button>
          );
        })}
      </div>

      {tab !== 'reveal' && roundList.length > 0 && (
        <CategoryBar
          list={roundList}
          value={cat}
          onChange={(c) => {
            playSfx('tap', true);
            setCategory(c);
            setSkip(0);
          }}
        />
      )}

      {tab === 'open' &&
        (next ? (
          <QuestionCard
            key={next.id}
            question={next as unknown as QuizQuestion}
            category={next.category}
            number={questions.length - left.open.length + 1}
            total={questions.length}
            me={me}
            theirName={theirName}
            existing={find(next.id, me)}
            onSkip={() => setSkip((s) => s + 1)}
          />
        ) : (
          <p className="game-panel">Je hebt alle vragen gehad! Voeg er zelf een paar toe. ✨</p>
        ))}

      {(tab === 'quick' || tab === 'who') &&
        (next ? (
          <ChoiceCard
            key={next.id}
            kind={tab}
            q={next as unknown as (typeof THIS_OR_THAT)[number] | (typeof WHO_OF_US)[number]}
            number={(tab === 'quick' ? THIS_OR_THAT : WHO_OF_US).length - roundList.length + 1}
            total={(tab === 'quick' ? THIS_OR_THAT : WHO_OF_US).length}
            me={me}
            myName={myName}
            theirName={theirName}
            existing={find(next.id, me)}
            onSkip={() => setSkip((s) => s + 1)}
          />
        ) : (
          <p className="game-panel">Allemaal gedaan! Kijk bij Onthullen. 🥁</p>
        ))}

      {tab === 'scale' &&
        (next ? (
          <ScaleCard
            key={next.id}
            q={next as unknown as (typeof SCALES)[number]}
            number={SCALES.length - roundList.length + 1}
            total={SCALES.length}
            me={me}
            theirName={theirName}
            existing={find(next.id, me)}
            onSkip={() => setSkip((s) => s + 1)}
          />
        ) : (
          <p className="game-panel">Alle schaalvragen gedaan! Kijk bij Onthullen. 🥁</p>
        ))}

      {tab === 'reveal' && (
        <section aria-label="Onthullen" className="show-reveals">
          {cats.length > 0 && (
            <div className="show-cats-score">
              <h2 className="show-h">🏆 Hoe goed kennen jullie elkaar?</h2>
              <ul>
                {cats.slice(0, 6).map((c) => (
                  <li key={c.category}>
                    <span>
                      {CATEGORIES[c.category].emoji} {CATEGORIES[c.category].label}
                    </span>
                    <span className="show-cats-score__bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${c.pct}%`,
                          background: CATEGORIES[c.category].color,
                        }}
                      />
                    </span>
                    <strong>{c.pct}%</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {reveals.length +
            both(THIS_OR_THAT).length +
            both(SCALES).length +
            both(WHO_OF_US).length ===
            0 && (
            <p className="game-panel">
              Nog niks te onthullen. Zodra jullie allebei een vraag hebben gedaan, staat hij hier
              klaar.
            </p>
          )}
          {reveals.length > 0 && (
            <>
              <h2 className="show-h">📝 Vragen</h2>
              <ul className="show-list">
                {reveals
                  .slice()
                  .reverse()
                  .slice(0, 40)
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
            </>
          )}
          <PickReveals
            title="⚡ Dit of dat"
            items={both(THIS_OR_THAT).map((q) => ({ id: q.id, label: `${q.a} of ${q.b}` }))}
            find={find}
            me={me}
            myName={myName}
            theirName={theirName}
            show={(v) => v}
          />
          <PickReveals
            title="🎚️ Schaal"
            items={both(SCALES).map((q) => ({ id: q.id, label: q.text }))}
            find={find}
            me={me}
            myName={myName}
            theirName={theirName}
            show={(v) => `${v}/10`}
            near
          />
          <PickReveals
            title="👫 Wie van ons"
            items={both(WHO_OF_US).map((q) => ({ id: q.id, label: q.text }))}
            find={find}
            me={me}
            myName={myName}
            theirName={theirName}
            show={(v) => nameOf(v as Person, profile)}
          />
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
      <span aria-hidden="true">{CATEGORIES[category].emoji}</span> {CATEGORIES[category].label}
    </span>
  );
}

/** Dit of dat, or Wie van ons: pick one, then guess what the other picked. */
function ChoiceCard({
  kind,
  q,
  number,
  total,
  me,
  myName,
  theirName,
  existing,
  onSkip,
}: {
  kind: 'quick' | 'who';
  q: { id: string; category: Category; a?: string; b?: string; text?: string };
  number: number;
  total: number;
  me: Person;
  myName: string;
  theirName: string;
  existing?: QuizAnswer;
  onSkip: () => void;
}) {
  const step = existing?.self ? 'guess' : 'self';
  const them = otherPerson(me);
  // Wie van ons is stored as you/partner, so it reads right on both phones.
  const options =
    kind === 'who'
      ? [
          { value: me as string, label: step === 'self' ? `Ik (${myName})` : myName },
          { value: them as string, label: theirName },
        ]
      : [
          { value: q.a!, label: q.a! },
          { value: q.b!, label: q.b! },
        ];
  const choose = (choice: string, el: HTMLElement) => {
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
          <CategoryChip category={q.category} />
          <span className="show-card__count">
            {Math.min(number, total)}/{total}
          </span>
        </div>
        {kind === 'who' && <p className="show-card__step">{q.text}</p>}
        <h2 className="show-card__q">
          {step === 'self'
            ? kind === 'who'
              ? 'Wie van jullie, vind jij?'
              : 'Wat kies jij?'
            : `Wat koos ${theirName}?`}
        </h2>
        <div className="show-vs">
          <button
            type="button"
            className="show-pick show-pick--a"
            data-sfx="none"
            onClick={(e) => choose(options[0].value, e.currentTarget)}
          >
            {options[0].label}
          </button>
          <span className="show-vs__or" aria-hidden="true">
            of
          </span>
          <button
            type="button"
            className="show-pick show-pick--b"
            data-sfx="none"
            onClick={(e) => choose(options[1].value, e.currentTarget)}
          >
            {options[1].label}
          </button>
        </div>
        {step === 'self' && (
          <button type="button" className="neon-btn neon-btn--small show-skip" onClick={onSkip}>
            <Shuffle aria-hidden="true" /> Andere vraag
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Schaal: a number from 1 to 10 about yourself, then a guess of theirs. */
function ScaleCard({
  q,
  number,
  total,
  me,
  theirName,
  existing,
  onSkip,
}: {
  q: (typeof SCALES)[number];
  number: number;
  total: number;
  me: Person;
  theirName: string;
  existing?: QuizAnswer;
  onSkip: () => void;
}) {
  const step = existing?.self ? 'guess' : 'self';
  const [value, setValue] = useState(5);
  const save = (el: HTMLElement) => {
    if (step === 'self') {
      saveAnswer(q.id, me, { self: String(value) });
      playSfx('pop', true);
      setValue(5);
    } else {
      saveAnswer(q.id, me, { guess: String(value) });
      playSfx('sparkle', true);
      celebrateFrom(el);
    }
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        className="show-card show-card--scale"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="show-card__top">
          <CategoryChip category={q.category} />
          <span className="show-card__count">
            {Math.min(number, total)}/{total}
          </span>
        </div>
        <p className="show-card__step">
          {step === 'self' ? 'stap 1 · over jezelf' : `stap 2 · raad wat ${theirName} zei`}
        </p>
        <h2 className="show-card__q">
          {step === 'self' ? q.text : guessWording(q.text, theirName)}
        </h2>
        <p className="show-scale__value" aria-hidden="true">
          {value}
        </p>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="show-scale"
          aria-label={step === 'self' ? 'Jouw getal van 1 tot 10' : `Het getal van ${theirName}`}
          aria-valuetext={`${value} van 10`}
        />
        <div className="show-scale__ends" aria-hidden="true">
          <span>1 · {q.low}</span>
          <span>{q.high} · 10</span>
        </div>
        <div className="game-actions">
          {step === 'self' && (
            <button type="button" className="neon-btn neon-btn--small show-skip" onClick={onSkip}>
              <Shuffle aria-hidden="true" /> Andere vraag
            </button>
          )}
          <button type="button" className="neon-btn" onClick={(e) => save(e.currentTarget)}>
            {step === 'self' ? 'Volgende' : 'Klaar!'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/** The quick rounds, revealed: what each of us picked, and whether the other knew. */
function PickReveals({
  title,
  items,
  find,
  me,
  myName,
  theirName,
  show,
  near = false,
}: {
  title: string;
  items: { id: string; label: string }[];
  find: (q: string, who: Person) => QuizAnswer | undefined;
  me: Person;
  myName: string;
  theirName: string;
  show: (value: string) => string;
  near?: boolean;
}) {
  const [all, setAll] = useState(false);
  if (!items.length) return null;
  const them = otherPerson(me);
  const shown = all ? items : items.slice(-12);
  const mark = (p: number | null) => (p === 1 ? '✓' : p === 0.5 && near ? '≈' : '✗');
  return (
    <div className="show-quick">
      <h2 className="show-h">{title}</h2>
      <ul className="show-quick__list">
        {shown
          .slice()
          .reverse()
          .map((q) => {
            const mine = find(q.id, me)!;
            const theirs = find(q.id, them)!;
            const iKnew = pointsFor(mine, theirs);
            const theyKnew = pointsFor(theirs, mine);
            return (
              <li key={q.id} className="show-quick__row">
                <span className="show-quick__q">{q.label}</span>
                <span className={`show-quick__who ${theyKnew ? 'is-right' : 'is-wrong'}`}>
                  <small>{myName}</small>
                  {show(mine.self!)} {mark(theyKnew)}
                </span>
                <span className={`show-quick__who ${iKnew ? 'is-right' : 'is-wrong'}`}>
                  <small>{theirName}</small>
                  {show(theirs.self!)} {mark(iKnew)}
                </span>
              </li>
            );
          })}
      </ul>
      {items.length > 12 && !all && (
        <button type="button" className="neon-btn neon-btn--small" onClick={() => setAll(true)}>
          Toon alle {items.length}
        </button>
      )}
      <p className="game-hint">
        ✓ betekent: de ander raadde het goed{near ? ' (≈ één ernaast)' : ''}.
      </p>
    </div>
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
