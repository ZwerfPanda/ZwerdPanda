import { useState } from 'react';
import { ExternalLink, Music2, PlayCircle } from 'lucide-react';
import { describeLink } from '../../lib/embeds';
import './song.css';

/**
 * Shows a song with an honest way to listen: an official embedded player
 * (Spotify / YouTube, loaded only when asked) or a plain external link.
 */
export function SongLink({ title, artist, url, compact = false }: { title: string; artist?: string; url?: string; compact?: boolean }) {
  const info = describeLink(url);
  const [embedOpen, setEmbedOpen] = useState(false);
  return (
    <div className={`song-link ${compact ? 'song-link--compact' : ''}`}>
      <div className="song-link__row">
        <span className="song-link__icon" aria-hidden="true">
          <Music2 />
        </span>
        <span className="song-link__text">
          <span className="song-link__title">{title}</span>
          {artist && <span className="song-link__artist">{artist}</span>}
        </span>
      </div>
      {info && (
        <div className="song-link__actions">
          {info.embedUrl && !embedOpen && (
            <button type="button" className="btn btn--soft btn--small" onClick={() => setEmbedOpen(true)}>
              <PlayCircle aria-hidden="true" />
              Play here
            </button>
          )}
          <a className="btn btn--ghost btn--small" href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden="true" />
            {info.label}
          </a>
        </div>
      )}
      {embedOpen && info?.embedUrl && (
        <iframe
          className="song-link__embed"
          title={`${title} player`}
          src={info.embedUrl}
          height={info.embedHeight}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}
