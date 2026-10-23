import { useEffect, useState } from 'react';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, TextArea, TextField } from '../../components/ui/Fields';
import { toast } from '../../components/ui/feedback';
import { updateContent } from '../../data/store';
import type { Song } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { describeLink, isHttpUrl } from '../../lib/embeds';
import { getAuthor } from '../../data/people';

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
    // Only when it opens (or opens on something else): a sync or an update
    // arriving while you edit must never wipe what you've typed or the photos
    // you've just added.
  }, [open, song?.id]);

  const link = describeLink(url.trim());

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!title.trim()) problems.title = 'Hoe heet het liedje?';
    if (!artist.trim()) problems.artist = 'Wie zingt het?';
    if (url.trim() && !isHttpUrl(url.trim()))
      problems.url = 'Plak een volledige link, die begint met https://';
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
      by: song?.by ?? getAuthor(),
      createdAt: song?.createdAt ?? nowIso(),
    };
    updateContent((c) => ({
      ...c,
      songs: c.songs.some((s) => s.id === item.id)
        ? c.songs.map((s) => (s.id === item.id ? item : s))
        : [item, ...c.songs],
    }));
    toast(song ? 'Liedje opgeslagen' : 'Bij onze liedjes gezet ♫');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={song ? 'Liedje bewerken' : 'Liedje toevoegen'}
      eyebrow="music corner"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="song-form" className="btn btn--primary">
            {song ? 'Opslaan' : 'Toevoegen'}
          </button>
        </>
      }
    >
      <form id="song-form" className="form" onSubmit={save} noValidate>
        <div className="form-row form-row--2">
          <TextField
            label="Liedje"
            value={title}
            onChange={setTitle}
            error={errors.title}
            maxLength={160}
          />
          <TextField
            label="Artiest"
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
              ? `✓ Deze ${link.platform === 'spotify' ? 'Spotify' : 'YouTube'}-link speelt hier gewoon af.`
              : link
                ? 'Deze link opent in zijn eigen app of website.'
                : 'Spotify- en YouTube-links spelen in de app af; andere links openen apart.'
          }
        />
        <TextArea
          label="Waarom hij van ons is"
          optional
          value={why}
          onChange={setWhy}
          rows={3}
          placeholder="Het liedje dat…"
        />
        <TextArea
          label="Een herinnering bij dit liedje"
          optional
          value={memory}
          onChange={setMemory}
          rows={3}
        />
        <Checkbox label="Een van onze favorieten" checked={favorite} onChange={setFavorite} />
      </form>
    </Dialog>
  );
}
