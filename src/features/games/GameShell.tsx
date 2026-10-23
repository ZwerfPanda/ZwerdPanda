import type { ReactNode } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useContent } from '../../data/store';
import { getAuthor, setMe } from '../../data/people';
import { href } from '../../lib/router';
import { refreshNow } from './gameData';

export type PlayMode = 'remote' | 'local';

/** The frame around every game: back, title, how we play, and the score. */
export function GameShell({
  title,
  emoji,
  mode,
  onMode,
  modes = ['remote', 'local'],
  localLabel = 'Op één telefoon',
  score,
  children,
}: {
  title: string;
  emoji: string;
  mode?: PlayMode;
  onMode?: (mode: PlayMode) => void;
  modes?: PlayMode[];
  localLabel?: string;
  score?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="page game">
      <div className="game__bar">
        <a className="btn btn--ghost btn--small" href={href('/games')}>
          <ArrowLeft aria-hidden="true" /> Spelletjes
        </a>
        {mode === 'remote' && (
          <button
            type="button"
            className="icon-btn"
            aria-label="Kijk of de ander al gezet heeft"
            onClick={refreshNow}
          >
            <RefreshCw />
          </button>
        )}
      </div>
      <h1 className="game__title">
        <span aria-hidden="true">{emoji}</span> {title}
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
              onClick={() => onMode(m)}
            >
              {m === 'remote' ? '📱↔📱 Samen, elk op je eigen telefoon' : `📱 ${localLabel}`}
            </button>
          ))}
        </div>
      )}
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
    <div className="game-who">
      <p>Eerst even: wie ben jij op deze telefoon?</p>
      <div className="settings-actions">
        <button type="button" className="btn btn--primary" onClick={() => setMe('you')}>
          Ik ben {profile.yourName}
        </button>
        <button type="button" className="btn btn--primary" onClick={() => setMe('partner')}>
          Ik ben {profile.partnerName}
        </button>
      </div>
    </div>
  );
}

/** Wins (or records) side by side. */
export function ScoreBoard({
  you,
  partner,
  label,
}: {
  you: ReactNode;
  partner: ReactNode;
  label: string;
}) {
  const profile = useContent((c) => c.profile);
  return (
    <div className="game-score" aria-label={label}>
      <span>
        <small>{profile.yourName}</small>
        <strong>{you}</strong>
      </span>
      <em>{label}</em>
      <span>
        <small>{profile.partnerName}</small>
        <strong>{partner}</strong>
      </span>
    </div>
  );
}

/** "Your turn" / "waiting for…" */
export function TurnBanner({
  mine,
  name,
  done,
}: {
  mine: boolean;
  name: string;
  done?: ReactNode;
}) {
  if (done) return <p className="game-turn game-turn--done">{done}</p>;
  return (
    <p className={`game-turn ${mine ? 'is-mine' : ''}`} aria-live="polite">
      {mine ? 'Jij bent aan de beurt ✨' : `Wachten op ${name}… (je krijgt het vanzelf te zien)`}
    </p>
  );
}
