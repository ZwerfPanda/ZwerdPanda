import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ChevronLeft, ChevronRight, Heart, Music, Pause, Pencil, Play, Trash2, X } from 'lucide-react';
import type { Memory } from '../../data/types';
import { useContent } from '../../data/store';
import { toggleFavorite } from '../../data/actions';
import { formatDate } from '../../lib/dates';
import { MediaView } from '../../components/media/MediaView';
import { useMusic } from '../../components/music/MusicProvider';
import { lockScroll, trapTab } from '../../components/ui/scrollLock';
import { useReducedMotion } from '../../hooks/useMotion';

const SLIDE_MS = 4500;

interface LightboxProps {
  items: Memory[];
  index: number | null;
  onIndex: (index: number) => void;
  onClose: () => void;
  onEdit: (memory: Memory) => void;
  onDelete: (memory: Memory) => void;
  startPlaying?: boolean;
}

export function Lightbox(props: LightboxProps) {
  const open = props.index !== null && props.items.length > 0;
  return createPortal(<AnimatePresence>{open && <LightboxInner key="lightbox" {...props} index={props.index!} />}</AnimatePresence>, document.body);
}

function LightboxInner({ items, index, onIndex, onClose, onEdit, onDelete, startPlaying = false }: LightboxProps & { index: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const albums = useContent((c) => c.albums);
  const music = useMusic();
  const reduce = useReducedMotion();
  const [playing, setPlaying] = useState(startPlaying);
  const [direction, setDirection] = useState(1);
  const safeIndex = Math.min(index, items.length - 1);
  const memory = items[safeIndex];

  const go = (delta: number) => {
    setDirection(delta);
    onIndex((safeIndex + delta + items.length) % items.length);
  };

  // Focus, scroll lock, keyboard.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    rootRef.current?.focus();
    return () => {
      unlock();
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!rootRef.current) return;
      if (document.querySelector('.dialog-root')) return; // a confirm dialog is on top
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' && (e.target as HTMLElement).tagName !== 'BUTTON') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else trapTab(e, rootRef.current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // Slideshow.
  useEffect(() => {
    if (!playing || items.length < 2) return;
    const timer = window.setTimeout(() => go(1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60 || info.velocity.x < -500) go(1);
    else if (info.offset.x > 60 || info.velocity.x > 500) go(-1);
  };

  if (!memory) return null;
  const albumNames = memory.albumIds.map((id) => albums.find((a) => a.id === id)?.name).filter(Boolean);
  const meta = [formatDate(memory.date), memory.location, ...albumNames].filter(Boolean).join(' · ');

  return (
    <motion.div
      ref={rootRef}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Memory ${safeIndex + 1} of ${items.length}${memory.caption ? `: ${memory.caption}` : ''}`}
      tabIndex={-1}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {playing && items.length > 1 && (
        <div className="lightbox__progress" aria-hidden="true">
          <span key={`${safeIndex}-${memory.id}`} style={{ animationDuration: `${SLIDE_MS}ms` }} />
        </div>
      )}

      <div className="lightbox__bar">
        <span className="lightbox__count">
          {safeIndex + 1} / {items.length}
        </span>
        <div className="lightbox__tools">
          {items.length > 1 && (
            <button
              type="button"
              className="icon-btn icon-btn--on-dark"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
              aria-pressed={playing}
            >
              {playing ? <Pause /> : <Play />}
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-btn--on-dark"
            onClick={music.toggle}
            aria-label={music.playing ? 'Turn music off' : 'Play our soundtrack'}
            aria-pressed={music.playing}
          >
            <Music />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--on-dark fav-btn"
            aria-pressed={memory.favorite}
            aria-label={memory.favorite ? 'Remove from favourites' : 'Mark as favourite'}
            onClick={() => toggleFavorite('memories', memory.id)}
          >
            <Heart />
          </button>
          <button type="button" className="icon-btn icon-btn--on-dark" aria-label="Edit memory" onClick={() => onEdit(memory)}>
            <Pencil />
          </button>
          <button type="button" className="icon-btn icon-btn--on-dark" aria-label="Delete memory" onClick={() => onDelete(memory)}>
            <Trash2 />
          </button>
          <button type="button" className="icon-btn icon-btn--on-dark" aria-label="Close" onClick={onClose}>
            <X />
          </button>
        </div>
      </div>

      <div className="lightbox__stage">
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.div
            key={memory.id}
            className="lightbox__frame"
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * 60, scale: reduce ? 1 : 0.98 }),
              center: { opacity: 1, x: 0, scale: 1 },
              exit: (d: number) => ({ opacity: 0, x: reduce ? 0 : d * -60, scale: reduce ? 1 : 0.98 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: playing ? 0.8 : 0.35, ease: [0.22, 1, 0.36, 1] }}
            drag={items.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={onDragEnd}
            style={{ touchAction: 'pan-y' }}
          >
            <MediaView source={memory.media} alt={memory.caption || 'Memory'} mode="full" fit="contain" className="lightbox__media" />
          </motion.div>
        </AnimatePresence>

        {items.length > 1 && (
          <>
            <button type="button" className="lightbox__nav lightbox__nav--prev" onClick={() => go(-1)} aria-label="Previous memory">
              <ChevronLeft />
            </button>
            <button type="button" className="lightbox__nav lightbox__nav--next" onClick={() => go(1)} aria-label="Next memory">
              <ChevronRight />
            </button>
          </>
        )}
      </div>

      <div className="lightbox__caption">
        {memory.isSample && <span className="tag tag--sample lightbox__sample">Sample · replace with your photo</span>}
        {memory.caption && <p className="lightbox__title">{memory.caption}</p>}
        {memory.note && <p className="lightbox__note">{memory.note}</p>}
        {meta && <p className="lightbox__meta">{meta}</p>}
      </div>
    </motion.div>
  );
}
