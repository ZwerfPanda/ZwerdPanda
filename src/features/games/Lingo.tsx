import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Delete, CornerDownLeft } from 'lucide-react';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { createId } from '../../lib/id';
import { GameShell, ScoreBoard, type PlayMode } from './GameShell';
import { DUEL_LABELS, DuelPanel, useDuelRound } from './DuelPanel';
import { TicketStrip } from './TicketStrip';
import { RoundCard } from './RoundCard';
import { addScore, useBest } from './gameData';
import { recordResult } from './gameStats';
import { planDuel } from './duel';
import {
  ROUND_WORDS,
  TRIES,
  WORD_LENGTH,
  cocoLingo,
  judge,
  letterHints,
  roundWords,
  wordPoints,
  type Mark,
} from './lingo';
import './lingo.css';

const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

interface WordPlay {
  word: string;
  guesses: string[];
  /** Guessed in this many tries (null: not guessed, or not yet). */
  tries: number | null;
  points: number;
  done: boolean;
}

function Row({
  guess,
  word,
  reveal,
  typing,
  first,
}: {
  guess: string;
  word: string;
  reveal: boolean;
  typing?: boolean;
  first?: string;
}) {
  const reduce = useReducedMotion();
  const marks: Mark[] | null = reveal ? judge(guess, word) : null;
  return (
    <div className={`lingo-row${typing ? ' is-typing' : ''}`}>
      {Array.from({ length: WORD_LENGTH }, (_, i) => {
        const ch = guess[i] ?? (typing && i === 0 ? first : '') ?? '';
        const m = marks?.[i];
        return (
          <motion.span
            key={`${i}-${reveal}`}
            className={`lingo-tile${m ? ` is-${m}` : ''}${!guess[i] && typing && i === 0 ? ' is-given' : ''}`}
            initial={reveal && !reduce ? { rotateX: 90 } : false}
            animate={{ rotateX: 0 }}
            transition={{ delay: i * 0.12, duration: 0.25 }}
          >
            {m === 'near' && <span className="lingo-ring" aria-hidden="true" />}
            <span className="lingo-letter">{ch.toUpperCase()}</span>
          </motion.span>
        );
      })}
      {marks && (
        <span className="visually-hidden">
          {guess}:{' '}
          {marks
            .map(
              (m, i) => `${guess[i]} ${m === 'right' ? 'goed' : m === 'near' ? 'elders' : 'niet'}`,
            )
            .join(', ')}
        </span>
      )}
    </div>
  );
}

