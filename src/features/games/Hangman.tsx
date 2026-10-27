import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import { TextField } from '../../components/ui/Fields';
import { CocoFigure } from '../../components/art/SampleArt';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';

export const MAX_WRONG = 7;
const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const ALL = ROWS.join('').split('');

/** Coco's words, each with her hint. */
const COCO_WORDS: { w: string; hint: string }[] = [
  { w: 'KNUFFEL', hint: 'Krijg ik graag van jullie' },
  { w: 'KUSJE', hint: 'Klein, maar o zo fijn' },
  { w: 'WORTELTJE', hint: 'Mijn lievelingssnack' },
  { w: 'MATCHA', hint: 'Groen drankje' },
  { w: 'ACHTBAAN', hint: 'Snel, hoog en gillen' },
  { w: 'POMPOEN', hint: 'Oranje, herfst' },
  { w: 'STERRENHEMEL', hint: 'Kijk ’s nachts omhoog' },
  { w: 'VAKANTIE', hint: 'Koffers mee' },
  { w: 'TREINREIS', hint: 'Halte na halte' },
  { w: 'VERLIEFD', hint: 'Vlinders in je buik' },
  { w: 'BIOSCOOP', hint: 'Groot scherm, popcorn' },
  { w: 'REUZENRAD', hint: 'Rondje boven de stad' },
  { w: 'BUBBELBAD', hint: 'Warm en borrelend' },
  { w: 'KERSTBOOM', hint: 'Lichtjes in december' },
  { w: 'NAGELLAK', hint: 'Voor tien kleine kunstwerkjes' },
  { w: 'AARDBEI', hint: 'Rood en zoet' },
  { w: 'VLINDERS', hint: 'Fladderen' },
  { w: 'PICKNICK', hint: 'Kleedje in het gras' },
  { w: 'REGENBOOG', hint: 'Na de regen' },
  { w: 'DOOLHOF', hint: 'Bij de pompoenen verdwaald' },
  { w: 'SUIKERSPIN', hint: 'Roze wolk op een stokje' },
  { w: 'HOOIBERG', hint: 'Mijn bed is ervan gemaakt' },
  { w: 'ZONSONDERGANG', hint: 'Oranje lucht' },
  { w: 'SNEEUWPOP', hint: 'Met een wortel als neus!' },
];

const clean = (s: string) =>
  s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const wrongCount = (word: string, guessed: string[]) =>
  guessed.filter((l) => !word.includes(l)).length;
export const solved = (word: string, guessed: string[]) =>
  word.split('').every((l) => l === ' ' || guessed.includes(l));

const COLORS = ['#ff5fa2', '#ffd75e', '#7fc8ff', '#7bdc8f', '#b07bff', '#ff9a5c', '#ff8cc0'];

/** A balloon popping: a ring of confetti flying out. */
function Pop({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r="2.4"
            fill={color}
            initial={{ opacity: 1 }}
            animate={{ cx: x + Math.cos(a) * 28, cy: y + Math.sin(a) * 28, opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          />
        );
      })}
    </g>
  );
}

