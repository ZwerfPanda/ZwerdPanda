import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../../data/store';
import {
  ACTIVITIES,
  ACTIVITY_ORDER,
  activityDoneToday,
  type ActivityId,
  type Mischief,
  type Request,
} from './care';

/** Coco asking for something, as a speech bubble with the answer right there. */
export function RequestCard({
  request,
  onAnswer,
  disabled,
}: {
  request: Request;
  onAnswer: () => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      key={request.id}
      className={`den-ask ${request.urgent ? 'is-urgent' : ''}`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      role="status"
    >
      <span className="den-ask__who" aria-hidden="true">
        🐰
      </span>
      <p className="den-ask__text">
        <small>{request.urgent ? 'Coco heeft je nodig' : 'Coco heeft een wensje'}</small>
        {request.text}
      </p>
      <button
        type="button"
        className="btn btn--primary btn--small"
        onClick={onAnswer}
        disabled={disabled}
      >
        {request.cta}
      </button>
    </motion.div>
  );
}

/** A bit of mischief: how do we respond? Kind answers bring her up well. */
export function MischiefCard({
  mischief,
  onChoose,
}: {
  mischief: Mischief;
  onChoose: (good: boolean, reply: string) => void;
}) {
  return (
    <motion.div
      className="den-mischief"
      initial={{ opacity: 0, rotate: -1.5, y: 8 }}
      animate={{ opacity: 1, rotate: 0, y: 0 }}
    >
      <p className="den-mischief__title">
        <span aria-hidden="true">😈</span> Opvoedmomentje
      </p>
      <p className="den-mischief__text">{mischief.text}</p>
      <p className="den-mischief__ask">Wat doe je?</p>
      <div className="den-mischief__options">
        {mischief.options.map((o) => (
          <button
            key={o.label}
            type="button"
            className="den-option"
            onClick={() => onChoose(o.good, o.reply)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/** What happened after we responded, with what really works and why. */
export function MischiefOutcome({
  outcome,
  onClose,
}: {
  outcome: { good: boolean; reply: string; fact: string } | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {outcome && (
        <motion.div
          className={`den-mischief den-mischief--done ${outcome.good ? 'is-good' : 'is-oops'}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role="status"
        >
          <p className="den-mischief__title">{outcome.good ? '🌟 Goed opgevoed!' : '🙈 Oeps…'}</p>
          <p className="den-mischief__text">{outcome.reply}</p>
          <p className="den-mischief__fact">{outcome.fact}</p>
          <button type="button" className="btn btn--quiet btn--small" onClick={onClose}>
            Oké
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Fun things to do with her: each one once a day. */
export function FunTray({
  onPick,
  busy,
}: {
  onPick: (activity: ActivityId) => void;
  busy: boolean;
}) {
  const pet = useContent((c) => c.pet);
  const [now] = useState(() => new Date());
  return (
    <div className="den-options den-options--fun">
      {ACTIVITY_ORDER.map((id) => {
        const done = activityDoneToday(pet, id, now);
        return (
          <button
            key={id}
            type="button"
            className={`den-option${done ? ' is-done' : ''}`}
            onClick={() => onPick(id)}
            disabled={busy || done}
          >
            <span className="den-option__emoji" aria-hidden="true">
              {ACTIVITIES[id].emoji}
            </span>
            {ACTIVITIES[id].label}
            {done && <span className="tag">vandaag gedaan ✓</span>}
          </button>
        );
      })}
    </div>
  );
}
