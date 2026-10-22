import { Heart, Pause, Pencil, Play, Plus, Settings2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { getContent, updatePrefs, useContent, usePrefs } from '../../data/store';
import { removeItem, restoreItem, toggleFavorite } from '../../data/actions';
import type { Song } from '../../data/types';
import { href } from '../../lib/router';
import { hashUnit } from '../../lib/id';
import { EmptyState, PageHeader } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { SongLink } from '../../components/music/SongLink';
import { useMusic } from '../../components/music/MusicProvider';
import { SiteFooter } from '../../components/common/SiteFooter';
import { INK, HeartShape } from '../../components/art/shapes';
import { SongForm } from './SongForm';
import './music.css';

const SLEEVES = ['#d48d96', '#8e7cc3', '#e9906c', '#6f9160', '#52294f', '#e8bd6a'];

export function MusicPage() {
  const songs = useContent((c) => c.songs);
  const [form, setForm] = useState<{ open: boolean; song: Song | null }>({
    open: false,
    song: null,
  });

  const remove = async (song: Song) => {
    const ok = await confirm({
      title: 'Remove this song?',
      message: `“${song.title}” will be removed from our songs.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().songs.findIndex((s) => s.id === song.id);
    removeItem('songs', song.id);
    toast('Song removed', {
      action: { label: 'Undo', run: () => restoreItem('songs', song, position) },
    });
  };

  const sorted = [...songs].sort((a, b) => Number(b.favorite) - Number(a.favorite));

  return (
    <div className="page music-page">
      <PageHeader
        eyebrow="songs that sound like us"
        title={
          <>
            Music <em>Corner</em>
          </>
        }
        lede="The songs that belong to us, why they matter, and a little soundtrack for this universe. Nothing plays until you press play."
        actions={
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => setForm({ open: true, song: null })}
          >
            <Plus aria-hidden="true" /> Add a song
          </button>
        }
      />

      <RecordPlayer />

      <h2 className="section-title">
        Our songs <span className="hand">{songs.length ? `${songs.length} so far` : ''}</span>
      </h2>

      {songs.length === 0 ? (
        <EmptyState
          art={<Cassette />}
          title="Our mixtape is still blank"
          text="Which song makes you think of her? The one from the car, the karaoke classic, the one that just feels like us."
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setForm({ open: true, song: null })}
            >
              <Plus aria-hidden="true" /> Add our first song
            </button>
          }
        />
      ) : (
        <ul className="sleeves">
          {sorted.map((song) => (
            <li key={song.id} className="sleeve">
              <div
                className="sleeve__art"
                aria-hidden="true"
                style={
                  {
                    '--sleeve': SLEEVES[Math.floor(hashUnit(song.id) * SLEEVES.length)],
                  } as React.CSSProperties
                }
              >
                <span className="sleeve__vinyl" />
                <span className="sleeve__cover">
                  <span className="sleeve__initial">{song.title.charAt(0)}</span>
                </span>
              </div>
              <div className="sleeve__body">
                <SongLink title={song.title} artist={song.artist} url={song.url} />
                {song.why && (
                  <p className="sleeve__why">
                    <span>why it’s ours</span>
                    {song.why}
                  </p>
                )}
                {song.memory && (
                  <p className="sleeve__memory">
                    <span>a memory</span>
                    {song.memory}
                  </p>
                )}
                <div className="sleeve__tools">
                  <button
                    type="button"
                    className="icon-btn fav-btn"
                    aria-pressed={song.favorite}
                    aria-label={song.favorite ? 'Remove from favourites' : 'Mark as favourite'}
                    onClick={() => toggleFavorite('songs', song.id)}
                  >
                    <Heart />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Edit ${song.title}`}
                    onClick={() => setForm({ open: true, song })}
                  >
                    <Pencil />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${song.title}`}
                    onClick={() => remove(song)}
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SongForm
        open={form.open}
        song={form.song}
        onClose={() => setForm({ open: false, song: null })}
      />
      <SiteFooter />
    </div>
  );
}

function RecordPlayer() {
  const music = useMusic();
  const prefs = usePrefs();
  return (
    <section className="player" aria-labelledby="player-title">
      <div className={`turntable ${music.playing ? 'is-playing' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 240 200">
          <rect
            x="6"
            y="14"
            width="228"
            height="176"
            rx="18"
            fill="#6a3a63"
            stroke={INK}
            strokeWidth="3"
          />
          <rect x="14" y="22" width="212" height="160" rx="12" fill="#52294f" />
          <g className="turntable__record">
            <circle cx="98" cy="102" r="74" fill="#1d0f22" />
            {[64, 54, 44, 34].map((r) => (
              <circle
                key={r}
                cx="98"
                cy="102"
                r={r}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.08"
                strokeWidth="1.5"
              />
            ))}
            <circle cx="98" cy="102" r="24" fill="#d48d96" />
            <HeartShape x={98} y={102} size={14} fill="#fffcf6" />
            <circle cx="98" cy="102" r="3" fill="#1d0f22" />
            <path
              d="M60 60a52 52 0 0 1 30-14"
              stroke="#fff"
              strokeOpacity="0.25"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
          </g>
          <circle cx="204" cy="44" r="12" fill="#e3d4c4" stroke={INK} strokeWidth="2.5" />
          <g className="turntable__arm">
            <path
              d="M204 44L196 140l-22 18"
              stroke="#e3d4c4"
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="164"
              y="150"
              width="18"
              height="12"
              rx="3"
              fill="#e8bd6a"
              stroke={INK}
              strokeWidth="2"
              transform="rotate(-38 173 156)"
            />
          </g>
          <circle cx="210" cy="170" r="6" fill={'#e8bd6a'} />
        </svg>
      </div>
      <div className="player__info">
        <p className="hand player__eyebrow">now on the record player</p>
        <h2 id="player-title" className="player__title">
          {music.label}
        </h2>
        <p className="player__desc">
          {prefs.soundtrack === 'custom' && prefs.customSoundtrackId
            ? 'Our own song, stored on this device.'
            : 'An original little music-box lullaby, made just for this universe.'}
        </p>
        <div className="player__controls">
          <button type="button" className="btn btn--primary player__play" onClick={music.toggle}>
            {music.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {music.playing ? 'Pause' : 'Play'}
          </button>
          <label className="player__volume">
            <span className="visually-hidden">Volume</span>
            <input
              className="range"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={prefs.volume}
              onChange={(e) => updatePrefs({ volume: Number(e.target.value) })}
              aria-valuetext={`${Math.round(prefs.volume * 100)}%`}
            />
          </label>
        </div>
        <a className="player__settings" href={href('/settings')}>
          <Settings2 aria-hidden="true" /> Upload our own song in Settings
        </a>
      </div>
    </section>
  );
}

function Cassette() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <rect
        x="10"
        y="28"
        width="100"
        height="64"
        rx="8"
        fill="#f5dad6"
        stroke={INK}
        strokeWidth="3"
      />
      <rect
        x="22"
        y="38"
        width="76"
        height="26"
        rx="4"
        fill="#fffcf6"
        stroke={INK}
        strokeWidth="2.5"
      />
      <circle cx="42" cy="51" r="7" fill="#fffcf6" stroke={INK} strokeWidth="2.5" />
      <circle cx="78" cy="51" r="7" fill="#fffcf6" stroke={INK} strokeWidth="2.5" />
      <path
        d="M30 92l8-14h44l8 14"
        fill="#e7bdb7"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <HeartShape x={60} y={20} size={14} fill="#d48d96" />
    </svg>
  );
}
