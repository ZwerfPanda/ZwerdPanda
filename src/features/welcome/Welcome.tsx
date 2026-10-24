import { useEffect, useRef, useSyncExternalStore } from 'react';
import { motion } from 'framer-motion';
import { updateContent, useContent } from '../../data/store';
import { useMe } from '../../data/people';
import { nowIso } from '../../lib/id';
import { celebrate } from '../../components/ui/feedback';
import { Starfield } from '../../components/art/Starfield';
import { useReducedMotion } from '../../hooks/useMotion';
import { useSyncState } from '../../sync/sync';
import { BunnySvg } from '../pet/Bunny';
import './welcome.css';

/* A preview can be opened from Settings without marking it as seen. */
let previewing = false;
const listeners = new Set<() => void>();
export function previewWelcome() {
  previewing = true;
  listeners.forEach((l) => l());
}
function closePreview() {
  previewing = false;
  listeners.forEach((l) => l());
}

/** True while the one-time welcome is waiting to be shown on this phone. */
export function useWelcomeDue(): boolean {
  const welcome = useContent((c) => c.welcome);
  const me = useMe();
  const sync = useSyncState();
  return (
    me === 'partner' &&
    Boolean(sync.spaceId) &&
    sync.phase === 'synced' &&
    welcome.enabled &&
    !welcome.seenAt &&
    welcome.message.trim().length > 0
  );
}

/**
 * The one-time welcome: shown to the partner the first time her phone has
 * synced the shared universe, then never again (unless switched back on).
 */
export function WelcomeHost() {
  const preview = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => previewing,
  );
  const due = useWelcomeDue();

  if (!preview && !due) return null;
  return (
    <WelcomeMoment
      onDone={() => {
        if (preview) {
          closePreview();
          return;
        }
        updateContent((c) => ({ ...c, welcome: { ...c.welcome, seenAt: nowIso() } }));
        celebrate();
      }}
    />
  );
}

function WelcomeMoment({ onDone }: { onDone: () => void }) {
  const welcome = useContent((c) => c.welcome);
  const profile = useContent((c) => c.profile);
  const outfit = useContent((c) => c.pet.outfit);
  const reduce = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const title = welcome.title.trim() || `Welkom thuis, ${profile.partnerName}`;
  const signature = welcome.signature.trim() || `— ${profile.yourName}`;
  const paragraphs = welcome.message.split(/\n{2,}/).filter((p) => p.trim());
  const delay = (i: number) => (reduce ? 0 : 0.9 + i * 0.6);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(
      () => buttonRef.current?.focus(),
      reduce ? 0 : (delay(paragraphs.length) + 0.4) * 1000,
    );
    return () => {
      document.body.style.overflow = previous;
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <motion.div
      className="welcome"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0 : 0.8 }}
    >
      <Starfield count={70} seed="welcome" className="welcome__stars" />
      <div className="welcome__inner">
        <motion.div
          className="welcome__coco"
          initial={reduce ? false : { x: -160, opacity: 0 }}
          animate={{ x: 0, opacity: 1, y: reduce ? 0 : [0, -18, 0, -10, 0] }}
          transition={{ duration: reduce ? 0 : 1.4, ease: 'easeOut', delay: reduce ? 0 : 0.3 }}
        >
          <BunnySvg outfit={outfit} face="happy" />
        </motion.div>
        <motion.h1
          id="welcome-title"
          className="welcome__title"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: delay(0) - 0.4 }}
        >
          {title}
        </motion.h1>
        <div className="welcome__letter">
          {paragraphs.map((p, i) => (
            <motion.p
              key={i}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: delay(i) }}
            >
              {p}
            </motion.p>
          ))}
          <motion.p
            className="welcome__sign"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: delay(paragraphs.length) }}
          >
            {signature}
          </motion.p>
        </div>
        <motion.button
          ref={buttonRef}
          type="button"
          className="welcome__enter"
          onClick={onDone}
          initial={reduce ? false : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: delay(paragraphs.length) + 0.3 }}
        >
          Kom binnen ♡
        </motion.button>
      </div>
    </motion.div>
  );
}
