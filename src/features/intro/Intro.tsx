import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useContent, usePrefs } from '../../data/store';
import { useMusic } from '../../components/music/MusicProvider';
import { preloadSpotify, useSpotify } from '../../components/music/SpotifyProvider';
import { spotifyItem } from '../../lib/embeds';
import { defaultProfile } from '../../data/defaults';
import { useReducedMotion } from '../../hooks/useMotion';
import { Starfield } from '../../components/art/Starfield';
import { HeartShape, SparkleShape } from '../../components/art/shapes';
import './intro.css';

const TimeTravel = lazy(() => import('./TimeTravel'));

/**
 * The opening scene: two stars that started far apart drift together and
 * become a little planet. Skippable at any moment, and calm when reduced
 * motion is preferred.
 */
export function Intro({ onEnter }: { onEnter: () => void }) {
  const profile = useContent((c) => c.profile);
  const prefs = usePrefs();
  const music = useMusic();
  const spotify = useSpotify();
  const reduce = useReducedMotion();
  const [travelling, setTravelling] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const songStarted = useRef(false);

  // Our song starts with the first tap (browsers only allow sound after one).
  const startSong = () => {
    if (songStarted.current) return;
    songStarted.current = true;
    if (prefs.soundtrack === 'custom' && prefs.customSoundtrackId) {
      void music.play();
      return;
    }
    const item = spotifyItem(profile.openingSong);
    if (!item) return;
    spotify.open(
      {
        title:
          item.url === defaultProfile.openingSong
            ? 'Risk It All · Bruno Mars'
            : 'Ons openingsliedje',
        uri: item.uri,
        url: item.url,
      },
      { play: true, quiet: true },
    );
  };

  useEffect(() => {
    if (spotifyItem(profile.openingSong)) preloadSpotify();
    // Only once, when the opening appears.
  }, []);
  const leavingRef = useRef(false);
  const enterRef = useRef<HTMLButtonElement>(null);
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  const enter = () => {
    startSong();
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    window.setTimeout(() => onEnterRef.current(), reduce ? 150 : 700);
  };

  useEffect(() => {
    const timer = window.setTimeout(
      () => enterRef.current?.focus({ preventScroll: true }),
      reduce ? 0 : 900,
    );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') enter();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
    };
    // `enter` reads refs only, so binding it once per motion mode is enough.
  }, [reduce]);

  const meetAt = reduce ? 0 : 2.4;
  const t = (seconds: number) => (reduce ? 0 : seconds);

  return (
    <motion.div
      className="intro"
      role="dialog"
      aria-modal="true"
      aria-labelledby="intro-title"
      initial={{ opacity: 1 }}
      animate={leaving ? { opacity: 0, scale: reduce ? 1 : 1.08 } : { opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0.15 : 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      <Starfield count={90} seed="intro" />
      <div className="intro__nebula" aria-hidden="true" />

      <button type="button" className="intro__skip" onClick={enter}>
        Intro overslaan
      </button>

      {travelling ? (
        <Suspense fallback={<div className="intro__stage" />}>
          <TimeTravel onDone={enter} />
        </Suspense>
      ) : (
        <div className="intro__stage">
          <motion.p
            className="intro__whisper"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: t(0.3), duration: 0.8 }}
          >
            Twee mensen. Eén onverwachte livestream.
          </motion.p>

          <svg className="intro__sky" viewBox="0 0 320 170" aria-hidden="true">
            <defs>
              <radialGradient id="intro-glow">
                <stop offset="0" stopColor="#f8e6bb" stopOpacity="0.9" />
                <stop offset="1" stopColor="#f8e6bb" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="intro-planet" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fbe0cd" />
                <stop offset="0.5" stopColor="#d48d96" />
                <stop offset="1" stopColor="#8e7cc3" />
              </linearGradient>
            </defs>

            {/* The two stars, drifting toward each other */}
            <motion.g
              initial={{ x: reduce ? 128 : 36, opacity: reduce ? 0 : 1 }}
              animate={{ x: 128, opacity: [1, 1, 0] }}
              transition={{
                duration: meetAt,
                ease: [0.5, 0, 0.3, 1],
                opacity: { duration: meetAt + 0.2, times: [0, 0.85, 1] },
              }}
            >
              <circle cx="0" cy="85" r="16" fill="url(#intro-glow)" />
              <SparkleShape x={0} y={85} size={16} fill="#fffaf0" />
              <text x="0" y="116" textAnchor="middle" className="intro__name">
                {profile.yourName}
              </text>
            </motion.g>
            <motion.g
              initial={{ x: reduce ? 192 : 284, opacity: reduce ? 0 : 1 }}
              animate={{ x: 192, opacity: [1, 1, 0] }}
              transition={{
                duration: meetAt,
                ease: [0.5, 0, 0.3, 1],
                opacity: { duration: meetAt + 0.2, times: [0, 0.85, 1] },
              }}
            >
              <circle cx="0" cy="85" r="16" fill="url(#intro-glow)" />
              <SparkleShape x={0} y={85} size={16} fill="#fffaf0" />
              <text x="0" y="116" textAnchor="middle" className="intro__name">
                {profile.partnerName}
              </text>
            </motion.g>

            {/* …and become a little planet */}
            <motion.g
              style={{ transformOrigin: '160px 85px' }}
              initial={{ scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: meetAt, type: 'spring', damping: 11, stiffness: 120 }}
            >
              <circle cx="160" cy="85" r="64" fill="url(#intro-glow)" opacity="0.5" />
              <ellipse
                cx="160"
                cy="88"
                rx="58"
                ry="13"
                fill="none"
                stroke="#e8bd6a"
                strokeWidth="2.4"
                transform="rotate(-14 160 88)"
              />
              <circle cx="160" cy="85" r="32" fill="url(#intro-planet)" />
              <path
                d="M134 96c14 8 38 8 52-4"
                fill="none"
                stroke="#fffcf6"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.5"
              />
              <path
                d="M103.72 102.03A58 13 -14 0 0 216.28 73.97"
                fill="none"
                stroke="#e8bd6a"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <HeartShape x={203} y={46} size={14} fill="#d48d96" />
              <SparkleShape x={116} y={44} size={10} fill="#f8e6bb" />
            </motion.g>
          </svg>

          <motion.h1
            id="intro-title"
            className="intro__title"
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ delay: t(meetAt + 0.25), duration: 1 }}
          >
            {profile.siteTitle}
          </motion.h1>
          <motion.p
            className="intro__subtitle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: t(meetAt + 0.7), duration: 0.9 }}
          >
            {profile.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: t(0.9), duration: 0.6 }}
          >
            <button
              ref={enterRef}
              type="button"
              className="intro__enter"
              onClick={() => {
                startSong();
                setTravelling(true);
              }}
            >
              <Play aria-hidden="true" />
              Start ons verhaal
            </button>
            <button type="button" className="intro__quiet" onClick={enter}>
              of ga meteen naar binnen
            </button>
          </motion.div>
        </div>
      )}

      {!travelling && <p className="intro__signature">{profile.signature}</p>}
    </motion.div>
  );
}
