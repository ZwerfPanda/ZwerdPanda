import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { confirm, toast } from '../../components/ui/feedback';
import { getContent } from '../../data/store';
import { setAlbums } from '../../data/actions';
import type { Album } from '../../data/types';
import { createId } from '../../lib/id';

export function AlbumsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [list, setList] = useState<Album[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setList(getContent().albums.map((a) => ({ ...a })));
      setError(null);
    }
  }, [open]);

  const rename = (id: string, name: string) =>
    setList((l) => l.map((a) => (a.id === id ? { ...a, name } : a)));

  const remove = async (album: Album) => {
    const used = getContent().memories.filter((m) => m.albumIds.includes(album.id)).length;
    if (used) {
      const ok = await confirm({
        title: `“${album.name || 'dit album'}” weghalen?`,
        message: `De ${used} ${used === 1 ? 'herinnering' : 'herinneringen'} erin blijven in het plakboek — alleen niet meer in dit album.`,
        confirmLabel: 'Album weghalen',
        tone: 'danger',
      });
      if (!ok) return;
    }
    setList((l) => l.filter((a) => a.id !== album.id));
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = list.map((a) => ({ ...a, name: a.name.trim() }));
    if (cleaned.some((a) => !a.name)) {
      setError('Elk album heeft een naam nodig (of haal het lege album weg).');
      return;
    }
    const names = cleaned.map((a) => a.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Twee albums hebben dezelfde naam.');
      return;
    }
    setAlbums(cleaned);
    toast('Albums opgeslagen');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Onze albums"
      eyebrow="organise"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Annuleren
          </button>
          <button type="submit" form="albums-form" className="btn btn--primary">
            Albums opslaan
          </button>
        </>
      }
    >
      <form id="albums-form" className="form" onSubmit={save} noValidate>
        <ul className="album-list">
          {list.map((album, i) => (
            <li key={album.id} className="album-list__row">
              <label className="visually-hidden" htmlFor={`album-${album.id}`}>
                Album {i + 1} name
              </label>
              <input
                id={`album-${album.id}`}
                className="input"
                value={album.name}
                maxLength={40}
                onChange={(e) => rename(album.id, e.target.value)}
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Album ${album.name} weghalen`}
                onClick={() => remove(album)}
              >
                <Trash2 />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn--soft"
          onClick={() => setList((l) => [...l, { id: createId('album'), name: '' }])}
        >
          <Plus aria-hidden="true" /> Nieuw album
        </button>
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}
