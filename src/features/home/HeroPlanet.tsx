import { useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { useContent } from '../../data/store';
import { useReducedMotion } from '../../hooks/useMotion';
import { celebrateFrom } from '../../components/ui/feedback';
import { HeartShape, INK, SparkleShape, StarShape } from '../../components/art/shapes';

/**
 * The little planet on the home page. Tiny versions of our places sit on its
 * surface; tapping it gives it a spin and lets a little reason float out.
 */
export function HeroPlanet() {
  const reasons = useContent((c) => c.surprises.reasons);
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [note, setNote] = useState<{ text: string; key: number } | null>(null);
  const lastIndex = useRef(-1);
  const spins = useRef(0);

  const spin = () => {
    if (reasons.length === 0) return;
    let index = Math.floor(Math.random() * reasons.length);
    if (reasons.length > 1 && index === lastIndex.current) index = (index + 1) % reasons.length;
    lastIndex.current = index;
    spins.current += 1;
    setNote({ text: reasons[index], key: spins.current });
    if (!reduce) {
      void controls.start({ rotate: spins.current * 360, transition: { type: 'spring', damping: 14, stiffness: 50 } });
      celebrateFrom(buttonRef.current);
    }
  };

  return (
    <div className="hero-planet">
      <button
        ref={buttonRef}
        type="button"
        className="hero-planet__button"
        onClick={spin}
        aria-label="Spin our little planet for a surprise"
      >
        <svg viewBox="0 0 300 300" className="hero-planet__svg" aria-hidden="true">
          <defs>
            <radialGradient id="hp-glow">
              <stop offset="0.45" stopColor="#f8e6bb" stopOpacity="0.45" />
              <stop offset="1" stopColor="#f8e6bb" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="hp-body" x1="0.15" y1="0.1" x2="0.85" y2="0.95">
              <stop offset="0" stopColor="#fde7d6" />
              <stop offset="0.35" stopColor="#f2b9ae" />
              <stop offset="0.7" stopColor="#c88ba7" />
              <stop offset="1" stopColor="#7a5aa6" />
            </linearGradient>
            <clipPath id="hp-clip">
              <circle cx="150" cy="158" r="78" />
            </clipPath>
          </defs>

          <circle cx="150" cy="158" r="140" fill="url(#hp-glow)" />

          {/* Orbiting keepsakes */}
          <g className="hero-planet__orbit">
            <circle cx="150" cy="158" r="126" fill="none" stroke="#fff4ea" strokeOpacity="0.35" strokeDasharray="2 8" strokeLinecap="round" />
            <g transform="translate(150 32)">
              <circle r="15" fill="#fffcf6" stroke={INK} strokeWidth="2" />
              <path d="M-6-6h12l-2 13h-8z" fill="#a7c191" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M2-12l-2 6" stroke="#b9646f" strokeWidth="2.4" strokeLinecap="round" />
            </g>
            <g transform="translate(259 221)">
              <circle r="14" fill="#fffcf6" stroke={INK} strokeWidth="2" />
              <HeartShape x={0} y={0} size={14} fill="#d48d96" />
            </g>
            <g transform="translate(41 221)">
              <circle r="14" fill="#fffcf6" stroke={INK} strokeWidth="2" />
              <StarShape x={0} y={0.5} size={14} fill="#e8bd6a" />
            </g>
          </g>

          {/* Back half of the ring */}
          <ellipse cx="150" cy="168" rx="118" ry="24" fill="none" stroke="#e8bd6a" strokeWidth="4" transform="rotate(-12 150 168)" opacity="0.8" />

          <motion.g animate={controls} style={{ originX: '150px', originY: '158px' }}>
            <circle cx="150" cy="158" r="78" fill="url(#hp-body)" />
            <g clipPath="url(#hp-clip)" opacity="0.45">
              <path d="M96 160c10-12 26-12 36-4s22 8 30 0 30-10 40 0c8 8 4 18-6 20-14 3-22-6-34-2s-26 12-44 6c-14-4-30-8-22-20z" fill="#fde7d6" />
              <path d="M128 208c12-8 30-8 42-2s22 2 30-4c6 10-2 22-14 24-18 4-30-6-44-4-8 1-20-6-14-14z" fill="#e4ddf5" />
              <circle cx="186" cy="124" r="10" fill="#fde7d6" />
              <circle cx="112" cy="122" r="6" fill="#fde7d6" />
            </g>
            <circle cx="150" cy="158" r="78" fill="none" stroke={INK} strokeWidth="3" />

            {/* A little house on top */}
            <g transform="translate(150 80)">
              <rect x="-15" y="-22" width="30" height="22" fill="#fbf4ea" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
              <path d="M-20-20L0-38 20-20z" fill="#b9646f" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
              <rect x="-4" y="-13" width="8" height="13" rx="4" fill="#3f2140" />
              <rect x="7" y="-17" width="6" height="6" fill="#f8e6bb" stroke={INK} strokeWidth="1.5" />
            </g>
            {/* A tree */}
            <g transform="translate(97 102) rotate(-42)">
              <path d="M0 0v-14" stroke={INK} strokeWidth="3" strokeLinecap="round" />
              <circle cx="0" cy="-22" r="11" fill="#a7c191" stroke={INK} strokeWidth="2.4" />
              <circle cx="3" cy="-25" r="2" fill="#d48d96" />
            </g>
            {/* Coco peeking over the horizon */}
            <g transform="translate(205 104) rotate(44)">
              <ellipse cx="-5" cy="-18" rx="3.5" ry="9" fill="#d9b48f" stroke={INK} strokeWidth="2" />
              <ellipse cx="5" cy="-18" rx="3.5" ry="9" fill="#d9b48f" stroke={INK} strokeWidth="2" />
              <ellipse cx="0" cy="-6" rx="11" ry="9" fill="#d9b48f" stroke={INK} strokeWidth="2" />
              <circle cx="-4" cy="-7" r="1.5" fill={INK} />
              <circle cx="4" cy="-7" r="1.5" fill={INK} />
            </g>
          </motion.g>

          {/* Front half of the ring */}
          <path
            d="M34.6 192.5A118 24 -12 0 0 265.4 143.5"
            fill="none"
            stroke="#e8bd6a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <SparkleShape x={262} y={72} size={18} fill="#fff4ea" className="hero-planet__twinkle" />
          <SparkleShape x={36} y={96} size={12} fill="#fff4ea" className="hero-planet__twinkle hero-planet__twinkle--late" />
        </svg>
      </button>

      <div className="hero-planet__note-slot" aria-live="polite">
        <AnimatePresence mode="wait">
          {note ? (
            <motion.p
              key={note.key}
              className="hero-planet__note"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
            >
              <span className="hero-planet__note-label">a little reason</span>
              {note.text}
            </motion.p>
          ) : (
            <motion.p key="hint" className="hero-planet__hint" exit={{ opacity: 0 }}>
              tap the planet ↑
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
