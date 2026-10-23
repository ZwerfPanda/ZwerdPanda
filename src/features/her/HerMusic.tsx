import { useState } from 'react';
import { Pause, Play, Plus, Trash2 } from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import { useSpotify } from '../../components/music/SpotifyProvider';
import { confirm, toast } from '../../components/ui/feedback';
import { spotifyItem } from '../../lib/embeds';
import { createId, nowIso } from '../../lib/id';
import { updateHer } from './herData';

const KIND_LABEL = { track: 'nummer', album: 'album', playlist: 'playlist' } as const;
const KIND_ICON = { track: '♪', album: '💿', playlist: '🎧' } as const;

/**
 * Her music box: her own songs, albums and playlists from Spotify, played
 * with Spotify's own player in the dock (so they keep playing as she
 * wanders round the universe).
 */
export function HerMusic({ visitor }: { visitor: boolean }) {
  const music = useContent((c) => c.her.music);
  const spotify = useSpotify();
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const playing = Boolean(spotify.current) && spotify.paused === false;
  const playingHere = music.some((m) => spotifyItem(m.url)?.uri === spotify.current?.uri);

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const item = spotifyItem(link);
    if (!item) {
      setError(
        /spotify\.link|spotify\.app\.link/.test(link)
          ? 'Dat is een korte spotify.link — open hem eerst en kopieer dan de open.spotify.com-link.'
          : 'Plak een Spotify-link van een nummer, album of playlist (in Spotify: ⋯ → Delen → Link kopiëren).',
      );
      return;
    }
    updateHer({
      music: [
        ...getContent().her.music,
        {
          id: createId('song'),
          url: item.url,
          title: title.trim() || undefined,
          createdAt: nowIso(),
        },
      ],
    });
    setLink('');
    setTitle('');
    setAdding(false);
    toast(`In je music box gezet ${KIND_ICON[item.kind]}`);
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: 'Uit je music box halen?',
      message: 'Hij blijft gewoon op Spotify staan.',
      confirmLabel: 'Weghalen',
      tone: 'danger',
    });
    if (ok) updateHer({ music: getContent().her.music.filter((m) => m.id !== id) });
  };

  return (
    <section className="her-card her-music" aria-labelledby="her-music-title">
      <div className="her-music__head">
        <div
          className={`her-vinyl ${playing && playingHere ? 'is-playing' : ''}`}
          aria-hidden="true"
        >
          <svg viewBox="-50 -50 100 100">
            <circle r="48" fill="#1d1b22" />
            {[40, 33, 26].map((r) => (
              <circle
                key={r}
                r={r}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.08"
                strokeWidth="1.5"
              />
            ))}
            <circle r="17" fill="var(--accent)" />
            <path d="M0 6C-7 1-8-3-5-6-3-8-1-7 0-5 1-7 3-8 5-6 8-3 7 1 0 6Z" fill="#fff" />
            <circle r="2" fill="#1d1b22" />
            <path
              d="M-30-28a42 42 0 0 1 22-12"
              stroke="#fff"
              strokeOpacity="0.3"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div>
          <p className="her-card__eyebrow">jouw liedjes</p>
          <h2 id="her-music-title" className="her-card__title">
            My music box
          </h2>
          {spotify.current && playingHere && (
            <button type="button" className="btn btn--soft btn--small" onClick={spotify.togglePlay}>
              {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              {playing ? 'Pauze' : 'Verder spelen'}
            </button>
          )}
        </div>
      </div>

      {music.length > 0 ? (
        <ul className="her-songs">
          {music.map((m) => {
            const item = spotifyItem(m.url);
            if (!item) return null;
            const on = spotify.current?.uri === item.uri;
            return (
              <li key={m.id} className={`her-song ${on ? 'is-on' : ''}`}>
                <button
                  type="button"
                  className="her-song__play"
                  onClick={() =>
                    on
                      ? spotify.togglePlay()
                      : spotify.open(
                          {
                            title: m.title || `Mijn ${KIND_LABEL[item.kind]}`,
                            uri: item.uri,
                            url: item.url,
                          },
                          { play: true, quiet: true },
                        )
                  }
                >
                  <span className="her-song__icon" aria-hidden="true">
                    {on && playing ? '❚❚' : KIND_ICON[item.kind]}
                  </span>
                  <span className="her-song__text">
                    <strong>{m.title || `Spotify-${KIND_LABEL[item.kind]}`}</strong>
                    <small>
                      {on
                        ? playing
                          ? 'speelt nu ♪'
                          : 'gepauzeerd'
                        : `tik om te spelen · ${KIND_LABEL[item.kind]}`}
                    </small>
                  </span>
                </button>
                {!visitor && (
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`${m.title ?? 'Dit'} uit je music box halen`}
                    onClick={() => void remove(m.id)}
                  >
                    <Trash2 />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="her-music__hint">
          Zet hier je eigen nummers, albums en playlists van Spotify in — ze spelen gewoon door
          terwijl je rondkijkt.
        </p>
      )}

      {!visitor &&
        (adding ? (
          <form className="her-song-form" onSubmit={add} noValidate>
            <input
              className="input"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError(null);
              }}
              inputMode="url"
              autoComplete="off"
              placeholder="https://open.spotify.com/track/…"
              aria-label="Spotify-link"
            />
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Naam (optioneel), bv. Mijn vibe"
              aria-label="Naam"
            />
            {error && (
              <p className="field__error" role="alert">
                {error}
              </p>
            )}
            <div className="her-song-form__actions">
              <button
                type="button"
                className="btn btn--ghost btn--small"
                onClick={() => setAdding(false)}
              >
                Annuleren
              </button>
              <button type="submit" className="btn btn--primary btn--small">
                Toevoegen
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="btn btn--soft btn--small"
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden="true" /> Nummer of playlist toevoegen
          </button>
        ))}
    </section>
  );
}
