import { motion } from 'framer-motion';
import type { Letter } from '../../data/types';
import { LETTER_COLORS, sealIcon } from './letterStyle';

/**
 * A paper envelope: back, the letter tucked inside, the front pocket, and a
 * flap with a wax seal. `stage` drives the opening animation.
 */
export function Envelope({
  letter,
  stage = 'closed',
  size = 'card',
  sealSlot,
}: {
  letter: Letter;
  stage?: 'closed' | 'open' | 'pulled';
  size?: 'card' | 'large';
  /** Replaces the decorative seal (e.g. with a press-and-hold button). */
  sealSlot?: React.ReactNode;
}) {
  const colors = LETTER_COLORS[letter.color];
  const Seal = sealIcon(letter.seal);
  const open = stage !== 'closed';
  const style = {
    '--env-paper': colors.paper,
    '--env-deep': colors.deep,
    '--env-ink': colors.ink,
    '--env-seal': colors.seal,
  } as React.CSSProperties;

  return (
    <div className={`env env--${size} ${open ? 'is-open' : ''}`} style={style}>
      <div className="env__back" />
      <motion.div
        className="env__letter"
        initial={false}
        animate={{ y: stage === 'pulled' ? '-58%' : '0%' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ zIndex: stage === 'pulled' ? 5 : 1 }}
      >
        <span className="env__letter-lines" />
      </motion.div>
      <div className="env__front">
        <svg className="env__folds" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 200L120 108M300 200L180 108" fill="none" stroke="rgba(45,23,47,.14)" strokeWidth="1.5" />
        </svg>
        <p className="env__label">
          <span className="env__open-when">open when</span>
          <span className="env__occasion">{letter.occasion}</span>
        </p>
      </div>
      <motion.div
        className="env__flap"
        initial={false}
        animate={{ rotateX: open ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        style={{ zIndex: open ? 0 : 3 }}
      />
      {!open &&
        (sealSlot ?? (
          <span className="env__seal" aria-hidden="true">
            <Seal />
          </span>
        ))}
    </div>
  );
}
