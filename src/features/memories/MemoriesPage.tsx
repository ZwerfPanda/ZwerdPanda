import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderPen, Heart, ImagePlus, Play, Search } from 'lucide-react';
import { getContent, useContent } from '../../data/store';
import { removeItem, restoreItem, toggleFavorite } from '../../data/actions';
import type { Memory } from '../../data/types';
import { replaceParams, useRoute } from '../../lib/router';
import { formatDate } from '../../lib/dates';
import { hashUnit } from '../../lib/id';
import { EmptyState, PageHeader } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { MediaView } from '../../components/media/MediaView';
import { SampleArt } from '../../components/art/SampleArt';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { Lightbox } from './Lightbox';
import { MemoryForm } from './MemoryForm';
import { AlbumsDialog } from './AlbumsDialog';
import './memories.css';

const FAVORITES = 'favorites';

export function MemoriesPage() {
  const memories = useContent((c) => c.memories);
  const albums = useContent((c) => c.albums);
  const { params } = useRoute();
  const album = params.get('album') ?? 'all';
  const [query, setQuery] = useState('');
  const [lightbox, setLightbox] = useState<{ index: number; play: boolean } | null>(null);
  const [form, setForm] = useState<{ open: boolean; memory: Memory | null }>({
    open: false,
    memory: null,
  });
  const [albumsOpen, setAlbumsOpen] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return memories.filter((m) => {
      if (album === FAVORITES && !m.favorite) return false;
      if (album !== 'all' && album !== FAVORITES && !m.albumIds.includes(album)) return false;
      if (!q) return true;
      const albumNames = m.albumIds.map((id) => albums.find((a) => a.id === id)?.name ?? '');
      return [m.caption, m.note, m.location, formatDate(m.date), ...albumNames]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [memories, albums, album, query]);

  const setAlbum = (value: string) => replaceParams({ album: value === 'all' ? null : value });
  const countFor = (id: string) =>
    id === 'all'
      ? memories.length
      : id === FAVORITES
        ? memories.filter((m) => m.favorite).length
        : memories.filter((m) => m.albumIds.includes(id)).length;

  const remove = async (memory: Memory) => {
    const ok = await confirm({
      title: 'Delete this memory?',
      message: memory.isSample
        ? 'This sample will be removed from the scrapbook.'
        : 'It will be removed from the scrapbook on this device. Make sure you still have the photo somewhere if you want to keep it.',
      confirmLabel: 'Delete memory',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().memories.findIndex((m) => m.id === memory.id);
    removeItem('memories', memory.id);
    if (visible.length <= 1) setLightbox(null);
    toast('Memory deleted', {
      action: { label: 'Undo', run: () => restoreItem('memories', memory, position) },
    });
  };

  const currentAlbumName =
    album === FAVORITES ? 'Favourites' : albums.find((a) => a.id === album)?.name;
  const defaultAlbumId = album !== 'all' && album !== FAVORITES ? album : undefined;

  return (
    <div className="page memories-page">
      <PageHeader
        eyebrow="our scrapbook"
        title={
          <>
            <em>Memories</em>
          </>
        }
        lede="Polaroids, silly moments and little everyday things. Add photos straight from your phone — they’re kept privately on this device."
        actions={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setForm({ open: true, memory: null })}
            >
              <ImagePlus aria-hidden="true" /> Add memories
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              disabled={visible.length === 0}
              onClick={() => setLightbox({ index: 0, play: true })}
            >
              <Play aria-hidden="true" /> Slideshow
            </button>
          </>
        }
      />

      <div className="toolbar">
        <div className="search">
          <Search aria-hidden="true" />
          <label className="visually-hidden" htmlFor="memory-search">
            Search memories
          </label>
          <input
            id="memory-search"
            className="input"
            type="search"
            placeholder="Search memories…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn btn--quiet btn--small"
          onClick={() => setAlbumsOpen(true)}
        >
          <FolderPen aria-hidden="true" /> Edit albums
        </button>
      </div>

      <div className="chip-row" role="group" aria-label="Filter by album">
        <button
          type="button"
          className="chip"
          aria-pressed={album === 'all'}
          onClick={() => setAlbum('all')}
        >
          Everything <span className="chip__count">{countFor('all')}</span>
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={album === FAVORITES}
          onClick={() => setAlbum(FAVORITES)}
        >
          <Heart aria-hidden="true" /> Favourites{' '}
          <span className="chip__count">{countFor(FAVORITES)}</span>
        </button>
        {albums.map((a) => (
          <button
            key={a.id}
            type="button"
            className="chip"
            aria-pressed={album === a.id}
            onClick={() => setAlbum(a.id)}
          >
            {a.name} <span className="chip__count">{countFor(a.id)}</span>
          </button>
        ))}
      </div>

      <p className="visually-hidden" aria-live="polite">
        Showing {visible.length} {visible.length === 1 ? 'memory' : 'memories'}
      </p>

      {visible.length === 0 ? (
        <EmptyState
          art={<SampleArt art="stars" />}
          title={
            memories.length === 0
              ? 'An empty scrapbook, ready for us'
              : query
                ? 'Nothing matches that'
                : `Nothing in ${currentAlbumName ?? 'this album'} yet`
          }
          text={
            memories.length === 0
              ? 'Add our first photo — a date, a silly face, Coco, anything.'
              : query
                ? 'Try another word, or clear the search.'
                : 'Add a memory here, or pick a different album.'
          }
          action={
            query ? (
              <button type="button" className="btn btn--soft" onClick={() => setQuery('')}>
                Clear search
              </button>
            ) : (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setForm({ open: true, memory: null })}
              >
                <ImagePlus aria-hidden="true" /> Add a memory
              </button>
            )
          }
        />
      ) : (
        <ul className="scrapbook">
          {visible.map((m, i) => (
            <MemoryCard
              key={m.id}
              memory={m}
              index={i}
              onOpen={() => setLightbox({ index: i, play: false })}
            />
          ))}
        </ul>
      )}

      <Lightbox
        items={visible}
        index={lightbox?.index ?? null}
        startPlaying={lightbox?.play}
        onIndex={(index) => setLightbox((l) => (l ? { ...l, index } : l))}
        onClose={() => setLightbox(null)}
        onEdit={(memory) => setForm({ open: true, memory })}
        onDelete={remove}
      />
      <MemoryForm
        open={form.open}
        memory={form.memory}
        defaultAlbumId={defaultAlbumId}
        onClose={() => setForm({ open: false, memory: null })}
      />
      <AlbumsDialog open={albumsOpen} onClose={() => setAlbumsOpen(false)} />
      <SiteFooter />
    </div>
  );
}

const TAPES = ['', 'tape--lavender', 'tape--peach', 'tape--gold'];

function MemoryCard({
  memory: m,
  index,
  onOpen,
}: {
  memory: Memory;
  index: number;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const r = hashUnit(m.id);
  const tilt = (r - 0.5) * 5;
  const tape = r > 0.35 ? TAPES[Math.floor(r * 10) % TAPES.length] : null;

  return (
    <motion.li
      className="scrapbook__item"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-20px' }}
      transition={{ duration: 0.5, delay: Math.min(index, 6) * 0.04 }}
    >
      <div
        className="polaroid scrapbook__card"
        style={{ '--tilt': `${tilt}deg` } as React.CSSProperties}
      >
        {tape && <span className={`tape ${tape} scrapbook__tape`} aria-hidden="true" />}
        <button type="button" className="scrapbook__open" onClick={onOpen}>
          <div
            className={`polaroid__photo scrapbook__photo ${m.media.type === 'sample' ? 'is-square' : ''}`}
          >
            <MediaView source={m.media} alt={m.caption || 'Memory'} />
          </div>
        </button>
        <div className="scrapbook__under">
          <p className="polaroid__caption scrapbook__caption">
            {m.caption || formatDate(m.date) || '♡'}
          </p>
          <button
            type="button"
            className="icon-btn fav-btn scrapbook__fav"
            aria-pressed={m.favorite}
            aria-label={m.favorite ? 'Remove from favourites' : 'Mark as favourite'}
            onClick={() => toggleFavorite('memories', m.id)}
          >
            <Heart />
          </button>
        </div>
        {(m.isSample || m.date) && (
          <p className="scrapbook__meta">
            {m.isSample ? (
              <span className="tag tag--sample">Sample</span>
            ) : (
              formatDate(m.date, 'short')
            )}
          </p>
        )}
      </div>
    </motion.li>
  );
}