export function Lingo() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const matches = useContent((c) => c.games.matches);
  const best = useBest('lingo');
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<PlayMode>('remote');
  const duel = useDuelRound('lingo', mode);
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [words, setWords] = useState<WordPlay[]>([]);
  const [at, setAt] = useState(0);
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(0);
  const [line, setLine] = useState('');
  const [tickets, setTickets] = useState<number | null>(null);
  const [cocoScore, setCocoScore] = useState<number | null>(null);
  const [handOver, setHandOver] = useState(false);
  const [record, setRecord] = useState(false);
  const [float, setFloat] = useState<{ id: number; text: string } | null>(null);
  const seed = useRef('');
  const started = useRef(0);
  const stage = useRef<HTMLDivElement>(null);

  const plan = mode === 'remote' && getAuthor() ? planDuel(matches, 'lingo', me) : null;
  const answering = plan?.type === 'answer' ? matches.find((m) => m.id === plan.id) : undefined;
  const total = words.reduce((n, w) => n + w.points, 0);
  const current = words[at];

  const begin = () => {
    // In a duel we answer, the same words the other had; otherwise new ones.
    const theirSeed = answering?.state.seed;
    seed.current = typeof theirSeed === 'string' ? theirSeed : createId('lingo');
    setWords(
      roundWords(seed.current).map((word) => ({
        word,
        guesses: [],
        tries: null,
        points: 0,
        done: false,
      })),
    );
    setAt(0);
    setInput('');
    setTickets(null);
    setCocoScore(null);
    setHandOver(false);
    setRecord(false);
    setPhase('play');
    started.current = performance.now();
    setLine(`Woord 1 van ${ROUND_WORDS} — de eerste letter krijg je cadeau`);
    playSfx('chime', true);
  };

  const finish = (all: WordPlay[]) => {
    setPhase('done');
    const score = all.reduce((n, w) => n + w.points, 0);
    const myBest = mode === 'local' ? null : best[me];
    setRecord(myBest !== null && myBest !== undefined && score > myBest);
    if (mode !== 'coco') {
      const end = duel.finish(score, { seed: seed.current });
      setLine(end.text);
      setTickets(end.tickets);
      setHandOver(Boolean(end.handOver));
      if (end.tickets) celebrateFrom(stage.current);
      return;
    }
    if (getAuthor()) addScore('lingo', score);
    const coco = cocoLingo();
    setCocoScore(coco);
    addScore('lingo', coco, 'coco');
    const winner = score > coco ? me : score < coco ? 'coco' : 'draw';
    recordResult('lingo', [me, 'coco'], winner);
    playSfx(winner === me ? 'success' : 'coin', true);
    setLine(
      winner === me
        ? `Jij wint! ${score} tegen ${coco} 🎉`
        : winner === 'coco'
          ? `Coco wint met ${coco} tegen ${score} 🐰📚`
          : `Gelijk! ${score}–${coco}`,
    );
  };

  const submit = () => {
    if (!current || current.done) return;
    const guess = input.toLowerCase();
    if (guess.length !== WORD_LENGTH) {
      setShake((n) => n + 1);
      playSfx('error', true);
      return;
    }
    const guesses = [...current.guesses, guess];
    const right = guess === current.word;
    const secs = (performance.now() - started.current) / 1000;
    const out: WordPlay = right
      ? {
          ...current,
          guesses,
          tries: guesses.length,
          points: wordPoints(guesses.length, secs),
          done: true,
        }
      : guesses.length >= TRIES
        ? { ...current, guesses, tries: null, points: 0, done: true }
        : { ...current, guesses };
    const all = words.map((w, i) => (i === at ? out : w));
    setWords(all);
    setInput('');
    if (right) {
      playSfx('success', true);
      setFloat({ id: performance.now(), text: `+${out.points}` });
      setLine(
        `Goed! ${current.word.toUpperCase()} ${guesses.length === 1 ? 'in één keer! 🤯' : `in ${guesses.length} pogingen 🟥`}`,
      );
    } else if (out.done) {
      playSfx('boing', true);
      setLine(`Helaas — het woord was ${current.word.toUpperCase()}`);
    } else playSfx('tap', true);
    if (out.done) {
      window.setTimeout(
        () => {
          if (at + 1 >= ROUND_WORDS) return finish(all);
          setAt(at + 1);
          started.current = performance.now();
          setLine(`Woord ${at + 2} van ${ROUND_WORDS}`);
        },
        reduce ? 300 : 1500,
      );
    }
  };

  const type = (ch: string) => {
    if (!current || current.done || phase !== 'play') return;
    setInput((v) => {
      // The first letter is given: typing starts after it (or with it).
      const base = v || current.word[0];
      if (!v && ch === current.word[0]) return ch;
      return base.length >= WORD_LENGTH ? base : base + ch;
    });
  };
  const back = () => setInput((v) => (v.length <= 1 ? '' : v.slice(0, -1)));

  // A real keyboard works too.
  useEffect(() => {
    if (phase !== 'play') return;
    const key = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('input, textarea, [role="dialog"]') || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') back();
      else if (/^[a-zA-Z]$/.test(e.key)) type(e.key.toLowerCase());
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  useEffect(() => {
    if (!float) return;
    const t = window.setTimeout(() => setFloat(null), 1200);
    return () => window.clearTimeout(t);
  }, [float]);

  const hints = current ? letterHints(current.guesses, current.word) : new Map<string, Mark>();
  const restart = (keepDuel = false) => {
    if (!keepDuel) duel.reset();
    setPhase('ready');
    setWords([]);
    setLine(keepDuel ? `Nu ${nameOf(duel.player, profile)}!` : '');
  };

  return (
    <GameShell
      id="lingo"
      title="Lingo"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        restart();
      }}
      modes={['remote', 'local', 'coco']}
      labels={DUEL_LABELS}
      score={
        <ScoreBoard
          label="records"
          entries={[
            { name: profile.yourName.toUpperCase(), value: best.you ?? '---', me: me === 'you' },
            {
              name: profile.partnerName.toUpperCase(),
              value: best.partner ?? '---',
              me: me === 'partner',
            },
            { name: 'COCO', value: best.coco ?? '---' },
          ]}
        />
      }
    >
      <DuelPanel kind="lingo" mode={mode} first={duel.first} result={duel.result} />
      <div className="lingo-studio" ref={stage}>
        <div className="lingo-logo" aria-hidden="true">
          {'LINGO'.split('').map((l, i) => (
            <span key={i} className={i % 2 ? 'is-blue' : 'is-yellow'}>
              {l}
            </span>
          ))}
        </div>

        {phase === 'ready' ? (
          <div className="lingo-intro">
            <p>
              Vijf woorden van vijf letters. De eerste letter krijg je. Een{' '}
              <span className="lingo-key is-right">rood vakje</span> is goed, een{' '}
              <span className="lingo-key is-near">gele cirkel</span> zit erin maar op een andere
              plek.
            </p>
            <p className="lingo-intro__small">
              {answering
                ? `Je krijgt precies dezelfde woorden als ${nameOf(them, profile)} had.`
                : 'Hoe sneller je het raadt, hoe meer punten.'}
            </p>
            <button type="button" className="lingo-go" onClick={begin}>
              {mode === 'local' && duel.first !== null
                ? `Start, ${nameOf(duel.player, profile)}!`
                : 'Start de ronde'}
            </button>
          </div>
        ) : (
          <>
            <div className="lingo-top">
              <span
                className="lingo-dots"
                role="img"
                aria-label={`Woord ${Math.min(at + 1, ROUND_WORDS)} van ${ROUND_WORDS}`}
              >
                {words.map((w, i) => (
                  <span
                    key={i}
                    className={w.done ? (w.tries ? 'is-won' : 'is-lost') : i === at ? 'is-now' : ''}
                  />
                ))}
              </span>
              <span className="lingo-score">{String(total).padStart(3, '0')}</span>
              {cocoScore !== null && <span className="lingo-score is-coco">🐰 {cocoScore}</span>}
            </div>
            {current && (
              <motion.div
                key={`${at}-${shake}`}
                className="lingo-board"
                animate={shake && !reduce ? { x: [0, -8, 8, -5, 5, 0] } : {}}
                transition={{ duration: 0.35 }}
              >
                {Array.from({ length: TRIES }, (_, r) => {
                  const g = current.guesses[r];
                  if (g !== undefined) return <Row key={r} guess={g} word={current.word} reveal />;
                  if (r === current.guesses.length && !current.done)
                    return (
                      <Row
                        key={r}
                        guess={input}
                        word={current.word}
                        reveal={false}
                        typing
                        first={current.word[0]}
                      />
                    );
                  return <Row key={r} guess="" word={current.word} reveal={false} />;
                })}
                {current.done && !current.tries && (
                  <p className="lingo-answer">
                    Het woord was <strong>{current.word.toUpperCase()}</strong>
                  </p>
                )}
                <AnimatePresence>
                  {float && (
                    <motion.span
                      key={float.id}
                      className="lingo-float"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: -30 }}
                      exit={{ opacity: 0 }}
                    >
                      {float.text}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
            {phase === 'play' && (
              <div className="lingo-keys" role="group" aria-label="Toetsenbord">
                {KEYS.map((row, r) => (
                  <div key={row} className="lingo-keys__row">
                    {r === 2 && (
                      <button
                        type="button"
                        className="lingo-k lingo-k--wide"
                        onClick={back}
                        aria-label="Wissen"
                        data-sfx="none"
                      >
                        <Delete aria-hidden="true" />
                      </button>
                    )}
                    {row.split('').map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        className={`lingo-k${hints.get(ch) ? ` is-${hints.get(ch)}` : ''}`}
                        onClick={() => type(ch)}
                        data-sfx="none"
                      >
                        {ch.toUpperCase()}
                      </button>
                    ))}
                    {r === 2 && (
                      <button
                        type="button"
                        className="lingo-k lingo-k--wide lingo-k--go"
                        onClick={submit}
                        aria-label="Raden"
                        data-sfx="none"
                      >
                        <CornerDownLeft aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <p className="game-turn is-mine" aria-live="polite">
        {line}
      </p>
      <TicketStrip tickets={tickets} />
      {phase === 'done' && (
        <RoundCard
          title="Lingo!"
          score={total}
          record={record}
          stats={[
            {
              label: 'Geraden',
              value: `${words.filter((w) => w.tries).length} van ${ROUND_WORDS}`,
            },
            {
              label: 'Gemiddeld',
              value: (() => {
                const won = words.filter((w) => w.tries);
                return won.length
                  ? `${(won.reduce((n, w) => n + (w.tries ?? 0), 0) / won.length).toFixed(1)} pogingen`
                  : '—';
              })(),
            },
            { label: 'Woorden', value: words.map((w) => w.word.toUpperCase()).join(' · ') },
          ]}
        />
      )}
      {phase === 'done' &&
        (handOver ? (
          <button type="button" className="neon-btn" onClick={() => restart(true)}>
            Nu {nameOf(duel.player, profile)} ▶
          </button>
        ) : (
          <button type="button" className="neon-btn" onClick={() => restart()}>
            Nog een ronde
          </button>
        ))}
    </GameShell>
  );
}
