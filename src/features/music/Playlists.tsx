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
import { useSpotify } from '../../components/music/SpotifyProvider';

/**
 * Our Spotify playlists, played with Spotify's own player in a dock that keeps
 * playing while we move around (see SpotifyProvider). Nothing loads from
 * Spotify until we press play, and there's no Spotify login or API key.
 */
export function Playlists() {
  const playlists = useContent((c) => c.playlists);
  const [form, setForm] = useState<{ open: boolean; playlist: Playlist | null }>({
    open: false,
    playlist: null,
  });

  const remove = async (playlist: Playlist) => {
    const ok = await confirm({
      title: 'Deze playlist ontkoppelen?',
      message: 'Hij blijft gewoon op Spotify — hij staat alleen niet meer hier.',
      confirmLabel: 'Ontkoppelen',
      tone: 'danger',
    });
    if (!ok) return;
    updateContent((c) => ({ ...c, playlists: c.playlists.filter((p) => p.id !== playlist.id) }));
  };

  return (
    <section className="playlists" aria-labelledby="playlists-title">
      <div className="playlists__head">
        <h2 id="playlists-title" className="section-title" style={{ margin: 0 }}>
          Onze playlists
        </h2>
        <button
          type="button"
          className="btn btn--soft btn--small"
          onClick={() => setForm({ open: true, playlist: null })}
        >
          <Plus aria-hidden="true" /> Playlist koppelen
        </button>
      </div>

      {playlists.length === 0 ? (
        <div className="playlists__empty">
          <span className="playlists__badge" aria-hidden="true">
            <ListMusic />
          </span>
          <div>
            <p className="playlists__empty-title">Koppel onze Spotify-playlist</p>
            <p className="muted">
              Open in Spotify de playlist, tik op <strong>⋯</strong> → <strong>Delen</strong> →{' '}
              <strong>Link kopiëren</strong> en plak hem hier. Tip: maak er in Spotify een
              gezamenlijke playlist van, dan kunnen jullie allebei liedjes toevoegen en zie je ze
              hier ook.
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
  const player = useSpotify();
  if (!spotify) return null;
  const name = playlist.title || (spotify.kind === 'album' ? 'Ons album' : 'Onze playlist');
  const uri = `spotify:${spotify.kind}:${spotify.id}`;
  const isOn = player.current?.uri === uri;
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
        <button type="button" className="icon-btn" aria-label={`${name} bewerken`} onClick={onEdit}>
          <Pencil />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={`${name} ontkoppelen`}
          onClick={onRemove}
        >
          <Trash2 />
        </button>
      </div>
      <div className="song-link__actions">
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() =>
            isOn ? player.setExpanded(true) : player.open({ title: name, uri, url: spotify.url })
          }
        >
          <PlayCircle aria-hidden="true" /> {isOn ? 'Toon de speler' : 'Hier afspelen'}
        </button>
        <a
          className="btn btn--ghost btn--small"
          href={spotify.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink aria-hidden="true" /> Open in Spotify
        </a>
      </div>
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
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, playlist?.id]);

  const spotify = spotifyCollection(url);
  const shortLink = /^https?:\/\/(spotify\.link|spotify\.app\.link)\//i.test(url.trim());

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!spotify) {
      setError(
        shortLink
          ? 'Dat is een korte spotify.link. Open hem eerst in je browser en kopieer dan de open.spotify.com-link uit de adresbalk.'
          : 'Plak een link naar een Spotify-playlist — die ziet eruit als https://open.spotify.com/playlist/…',
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
    toast(playlist ? 'Playlist opgeslagen' : 'Playlist gekoppeld ♫');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={playlist ? 'Playlist bewerken' : 'Spotify-playlist koppelen'}
      eyebrow="music corner"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="playlist-form" className="btn btn--primary">
            {playlist ? 'Opslaan' : 'Koppelen'}
          </button>
        </>
      }
    >
      <form id="playlist-form" className="form" onSubmit={save} noValidate>
        <TextField
          label="Spotify-link"
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
              ? `✓ Spotify-${spotify.kind} herkend.`
              : 'In Spotify: ⋯ → Delen → Link kopiëren. Albums werken ook.'
          }
        />
        <TextField
          label="Onze naam ervoor"
          optional
          value={title}
          onChange={setTitle}
          maxLength={120}
          placeholder="Songs that sound like us"
        />
        <TextArea label="Een notitie" optional value={note} onChange={setNote} rows={3} />
      </form>
    </Dialog>
  );
}
