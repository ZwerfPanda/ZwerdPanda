import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useContent } from '../../data/store';
import { useReducedMotion } from '../../hooks/useMotion';
import { durationBetween, parseIsoDate, todayIso } from '../../lib/dates';
import { CocoFigure, SampleArt } from '../../components/art/SampleArt';
import { StopScene } from '../museum/scenes';
import { NSTrain } from '../museum/TrainRide';
import { HeartScene } from '../home/HeartScene';
import { usePetName } from '../her/petName';

interface Chapter {
  key: string;
  caption: string;
  art: ReactNode;
}

const STEP_MS = 3800;

/**
 * Time travel through us: from the livestream where it started to today, in
 * little scenes with mini us, while our song plays. Tap to go faster.
 */
export default function TimeTravel({ onDone }: { onDone: () => void }) {
  const startDate = useContent((c) => c.profile.startDate);
  const reduce = useReducedMotion();
  const petName = usePetName();
  const [index, setIndex] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const start = parseIsoDate(startDate);
  const total = start ? (durationBetween(start, parseIsoDate(todayIso())!)?.totalDays ?? 0) : 0;

  const chapters: Chapter[] = [
    {
      key: 'live',
      caption: 'Het begon ergens waar we het allebei niet verwachtten: een TikTok-livestream.',
      art: (
        <div className="tt-art tt-art--sample">
          <SampleArt art="phone" />
        </div>
      ),
    },
    {
      key: 'mall',
      caption: 'Onze eerste date. En onze eerste kus, bij de matchawinkel.',
      art: <StopScene theme="mall" label="Onze eerste kus" />,
    },
    {
      key: 'train',
      caption: 'Daarna: trein, metro, haltes tellen — elke keer naar jou toe.',
      art: (
        <svg viewBox="0 0 400 230" className="tt-train" preserveAspectRatio="xMidYMid slice">
          <rect width="400" height="230" fill="#bfe0f5" />
          <path d="M0 150Q100 120 200 146T400 140V230H0Z" fill="#9cc98b" />
          <rect y="196" width="400" height="34" fill="#b9ae9c" />
          <g transform="translate(-6 0)">
            <NSTrain />
          </g>
        </svg>
      ),
    },
    {
      key: 'platform',
      caption: 'Moerwijk. Ik was er vroeg, ging laat weer weg, en was pas in de nacht thuis.',
      art: <StopScene theme="platform" label="Een knuffel op Moerwijk" />,
    },
    {
      key: 'coco',
      caption: 'Toen kwam Coco. Ons kleine chaosje. 🐰',
      art: (
        <svg viewBox="-120 -110 240 220" className="tt-coco" preserveAspectRatio="xMidYMid slice">
          <rect x="-120" y="-110" width="240" height="220" fill="#fbeeec" />
          <circle cx="0" cy="10" r="80" fill="#f5dad6" />
          <CocoFigure x={0} y={-6} scale={1} blink />
        </svg>
      ),
    },
    {
      key: 'park',
      caption: 'Achtbanen, reuzenraden, de grootste knuffel van het park…',
      art: <StopScene theme="themepark" label="Walibi" />,
    },
    {
      key: 'pumpkin',
      caption: '…en ik die jou bang maakte in het doolhof. 👻',
      art: <StopScene theme="pumpkin" label="De pumpkin patch" />,
    },
    {
      key: 'heart',
      caption: total
        ? `${total} dagen samen. En we zijn nog maar net begonnen.`
        : 'En we zijn nog maar net begonnen.',
      art: (
        <svg viewBox="-240 -340 480 350" className="tt-heart">
          <rect x="-240" y="-340" width="480" height="350" fill="#2a1530" />
          <HeartScene progress={1} />
        </svg>
      ),
    },
  ];

  const last = index >= chapters.length;

  useEffect(() => {
    if (reduce || last) return;
    const timer = window.setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [index, reduce, last]);

  const next = () => setIndex((i) => Math.min(i + 1, chapters.length));
  const chapter = chapters[index];
  const day = total && !last ? Math.round((total * index) / (chapters.length - 1)) : total;

  return (
    <div className="tt" onClick={last ? undefined : next}>
      <div className="tt__tunnel" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={`${index}-${i}`} style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
      </div>
      {!last && (
        <p className="tt__eyebrow" aria-hidden="true">
          time travel{total ? ` · dag ${day}` : ''}
        </p>
      )}
      <AnimatePresence mode="wait">
        {!last ? (
          <motion.figure
            key={chapter.key}
            className="tt__chapter"
            initial={
              reduce ? { opacity: 0 } : { opacity: 0, scale: 0.55, rotate: -4, filter: 'blur(8px)' }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.35, filter: 'blur(10px)' }}
            transition={{ duration: reduce ? 0.2 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="tt__frame">{chapter.art}</div>
            <figcaption className="tt__caption" aria-live="polite">
              {chapter.caption}
            </figcaption>
          </motion.figure>
        ) : (
          <motion.div
            key="end"
            className="tt__end"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <p className="tt__eyebrow">nu</p>
            <h2 className="tt__welcome">Welkom thuis, {petName} ♡</h2>
            <button
              type="button"
              className="intro__enter"
              onClick={() => doneRef.current()}
              autoFocus
            >
              Ons universe in
              <ArrowRight aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {!last && (
        <div className="tt__dots" aria-hidden="true">
          {chapters.map((c, i) => (
            <span key={c.key} className={i <= index ? 'is-on' : ''} />
          ))}
        </div>
      )}
      {!last && (
        <p className="tt__hint">{reduce ? 'tik voor het volgende' : 'tik om sneller te reizen'}</p>
      )}
    </div>
  );
}