/** Coco floating on balloons above the grass; a wrong letter pops one. */
function Sky({ left, state }: { left: number; state: 'playing' | 'won' | 'lost' }) {
  const reduce = useReducedMotion();
  const spots = COLORS.map((c, i) => ({
    c,
    x: (i - (MAX_WRONG - 1) / 2) * 24,
    y: -142 - (i % 2) * 20 - (i === 3 ? 12 : 0),
  }));
  const popped = spots.slice(left);
  const sink = state === 'lost' ? 40 : (MAX_WRONG - left) * 5;
  return (
    <svg viewBox="-130 -220 260 300" className="sky" aria-hidden="true">
      <defs>
        <linearGradient id="sky-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b2a7a" />
          <stop offset="0.55" stopColor="#ff8cc0" />
          <stop offset="1" stopColor="#ffd3a8" />
        </linearGradient>
        <radialGradient id="balloon-shine" cx="0.35" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="-130" y="-220" width="260" height="300" fill="url(#sky-g)" />
      {[
        [-90, -180, 1],
        [60, -120, 0.8],
        [-40, -70, 0.6],
      ].map(([x, y, s], i) => (
        <g key={i} className="sky__cloud" style={{ animationDelay: `${i * -6}s` }}>
          <g transform={`translate(${x} ${y}) scale(${s})`} fill="#fff" opacity="0.85">
            <ellipse cx="0" cy="0" rx="22" ry="10" />
            <ellipse cx="12" cy="-7" rx="13" ry="10" />
            <ellipse cx="-10" cy="-5" rx="10" ry="8" />
          </g>
        </g>
      ))}
      {[...Array(14)].map((_, i) => (
        <circle
          key={i}
          cx={-120 + ((i * 53) % 240)}
          cy={-210 + ((i * 37) % 60)}
          r="1"
          fill="#fff"
          opacity="0.7"
        />
      ))}
      <path d="M-130 60Q-60 40 0 52T130 48V80H-130Z" fill="#7bdc8f" />
      <path d="M-130 70Q-40 58 40 66T130 64V80H-130Z" fill="#5bbf72" />

      <motion.g
        animate={
          state === 'won'
            ? { y: -320 }
            : { y: sink, rotate: reduce || state === 'lost' ? 0 : [0, 2, 0, -2, 0] }
        }
        transition={
          state === 'won'
            ? { duration: 2.4, ease: 'easeIn' }
            : {
                y: { type: 'spring', stiffness: 70, damping: 11 },
                rotate: { repeat: Infinity, duration: 4 },
              }
        }
      >
        <AnimatePresence>
          {spots.slice(0, left).map((b, i) => (
            <motion.g
              key={b.c}
              className="sky__balloon"
              style={{ animationDelay: `${i * 0.35}s` }}
              exit={{ scale: 1.5, opacity: 0, transition: { duration: 0.12 } }}
            >
              <path
                d={`M${b.x} ${b.y + 24}Q${b.x * 0.5} ${b.y + 70} 0 -40`}
                stroke="#ffffffb0"
                strokeWidth="1.1"
                fill="none"
              />
              <ellipse cx={b.x} cy={b.y} rx="16" ry="20" fill={b.c} />
              <ellipse cx={b.x} cy={b.y} rx="16" ry="20" fill="url(#balloon-shine)" />
              <path d={`M${b.x - 3} ${b.y + 20}h6l-3 4z`} fill={b.c} />
            </motion.g>
          ))}
        </AnimatePresence>
        {popped.slice(-1).map((b) => (
          <Pop key={`${b.c}-${left}`} x={b.x} y={b.y} color={b.c} />
        ))}
        <CocoFigure x={0} y={-2} scale={0.55} blink />
        {state === 'won' &&
          [0, 1, 2].map((i) => (
            <motion.text
              key={i}
              x={-20 + i * 20}
              y={-40}
              fontSize="14"
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: [0, 1, 0], y: -80 }}
              transition={{ duration: 1.6, delay: i * 0.25, repeat: Infinity }}
            >
              ♥
            </motion.text>
          ))}
      </motion.g>
      {state === 'lost' && (
        <motion.text
          x="0"
          y="10"
          textAnchor="middle"
          fontSize="16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          💫
        </motion.text>
      )}
    </svg>
  );
}

