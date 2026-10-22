import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion';
import { Carrot, HandHeart, Heart, House, X } from 'lucide-react';
import { getContent, updateContent, updatePrefs, usePrefs, useContent } from '../../data/store';
import { getMe, nameOf } from '../../data/people';
import { navigate, useRoute, type RoutePath } from '../../lib/router';
import { toast } from '../../components/ui/feedback';
import { useReducedMotion } from '../../hooks/useMotion';
import { Bunny } from './Bunny';
import { care, isNapTime, moodOf, needsOf } from './care';
import './companion.css';

/** Little things Coco says when you arrive somewhere with her. */
const LINES: Partial<Record<RoutePath, string[]>> = {
  '/': ['Home sweet home.', 'Hi! I came along.'],
  '/story': ['Is there a chapter about me?', 'I love this story.'],
  '/memories': ['So many photos… am I in them?', 'Ooh, pictures!'],
  '/world': ['I know the way to my house!', 'Can we visit the Matcha Corner?'],
  '/letters': ['I promise not to nibble the envelopes.', 'Shh, someone’s reading.'],
  '/future': ['Is there a garden for me in the future?', 'Big dreams. I approve.'],
  '/surprises': ['I love surprises. Especially crunchy ones.'],
  '/music': ['*ears up* I like this one.', 'Do bunnies dance? This one does.'],
  '/settings': ['Don’t forget to back up my photos!'],
};

/** Coco hops along in a corner of every page (except her own den). */
export function CocoCompanion() {
  const { companion } = usePrefs();
  const { path } = useRoute();
  const pet = useContent((c) => c.pet);
  const profile = useContent((c) => c.profile);
  const reduce = useReducedMotion();
  const controls = useAnimationControls();
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [hearts, setHearts] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const firstRoute = useRef(true);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // A hop (and sometimes a word) whenever you go somewhere.
  useEffect(() => {
    setOpen(false);
    if (firstRoute.current) {
      firstRoute.current = false;
      return;
    }
    if (!reduce) void controls.start({ y: [0, -22, 0, -6, 0], transition: { duration: 0.7 } });
    const options = LINES[path];
    if (options && Math.random() < 0.45) {
      setLine(options[Math.floor(Math.random() * options.length)]);
      const timer = window.setTimeout(() => setLine(null), 3200);
      return () => window.clearTimeout(timer);
    }
  }, [path, controls, reduce]);

  // Close the little menu when tapping elsewhere.
  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  if (!companion || path === '/coco') return null;

  const needs = needsOf(pet, now);
  const mood = moodOf(needs);
  const napping = isNapTime(new Date(now).getHours()) && !open;
  const wants = mood === 'hungry' ? 'food' : mood === 'lonely' ? 'love' : null;

  const cuddle = () => {
    const result = care(getContent().pet, { type: 'pet' }, getMe());
    if (result.ok) updateContent((c) => ({ ...c, pet: result.pet }));
    setHearts((h) => h + 1);
    setLine('*happy tooth purr*');
    window.setTimeout(() => setLine(null), 2400);
    if (!reduce)
      void controls.start({
        y: [0, -30, 0],
        rotate: [0, -12, 8, 0],
        transition: { duration: 0.7 },
      });
    setOpen(false);
  };

  const hide = () => {
    updatePrefs({ companion: false });
    toast('Coco went back to her den. Bring her along again from Coco’s Corner.');
  };

  return (
    <aside className="companion" ref={rootRef} aria-label="Coco">
      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            className="companion__menu"
            role="menu"
            aria-label="Coco"
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: reduce ? 0 : 0.16 }}
          >
            <p className="companion__menu-title">
              {wants === 'food'
                ? 'Coco is a bit hungry.'
                : wants === 'love'
                  ? 'Coco misses you.'
                  : `Hi ${nameOf(getMe(), profile)}!`}
            </p>
            <button type="button" role="menuitem" onClick={cuddle}>
              <HandHeart aria-hidden="true" /> Give her a cuddle
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/coco');
              }}
            >
              {wants === 'food' ? <Carrot aria-hidden="true" /> : <House aria-hidden="true" />}
              {wants === 'food' ? 'Feed her in her den' : 'Visit her den'}
            </button>
            <button type="button" role="menuitem" onClick={hide}>
              <X aria-hidden="true" /> Let her stay home
            </button>
          </motion.div>
        ) : (
          line && (
            <motion.p
              key={line}
              className="companion__line"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.2 }}
            >
              {line}
            </motion.p>
          )
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        className="companion__coco"
        animate={controls}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          wants === 'food'
            ? 'Coco is hungry. Open Coco’s menu'
            : wants === 'love'
              ? 'Coco wants a cuddle. Open Coco’s menu'
              : 'Coco. Open Coco’s menu'
        }
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="-95 -120 190 215" aria-hidden="true">
          <Bunny pose={napping ? 'flop' : 'sit'} outfit={pet.outfit} />
        </svg>
        {wants && !open && (
          <span className={`companion__need companion__need--${wants}`} aria-hidden="true">
            {wants === 'food' ? <Carrot /> : <Heart />}
          </span>
        )}
        {napping && !wants && (
          <span className="companion__zz" aria-hidden="true">
            z
          </span>
        )}
        {hearts > 0 && (
          <span key={hearts} className="companion__hearts" aria-hidden="true">
            ♥ ♥
          </span>
        )}
      </motion.button>
    </aside>
  );
}
