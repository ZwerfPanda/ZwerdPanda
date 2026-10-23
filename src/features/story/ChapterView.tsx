import { useEffect, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Heart, Pencil, Trash2 } from 'lucide-react';
import { Dialog } from '../../components/ui/Dialog';
import { MediaView } from '../../components/media/MediaView';
import { SongLink } from '../../components/music/SongLink';
import { confirm, toast } from '../../components/ui/feedback';
import { moveItem, removeItem, restoreItem, toggleFavorite } from '../../data/actions';
import { getContent, useContent } from '../../data/store';
import { formatDate } from '../../lib/dates';
import { motifFor, roman } from './motifs';
import { ByTag } from '../../components/common/ByTag';

export function ChapterView({
  openId,
  onNavigate,
  onClose,
  onEdit,
}: {
  openId: string | null;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onEdit: (id: string) => void;
}) {
  const milestones = useContent((c) => c.milestones);
  const index = milestones.findIndex((m) => m.id === openId);
  const milestone = index >= 0 ? milestones[index] : null;
  const [direction, setDirection] = useState(1);
  const [mediaIndex, setMediaIndex] = useState(0);

  useEffect(() => setMediaIndex(0), [openId]);

  // Close if the chapter vanished (deleted elsewhere).
  useEffect(() => {
    if (openId && index < 0) onClose();
  }, [openId, index, onClose]);

  const go = (delta: 1 | -1) => {
    const next = milestones[index + delta];
    if (!next) return;
    setDirection(delta);
    onNavigate(next.id);
  };

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, iframe, video')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -70) go(1);
    else if (info.offset.x > 70) go(-1);
  };

  const remove = async () => {
    if (!milestone) return;
    const ok = await confirm({
      title: 'Dit hoofdstuk verwijderen?',
      message: `“${milestone.title}” en de foto’s gaan uit ons verhaal.`,
      confirmLabel: 'Hoofdstuk verwijderen',
      tone: 'danger',
    });
    if (!ok) return;
    const position = getContent().milestones.findIndex((m) => m.id === milestone.id);
    removeItem('milestones', milestone.id);
    onClose();
    toast('Hoofdstuk verwijderd', {
      action: {
        label: 'Ongedaan maken',
        run: () => restoreItem('milestones', milestone, position),
      },
    });
  };

  const motif = milestone ? motifFor(milestone.motif) : null;
  const Icon = motif?.icon;
  const media = milestone?.media ?? [];
  const current = media[Math.min(mediaIndex, media.length - 1)];

  return (
    <Dialog
      open={milestone !== null}
      onClose={onClose}
      size="lg"
      className="chapter-dialog"
      eyebrow={
        milestone ? (milestone.future ? 'nog te schrijven' : `hoofdstuk ${roman(index + 1)}`) : ''
      }
      title={milestone?.title ?? ''}
      footer={
        milestone && (
          <>
            <button
              type="button"
              className="icon-btn icon-btn--filled"
              onClick={() => go(-1)}
              disabled={index <= 0}
              aria-label="Vorig hoofdstuk"
            >
              <ChevronLeft />
            </button>
            <span className="pager-count" aria-live="polite">
              {index + 1} / {milestones.length}
            </span>
            <button
              type="button"
              className="icon-btn icon-btn--filled"
              onClick={() => go(1)}
              disabled={index >= milestones.length - 1}
              aria-label="Volgend hoofdstuk"
            >
              <ChevronRight />
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="icon-btn fav-btn"
              aria-pressed={milestone.favorite}
              aria-label={milestone.favorite ? 'Uit favorieten halen' : 'Markeer als favoriet'}
              onClick={() => toggleFavorite('milestones', milestone.id)}
            >
              <Heart />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Hoofdstuk bewerken"
              onClick={() => onEdit(milestone.id)}
            >
              <Pencil />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Hoofdstuk verwijderen"
              onClick={remove}
            >
              <Trash2 />
            </button>
          </>
        )
      }
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        {milestone && (
          <motion.article
            key={milestone.id}
            className="chapter"
            custom={direction}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 40, rotateY: d * -8 }),
              center: { opacity: 1, x: 0, rotateY: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -40, rotateY: d * 8 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={onDragEnd}
            style={{ touchAction: 'pan-y' }}
          >
            <div className="chapter__meta">
              {Icon && (
                <span
                  className="chapter__motif"
                  style={{ background: motif!.tint }}
                  aria-hidden="true"
                >
                  <Icon />
                </span>
              )}
              <span>
                {milestone.date
                  ? formatDate(milestone.date)
                  : milestone.dateLabel || (milestone.future ? 'someday' : 'datum volgt')}
              </span>
              {milestone.isSample && <span className="tag tag--sample">Voorbeeldhoofdstuk</span>}
              <ByTag by={milestone.by} />
              {milestone.favorite && (
                <span className="tag">
                  <Heart fill="currentColor" aria-hidden="true" /> Favoriet
                </span>
              )}
            </div>

            {current && (
              <figure className="chapter__figure">
                <div className="chapter__media">
                  <MediaView
                    source={current}
                    alt={`${milestone.title} — foto ${mediaIndex + 1}`}
                    mode="full"
                    fit="contain"
                  />
                </div>
                {media.length > 1 && (
                  <div className="chapter__thumbs" role="group" aria-label="Kies een foto">
                    {media.map((m, i) => (
                      <button
                        key={i}
                        type="button"
                        className="chapter__thumb"
                        aria-pressed={i === mediaIndex}
                        aria-label={`Foto ${i + 1} tonen`}
                        onClick={() => setMediaIndex(i)}
                      >
                        <MediaView source={m} alt="" />
                      </button>
                    ))}
                  </div>
                )}
              </figure>
            )}

            {milestone.story && (
              <div className="chapter__story">
                {milestone.story.split(/\n{2,}/).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}

            {milestone.prompt && (
              <p className="chapter__prompt">
                <span>vul dit in:</span> {milestone.prompt}
              </p>
            )}

            {milestone.song && <SongLink {...milestone.song} />}

            <div className="chapter__order">
              <button
                type="button"
                className="btn btn--quiet btn--small"
                disabled={index <= 0}
                onClick={() => moveItem('milestones', milestone.id, -1)}
              >
                <ArrowUp aria-hidden="true" /> Eerder zetten
              </button>
              <button
                type="button"
                className="btn btn--quiet btn--small"
                disabled={index >= milestones.length - 1}
                onClick={() => moveItem('milestones', milestone.id, 1)}
              >
                <ArrowDown aria-hidden="true" /> Later zetten
              </button>
            </div>
          </motion.article>
        )}
      </AnimatePresence>
    </Dialog>
  );
}
