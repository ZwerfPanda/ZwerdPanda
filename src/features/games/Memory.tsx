import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameMatch, Person } from '../../data/types';
import { startMatch, updateMatch, useMatch } from './gameData';
import { useContent } from '../../data/store';
import { nameOf, otherPerson, useMe } from '../../data/people';
import type { Player } from '../../data/types';
import { MediaView } from '../../components/media/MediaView';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { headToHead, recordResult } from './gameStats';
import { GameShell, ScoreBoard, TurnBanner, WhoAreYou, type PlayMode } from './GameShell';
import { cocoPick, deck, facesFrom, type Card, type Face } from './memory';

const PAIRS = 8;

export function Memory() {
  const [mode, setMode] = useState<PlayMode>('remote');
  const [round, setRound] = useState(0);
  const results = useContent((c) => c.games);
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
      modes={['remote', 'local', 'coco']}
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
      {mode === 'remote' ? (
        <WhoAreYou>
          <RemoteBoard />
        </WhoAreYou>
      ) : (
        <Board
          key={`${mode}-${round}`}
          vsCoco={mode === 'coco'}
          onAgain={() => setRound((r) => r + 1)}
        />
      )}
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
    playSfx('flip', true);
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

/* ------------------------------------------------- each on our own phone */

interface MemoryState {
  faces: Face[];
  /** Which face each card shows. */
  order: number[];
  open: number[];
  matched: number[];
  pairs: Record<Person, number>;
}

function readState(state: unknown): MemoryState | null {
  const s = state as Partial<MemoryState> | undefined;
  if (!s || !Array.isArray(s.faces) || !Array.isArray(s.order)) return null;
  return {
    faces: s.faces,
    order: s.order,
    open: Array.isArray(s.open) ? s.open : [],
    matched: Array.isArray(s.matched) ? s.matched : [],
    pairs: { you: s.pairs?.you ?? 0, partner: s.pairs?.partner ?? 0 },
  };
}

/** Turn the two open cards back, or keep them when they're a pair. */
function resolve(match: GameMatch, me: Person) {
  updateMatch(match.id, (m) => {
    const s = readState(m.state);
    if (!s || s.open.length < 2 || m.turn !== me) return m;
    const [a, b] = s.open;
    const pair = s.order[a] === s.order[b];
    const matched = pair ? [...s.matched, a, b] : s.matched;
    const pairs = pair ? { ...s.pairs, [me]: s.pairs[me] + 1 } : s.pairs;
    const done = matched.length === s.order.length;
    const other: Person = me === 'you' ? 'partner' : 'you';
    return {
      ...m,
      state: { ...s, open: [], matched, pairs },
      turn: pair ? me : other,
      winner: done
        ? pairs.you === pairs.partner
          ? 'draw'
          : pairs.you > pairs.partner
            ? 'you'
            : 'partner'
        : undefined,
    };
  });
}

function RemoteBoard() {
  const content = useContent((c) => c);
  const me = useMe();
  const them = otherPerson(me);
  const match = useMatch('memory');
  const s = readState(match?.state);
  const heard = useRef('');
  const theirName = nameOf(them, content.profile);

  // A sound for every card the other turns, as it arrives.
  useEffect(() => {
    if (!match || !s) return;
    const key = `${match.id}:${s.open.join(',')}:${s.matched.length}`;
    if (heard.current && heard.current !== key && match.turn === them) playSfx('flip', true);
    heard.current = key;
  }, [match?.updatedAt]);

  // Two cards open on my turn: look a moment, then turn them (also after a reload).
  useEffect(() => {
    if (!match || !s || match.winner || match.turn !== me || s.open.length < 2) return;
    const pair = s.order[s.open[0]] === s.order[s.open[1]];
    const t = window.setTimeout(
      () => {
        playSfx(pair ? 'sparkle' : 'whoosh', true);
        resolve(match, me);
      },
      pair ? 700 : 1200,
    );
    return () => window.clearTimeout(t);
  }, [match?.updatedAt]);

  useEffect(() => {
    if (match?.winner && match.winner !== 'draw' && match.winner === me)
      celebrateFrom(document.querySelector('.memory'));
  }, [match?.winner]);

  const start = () => {
    const faces = facesFrom(content, PAIRS);
    const order = deck(faces).map((c) => faces.findIndex((f) => f.key === c.key));
    playSfx('sparkle', true);
    startMatch(
      'memory',
      { faces, order, open: [], matched: [], pairs: { you: 0, partner: 0 } },
      me,
      me,
    );
  };

  if (!match || !s) {
    return (
      <div className="game-panel">
        <p>
          Om de beurt twee kaartjes omdraaien — elk op je eigen telefoon. Wie de meeste paartjes
          vindt, wint.
        </p>
        <button type="button" className="neon-btn" onClick={start}>
          Daag {theirName} uit
        </button>
      </div>
    );
  }

  const mine = !match.winner && match.turn === me;
  const flip = (id: number) => {
    if (!mine || s.open.length >= 2 || s.open.includes(id) || s.matched.includes(id)) return;
    playSfx('flip', true);
    updateMatch(match.id, (m) => {
      const cur = readState(m.state);
      if (!cur || cur.open.length >= 2 || cur.open.includes(id)) return m;
      return { ...m, state: { ...cur, open: [...cur.open, id] } };
    });
  };
  const label = (p: Person) => (p === me ? 'Jij' : theirName);

  return (
    <>
      <div className="darts-totals">
        {(['you', 'partner'] as Person[]).map((p) => (
          <span
            key={p}
            className={`darts-total darts-total--${p} ${match.turn === p && !match.winner ? 'is-up' : ''}`}
          >
            <small>{label(p)}</small>
            <strong>{s.pairs[p]}</strong>
          </span>
        ))}
      </div>
      <TurnBanner
        mine={mine}
        name={theirName}
        note="Jouw beurt — draai twee kaartjes om"
        done={
          match.winner
            ? match.winner === 'draw'
              ? `Gelijkspel! ${s.pairs.you}–${s.pairs.partner}`
              : match.winner === me
                ? `Jij wint met ${s.pairs[me]} paartjes! 🎉`
                : `${theirName} wint met ${s.pairs[them]} paartjes 💕`
            : undefined
        }
      />
      <ul className="memory" aria-label="Memory-kaartjes">
        {s.order.map((face, id) => {
          const f = s.faces[face];
          const matched = s.matched.includes(id);
          const up = s.open.includes(id) || matched;
          return (
            <li key={id}>
              <button
                type="button"
                className={`memory__card ${up ? 'is-up' : ''} ${matched ? 'is-matched' : ''}`}
                onClick={() => flip(id)}
                disabled={!mine || up || s.open.length >= 2}
                aria-label={up ? (f?.emoji ?? 'foto') : 'Omgedraaid kaartje'}
                data-sfx="none"
              >
                <span className="memory__inner">
                  <span className="memory__back" aria-hidden="true">
                    ♥
                  </span>
                  <span className="memory__front" aria-hidden="true">
                    {f?.media ? <MediaView source={f.media} alt="" /> : <span>{f?.emoji}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {match.winner && (
        <button type="button" className="neon-btn" onClick={start}>
          Nog een potje
        </button>
      )}
    </>
  );
}
