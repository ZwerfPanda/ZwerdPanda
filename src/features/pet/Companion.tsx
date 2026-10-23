import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Carrot, HandHeart, Heart, House } from 'lucide-react';
import { getContent, updateContent, usePrefs, useContent } from '../../data/store';
import { getMe, nameOf } from '../../data/people';
import { navigate, useRoute, type RoutePath } from '../../lib/router';
import { useReducedMotion } from '../../hooks/useMotion';
import { useIsDesktop } from '../../hooks/useMediaQuery';
import { Bunny } from './Bunny';
import { BunnySide } from './BunnySide';
import { useHopper } from './useHopper';
import { sendCocoHome } from './home';
import { care, isNapTime, moodOf, needsOf } from './care';
import { cocoGameTalk } from '../games/gameStats';
import './companion.css';

/** Little things Coco says when you arrive somewhere with her. */
const LINES: Partial<Record<RoutePath, string[]>> = {
  '/her': [
    'Dit is jouw plekje. Ik pas erop.',
    'Ik lees niet mee, beloofd. *oortjes plat*',
    'Zo’n mooi thema!',
  ],
  '/': ['Home sweet home.', 'Hoi! Ik ben meegekomen.'],
  '/story': ['Is er een hoofdstuk over mij?', 'Ik vind dit verhaal zo leuk.'],
  '/memories': ['Zoveel foto’s… sta ik erop?', 'Ooh, foto’s!'],
  '/world': ['Ik weet de weg naar mijn huisje!', 'Gaan we naar de Matcha Corner?'],
  '/letters': ['Ik beloof dat ik niet aan de enveloppen knabbel.', 'Ssst, er wordt gelezen.'],
  '/future': ['Is er later een tuintje voor mij?', 'Grote dromen. Approved.'],
  '/surprises': ['Ik hou van surprises. Vooral knapperige.'],
  '/music': ['*oortjes omhoog* Deze vind ik leuk.', 'Dansen konijnen? Deze wel.'],
  '/settings': ['Vergeet geen back-up van mijn foto’s!'],
};

/* Her little patch of screen is 100 px wide; 50 is her resting spot. */
const REST = 50;

/** Coco hops along in a corner of every page (except her own den). */
export function CocoCompanion() {
  const { companion } = usePrefs();
  const { path } = useRoute();
  if (!companion || path === '/coco') return null;
  return <Companion path={path} />;
}

