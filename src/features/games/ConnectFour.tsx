import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import {
  COLS,
  ROWS,
  cocoColumn,
  drop,
  emptyBoard,
  isFull,
  landingRow,
  normalizeBoard,
  winningLine,
  type Cell,
} from './c4';
import { startMatch, updateMatch, useMatch } from './gameData';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';

const DISC = { you: 'disc--blue', partner: 'disc--pink', coco: 'disc--caramel' } as const;

function Board({
  board,
  line,
  canPlay,
  skin,
  ghost,
  onDrop,
}: {
  board: Cell[];
  line: number[] | null;
  canPlay: boolean;
  skin: Record<'you' | 'partner', string>;
  ghost: 'you' | 'partner';
  onDrop: (col: number) => void;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const ghostRow = hover !== null && canPlay ? landingRow(board, hover) : -1;
  return (
    <div className={`c4 ${line ? 'has-win' : ''}`} role="grid" aria-label="Speelbord, 7 kolommen">
      {Array.from({ length: COLS }, (_, col) => (
        <button
          key={col}
          type="button"
          className="c4__col"
          disabled={!canPlay || board[col] !== null}
          aria-label={`Kolom ${col + 1}`}
          data-sfx="none"
          onPointerEnter={() => setHover(col)}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(col)}
          onBlur={() => setHover(null)}
          onClick={() => onDrop(col)}
        >
          {Array.from({ length: ROWS }, (_, row) => {
            const i = row * COLS + col;
            const who = board[i];
            return (
              <span
                key={row}
                className={`c4__hole ${line?.includes(i) ? 'is-win' : line && who ? 'is-dim' : ''}`}
              >
                {who ? (
                  <motion.span
                    className={`disc ${skin[who]}`}
                    initial={reduce ? false : { y: `-${(row + 1) * 115}%` }}
                    animate={{ y: 0 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 18, mass: 0.9 }}
                  />
                ) : hover === col && row === ghostRow ? (
                  <span className={`disc disc--ghost ${skin[ghost]}`} />
                ) : null}
              </span>
            );
          })}
        </button>
      ))}
    </div>
  );
}

const dropSound = () => playSfx('drop', true);

/** Against Coco, or two on one phone. */
function LocalGame({ vsCoco }: { vsCoco: boolean }) {
  const me = useMe();
  const profile = useContent((c) => c.profile);
  const human: 'you' | 'partner' = vsCoco ? 'you' : 'partner';
  const [board, setBoard] = useState<Cell[]>(emptyBoard);
  const [turn, setTurn] = useState<'you' | 'partner'>(human);
  const line = winningLine(board);
  const full = !line && isFull(board);
  const winner = line ? board[line[0]] : null;
  // On this board 'partner' is Coco when playing her.
  const label = (side: 'you' | 'partner') =>
    vsCoco ? (side === 'you' ? 'Jij' : 'Coco') : nameOf(side, profile);
  const skin = vsCoco
    ? { you: me === 'partner' ? DISC.partner : DISC.you, partner: DISC.coco }
    : { you: DISC.you, partner: DISC.partner };

  const finish = (next: Cell[]) => {
    const won = winningLine(next);
    if (!won && !isFull(next)) return;
    const w = won ? next[won[0]] : null;
    if (vsCoco) recordResult('c4', [me, 'coco'], w === null ? 'draw' : w === 'you' ? me : 'coco');
    else recordResult('c4', ['you', 'partner'], w ?? 'draw');
    if (w) {
      playSfx(vsCoco && w === 'partner' ? 'boing' : 'success', true);
      if (!(vsCoco && w === 'partner')) celebrateFrom(document.querySelector('.c4'));
    }
  };

  const place = (col: number, side: 'you' | 'partner') => {
    const next = drop(board, col, side);
    if (!next) return;
    dropSound();
    setBoard(next);
    finish(next);
    setTurn(side === 'you' ? 'partner' : 'you');
  };

  // Coco thinks for a moment, then drops.
  useEffect(() => {
    if (!vsCoco || turn !== 'partner' || line || full) return;
    const t = window.setTimeout(() => place(cocoColumn(board, 'partner', 'you'), 'partner'), 750);
    return () => window.clearTimeout(t);
    // place reads the current board.
  }, [vsCoco, turn, board]);

  return (
    <>
      <TurnBanner
        mine={!vsCoco || turn === 'you'}
        name="Coco 🐰💭"
        note={vsCoco ? 'Jouw zet ✨' : `${label(turn)} is aan de beurt`}
        done={
          winner
            ? vsCoco
              ? winner === 'you'
                ? 'Jij wint van Coco! 🎉'
                : 'Coco wint… 🐰👑'
              : `${label(winner)} wint! 🎉`
            : full
              ? 'Gelijkspel — het bord is vol.'
              : undefined
        }
      />
      <Board
        board={board}
        line={line}
        skin={skin}
        ghost={turn}
        canPlay={!winner && !full && (!vsCoco || turn === 'you')}
        onDrop={(col) => place(col, turn)}
      />
      <button
        type="button"
        className="neon-btn"
        onClick={() => {
          setBoard(emptyBoard());
          setTurn(vsCoco ? (Math.random() < 0.5 ? 'you' : 'partner') : turn);
        }}
      >
        Nieuw potje
      </button>
    </>
  );
}

/** Each on our own phone: the board travels through the sync. */
function RemoteGame() {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const match = useMatch('c4');
  const board = normalizeBoard(match?.state.board);
  const line = winningLine(board);
  const mine = Boolean(match && !match.winner && match.turn === me);
  const skin = { you: DISC.you, partner: DISC.partner };

  const start = () => startMatch('c4', { board: emptyBoard() }, them, me);

  if (!match) {
    return (
      <div className="game-panel">
        <p>Start een potje — {nameOf(them, profile)} krijgt de eerste zet.</p>
        <button type="button" className="neon-btn" onClick={start}>
          Nieuw potje
        </button>
      </div>
    );
  }

  return (
    <>
      <TurnBanner
        mine={mine}
        name={nameOf(them, profile)}
        done={
          match.winner
            ? match.winner === 'draw'
              ? 'Gelijkspel!'
              : match.winner === me
                ? 'Jij wint! 🎉'
                : `${nameOf(match.winner, profile)} wint dit potje 💕`
            : undefined
        }
      />
      <Board
        board={board}
        line={line}
        skin={skin}
        ghost={me}
        canPlay={mine}
        onDrop={(col) => {
          const next = drop(board, col, me);
          if (!next) return;
          dropSound();
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
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </>
  );
}

export function ConnectFour() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const results = useContent((c) => c.games.results);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const h = headToHead(results, 'c4', 'you', 'partner');
  const coco = headToHead(results, 'c4', me, 'coco');
  return (
    <GameShell
      id="c4"
      title="4 op een rij"
      mode={mode}
      onMode={setMode}
      modes={['remote', 'coco', 'local']}
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
            label="gewonnen"
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
        <LocalGame key={mode} vsCoco={mode === 'coco'} />
      )}
    </GameShell>
  );
}
