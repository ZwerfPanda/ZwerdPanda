import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useContent } from '../../data/store';
import { INK } from '../../components/art/shapes';
import { playSfx } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../hooks/useMotion';
import { Figure } from '../us/Figure';

export const NS_YELLOW = '#ffc917';
export const NS_BLUE = '#003082';

/** A strip of Dutch countryside; drawn twice side by side so it can loop. */
function Countryside({ y }: { y: number }) {
  const strip = (dx: number) => (
    <g transform={`translate(${dx} ${y})`}>
      <path d="M0 40Q60 10 120 34T260 30T400 36V60H0Z" fill="#9cc98b" />
      {/* a windmill */}
      <g transform="translate(70 4)">
        <path d="M-7 36L-4 4H4L7 36Z" fill="#8a6a4f" stroke={INK} strokeWidth="1.6" />
        <g className="train__sails">
          <path
            d="M0 4L-2-22H2ZM0 4L24 2V6ZM0 4L2 30H-2ZM0 4L-24 6V2Z"
            fill="#fff6e6"
            stroke={INK}
            strokeWidth="1.2"
          />
        </g>
      </g>
      {/* houses */}
      <g transform="translate(180 14)" stroke={INK} strokeWidth="1.4">
        <path d="M0 22V8L8 0L16 8V22Z" fill="#d9776a" />
        <path d="M18 22V10L25 3L32 10V22Z" fill="#e8b46c" />
        <path d="M34 22V6L42-2L50 6V22Z" fill="#c8655c" />
      </g>
      {/* trees and a cow */}
      <circle cx="300" cy="22" r="12" fill="#6fa56a" />
      <circle cx="318" cy="26" r="9" fill="#7fb877" />
      <g transform="translate(250 30)">
        <ellipse cx="0" cy="0" rx="9" ry="5" fill="#fff" stroke={INK} strokeWidth="1.2" />
        <circle cx="-3" cy="-1" r="2" fill={INK} />
        <circle cx="9" cy="-3" r="3" fill="#fff" stroke={INK} strokeWidth="1.2" />
      </g>
    </g>
  );
  return (
    <g className="train__land">
      {strip(0)}
      {strip(400)}
    </g>
  );
}

/** An NS double-decker, with mini us at the window. */
export function NSTrain({ waving = true }: { waving?: boolean }) {
  const us = useContent((c) => c.us);
  return (
    <g className="train__body">
      <defs>
        <clipPath id="train-window">
          <rect x="146" y="108" width="128" height="52" rx="10" />
        </clipPath>
      </defs>
      {/* body */}
      <path
        d="M24 54Q24 40 40 40H330Q372 40 386 92L392 150Q394 176 368 178H40Q24 178 24 162Z"
        fill={NS_YELLOW}
        stroke={INK}
        strokeWidth="3"
      />
      {/* blue skirt and stripe */}
      <path d="M24 160H392Q392 178 368 178H40Q24 178 24 162Z" fill={NS_BLUE} />
      <path d="M24 98H388" stroke={NS_BLUE} strokeWidth="4" />
      {/* upper deck windows */}
      {[44, 104, 164, 224, 284].map((x) => (
        <rect
          key={x}
          x={x}
          y="52"
          width="48"
          height="32"
          rx="7"
          fill="#2c3e57"
          stroke={INK}
          strokeWidth="2"
        />
      ))}
      <path d="M338 52H352Q366 54 372 84H338Z" fill="#2c3e57" stroke={INK} strokeWidth="2" />
      {/* lower deck: a door, and our window */}
      <rect
        x="44"
        y="104"
        width="40"
        height="56"
        rx="5"
        fill="#2c3e57"
        stroke={INK}
        strokeWidth="2"
      />
      <path d="M64 104V160" stroke={NS_YELLOW} strokeWidth="2" />
      <rect
        x="92"
        y="108"
        width="46"
        height="52"
        rx="10"
        fill="#2c3e57"
        stroke={INK}
        strokeWidth="2"
      />
      <rect x="146" y="108" width="128" height="52" rx="10" fill="#cfe6f5" />
      <g clipPath="url(#train-window)">
        {/* seats */}
        <rect x="150" y="140" width="120" height="30" rx="6" fill="#3b5d8f" />
        <g transform="translate(186 236) scale(0.42)">
          <Figure
            who="partner"
            look={us.partner.look}
            heightCm={us.partner.heightCm}
            face="happy"
            tilt={12}
            toward={1}
          />
        </g>
        <g transform="translate(229 236) scale(0.42)">
          <Figure
            who="you"
            look={us.you.look}
            heightCm={us.you.heightCm}
            face="grin"
            tilt={-5}
            toward={-1}
            pose={waving ? 'wave' : 'idle'}
          />
        </g>
        <path d="M150 112L176 112L160 160H146Z" fill="#fff" opacity="0.28" />
      </g>
      <rect
        x="146"
        y="108"
        width="128"
        height="52"
        rx="10"
        fill="none"
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect
        x="282"
        y="108"
        width="46"
        height="52"
        rx="10"
        fill="#2c3e57"
        stroke={INK}
        strokeWidth="2"
      />
      {/* nose: headlight and the NS logo */}
      <circle cx="378" cy="150" r="5" fill="#fff8d6" stroke={INK} strokeWidth="1.6" />
      <g
        transform="translate(354 122)"
        fill="none"
        stroke={NS_BLUE}
        strokeWidth="3.4"
        strokeLinecap="round"
      >
        <path d="M-10-4H6L10 0L6 4H-10L-14 0Z" />
      </g>
      {/* little hearts on the side, because it's our train */}
      <path d="M112 146q-4-4-8 0t8 8q12-4 8-8t-8 0z" fill="#e05a7d" />
      {/* bogies */}
      {[70, 330].map((x) => (
        <g key={x}>
          <rect x={x - 32} y="176" width="64" height="10" rx="3" fill="#3a3a44" />
          {[x - 18, x + 18].map((w) => (
            <g key={w} transform={`translate(${w} 190)`}>
              <g className="train__wheel">
                <circle r="9" fill="#4a4a55" stroke={INK} strokeWidth="2" />
                <path d="M-6 0H6M0-6V6" stroke="#9aa0ad" strokeWidth="2" />
              </g>
            </g>
          ))}
        </g>
      ))}
      {/* pantograph */}
      <path d="M300 40L310 22L292 12M310 22L330 22" fill="none" stroke="#555" strokeWidth="2.5" />
    </g>
  );
}

