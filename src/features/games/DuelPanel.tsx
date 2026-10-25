import { useEffect, useRef, useState } from 'react';
import { useContent } from '../../data/store';
import { getAuthor, nameOf, otherPerson, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { playSfx } from '../../lib/audio/sfx';
import { celebrateFrom } from '../../components/ui/feedback';
import { addScore } from './gameData';
import { recordResult } from './gameStats';
import type { PlayMode } from './GameShell';
import { TICKETS } from './tickets';
import {
  duelScores,
  duelWinner,
  foldDuels,
  foldPlan,
  planDuel,
  playDuelRound,
  ticketsFor,
  type DuelKind,
} from './duel';

export const DUEL_LABELS: Partial<Record<PlayMode, string>> = {
  remote: '⚔️ Duel (samen)',
  local: '📱 Samen op één telefoon',
  coco: '🐰 Tegen Coco',
};

export interface RoundEnd {
  text: string;
  /** Real tickets this round earned (shown as the ticket strip), or none. */
  tickets: number | null;
  /** On one phone: the first of us is done, now the other. */
  handOver?: boolean;
}

/**
 * The end of a round at skeeball or bowling, for playing against each other:
 * apart, it goes into a duel; on one phone, the second round settles it.
 */
export function useDuelRound(kind: DuelKind, mode: PlayMode) {
  const me = useMe();
  const them = otherPerson(me);
  const profile = useContent((c) => c.profile);
  const [first, setFirst] = useState<number | null>(null);
  /** On one phone: how the last duel ended. */
  const [result, setResult] = useState<string | null>(null);
  const player: Person = mode === 'local' && first !== null ? them : me;

  const finish = (total: number): RoundEnd => {
    if (mode === 'local') {
      if (first === null) {
        addScore(kind, total, me);
        setFirst(total);
        return {
          text: `${nameOf(me, profile)} haalde ${total}. Geef de telefoon aan ${nameOf(them, profile)}!`,
          tickets: null,
          handOver: true,
        };
      }
      addScore(kind, total, them);
      const scores = { [me]: first, [them]: total } as Record<Person, number>;
      const winner = duelWinner(scores)!;
      recordResult(kind, ['you', 'partner'], winner);
      playSfx('success', true);
      setFirst(null);
      const loser = otherPerson(winner === 'draw' ? me : winner);
      const end: RoundEnd =
        winner === 'draw'
          ? {
              text: `Gelijk! ${first}–${total} · allebei ${TICKETS.draw} 🎟️`,
              tickets: TICKETS.draw,
            }
          : {
              text: `${nameOf(winner, profile)} wint ${scores[winner]}–${scores[loser]}! +${TICKETS.win} 🎟️ (en +${TICKETS.played} voor ${nameOf(loser, profile)})`,
              tickets: TICKETS.win,
            };
      setResult(end.text);
      return end;
    }
    // Apart: only when this phone knows who's playing.
    if (!getAuthor()) return { text: `Klaar! ${total} punten 🏆`, tickets: null };
    addScore(kind, total);
    const out = playDuelRound(kind, me, total);
    const theirs = nameOf(them, profile);
    if (out.type === 'started')
      return {
        text: `${total} punten! Nu is ${theirs} aan de beurt — de winnaar krijgt ${TICKETS.win} 🎟️`,
        tickets: null,
      };
    if (out.type === 'practice')
      return {
        text: `${total} punten (oefenrondje) · jouw duelscore blijft ${out.mine}`,
        tickets: null,
      };
    const mine = out.scores[me] ?? total;
    const other = out.scores[them] ?? 0;
    return {
      text:
        out.winner === 'draw'
          ? `Gelijk! ${mine}–${other} · ${out.tickets} 🎟️ voor jullie allebei`
          : out.winner === me
            ? `Jij wint het duel ${mine}–${other}! +${out.tickets} 🎟️`
            : `${theirs} wint ${other}–${mine}… maar jij krijgt ${out.tickets} 🎟️ 💕`,
      tickets: out.tickets,
    };
  };

  return {
    player,
    first,
    result,
    finish,
    reset: () => {
      setFirst(null);
      setResult(null);
    },
  };
}

/** What's going on in the duel, above the lane. */
export function DuelPanel({
  kind,
  mode,
  first,
  result = null,
}: {
  kind: DuelKind;
  mode: PlayMode;
  first: number | null;
  result?: string | null;
}) {
  const me = useMe();
  const them = otherPerson(me);
  const matches = useContent((c) => c.games.matches);
  const profile = useContent((c) => c.profile);
  const box = useRef<HTMLDivElement>(null);
  const theirs = nameOf(them, profile);

  // Both started a duel at once: fold them into one (both phones agree how).
  useEffect(() => {
    if (mode === 'remote' && foldPlan(matches, kind)) foldDuels(kind);
  }, [matches, mode, kind]);

  // The other just settled a duel while we're here.
  const last = matches
    .filter((m) => m.kind === kind && m.winner)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
  const seen = useRef(last?.id);
  useEffect(() => {
    if (!last || last.id === seen.current) return;
    seen.current = last.id;
    // (When we settled it ourselves, the round's end already cheered.)
    if (mode !== 'remote' || last.startedBy !== me) return;
    playSfx(last.winner === me || last.winner === 'draw' ? 'success' : 'coin', true);
    if (last.winner === me) celebrateFrom(box.current);
  }, [last?.id]);

  if (mode === 'coco')
    return (
      <p className="duel-panel">
        Tegen Coco speel je voor de eer 🐰 Tickets verdien je samen, in een duel.
      </p>
    );

  if (mode === 'local')
    return (
      <div className="duel-panel" ref={box}>
        {result ? (
          <p>🏁 {result}</p>
        ) : first === null ? (
          <p>
            Eerst <strong>{nameOf(me, profile)}</strong>, dan <strong>{theirs}</strong>. De winnaar
            krijgt {TICKETS.win} 🎟️, de ander {TICKETS.played}.
          </p>
        ) : (
          <p>
            {nameOf(me, profile)} haalde <strong>{first}</strong> — nu <strong>{theirs}</strong>!
          </p>
        )}
      </div>
    );

  if (!getAuthor())
    return <p className="duel-panel">Kies in Instellingen wie je bent om een duel te spelen.</p>;

  const plan = planDuel(matches, kind, me);
  const lastScores = duelScores(last);
  const lastWinner = last?.winner;
  return (
    <div className="duel-panel" ref={box} aria-live="polite">
      {plan.type === 'answer' ? (
        <p>
          ⚔️ {theirs} haalde{' '}
          <strong>{duelScores(matches.find((m) => m.id === plan.id))[them]}</strong>. Kun jij dat
          verslaan?
        </p>
      ) : plan.type === 'practice' ? (
        <p>
          ⏳ Jij haalde <strong>{plan.mine}</strong>. Wachten op {theirs}… Nog een rondje is om te
          oefenen.
        </p>
      ) : (
        <p>
          ⚔️ Speel je rondje, dan is {theirs} aan de beurt (ook later, op de eigen telefoon). De
          winnaar krijgt {TICKETS.win} 🎟️, de ander {TICKETS.played}.
        </p>
      )}
      {last && lastWinner && (
        <p className="duel-panel__last">
          Vorig duel: jij {lastScores[me] ?? '–'} · {theirs} {lastScores[them] ?? '–'} —{' '}
          {lastWinner === 'draw' ? 'gelijk' : lastWinner === me ? 'jij won 🏆' : `${theirs} won`} (+
          {ticketsFor(lastWinner, me)} 🎟️)
        </p>
      )}
    </div>
  );
}
