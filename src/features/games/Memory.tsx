import { useEffect, useMemo, useRef, useState } from 'react';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Player } from '../../data/types';
import { MediaView } from '../../components/media/MediaView';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, type PlayMode } from './GameShell';
import { cocoPick, deck, facesFrom, type Card } from './memory';

const PAIRS = 8;

export function Memory() {
  const [mode, setMode] = useState<PlayMode>('local');
  const [round, setRound] = useState(0);
  const results = useContent((c) => c.games.results);
  const profile = useContent((c) => c.profile);
  const me = useMe();
  const us = headToHead(results, 'memory', 'you', 'partner');
  const coco = headToHead(results, 'memory', me, 'coco');
  return (
    <GameShell
      id="memory"
      title="Memory"
      mode={mode}
      onMode={(m) => {
        setMode(m);
        setRound((r) => r + 1);
      }}
      modes={['local', 'coco']}
      labels={{ local: '📱 Samen op één telefoon' }}
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
              { name: profile.yourName.toUpperCase(), value: us.a, me: me === 'you' },
              { name: profile.partnerName.toUpperCase(), value: us.b, me: me === 'partner' },
            ]}
          />
        )
      }
    >
      <Board
        key={`${mode}-${round}`}
        vsCoco={mode === 'coco'}
        onAgain={() => setRound((r) => r + 1)}
      />
    </GameShell>
  );
}

function Board({ vsCoco, onAgain }: { vsCoco: boolean; onAgain: () => void }) {
  const content = useContent((c) => c);
  const me = useMe();
  const players: Player[] = vsCoco ? [me, 'coco'] : [me, otherPerson(me)];
  const label = (p: Player) =>
    p === 'coco' ? 'Coco' : vsCoco ? 'Jij' : nameOf(p, content.profile);
  // The deck is dealt once per game.
  const cards = useMemo<Card[]>(() => deck(facesFrom(content, PAIRS)), []);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [turn, setTurn] = useState(0);
  const [pairs, setPairs] = useState<number[]>([0, 0]);
  const [busy, setBusy] = useState(false);
  const memory = useRef(new Map<number, string>());
  const recorded = useRef(false);
  const done = matched.size === cards.length;
  const current = players[turn];

  const remember = (id: number) => {
    // Coco remembers most of what she sees.
    if (Math.random() < 0.72) memory.current.set(id, cards[id].key);
  };

  const flip = (id: number) => {
    if (busy || done || open.includes(id) || matched.has(id)) return;
    playSfx('pop', true);
    remember(id);
    const next = [...open, id];
    setOpen(next);
    if (next.length < 2) return;
    setBusy(true);
    const [a, b] = next;
    const hit = cards[a].key === cards[b].key;
    window.setTimeout(
      () => {
        if (hit) {
          playSfx('sparkle', true);
          setMatched((m) => new Set([...m, a, b]));
          setPairs((p) => p.map((n, i) => (i === turn ? n + 1 : n)));
        } else {
          setTurn((t) => 1 - t);
        }
        setOpen([]);
        setBusy(false);
      },
      hit ? 650 : 1100,
    );
  };

  // Coco plays her turn by herself.
  useEffect(() => {
    if (!vsCoco || current !== 'coco' || done || busy) return;
    const t = window.setTimeout(
      () => {
        const first = open[0] ?? null;
        flip(cocoPick(cards, matched, memory.current, first));
      },
      open.length ? 700 : 900,
    );
    return () => window.clearTimeout(t);
    // flip reads the latest state.
  }, [vsCoco, current, done, busy, open, matched]);

  // The end: the most pairs wins.
  useEffect(() => {
    if (!done || recorded.current) return;
    recorded.current = true;
    const [a, b] = pairs;
    const winner: Player | 'draw' = a === b ? 'draw' : a > b ? players[0] : players[1];
    recordResult('memory', players, winner);
    playSfx(winner === 'coco' ? 'boing' : 'success', true);
    if (winner !== 'coco') celebrateFrom(document.querySelector('.memory'));
  }, [done]);

  const [a, b] = pairs;
  return (
    <>
      <div className="darts-totals">
        {players.map((p, i) => (
          <span
            key={p}
            className={`darts-total darts-total--${p} ${i === turn && !done ? 'is-up' : ''}`}
          >
            <small>{label(p)}</small>
            <strong>{pairs[i]}</strong>
          </span>
        ))}
      </div>
      <TurnBanner
        mine={!vsCoco || current !== 'coco'}
        name="Coco 🐰🤔"
        note={`${label(current)} ${current === me && vsCoco ? 'bent' : 'is'} aan de beurt — draai twee kaartjes om`}
        done={
          done
            ? a === b
              ? `Gelijkspel! ${a}–${b}`
              : `${label(a > b ? players[0] : players[1])} wint met ${Math.max(a, b)} paartjes! ${
                  (a > b ? players[0] : players[1]) === 'coco' ? '🐰👑' : '🎉'
                }`
            : undefined
        }
      />
      <ul className="memory" aria-label="Memory-kaartjes">
        {cards.map((c) => {
          const up = open.includes(c.id) || matched.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                className={`memory__card ${up ? 'is-up' : ''} ${matched.has(c.id) ? 'is-matched' : ''}`}
                onClick={() => flip(c.id)}
                disabled={busy || up || (vsCoco && current === 'coco')}
                aria-label={up ? (c.emoji ?? 'foto') : 'Omgedraaid kaartje'}
                data-sfx="none"
              >
                <span className="memory__inner">
                  <span className="memory__back" aria-hidden="true">
                    ♥
                  </span>
                  <span className="memory__front" aria-hidden="true">
                    {c.media ? <MediaView source={c.media} alt="" /> : <span>{c.emoji}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {done && (
        <button type="button" className="neon-btn" onClick={onAgain}>
          Nog een potje
        </button>
      )}
    </>
  );
}
