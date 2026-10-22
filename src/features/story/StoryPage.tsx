import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookHeart, Heart, Plus } from 'lucide-react';
import { useContent } from '../../data/store';
import { toggleFavorite } from '../../data/actions';
import type { Milestone } from '../../data/types';
import { formatDate } from '../../lib/dates';
import { replaceParams, useRoute } from '../../lib/router';
import { EmptyState, PageHeader } from '../../components/ui/Fields';
import { MediaView } from '../../components/media/MediaView';
import { SampleArt } from '../../components/art/SampleArt';
import { SiteFooter } from '../../components/common/SiteFooter';
import { useReducedMotion } from '../../hooks/useMotion';
import { ChapterView } from './ChapterView';
import { MilestoneForm } from './MilestoneForm';
import { motifFor, roman } from './motifs';
import './story.css';
import { ByTag } from '../../components/common/ByTag';

type Track = 'rail' | 'road' | 'stars';

export function StoryPage() {
  const milestones = useContent((c) => c.milestones);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const closeChapter = useCallback(() => setOpenId(null), []);
  const { params } = useRoute();
  const linkedChapter = params.get('chapter');

  // Deep link from elsewhere (e.g. the station's departure board).
  useEffect(() => {
    if (!linkedChapter) return;
    setOpenId(linkedChapter);
    replaceParams({ chapter: null });
  }, [linkedChapter]);

  // The line is train tracks until the chapter with the car, then a road.
  const carIndex = milestones.findIndex((m) => m.motif === 'car');
  const trackFor = (m: Milestone, i: number): Track =>
    m.future ? 'stars' : carIndex >= 0 && i >= carIndex ? 'road' : 'rail';

  const visible = useMemo(
    () => milestones.map((m, i) => ({ m, i })).filter(({ m }) => !onlyFavorites || m.favorite),
    [milestones, onlyFavorites],
  );
  const editingMilestone = editing.id
    ? (milestones.find((m) => m.id === editing.id) ?? null)
    : null;
  const favoriteCount = milestones.filter((m) => m.favorite).length;

  return (
    <div className="page story-page">
      <PageHeader
        eyebrow="the chapters so far"
        title={
          <>
            Our <em>Story</em>
          </>
        }
        lede="From a livestream to wherever we’re going next. Tap a chapter to open it — every one can be rewritten, dated and filled with our own photos."
        actions={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setEditing({ open: true, id: null })}
            >
              <Plus aria-hidden="true" /> Add a chapter
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites((v) => !v)}
            >
              <Heart aria-hidden="true" /> Favourites{' '}
              <span className="chip__count">{favoriteCount}</span>
            </button>
          </>
        }
      />

      {milestones.length === 0 ? (
        <EmptyState
          art={<SampleArt art="future" />}
          title="Our story starts here"
          text="Add the first chapter — the livestream, the first message, whatever feels like page one."
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setEditing({ open: true, id: null })}
            >
              <Plus aria-hidden="true" /> Write chapter one
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          art={<BookHeart size={56} strokeWidth={1.4} color="var(--accent)" />}
          title="No favourite chapters yet"
          text="Open a chapter and tap the heart to keep it here."
          action={
            <button type="button" className="btn btn--soft" onClick={() => setOnlyFavorites(false)}>
              Show every chapter
            </button>
          }
        />
      ) : (
        <ol className="timeline">
          {visible.map(({ m, i }, position) => (
            <TimelineEntry
              key={m.id}
              milestone={m}
              number={i + 1}
              track={trackFor(m, i)}
              variant={position % 3}
              side={position % 2 === 0 ? 'left' : 'right'}
              onOpen={() => setOpenId(m.id)}
            />
          ))}
        </ol>
      )}

      <ChapterView
        openId={openId}
        onNavigate={setOpenId}
        onClose={closeChapter}
        onEdit={(id) => setEditing({ open: true, id })}
      />
      <MilestoneForm
        open={editing.open}
        milestone={editingMilestone}
        onClose={() => setEditing({ open: false, id: null })}
        onSaved={(id) => {
          if (openId) setOpenId(id);
        }}
      />
      <SiteFooter />
    </div>
  );
}

function TimelineEntry({
  milestone: m,
  number,
  track,
  variant,
  side,
  onOpen,
}: {
  milestone: Milestone;
  number: number;
  track: Track;
  variant: number;
  side: 'left' | 'right';
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const motif = motifFor(m.motif);
  const Icon = motif.icon;
  const cover = m.media[0];
  const when = m.date ? formatDate(m.date) : m.dateLabel || (m.future ? 'someday' : 'date to add');
  const layout = m.future
    ? 'future'
    : cover
      ? (['polaroid', 'paper', 'quote'] as const)[variant]
      : 'quote';

  return (
    <motion.li
      className={`tl tl--${track} tl--${side}`}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="tl__line" aria-hidden="true" />
      <span
        className={`tl__station tl__station--${track}`}
        style={{ background: motif.tint }}
        aria-hidden="true"
      >
        <Icon />
      </span>

      <article className={`tl__card tl__card--${layout}`} onClick={onOpen}>
        <p className="tl__chapter">
          {m.future ? 'to be continued' : `chapter ${roman(number)}`} ·{' '}
          <span className="tl__when">{when}</span>
        </p>
        <h2 className="tl__title">
          <button
            type="button"
            className="tl__open"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {m.title}
          </button>
        </h2>

        {cover && layout !== 'future' && (
          <div className={`tl__media tl__media--${layout}`}>
            {layout === 'paper' && (
              <span className="tape tape--lavender tl__tape" aria-hidden="true" />
            )}
            <div className="tl__photo">
              <MediaView source={cover} alt={m.title} />
            </div>
            {m.media.length > 1 && <span className="tl__more">+{m.media.length - 1}</span>}
          </div>
        )}

        {m.story && <p className="tl__story">{m.story}</p>}

        <div className="tl__foot">
          {m.isSample && <span className="tag tag--sample">Sample</span>}
          <ByTag by={m.by} />
          {m.song && <span className="tag">♫ {m.song.title}</span>}
          <button
            type="button"
            className="icon-btn fav-btn tl__fav"
            aria-pressed={m.favorite}
            aria-label={
              m.favorite
                ? `Remove “${m.title}” from favourites`
                : `Mark “${m.title}” as a favourite`
            }
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite('milestones', m.id);
            }}
          >
            <Heart />
          </button>
        </div>
      </article>
    </motion.li>
  );
}
