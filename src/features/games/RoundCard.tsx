import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '../../hooks/useMotion';
import './roundcard.css';

/** The end of a round: the score, what went into it, and a record when there is one. */
export function RoundCard({
  title,
  score,
  stats,
  record = false,
  stars,
  children,
}: {
  title: string;
  score: number;
  stats: { label: string; value: string | number }[];
  record?: boolean;
  /** One to three stars, for how the round went. */
  stars?: number;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  // in view when it appears (it sits under the game)
  useEffect(() => {
    card.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, []);
  return (
    <motion.div
      ref={card}
      className="round-card"
      role="status"
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {record && <span className="round-card__record">★ Nieuw record! ★</span>}
      <p className="round-card__title">{title}</p>
      {stars !== undefined && (
        <p className="round-card__stars" aria-label={`${stars} van de 3 sterren`}>
          {[1, 2, 3].map((n) => (
            <motion.span
              key={n}
              className={n <= stars ? 'is-on' : ''}
              aria-hidden="true"
              initial={reduce ? false : { scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.25 + n * 0.18, type: 'spring', stiffness: 300, damping: 12 }}
            >
              ★
            </motion.span>
          ))}
        </p>
      )}
      <p className="round-card__score">{score}</p>
      <dl className="round-card__stats">
        {stats.map((s) => (
          <div key={s.label}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </motion.div>
  );
}
