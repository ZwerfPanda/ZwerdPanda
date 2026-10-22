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
        title: `Remove “${album.name || 'this album'}”?`,
        message: `The ${used} ${used === 1 ? 'memory' : 'memories'} inside stay in the scrapbook — they just won’t be in this album any more.`,
        confirmLabel: 'Remove album',
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
      setError('Every album needs a name (or remove the empty one).');
      return;
    }
    const names = cleaned.map((a) => a.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      setError('Two albums have the same name.');
      return;
    }
    setAlbums(cleaned);
    toast('Albums saved');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Our albums"
      eyebrow="organise"
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="albums-form" className="btn btn--primary">
            Save albums
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
                aria-label={`Remove album ${album.name}`}
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
          <Plus aria-hidden="true" /> New album
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
