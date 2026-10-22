import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Lock, Mail, Pencil, Trash2, X } from 'lucide-react';
import type { Letter } from '../../data/types';
import { patchItem } from '../../data/actions';
import {
  daysUntil,
  formatDate,
  formatTimestamp,
  parseIsoDate,
  plural,
  todayIso,
} from '../../lib/dates';
import { nowIso } from '../../lib/id';
import { lockScroll, trapTab } from '../../components/ui/scrollLock';
import { useReducedMotion } from '../../hooks/useMotion';
import { Envelope } from './Envelope';
import { sealIcon } from './letterStyle';

type Stage = 'closed' | 'open' | 'pulled' | 'reading';

export function isDateLocked(letter: Letter, today = todayIso()): boolean {
  return letter.lock.type === 'date' && letter.lock.until > today;
}

interface OpenerProps {
  letter: Letter | null;
  onClose: () => void;
  onEdit: (letter: Letter) => void;
  onDelete: (letter: Letter) => void;
}

export function LetterOpener(props: OpenerProps) {
  return createPortal(
    <AnimatePresence>
      {props.letter && <OpenerInner key={props.letter.id} {...props} letter={props.letter} />}
    </AnimatePresence>,
    document.body,
  );
}

function OpenerInner({ letter, onClose, onEdit, onDelete }: OpenerProps & { letter: Letter }) {
  const reduce = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const dateLocked = isDateLocked(letter);
  const needsHold = letter.lock.type === 'hold' && !letter.readAt;
  const startReading = Boolean(letter.readAt) && !dateLocked;
  const [stage, setStage] = useState<Stage>(startReading ? 'reading' : 'closed');
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    rootRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current || document.querySelector('.dialog-root')) return;
      if (e.key === 'Escape') closeRef.current();
      else trapTab(e, rootRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      unlock();
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  const open = () => {
    if (stage !== 'closed' || dateLocked) return;
    if (!letter.readAt) patchItem('letters', letter.id, { readAt: nowIso() });
    if (reduce) {
      setStage('reading');
      return;
    }
    setStage('open');
    window.setTimeout(() => setStage('pulled'), 520);
    window.setTimeout(() => setStage('reading'), 1350);
  };

  // Plain letters open by themselves once the envelope has settled.
  useEffect(() => {
    if (stage !== 'closed' || needsHold || dateLocked) return;
    const timer = window.setTimeout(open, reduce ? 0 : 650);
    return () => window.clearTimeout(timer);
  });

  const until = letter.lock.type === 'date' ? letter.lock.until : null;
  const daysLeft = until ? daysUntil(parseIsoDate(until)!, parseIsoDate(todayIso())!) : 0;

  return (
    <motion.div
      ref={rootRef}
      className="opener"
      role="dialog"
      aria-modal="true"
      aria-label={`Letter: open when ${letter.occasion}`}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        className="opener__backdrop"
        aria-label="Close letter"
        tabIndex={-1}
        onClick={onClose}
      />
      <button
        type="button"
        className="icon-btn icon-btn--on-dark opener__close"
        onClick={onClose}
        aria-label="Close"
      >
        <X />
      </button>

      <AnimatePresence mode="wait">
        {stage !== 'reading' ? (
          <motion.div
            key="envelope"
            className="opener__stage"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 1.04 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <Envelope
              letter={letter}
              stage={stage}
              size="large"
              sealSlot={
                needsHold && !dateLocked ? <HoldSeal letter={letter} onDone={open} /> : undefined
              }
            />
            <div className="opener__under" aria-live="polite">
              {dateLocked ? (
                <>
                  <p className="opener__lock">
                    <Lock aria-hidden="true" /> Sealed until {formatDate(until)}
                  </p>
                  <p className="opener__hint">
                    {daysLeft === 1
                      ? 'Just one more day.'
                      : `${plural(daysLeft, 'day')} to go. Good things are worth waiting for.`}
                  </p>
                  <button
                    type="button"
                    className="btn btn--ghost btn--small opener__ghost"
                    onClick={() => onEdit(letter)}
                  >
                    <Pencil aria-hidden="true" /> Edit (for the writer)
                  </button>
                </>
              ) : needsHold && stage === 'closed' ? (
                <p className="opener__hint">Press and hold the seal to break it</p>
              ) : (
                <p className="opener__hint">{stage === 'closed' ? 'Opening…' : ' '}</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.article
            key="letter"
            className="letter-paper"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.94, rotate: -1.5 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="letter-paper__scroll">
              <header className="letter-paper__head">
                <p className="letter-paper__for">
                  {letter.recipient ? `for ${letter.recipient}` : 'for you'}
                  {letter.date && <span> · {formatDate(letter.date)}</span>}
                </p>
                <h2 className="letter-paper__title">
                  <span>open when</span> {letter.occasion}
                </h2>
                {letter.isSample && (
                  <p className="tag tag--sample letter-paper__sample">
                    Starter letter — Valencio, rewrite it in your own words
                  </p>
                )}
              </header>
              <div className="letter-paper__body">
                {letter.body.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {letter.signature && <p className="letter-paper__sign">{letter.signature}</p>}
            </div>
            <footer className="letter-paper__foot">
              <span className="letter-paper__read">
                {letter.readAt ? `Opened ${formatTimestamp(letter.readAt)}` : ''}
              </span>
              <button
                type="button"
                className="btn btn--quiet btn--small"
                onClick={() => {
                  patchItem('letters', letter.id, { readAt: undefined });
                  onClose();
                }}
              >
                <Mail aria-hidden="true" /> Seal it again
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Edit letter"
                onClick={() => onEdit(letter)}
              >
                <Pencil />
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Delete letter"
                onClick={() => onDelete(letter)}
              >
                <Trash2 />
              </button>
            </footer>
          </motion.article>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const HOLD_MS = 1200;

/** The wax seal of a "hold to open" letter: press and keep holding to break it. */
function HoldSeal({ letter, onDone }: { letter: Letter; onDone: () => void }) {
  const Seal = sealIcon(letter.seal);
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const start = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onDone();
    }, HOLD_MS);
  };
  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  useEffect(() => cancel, []);

  return (
    <button
      type="button"
      className={`env__seal env__seal--hold ${holding ? 'is-holding' : ''}`}
      aria-label="Press and hold to break the seal"
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') cancel();
      }}
      style={{ '--hold-ms': `${HOLD_MS}ms` } as React.CSSProperties}
    >
      <svg className="env__seal-ring" viewBox="0 0 60 60" aria-hidden="true">
        <circle cx="30" cy="30" r="27" />
      </svg>
      <Seal aria-hidden="true" />
    </button>
  );
}
