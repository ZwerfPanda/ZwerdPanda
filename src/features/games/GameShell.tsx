import { useEffect, type ReactNode } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useContent } from '../../data/store';
import { getAuthor, setMe } from '../../data/people';
import { href } from '../../lib/router';
import { playSfx } from '../../lib/audio/sfx';
import { refreshNow } from './gameData';
import { GoldenBadge } from './GoldenDay';
import { ChatBarButton, PresencePill } from '../chat/ArcadeChat';
import './arcade.css';

export type PlayMode = 'remote' | 'coco' | 'local';

const MODE_LABEL: Record<PlayMode, string> = {
  remote: '📱↔📱 Samen',
  coco: '🐰 Tegen Coco',
  local: '📱 Op één telefoon',
};

/** The frame around every game: back to the hall, a neon title, how we play, the score. */
export function GameShell({
  id,
  title,
  mode,
  onMode,
  modes = ['remote', 'coco'],
  labels,
  score,
  children,
}: {
  id: string;
  title: string;
  mode?: PlayMode;
  onMode?: (mode: PlayMode) => void;
  modes?: PlayMode[];
  labels?: Partial<Record<PlayMode, string>>;
  score?: ReactNode;
  children: ReactNode;
}) {
  // Playing apart: look for the other's move every few seconds.
  useEffect(() => {
    if (mode !== 'remote') return;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshNow();
    }, 6000);
    return () => window.clearInterval(t);
  }, [mode]);

  return (
    <div className={`page arcade-zone game game--${id}`}>
      <div className="game__bar">
        <a className="game__back" href={href('/games')}>
          <ArrowLeft aria-hidden="true" /> Arcade Hall
        </a>
        <span className="game__bar-end">
          {mode === 'remote' && (
            <button
              type="button"
              className="game__refresh"
              aria-label="Kijk of de ander al gezet heeft"
              onClick={refreshNow}
            >
              <RefreshCw />
            </button>
          )}
          <ChatBarButton />
        </span>
      </div>
      <PresencePill game={id} />
      <h1 className="game__title">
        <span>{title}</span>
      </h1>
      {mode && onMode && modes.length > 1 && (
        <div className="game__modes" role="tablist" aria-label="Hoe spelen we?">
          {modes.map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className="game__mode"
              data-sfx="none"
              onClick={() => {
                playSfx('coin', true);
                onMode(m);
              }}
            >
              {labels?.[m] ?? MODE_LABEL[m]}
            </button>
          ))}
        </div>
      )}
      {mode === 'remote' && <GoldenBadge />}
      {score}
      {children}
    </div>
  );
}

/** Remote games need to know whose phone this is. */
export function WhoAreYou({ children }: { children: ReactNode }) {
  const profile = useContent((c) => c.profile);
  if (getAuthor()) return <>{children}</>;
  return (
    <div className="game-panel">
      <p>Eerst even: wie ben jij op deze telefoon?</p>
      <div className="game-actions">
        <button type="button" className="neon-btn" onClick={() => setMe('you')}>
          Ik ben {profile.yourName}
        </button>
        <button type="button" className="neon-btn" onClick={() => setMe('partner')}>
          Ik ben {profile.partnerName}
        </button>
      </div>
    </div>
  );
}

/** An LED score panel: names with their wins (or records). */
export function ScoreBoard({
  entries,
  label,
}: {
  entries: { name: string; value: ReactNode; me?: boolean }[];
  label: string;
}) {
  return (
    <div className="led-board" aria-label={label}>
      <span className="led-board__label">{label}</span>
      <div className="led-board__row">
        {entries.map((e) => (
          <span key={e.name} className={`led-board__cell ${e.me ? 'is-me' : ''}`}>
            <small>{e.name}</small>
            <strong>{e.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/** "Your turn" / "waiting for…" / how it ended. */
export function TurnBanner({
  mine,
  name,
  done,
  note,
}: {
  mine: boolean;
  name: string;
  done?: ReactNode;
  note?: ReactNode;
}) {
  if (done) return <p className="game-turn game-turn--done">{done}</p>;
  return (
    <p className={`game-turn ${mine ? 'is-mine' : ''}`} aria-live="polite">
      {mine ? (note ?? 'Jij bent aan de beurt ✨') : `${name} is aan zet…`}
    </p>
  );
}