/**
 * The ride between two stops: the train rolls through the Dutch countryside
 * with the two of us waving from the window, then "ding-dong", we're there.
 */
export function TrainRide({
  title,
  kicker,
  onDone,
}: {
  title: string;
  kicker: string;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (reduce) {
      playSfx('chime', true);
      doneRef.current();
      return;
    }
    playSfx('train', true);
    const chime = window.setTimeout(() => playSfx('chime', true), 1500);
    const done = window.setTimeout(() => doneRef.current(), 2500);
    return () => {
      window.clearTimeout(chime);
      window.clearTimeout(done);
    };
  }, [reduce]);

  if (reduce) return null;

  return createPortal(
    <motion.div
      className="train"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.5, times: [0, 0.12, 0.85, 1] }}
    >
      <div className="train__sign">
        <span className="train__kicker">{kicker}</span>
        <span className="train__title">{title}</span>
      </div>
      <svg className="train__svg" viewBox="0 0 400 230" aria-hidden="true">
        <defs>
          <linearGradient id="train-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fc3ec" />
            <stop offset="1" stopColor="#e9f5fb" />
          </linearGradient>
        </defs>
        <rect width="400" height="230" fill="url(#train-sky)" />
        <g className="train__clouds" fill="#fff">
          <ellipse cx="60" cy="30" rx="26" ry="9" />
          <ellipse cx="260" cy="20" rx="34" ry="10" />
          <ellipse cx="460" cy="34" rx="26" ry="9" />
          <ellipse cx="660" cy="20" rx="34" ry="10" />
        </g>
        <Countryside y={120} />
        {/* the track */}
        <rect y="196" width="400" height="34" fill="#b9ae9c" />
        <g className="train__sleepers">
          {Array.from({ length: 30 }, (_, i) => (
            <rect key={i} x={i * 28} y="200" width="14" height="5" fill="#7d6a57" />
          ))}
        </g>
        <path d="M0 199H400" stroke="#6b6560" strokeWidth="3" />
        <motion.g
          initial={{ x: -420 }}
          animate={{ x: [-420, -8, 8, 430] }}
          transition={{ duration: 2.5, times: [0, 0.35, 0.7, 1], ease: 'easeInOut' }}
        >
          <g className="train__bob">
            <NSTrain />
          </g>
        </motion.g>
        {/* catenary poles rush past in front */}
        <g className="train__poles" stroke="#5b6268" strokeWidth="4">
          {[0, 200, 400, 600].map((x) => (
            <g key={x}>
              <path d={`M${x + 40} 230V0`} />
              <path d={`M${x + 40} 16h-40`} strokeWidth="2.5" />
            </g>
          ))}
        </g>
      </svg>
    </motion.div>,
    document.body,
  );
}
