import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Plus, Shuffle } from 'lucide-react';
import { updateContent, useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, setMe, useMe } from '../../data/people';
import type { Person, QuizAnswer, QuizQuestion } from '../../data/types';
import { PageHeader, TextArea, TextField } from '../../components/ui/Fields';
import { Dialog } from '../../components/ui/Dialog';
import { celebrateFrom, toast } from '../../components/ui/feedback';
import { SiteFooter } from '../../components/common/SiteFooter';
import { createId, hashUnit, nowIso } from '../../lib/id';
import { playSfx } from '../../lib/audio/sfx';
import './quiz.css';

/** Questions about yourself, so the other can guess. Our own can be added. */
export const STARTER_QUESTIONS: { id: string; text: string }[] = [
  { id: 'q-food', text: 'Wat is mijn lievelingseten?' },
  { id: 'q-colour', text: 'Wat is mijn lievelingskleur?' },
  { id: 'q-trip', text: 'Waar zou ik het liefst samen op reis gaan?' },
  { id: 'q-snack', text: 'Wat is mijn favoriete snack?' },
  { id: 'q-song', text: 'Welk liedje zit altijd in mijn hoofd?' },
  { id: 'q-morning', text: 'Wat doe ik als eerste als ik wakker word?' },
  { id: 'q-dream-job', text: 'Wat is mijn droombaan?' },
  { id: 'q-series', text: 'Wat is mijn lievelingsfilm of -serie?' },
  { id: 'q-happy', text: 'Waar word ik meteen blij van?' },
  { id: 'q-memory', text: 'Wat is mijn favoriete herinnering van ons?' },
  { id: 'q-animal', text: 'Welk dier zou ik zijn?' },
  { id: 'q-date', text: 'Mijn ideale date is…' },
  { id: 'q-never', text: 'Wat zou ik nooit eten?' },
  { id: 'q-talent', text: 'Wat is mijn verborgen talent?' },
  { id: 'q-proud', text: 'Waar ben ik stiekem trots op?' },
  { id: 'q-grumpy', text: 'Waar word ik chagrijnig van?' },
  { id: 'q-drink', text: 'Koffie, thee of matcha?' },
  { id: 'q-first', text: 'Wat viel mij als eerste aan jou op?' },
  { id: 'q-fear', text: 'Waar ben ik bang voor?' },
  { id: 'q-sunday', text: 'Mijn perfecte zondag ziet eruit als…' },
];

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

/** Points for how well `who` knows the other: right 1, close ½. */
function score(answers: QuizAnswer[], who: Person): number {
  return answers
    .filter((a) => a.who === who)
    .reduce((n, a) => n + (a.judged === 'right' ? 1 : a.judged === 'close' ? 0.5 : 0), 0);
}