function Board({
  word,
  guessed,
  hint,
  canPlay,
  onGuess,
}: {
  word: string;
  guessed: string[];
  hint?: string;
  canPlay: boolean;
  onGuess: (letter: string) => void;
}) {
  const wrong = wrongCount(word, guessed);
  const lost = wrong >= MAX_WRONG;
  const won = solved(word, guessed);
  const [shake, setShake] = useState(0);
  return (
    <div className="hangman">
      <Sky left={MAX_WRONG - wrong} state={won ? 'won' : lost ? 'lost' : 'playing'} />
      {hint && <p className="hangman__hint">💡 {hint}</p>}
      <p className="hangman__word" aria-label={won || lost ? word : 'Het woord'}>
        {word.split('').map((l, i) =>
          l === ' ' ? (
            <span key={i} className="hangman__space" />
          ) : (
            <span key={i} className="hangman__slot">
              <AnimatePresence>
                {(guessed.includes(l) || lost) && (
                  <motion.span
                    className={`hangman__letter ${lost && !guessed.includes(l) ? 'is-missed' : ''}`}
                    initial={{ rotateX: 90, opacity: 0 }}
                    animate={{ rotateX: 0, opacity: 1 }}
                    transition={{ duration: 0.35, delay: lost ? i * 0.05 : 0 }}
                  >
                    {l}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          ),
        )}
      </p>
      <p className="hangman__lives" aria-live="polite">
        {won
          ? 'Geraden! Coco zweeft de lucht in 🎈'
          : lost
            ? `Coco is zachtjes geland… het woord was ${word}`
            : `${'🎈'.repeat(MAX_WRONG - wrong)}`}
      </p>
      <div
        className={`hangman__keys ${shake ? 'is-shake' : ''}`}
        key={shake}
        role="group"
        aria-label="Letters"
      >
        {ROWS.map((row) => (
          <div key={row} className="hangman__row">
            {row.split('').map((l) => {
              const used = guessed.includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  className={`hangman__key ${used ? (word.includes(l) ? 'is-hit' : 'is-miss') : ''}`}
                  disabled={!canPlay || used || won || lost}
                  data-sfx="none"
                  onClick={() => {
                    if (!word.includes(l)) setShake((s) => s + 1);
                    onGuess(l);
                  }}
                >
                  {l}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const sounds = (word: string, next: string[], letter: string) => {
  if (word.includes(letter)) playSfx('sparkle', true);
  else playSfx('pop', true);
  if (solved(word, next)) {
    playSfx('success', true);
    celebrateFrom(document.querySelector('.hangman__word'));
  }
};

/** Coco picks the word (and gives a hint). */
function VsCoco() {
  const me = useMe();
  const [pick, setPick] = useState(() => COCO_WORDS[Math.floor(Math.random() * COCO_WORDS.length)]);
  const [guessed, setGuessed] = useState<string[]>([]);
  const done = solved(pick.w, guessed) || wrongCount(pick.w, guessed) >= MAX_WRONG;
  return (
    <>
      <TurnBanner mine name="Coco" note="Coco heeft een woord bedacht 🐰💭" />
      <Board
        word={pick.w}
        guessed={guessed}
        hint={pick.hint}
        canPlay={!done}
        onGuess={(l) => {
          const next = [...guessed, l];
          setGuessed(next);
          sounds(pick.w, next, l);
          if (solved(pick.w, next)) recordResult('hangman', [me, 'coco'], me);
          else if (wrongCount(pick.w, next) >= MAX_WRONG)
            recordResult('hangman', [me, 'coco'], 'coco');
        }}
      />
      <button
        type="button"
        className="neon-btn"
        onClick={() => {
          let next = pick;
          while (next.w === pick.w)
            next = COCO_WORDS[Math.floor(Math.random() * COCO_WORDS.length)];
          setPick(next);
          setGuessed([]);
        }}
      >
        Nieuw woord van Coco
      </button>
    </>
  );
}

function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const theirName = nameOf(them, profile);
  const match = useMatch('hangman');
  const [word, setWord] = useState('');
  const [hint, setHint] = useState('');
  const [choosing, setChoosing] = useState(false);

  const state = match?.state as
    | { word?: string; hint?: string; setter?: string; guessed?: string[] }
    | undefined;
  const secret = clean(state?.word ?? '');
  const guessed = (state?.guessed ?? []).filter((l) => ALL.includes(l));
  const iSet = state?.setter === me;

  if (!match || choosing) {
    return (
      <form
        className="game-panel"
        onSubmit={(e) => {
          e.preventDefault();
          const w = clean(word);
          if (w.replace(/ /g, '').length < 2) return;
          startMatch(
            'hangman',
            { word: w, hint: hint.trim().slice(0, 80), setter: me, guessed: [] },
            them,
            me,
          );
          setWord('');
          setHint('');
          setChoosing(false);
          playSfx('seal', true);
        }}
      >
        <p>Kies een woord voor {theirName} — die ziet alleen de streepjes en Coco’s ballonnen.</p>
        <TextField
          label="Het woord"
          value={word}
          onChange={setWord}
          maxLength={24}
          autoComplete="off"
        />
        <TextField label="Hint" optional value={hint} onChange={setHint} maxLength={80} />
        <button type="submit" className="neon-btn" disabled={clean(word).length < 2}>
          Stuur het woord
        </button>
      </form>
    );
  }

  return (
    <>
      <TurnBanner
        mine={!iSet && !match.winner}
        name={theirName}
        done={
          match.winner
            ? match.winner === me
              ? iSet
                ? `${theirName} kwam er niet uit — punt voor jou 😏`
                : 'Geraden! Punt voor jou 🎉'
              : iSet
                ? `${theirName} heeft het geraden 💕`
                : `Net niet… het woord was ${secret}`
            : iSet
              ? `${theirName} is aan het raden… (jouw woord: ${secret})`
              : undefined
        }
      />
      <Board
        word={secret}
        guessed={guessed}
        hint={state?.hint}
        canPlay={!iSet && !match.winner}
        onGuess={(l) => {
          const next = [...guessed, l];
          sounds(secret, next, l);
          const nowWon = solved(secret, next);
          const nowLost = wrongCount(secret, next) >= MAX_WRONG;
          updateMatch(match.id, (m) => ({
            ...m,
            state: { ...m.state, guessed: next },
            winner: nowWon ? me : nowLost ? them : undefined,
          }));
        }}
      />
      {match.winner && (
        <button type="button" className="neon-btn" onClick={() => setChoosing(true)}>
          Nu jij een woord kiezen
        </button>
      )}
    </>
  );
}

export function Hangman() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'hangman', 'you', 'partner');
  const coco = headToHead(results, 'hangman', me, 'coco');
  return (
    <GameShell
      id="hangman"
      title="Galgje"
      mode={mode}
      onMode={setMode}
      labels={{ coco: '🐰 Coco kiest een woord' }}
      score={
        mode === 'coco' ? (
          <ScoreBoard
            label="jij tegen coco"
            entries={[
              { name: 'JIJ', value: coco.a, me: true },
              { name: 'COCO', value: coco.b },
            ]}
          />
        ) : (
          <ScoreBoard
            label="punten"
            entries={[
              { name: profile.yourName.toUpperCase(), value: h.a, me: me === 'you' },
              { name: profile.partnerName.toUpperCase(), value: h.b, me: me === 'partner' },
            ]}
          />
        )
      }
    >
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteGame />
        </WhoAreYou>
      ) : (
        <VsCoco />
      )}
    </GameShell>
  );
}
