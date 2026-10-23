import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Moon, Sun, Sunset } from 'lucide-react';
import { WorldScene, LANDSCAPE, PORTRAIT, type Light } from './WorldScene';
import { PLACES, PLACE_ORDER } from './places';
import { PlaceArt, type PlaceId } from './PlaceArt';
import { navigate, replaceParams, useRoute } from '../../lib/router';
import { updatePrefs, usePrefs } from '../../data/store';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useReducedMotion } from '../../hooks/useMotion';
import { lockScroll } from '../../components/ui/scrollLock';
import { HiddenHeart } from '../../components/common/HiddenHeart';
import { SiteFooter } from '../../components/common/SiteFooter';
import './world.css';
import { HuntStar } from '../hunt/HuntStar';

function lightFromClock(date = new Date()): Light {
  const hour = date.getHours();
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

const LIGHT_ICONS = { day: Sun, dusk: Sunset, night: Moon } as const;
const LIGHT_LABEL = { day: 'Dag', dusk: 'Schemer', night: 'Nacht' } as const;
const NEXT_MODE = { auto: 'day', day: 'dusk', dusk: 'night', night: 'auto' } as const;

export function WorldPage() {
  const { params } = useRoute();
  const prefs = usePrefs();
  const reduce = useReducedMotion();
  const wide = useMediaQuery('(min-width: 900px) and (min-aspect-ratio: 1/1)');
  const layout = wide ? LANDSCAPE : PORTRAIT;
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [clockLight, setClockLight] = useState<Light>(lightFromClock);
  const [touched, setTouched] = useState(false);

  const selectedParam = params.get('place') as PlaceId | null;
  const selected = selectedParam && selectedParam in PLACES ? selectedParam : null;
  const light: Light = prefs.worldLight === 'auto' ? clockLight : prefs.worldLight;

  useEffect(() => {
    const timer = window.setInterval(() => setClockLight(lightFromClock()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Lets the top bar pick readable colours over a bright daytime sky.
  useEffect(() => {
    document.documentElement.dataset.worldLight = light;
    return () => {
      delete document.documentElement.dataset.worldLight;
    };
  }, [light]);

  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const select = (id: PlaceId | null) => {
    setTouched(true);
    replaceParams({ place: id });
  };

  // Camera: zoom toward the chosen place, leaving room for the panel.
  const camera = (() => {
    if (!selected || !size.w || reduce) return { x: 0, y: 0, scale: 1 };
    const fit = Math.min(size.w / layout.width, size.h / layout.height);
    const ox = (size.w - layout.width * fit) / 2;
    const oy = (size.h - layout.height * fit) / 2;
    const [px, py] = layout.places[selected];
    const sx = ox + px * fit;
    const sy = oy + (py - 40) * fit;
    const zoom = wide ? 1.7 : 1.85;
    const tx = wide ? (size.w - 440) / 2 : size.w / 2;
    const ty = wide ? size.h / 2 : size.h * 0.24;
    return { x: tx - sx * zoom, y: ty - sy * zoom, scale: zoom };
  })();

  const LightIcon = LIGHT_ICONS[light];
  const lightText =
    prefs.worldLight === 'auto' ? `${LIGHT_LABEL[light]} · live` : LIGHT_LABEL[light];

  return (
    <div className="world-page">
      <section className={`world-stage world-stage--${light}`} aria-labelledby="world-title">
        <div className="world-stage__viewport" ref={stageRef}>
          <motion.div
            className="world-camera"
            initial={false}
            animate={camera}
            transition={{ type: 'spring', damping: 30, stiffness: 120, mass: 1 }}
          >
            <WorldScene
              layout={layout}
              light={light}
              selected={selected}
              onSelect={select}
              animate={!reduce}
            />
          </motion.div>
        </div>

        <div className={`world-overlay ${selected ? 'is-hidden' : ''}`}>
          <p className="world-overlay__eyebrow hand">a tiny map of us</p>
          <h1 id="world-title" className="world-overlay__title">
            Onze Kleine Wereld
          </h1>
          <AnimatePresence>
            {!touched && (
              <motion.p
                className="world-overlay__hint"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.6 }}
              >
                Tik op een plek om erheen te gaan
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          className={`world-light ${selected ? 'is-hidden' : ''}`}
          onClick={() => updatePrefs({ worldLight: NEXT_MODE[prefs.worldLight] })}
          aria-label={`${lightText} — verander het licht${prefs.worldLight === 'auto' ? ' (volgt nu de klok)' : ''}`}
        >
          <LightIcon aria-hidden="true" />
          <span>{lightText}</span>
        </button>

        {createPortal(
          <AnimatePresence>
            {selected && (
              <PlacePanel
                key={selected}
                id={selected}
                wide={wide}
                onClose={() => select(null)}
                onGo={select}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
      </section>

      <section className="world-index" aria-labelledby="world-index-title">
        <h2 id="world-index-title" className="world-index__title">
          Plekjes in onze wereld
        </h2>
        <ul className="world-index__list">
          {PLACE_ORDER.map((id) => (
            <li key={id}>
              <button type="button" className="world-index__item" onClick={() => select(id)}>
                <svg viewBox="-70 -125 140 140" aria-hidden="true">
                  <PlaceArt id={id} />
                </svg>
                <span>
                  <span className="world-index__name">{PLACES[id].name}</span>
                  <span className="world-index__tag">{PLACES[id].tagline}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="world-index__secret">
          Sommige dingen in deze wereld zijn expres verstopt <HiddenHeart />
          <HuntStar id="world" className="hunt-star--inline" />
        </p>
        <SiteFooter />
      </section>
    </div>
  );
}

function PlacePanel({
  id,
  wide,
  onClose,
  onGo,
}: {
  id: PlaceId;
  wide: boolean;
  onClose: () => void;
  onGo: (id: PlaceId) => void;
}) {
  const info = PLACES[id];
  const Body = info.Body;
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const index = PLACE_ORDER.indexOf(id);
  const next = PLACE_ORDER[(index + 1) % PLACE_ORDER.length];
  const prev = PLACE_ORDER[(index - 1 + PLACE_ORDER.length) % PLACE_ORDER.length];

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const unlock = lockScroll();
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.dialog-root')) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      unlock();
      document.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous) && !previous.closest('.place-panel'))
        previous.focus({ preventScroll: true });
    };
  }, []);

  const offscreen = wide ? { x: 460, y: 0 } : { x: 0, y: 500 };

  return (
    <motion.aside
      ref={panelRef}
      className="place-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="place-title"
      tabIndex={-1}
      initial={reduce ? { opacity: 0 } : { ...offscreen, opacity: 0 }}
      animate={{ x: 0, y: 0, opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { ...offscreen, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 260 }}
    >
      <div className="place-panel__top">
        <button type="button" className="btn btn--ghost btn--small" onClick={onClose}>
          <ArrowLeft aria-hidden="true" /> Terug naar onze wereld
        </button>
        <div className="place-panel__step">
          <button
            type="button"
            className="icon-btn"
            onClick={() => onGo(prev)}
            aria-label={`Vorige plek: ${PLACES[prev].name}`}
          >
            <ArrowLeft />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onGo(next)}
            aria-label={`Volgende plek: ${PLACES[next].name}`}
          >
            <ArrowRight />
          </button>
        </div>
      </div>
      <div className="place-panel__scroll">
        <p className="place-panel__tagline hand">{info.tagline}</p>
        <h2 id="place-title" className="place-panel__title">
          {info.name}
        </h2>
        <p className="place-panel__blurb">{info.blurb}</p>
        <div className="place-panel__body">
          <Body />
        </div>
        <button
          type="button"
          className="btn btn--soft place-panel__cta"
          onClick={() => navigate(info.cta.path, info.cta.params)}
        >
          {info.cta.label} <ArrowRight aria-hidden="true" />
        </button>
      </div>
    </motion.aside>
  );
}
