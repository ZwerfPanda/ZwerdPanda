import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import { TextField } from '../../components/ui/Fields';
import { CocoFigure } from '../../components/art/SampleArt';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { startMatch, updateMatch, useMatch, useWins } from './gameData';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';

const MAX_WRONG = 7;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Words for playing alone. */
const WORDS = [
  'KNUFFEL',
  'KUSJE',
  'KONIJNTJE',
  'MATCHA',
  'ACHTBAAN',
  'POMPOEN',
  'STERRENHEMEL',
  'VAKANTIE',
  'TREINREIS',
  'VERLIEFD',
  'BIOSCOOP',
  'POPCORN',
  'ZONSONDERGANG',
  'REUZENRAD',
  'BUBBELBAD',
  'KERSTBOOM',
  'SNEEUWPOP',
  'NAGELLAK',
  'AARDBEI',
  'VLINDERS',
  'SPOORBOEKJE',
  'PICKNICK',
  'KAMPVUUR',
  'REGENBOOG',
  'DOOLHOF',
  'SUIKERSPIN',
];

const clean = (s: string) =>
  s
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const wrongCount = (word: string, guessed: string[]) =>
  guessed.filter((l) => !word.includes(l)).length;
const solved = (word: string, guessed: string[]) =>
  word.split('').every((l) => l === ' ' || guessed.includes(l));

/** Coco floating on balloons; a wrong letter pops one. */
function Balloons({ left, landed }: { left: number; landed: boolean }) {
  const colors = ['#e0457b', '#ffd75e', '#a9d2f2', '#a7c191', '#c7a6e8', '#ffb38a', '#f48fb1'];
  return (
    <svg viewBox="-120 -200 240 260" className="balloons" aria-hidden="true">
      <AnimatePresence>
        {colors.slice(0, left).map((c, i) => {
          const x = (i - (MAX_WRONG - 1) / 2) * 26;
          const y = -150 - (i % 2) * 18;
          return (
            <motion.g
              key={c}
              initial={false}
              exit={{ scale: 1.6, opacity: 0, transition: { duration: 0.25 } }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            >
              <path
                d={`M${x} ${y + 22}Q${x * 0.4} ${y + 70} 0 -36`}
                stroke="#8f7a89"
                strokeWidth="1.2"
                fill="none"
              />
              <ellipse cx={x} cy={y} rx="15" ry="19" fill={c} stroke="#2b1a24" strokeWidth="1.5" />
              <ellipse cx={x - 5} cy={y - 7} rx="3" ry="5" fill="#fff" opacity="0.5" />
            </motion.g>
          );
        })}
      </AnimatePresence>
      <motion.g
        animate={{ y: landed ? 40 : (MAX_WRONG - left) * 6 }}
        transition={{ type: 'spring', stiffness: 80, damping: 12 }}
      >
        <CocoFigure x={0} y={0} scale={0.55} blink />
      </motion.g>
      <rect x="-120" y="52" width="240" height="8" rx="4" fill="#a7c191" />
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
  return (
    <div className="hangman">
      <Balloons left={MAX_WRONG - wrong} landed={lost} />
      {hint && <p className="hangman__hint">Hint: {hint}</p>}
      <p className="hangman__word" aria-label={won || lost ? word : 'Het woord'}>
        {word.split('').map((l, i) =>
          l === ' ' ? (
            <span key={i} className="hangman__space" />
          ) : (
            <span
              key={i}
              className={`hangman__letter ${lost && !guessed.includes(l) ? 'is-missed' : ''}`}
            >
              {guessed.includes(l) || lost ? l : ''}
            </span>
          ),
        )}
      </p>
      <p className="hangman__lives">
        {won
          ? 'Geraden! 🎉'
          : lost
            ? 'Coco is geland… het woord was ' + word
            : `${MAX_WRONG - wrong} ballonnen over`}
      </p>
      <div className="hangman__keys" role="group" aria-label="Letters">
        {LETTERS.map((l) => {
          const used = guessed.includes(l);
          return (
            <button
              key={l}
              type="button"
              className={`hangman__key ${used ? (word.includes(l) ? 'is-hit' : 'is-miss') : ''}`}
              disabled={!canPlay || used || won || lost}
              data-sfx="none"
              onClick={() => onGuess(l)}
            >
              {l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LocalGame() {
  const [word, setWord] = useState(() => WORDS[Math.floor(Math.random() * WORDS.length)]);
  const [guessed, setGuessed] = useState<string[]>([]);
  return (
    <>
      <Board
        word={word}
        guessed={guessed}
        canPlay
        onGuess={(l) => {
          const next = [...guessed, l];
          setGuessed(next);
          playSfx(word.includes(l) ? 'pop' : 'boing', true);
          if (solved(word, next)) playSfx('success', true);
        }}
      />
      <button
        type="button"
        className="btn btn--soft"
        onClick={() => {
          setWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
          setGuessed([]);
        }}
      >
        Nieuw woord
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
  const guessed = (state?.guessed ?? []).filter((l) => LETTERS.includes(l));
  const iSet = state?.setter === me;

  const newWord = (
    <form
      className="game-start"
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
      <p>Kies een woord voor {theirName}. Zij/hij ziet het niet, alleen de streepjes.</p>
      <TextField
        label="Het woord"
        value={word}
        onChange={setWord}
        maxLength={24}
        autoComplete="off"
      />
      <TextField label="Hint" optional value={hint} onChange={setHint} maxLength={80} />
      <button type="submit" className="btn btn--primary" disabled={clean(word).length < 2}>
        Stuur het woord
      </button>
    </form>
  );

  if (!match || choosing) return newWord;

  const lost = wrongCount(secret, guessed) >= MAX_WRONG;
  const won = solved(secret, guessed);
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
              ? `${theirName} is aan het raden…`
              : undefined
        }
      />
      {iSet && !match.winner ? (
        <>
          <p className="hangman__secret">
            Jouw woord: <strong>{secret}</strong>
          </p>
          <Board
            word={secret}
            guessed={guessed}
            hint={state?.hint}
            canPlay={false}
            onGuess={() => undefined}
          />
        </>
      ) : (
        <Board
          word={secret}
          guessed={guessed}
          hint={state?.hint}
          canPlay={!iSet && !match.winner}
          onGuess={(l) => {
            const next = [...guessed, l];
            const hit = secret.includes(l);
            playSfx(hit ? 'pop' : 'boing', true);
            const nowWon = solved(secret, next);
            const nowLost = wrongCount(secret, next) >= MAX_WRONG;
            if (nowWon) {
              playSfx('success', true);
              celebrateFrom(document.querySelector('.hangman__word'));
            }
            updateMatch(match.id, (m) => ({
              ...m,
              state: { ...m.state, guessed: next },
              winner: nowWon ? me : nowLost ? them : undefined,
            }));
          }}
        />
      )}
      {(match.winner || won || lost) && (
        <button type="button" className="btn btn--primary" onClick={() => setChoosing(true)}>
          Nu jij een woord kiezen
        </button>
      )}
    </>
  );
}

export function Hangman() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const wins = useWins('hangman');
  return (
    <GameShell
      title="Galgje"
      emoji="🎈"
      mode={mode}
      onMode={setMode}
      localLabel="Alleen (met een woordenlijst)"
      score={
        mode === 'remote' ? (
          <ScoreBoard you={wins.you} partner={wins.partner} label="punten" />
        ) : undefined
      }
    >
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteGame />
        </WhoAreYou>
      ) : (
        <LocalGame />
      )}
    </GameShell>
  );
}
