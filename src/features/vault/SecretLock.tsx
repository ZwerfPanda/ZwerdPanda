import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useReducedMotion } from '../../hooks/useMotion';
import { playSfx } from '../../lib/audio/sfx';
import './secret-lock.css';

const FOUND_KEY = 'olu:secret-found:v1';

function foundBefore(): boolean {
  try {
    return localStorage.getItem(FOUND_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * The little golden lock at the bottom of every page. Tap it and a key turns,
 * two velvet doors swing open — and you're in our secret room.
 */
export function SecretLock() {
  const reduce = useReducedMotion();

  // The reveal lives outside this page: it keeps playing while the secret room loads behind it.
  const go = () => {
    if (reduce) {
      location.hash = '#/secret';
      return;
    }
    if (document.querySelector('.secret-reveal')) return;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    root.render(
      <Reveal
        onDone={() => {
          root.unmount();
          host.remove();
        }}
      />,
    );
  };

  return (
    <>
      <button
        type="button"
        className="site-footer__lock secret-lock"
        onClick={go}
        aria-label="Ons geheimpje"
      >
        <svg viewBox="0 0 24 28" aria-hidden="true">
          <path
            d="M7 12V8.5a5 5 0 0 1 10 0V12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            className="secret-lock__shackle"
          />
          <rect x="3" y="11.5" width="18" height="14" rx="4" fill="currentColor" />
          <path d="M12 16.2l-1.9-1.9a1.3 1.3 0 0 1 1.9-1.6a1.3 1.3 0 0 1 1.9 1.6z" fill="#2c0b22" />
          <path d="M12 18v3" stroke="#2c0b22" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}

function Reveal({ onDone }: { onDone: () => void }) {
  const [first] = useState(() => !foundBefore());
  useEffect(() => {
    try {
      localStorage.setItem(FOUND_KEY, '1');
    } catch {
      /* fine: then it's a first time again next time */
    }
    playSfx('unlock', true);
    const timers = [
      window.setTimeout(() => playSfx('sparkle', true), 900),
      // Behind the closed doors the room gets ready…
      window.setTimeout(() => {
        location.hash = '#/secret';
        window.scrollTo(0, 0);
      }, 1000),
      window.setTimeout(onDone, 2700),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="secret-reveal" role="status" aria-live="polite">
      <div className="secret-reveal__door is-left" aria-hidden="true" />
      <div className="secret-reveal__door is-right" aria-hidden="true" />
      <div className="secret-reveal__light" aria-hidden="true" />
      <div className="secret-reveal__lock" aria-hidden="true">
        <svg viewBox="0 0 120 150">
          <defs>
            <linearGradient id="reveal-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f7dc8f" />
              <stop offset="0.5" stopColor="#d9a441" />
              <stop offset="1" stopColor="#8a5a1a" />
            </linearGradient>
          </defs>
          <path
            d="M60 6c28 0 50 20 50 46v60c0 18-22 32-50 32S10 130 10 112V52C10 26 32 6 60 6z"
            fill="url(#reveal-gold)"
            stroke="#5a3a10"
            strokeWidth="2"
          />
          <path d="M60 52a14 14 0 0 1 8 25.5L74 108H46l6-30.5A14 14 0 0 1 60 52z" fill="#1a0610" />
        </svg>
        <svg className="secret-reveal__key" viewBox="0 0 40 120">
          <circle cx="20" cy="16" r="13" fill="none" stroke="#f7dc8f" strokeWidth="6" />
          <path
            d="M20 29v76M20 92h10M20 104h7"
            stroke="#f7dc8f"
            strokeWidth="6"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="secret-reveal__text">
        <span>{first ? 'Je hebt iets gevonden…' : 'Welkom terug…'}</span>
        <strong>{first ? 'onze geheime kamer 🤫' : 'in onze geheime kamer'}</strong>
      </p>
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="secret-reveal__spark"
          aria-hidden="true"
          style={
            {
              '--a': `${(i / 14) * 360}deg`,
              '--d': `${0.9 + (i % 3) * 0.08}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