export function QuizPage() {
  const quiz = useContent((c) => c.quiz);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const known = getAuthor() !== undefined;
  const them = otherPerson(me);
  const myName = nameOf(me, profile);
  const theirName = nameOf(them, profile);
  const [adding, setAdding] = useState(false);
  const [skip, setSkip] = useState(0);

  const questions: QuizQuestion[] = [
    ...STARTER_QUESTIONS.map((q) => ({ ...q, createdAt: '' })),
    ...quiz.custom,
  ];
  const find = (q: string, who: Person) => quiz.answers.find((a) => a.id === answerId(q, who));
  const mineDone = (q: string) => {
    const a = find(q, me);
    return Boolean(a?.self && a?.guess);
  };
  const open = questions.filter((q) => !mineDone(q.id));
  const next = open.length
    ? open[(Math.floor(hashUnit('quiz') * open.length) + skip) % open.length]
    : null;
  const both = questions.filter(
    (q) => mineDone(q.id) && find(q.id, them)?.self && find(q.id, them)?.guess,
  );
  const waiting = questions.filter((q) => mineDone(q.id) && !both.includes(q)).length;

  if (!known) {
    return (
      <div className="page quiz">
        <PageHeader
          eyebrow="spelletje"
          title="Wie kent wie het best?"
          lede="Eerst even: wie ben jij?"
        />
        <div className="quiz-who">
          <button type="button" className="btn btn--primary" onClick={() => setMe('you')}>
            Ik ben {profile.yourName}
          </button>
          <button type="button" className="btn btn--primary" onClick={() => setMe('partner')}>
            Ik ben {profile.partnerName}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page quiz">
      <PageHeader
        eyebrow="spelletje voor twee"
        title={
          <>
            Wie kent wie <em>het best?</em>
          </>
        }
        lede={`Beantwoord vragen over jezelf, en raad wat ${theirName} zou zeggen. Als jullie allebei klaar zijn, onthul je samen de antwoorden.`}
      />

      <section className="quiz-score" aria-label="Score">
        {(['you', 'partner'] as const).map((who) => (
          <div key={who} className={`quiz-score__side ${who === me ? 'is-me' : ''}`}>
            <span className="quiz-score__name">{nameOf(who, profile)}</span>
            <strong className="quiz-score__points">{score(quiz.answers, who)}</strong>
            <span className="quiz-score__label">punten</span>
          </div>
        ))}
        <span className="quiz-score__vs" aria-hidden="true">
          ♡
        </span>
      </section>

      {next ? (
        <QuestionCard
          key={next.id}
          question={next}
          me={me}
          theirName={theirName}
          existing={find(next.id, me)}
          onSkip={() => setSkip((s) => s + 1)}
        />
      ) : (
        <p className="notice notice--plain">
          <span>Je hebt alle vragen gehad! Voeg er zelf een paar toe hieronder. ✨</span>
        </p>
      )}

      {waiting > 0 && (
        <p className="quiz-waiting">
          ⏳ {waiting} {waiting === 1 ? 'vraag wacht' : 'vragen wachten'} nog op {theirName}.
        </p>
      )}

      {both.length > 0 && (
        <section aria-labelledby="reveal-title">
          <h2 id="reveal-title" className="quiz-title">
            Onthullen <span className="hand">{both.length}</span>
          </h2>
          <ul className="quiz-reveals">
            {both
              .slice()
              .reverse()
              .map((q) => (
                <Reveal
                  key={q.id}
                  question={q}
                  mine={find(q.id, me)!}
                  theirs={find(q.id, them)!}
                  myName={myName}
                  theirName={theirName}
                />
              ))}
          </ul>
        </section>
      )}

      <button type="button" className="btn btn--soft" onClick={() => setAdding(true)}>
        <Plus aria-hidden="true" /> Eigen vraag toevoegen
      </button>
      <AddQuestion open={adding} onClose={() => setAdding(false)} />
      <SiteFooter />
    </div>
  );
}

function QuestionCard({
  question,
  me,
  theirName,
  existing,
  onSkip,
}: {
  question: QuizQuestion;
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
        className={`quiz-card quiz-card--${step}`}
        onSubmit={submit}
        initial={{ opacity: 0, rotateY: -12, y: 10 }}
        animate={{ opacity: 1, rotateY: 0, y: 0 }}
        exit={{ opacity: 0, rotateY: 12 }}
        transition={{ duration: 0.3 }}
      >
        <p className="quiz-card__step">
          {step === 'self' ? 'stap 1 · over jezelf' : `stap 2 · raad wat ${theirName} zegt`}
        </p>
        <h2 className="quiz-card__q">{step === 'self' ? question.text : asThem}</h2>
        <TextField
          label={step === 'self' ? 'Jouw antwoord' : `Wat zegt ${theirName}?`}
          value={text}
          onChange={setText}
          maxLength={200}
          autoFocus
        />
        <div className="quiz-card__actions">
          {step === 'self' && (
            <button type="button" className="btn btn--ghost btn--small" onClick={onSkip}>
              <Shuffle aria-hidden="true" /> Andere vraag
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
            {step === 'self' ? 'Volgende' : 'Klaar'}
          </button>
        </div>
      </motion.form>
    </AnimatePresence>
  );
}

function Reveal({
  question,
  mine,
  theirs,
  myName,
  theirName,
}: {
  question: QuizQuestion;
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
    <li className="quiz-reveal">
      <p className="quiz-reveal__q">{question.text}</p>
      {!shown ? (
        <button
          type="button"
          className="btn btn--primary btn--small"
          data-sfx="sparkle"
          onClick={() => setShown(true)}
        >
          Onthul ✨
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <div className="quiz-reveal__row">
            <span>
              <small>{myName} zei</small>
              <strong>{mine.self}</strong>
            </span>
            <span>
              <small>{theirName} gokte</small>
              <strong>{theirs.guess}</strong>
            </span>
          </div>
          <div
            className="quiz-reveal__judge"
            role="group"
            aria-label={`Klopt de gok van ${theirName}?`}
          >
            {(
              [
                ['right', 'Goed! ✓'],
                ['close', 'Bijna'],
                ['wrong', 'Fout'],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className="chip"
                data-sfx="none"
                aria-pressed={theirs.judged === v}
                onClick={(e) => judge(v, e.currentTarget)}
              >
                {v === 'right' && auto && !theirs.judged ? <Check aria-hidden="true" /> : null}
                {label}
              </button>
            ))}
          </div>
          <div className="quiz-reveal__row quiz-reveal__row--other">
            <span>
              <small>{theirName} zei</small>
              <strong>{theirs.self}</strong>
            </span>
            <span>
              <small>jij gokte</small>
              <strong>{mine.guess}</strong>
            </span>
          </div>
          <p className="quiz-reveal__verdict">
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
