import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, TextArea, TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { updateContent } from '../../data/store';
import type { Song } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { describeLink, isHttpUrl } from '../../lib/embeds';

export function SongForm({
  open,
  onClose,
  song,
}: {
  open: boolean;
  onClose: () => void;
  song: Song | null;
}) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [url, setUrl] = useState('');
  const [why, setWhy] = useState('');
  const [memory, setMemory] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; artist?: string; url?: string }>({});

  useEffect(() => {
    if (!open) return;
    setTitle(song?.title ?? '');
    setArtist(song?.artist ?? '');
    setUrl(song?.url ?? '');
    setWhy(song?.why ?? '');
    setMemory(song?.memory ?? '');
    setFavorite(song?.favorite ?? false);
    setErrors({});
  }, [open, song]);

  const link = describeLink(url.trim());

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'What’s the song called?';
    if (!artist.trim()) problems.artist = 'Who sings it?';
    if (url.trim() && !isHttpUrl(url.trim()))
      problems.url = 'Paste a full link, starting with https://';
    setErrors(problems);
    if (Object.keys(problems).length) return;
    const item: Song = {
      id: song?.id ?? createId('song'),
      title: title.trim(),
      artist: artist.trim(),
      url: url.trim() || undefined,
      why: why.trim() || undefined,
      memory: memory.trim() || undefined,
      favorite,
      createdAt: song?.createdAt ?? nowIso(),
    };
    updateContent((c) => ({
      ...c,
      songs: c.songs.some((s) => s.id === item.id)
        ? c.songs.map((s) => (s.id === item.id ? item : s))
        : [item, ...c.songs],
    }));
    toast(song ? 'Song saved' : 'Added to our songs ♫');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={song ? 'Edit song' : 'Add a song'}
      eyebrow="music corner"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="song-form" className="btn btn--primary">
            {song ? 'Save song' : 'Add song'}
          </button>
        </>
      }
    >
      <form id="song-form" className="form" onSubmit={save} noValidate>
        <div className="form-row form-row--2">
          <TextField
            label="Song"
            value={title}
            onChange={setTitle}
            error={errors.title}
            maxLength={160}
          />
          <TextField
            label="Artist"
            value={artist}
            onChange={setArtist}
            error={errors.artist}
            maxLength={160}
          />
        </div>
        <TextField
          label="Link"
          optional
          type="url"
          inputMode="url"
          value={url}
          onChange={setUrl}
          error={errors.url}
          placeholder="https://open.spotify.com/track/…"
          hint={
            link?.embedUrl
              ? `✓ This ${link.platform === 'spotify' ? 'Spotify' : 'YouTube'} link can play right here.`
              : link
                ? 'This link will open in its own app or website.'
                : 'Spotify and YouTube links can play inside the site; other links open externally.'
          }
        />
        <TextArea
          label="Why it’s ours"
          optional
          value={why}
          onChange={setWhy}
          rows={3}
          placeholder="The song that…"
        />
        <TextArea
          label="A memory with this song"
          optional
          value={memory}
          onChange={setMemory}
          rows={3}
        />
        <Checkbox label="One of our favourites" checked={favorite} onChange={setFavorite} />
      </form>
    </Dialog>
  );
}
