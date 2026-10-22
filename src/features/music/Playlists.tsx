import { useEffect, useState } from 'react';
import { ExternalLink, ListMusic, Pencil, PlayCircle, Plus, Trash2 } from 'lucide-react';
import { updateContent, useContent } from '../../data/store';
import { getAuthor } from '../../data/people';
import type { Playlist } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { spotifyCollection } from '../../lib/embeds';
import { Dialog } from '../../components/ui/Dialog';
import { TextArea, TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { ByTag } from '../../components/common/ByTag';
import { useMusic } from '../../components/music/MusicProvider';

/**
 * Our Spotify playlists, played with Spotify's own embedded player. Nothing
 * loads from Spotify until we press play; there's no Spotify login or API key
 * involved, so the player always shows the playlist as it is right now.
 */
export function Playlists() {
  const playlists = useContent((c) => c.playlists);
  const [form, setForm] = useState<{ open: boolean; playlist: Playlist | null }>({
    open: false,
    playlist: null,
  });

  const remove = async (playlist: Playlist) => {
    const ok = await confirm({
      title: 'Disconnect this playlist?',
      message: 'It stays on Spotify — it just won’t show here anymore.',
      confirmLabel: 'Disconnect',
      tone: 'danger',
    });
    if (!ok) return;
    updateContent((c) => ({ ...c, playlists: c.playlists.filter((p) => p.id !== playlist.id) }));
  };

  return (
    <section className="playlists" aria-labelledby="playlists-title">
      <div className="playlists__head">
        <h2 id="playlists-title" className="section-title" style={{ margin: 0 }}>
          Our playlists
        </h2>
        <button
          type="button"
          className="btn btn--soft btn--small"
          onClick={() => setForm({ open: true, playlist: null })}
        >
          <Plus aria-hidden="true" /> Connect a playlist
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="playlists__empty">
          <span className="playlists__badge" aria-hidden="true">
            <ListMusic />
          </span>
          <div>
            <p className="playlists__empty-title">Connect our Spotify playlist</p>
            <p className="muted">
              In Spotify, open the playlist, tap <strong>⋯</strong> → <strong>Share</strong> →{' '}
              <strong>Copy link</strong>, and paste it here. Tip: make it a collaborative playlist
              in Spotify, then you can both add songs and they show up here too.
            </p>
          </div>
        </div>
      ) : (
        <ul className="playlists__list">
          {playlists.map((p) => (
            <PlaylistCard
              key={p.id}
              playlist={p}
              onEdit={() => setForm({ open: true, playlist: p })}
              onRemove={() => remove(p)}
            />
          ))}
        </ul>
      )}

      <PlaylistForm
        open={form.open}
        playlist={form.playlist}
        onClose={() => setForm({ open: false, playlist: null })}
      />
    </section>
  );
}

function PlaylistCard({
  playlist,
  onEdit,
  onRemove,
}: {
  playlist: Playlist;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const spotify = spotifyCollection(playlist.url);
  const music = useMusic();
  const [open, setOpen] = useState(false);
  if (!spotify) return null;
  const name = playlist.title || (spotify.kind === 'album' ? 'Our album' : 'Our playlist');
  return (
    <li className="playlist">
      <div className="playlist__row">
        <span className="playlists__badge" aria-hidden="true">
          <ListMusic />
        </span>
        <div className="playlist__text">
          <p className="playlist__title">{name}</p>
          {playlist.note && <p className="playlist__note">{playlist.note}</p>}
          <ByTag by={playlist.by} />
        </div>
        <button type="button" className="icon-btn" aria-label={`Edit ${name}`} onClick={onEdit}>
          <Pencil />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`Disconnect ${name}`}
          onClick={onRemove}
        >
          <Trash2 />
        </button>
      </div>
      <div className="song-link__actions">
        {!open && (
          <button
            type="button"
            className="btn btn--primary btn--small"
            onClick={() => {
              // never two songs at once: the music box hushes for Spotify
              music.pause();
              setOpen(true);
            }}
          >
            <PlayCircle aria-hidden="true" /> Play here
          </button>
        )}
        <a
          className="btn btn--ghost btn--small"
          href={spotify.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink aria-hidden="true" /> Open in Spotify
        </a>
      </div>
      {open && (
        <iframe
          className="song-link__embed playlist__embed"
          title={`${name} — Spotify player`}
          src={spotify.embedUrl}
          height={380}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </li>
  );
}

function PlaylistForm({
  open,
  playlist,
  onClose,
}: {
  open: boolean;
  playlist: Playlist | null;
  onClose: () => void;
}) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUrl(playlist?.url ?? '');
    setTitle(playlist?.title ?? '');
    setNote(playlist?.note ?? '');
    setError(null);
  }, [open, playlist]);

  const spotify = spotifyCollection(url);
  const shortLink = /^https?:\/\/(spotify\.link|spotify\.app\.link)\//i.test(url.trim());

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!spotify) {
      setError(
        shortLink
          ? 'That’s a short spotify.link. Open it in your browser first, then copy the open.spotify.com link from the address bar.'
          : 'Paste a Spotify playlist link — it looks like https://open.spotify.com/playlist/…',
      );
      return;
    }
    const item: Playlist = {
      id: playlist?.id ?? createId('playlist'),
      title: title.trim(),
      url: spotify.url,
      note: note.trim() || undefined,
      by: playlist?.by ?? getAuthor(),
      createdAt: playlist?.createdAt ?? nowIso(),
    };
    updateContent((c) => ({
      ...c,
      playlists: c.playlists.some((p) => p.id === item.id)
        ? c.playlists.map((p) => (p.id === item.id ? item : p))
        : [...c.playlists, item],
    }));
    toast(playlist ? 'Playlist saved' : 'Playlist connected ♫');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={playlist ? 'Edit playlist' : 'Connect a Spotify playlist'}
      eyebrow="music corner"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="playlist-form" className="btn btn--primary">
            {playlist ? 'Save' : 'Connect'}
          </button>
        </>
      }
    >
      <form id="playlist-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Spotify link"
          value={url}
          onChange={(v) => {
            setUrl(v);
            setError(null);
          }}
          inputMode="url"
          autoComplete="off"
          placeholder="https://open.spotify.com/playlist/…"
          error={error}
          hint={
            spotify
              ? `✓ Spotify ${spotify.kind} recognised.`
              : 'In Spotify: ⋯ → Share → Copy link. Albums work too.'
          }
        />
        <TextField
          label="Our name for it"
          optional
          value={title}
          onChange={setTitle}
          maxLength={120}
          placeholder="Songs that sound like us"
        />
        <TextArea label="A little note" optional value={note} onChange={setNote} rows={3} />
      </form>
    </Dialog>
  );
}