function Companion({ path }: { path: RoutePath }) {
  const pet = useContent((c) => c.pet);
  const profile = useContent((c) => c.profile);
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const hop = useHopper(reduce, 300);
  const [open, setOpen] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [hearts, setHearts] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const lastPath = useRef(path);
  const rootRef = useRef<HTMLElement>(null);

  const needs = needsOf(pet, now);
  const mood = moodOf(needs);
  const napping = isNapTime(new Date(now).getHours()) && !open && !leaving;
  const wants = mood === 'hungry' ? 'food' : mood === 'lonely' ? 'love' : null;

  const speak = (text: string, ms = 3200) => {
    setLine(text);
    window.setTimeout(() => setLine((l) => (l === text ? null : l)), ms);
  };

  // She hops in when she arrives.
  useEffect(() => {
    hop.setWidth(100);
    const t = hop.begin();
    hop.place(desktop ? 96 : 4);
    hop.opacity.set(0);
    void (async () => {
      if (!(await hop.fade(t, 1, 0.2))) return;
      if (!(await hop.hopTo(t, REST))) return;
      hop.show('front');
    })();
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearInterval(timer);
      hop.begin();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A hop (and sometimes a word) whenever you go somewhere.
  useEffect(() => {
    setOpen(false);
    if (lastPath.current === path) return;
    lastPath.current = path;
    const t = hop.begin();
    hop.opacity.set(1);
    hop.show('front');
    void hop.hopInPlace(t, 0.08);
    // In the arcade (and now and then elsewhere) she talks about our games.
    const me = getMe();
    const talk =
      Math.random() < (path === '/games' ? 0.7 : 0.1)
        ? cocoGameTalk(getContent(), me, nameOf(me, getContent().profile), Math.random)
        : null;
    if (talk) {
      speak(talk, 4200);
      return;
    }
    const options = LINES[path];
    if (options && Math.random() < 0.45) speak(options[Math.floor(Math.random() * options.length)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Now and then she wanders a few hops and looks around.
  useEffect(() => {
    if (reduce || open || leaving || napping) return;
    const timer = window.setTimeout(
      async () => {
        const t = hop.begin();
        const range = desktop ? [24, REST] : [REST, 76];
        const to = range[0] + Math.random() * (range[1] - range[0]);
        if (!(await hop.hopTo(t, to))) return;
        hop.show('side', 'sniff');
        if (!(await hop.wait(t, 1200))) return;
        if (!(await hop.hopTo(t, REST))) return;
        hop.show('front');
        setNow(Date.now());
      },
      14_000 + Math.random() * 12_000,
    );
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce, open, leaving, napping, desktop, now]);

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

  const cuddle = async () => {
    setOpen(false);
    const result = care(getContent().pet, { type: 'pet' }, getMe());
    if (result.ok) updateContent((c) => ({ ...c, pet: result.pet }));
    setHearts((h) => h + 1);
    speak('*blij tandengeknars*', 2400);
    const t = hop.begin();
    hop.show('front');
    await hop.hopInPlace(t, 0.1);
  };

  const goHome = async () => {
    setOpen(false);
    setLeaving(true);
    speak('Doei! Ik ben in mijn hokje…', 1800);
    const t = hop.begin();
    if (!reduce) {
      await hop.hopTo(t, desktop ? 96 : 4, 'run');
      await hop.fade(t, 0, 0.3);
    }
    sendCocoHome(path);
  };

  return (
    <aside
      className={`companion${desktop ? ' companion--right' : ''}`}
      ref={rootRef}
      aria-label="Coco"
    >
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
                ? 'Coco heeft een beetje honger.'
                : wants === 'love'
                  ? 'Coco mist je.'
                  : `Hoi ${nameOf(getMe(), profile)}!`}
            </p>
            <button type="button" role="menuitem" data-sfx="heart" onClick={() => void cuddle()}>
              <HandHeart aria-hidden="true" /> Geef haar een knuffel
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
              {wants === 'food' ? 'Geef haar eten in haar holletje' : 'Naar haar holletje'}
            </button>
            <button type="button" role="menuitem" onClick={() => void goHome()}>
              <House aria-hidden="true" /> Laat haar thuis
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

      <div className="companion__patch">
        <motion.div className="companion__mover" style={{ x: hop.x }}>
          <motion.div style={{ y: hop.y, opacity: hop.opacity }}>
            <motion.button
              type="button"
              className="companion__coco"
              style={{ scaleX: hop.scaleX, scaleY: hop.scaleY, rotate: hop.rotate }}
              aria-haspopup="menu"
              data-sfx="squeak"
              aria-expanded={open}
              disabled={leaving}
              aria-label={
                wants === 'food'
                  ? 'Coco heeft honger. Open Coco’s menu'
                  : wants === 'love'
                    ? 'Coco wil een knuffel. Open Coco’s menu'
                    : 'Coco. Open Coco’s menu'
              }
              onClick={() => {
                const t = hop.begin();
                hop.opacity.set(1);
                hop.show('front');
                void hop.hopTo(t, REST).then(() => hop.show('front'));
                setOpen((o) => !o);
              }}
            >
              <svg viewBox="-95 -120 190 215" aria-hidden="true">
                {hop.view === 'front' ? (
                  <Bunny pose={napping ? 'flop' : 'sit'} outfit={pet.outfit} />
                ) : (
                  <BunnySide pose={hop.sidePose} outfit={pet.outfit} />
                )}
              </svg>
            </motion.button>
          </motion.div>
          {wants && !open && !leaving && (
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
        </motion.div>
      </div>
    </aside>
  );
}
