import { useState } from 'react';
import { motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { COLS, ROWS, drop, emptyBoard, isFull, normalizeBoard, winningLine, type Cell } from './c4';
import { startMatch, updateMatch, useMatch, useWins } from './gameData';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';

const COLORS: Record<Person, string> = { you: '#3d6fd8', partner: '#e0457b' };

function Board({
  board,
  line,
  canPlay,
  onDrop,
}: {
  board: Cell[];
  line: number[] | null;
  canPlay: boolean;
  onDrop: (col: number) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="c4" role="grid" aria-label="Speelbord, 7 kolommen">
      {Array.from({ length: COLS }, (_, col) => (
        <button
          key={col}
          type="button"
          className="c4__col"
          disabled={!canPlay || board[col] !== null}
          aria-label={`Kolom ${col + 1}`}
          data-sfx="none"
          onClick={() => onDrop(col)}
        >
          {Array.from({ length: ROWS }, (_, row) => {
            const i = row * COLS + col;
            const who = board[i];
            return (
              <span key={row} className={`c4__hole ${line?.includes(i) ? 'is-win' : ''}`}>
                {who && (
                  <motion.span
                    className="c4__disc"
                    style={{ background: COLORS[who] }}
                    initial={reduce ? false : { y: -(row + 1) * 52 }}
                    animate={{ y: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  />
                )}
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}

function useNames() {
  const profile = useContent((c) => c.profile);
  return (p: Person) => nameOf(p, profile);
}

/** Two on one phone, taking turns. */
function LocalGame() {
  const name = useNames();
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [turn, setTurn] = useState<Person>('partner');
  const line = winningLine(board);
  const full = !line && isFull(board);
  const winner = line ? board[line[0]] : null;

  return (
    <>
      <TurnBanner
        mine
        name=""
        done={
          winner ? `${name(winner)} wint! 🎉` : full ? 'Gelijkspel — het bord is vol.' : undefined
        }
      />
      {!winner && !full && (
        <p className="game-who-turn">
          <span className="c4__dot" style={{ background: COLORS[turn] }} /> {name(turn)} is aan de
          beurt
        </p>
      )}
      <Board
        board={board}
        line={line}
        canPlay={!winner && !full}
        onDrop={(col) => {
          const next = drop(board, col, turn);
          if (!next) return;
          playSfx('pop', true);
          setBoard(next);
          if (winningLine(next)) playSfx('success', true);
          setTurn(otherPerson(turn));
        }}
      />
      <button
        type="button"
        className="btn btn--soft"
        onClick={() => {
          setBoard(emptyBoard());
          setTurn(otherPerson(turn));
        }}
      >
        Opnieuw
      </button>
    </>
  );
}

/** Each on our own phone: the board travels through the sync. */
function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const name = useNames();
  const match = useMatch('c4');
  const board = normalizeBoard(match?.state.board);
  const line = winningLine(board);
  const mine = Boolean(match && !match.winner && match.turn === me);

  const start = () => startMatch('c4', { board: emptyBoard() }, them, me);

  if (!match) {
    return (
      <div className="game-start">
        <p>Start een potje — {name(them)} krijgt de eerste zet.</p>
        <button type="button" className="btn btn--primary" onClick={start}>
          Nieuw potje
        </button>
      </div>
    );
  }

  return (
    <>
      <TurnBanner
        mine={mine}
        name={name(them)}
        done={
          match.winner
            ? match.winner === 'draw'
              ? 'Gelijkspel!'
              : match.winner === me
                ? 'Jij wint! 🎉'
                : `${name(match.winner)} wint dit potje 💕`
            : undefined
        }
      />
      <p className="game-who-turn">
        <span className="c4__dot" style={{ background: COLORS[me] }} /> jij ·{' '}
        <span className="c4__dot" style={{ background: COLORS[them] }} /> {name(them)}
      </p>
      <Board
        board={board}
        line={line}
        canPlay={mine}
        onDrop={(col) => {
          const next = drop(board, col, me);
          if (!next) return;
          playSfx('pop', true);
          const won = winningLine(next);
          if (won) {
            playSfx('success', true);
            celebrateFrom(document.querySelector('.c4'));
          }
          updateMatch(match.id, (m) => ({
            ...m,
            state: { board: next },
            turn: them,
            winner: won ? me : isFull(next) ? 'draw' : undefined,
          }));
        }}
      />
      {match.winner && (
        <button type="button" className="btn btn--primary" onClick={start}>
          Nog een potje
        </button>
      )}
    </>
  );
}

export function ConnectFour() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const wins = useWins('c4');
  return (
    <GameShell
      title="4 op een rij"
      emoji="🔴"
      mode={mode}
      onMode={setMode}
      score={
        mode === 'remote' ? (
          <ScoreBoard you={wins.you} partner={wins.partner} label="gewonnen" />
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
