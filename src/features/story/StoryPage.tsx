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
import { SampleNotice } from '../../components/common/SampleNotice';
import { HuntStar } from '../hunt/HuntStar';

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
            Ons <em>Verhaal</em>
          </>
        }
        lede="Van een livestream tot waar we ook heen gaan. Tik op een hoofdstuk om het te openen — elk hoofdstuk kun je herschrijven, dateren en vullen met onze eigen foto’s."
        actions={
          <>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setEditing({ open: true, id: null })}
            >
              <Plus aria-hidden="true" /> Hoofdstuk toevoegen
            </button>
            <button
              type="button"
              className="chip"
              aria-pressed={onlyFavorites}
              onClick={() => setOnlyFavorites((v) => !v)}
            >
              <Heart aria-hidden="true" /> Favorieten{' '}
              <span className="chip__count">{favoriteCount}</span>
            </button>
          </>
        }
      />
      <SampleNotice kind="milestones" />

      {milestones.length === 0 ? (
        <EmptyState
          art={<SampleArt art="future" />}
          title="Ons verhaal begint hier"
          text="Voeg het eerste hoofdstuk toe — de livestream, het eerste berichtje, wat voor ons als bladzijde één voelt."
          action={
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setEditing({ open: true, id: null })}
            >
              <Plus aria-hidden="true" /> Schrijf hoofdstuk één
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          art={<BookHeart size={56} strokeWidth={1.4} color="var(--accent)" />}
          title="Nog geen favoriete hoofdstukken"
          text="Open een hoofdstuk en tik op het hartje om het hier te bewaren."
          action={
            <button type="button" className="btn btn--soft" onClick={() => setOnlyFavorites(false)}>
              Toon alle hoofdstukken
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
  const when = m.date ? formatDate(m.date) : m.dateLabel || (m.future ? 'ooit' : 'datum volgt');
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
          {m.future ? 'to be continued' : `hoofdstuk ${roman(number)}`}
          {m.future && <HuntStar id="story" className="hunt-star--inline" />} ·{' '}
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
          {m.isSample && <span className="tag tag--sample">Voorbeeld</span>}
          <ByTag by={m.by} />
          {m.song && <span className="tag">♫ {m.song.title}</span>}
          <button
            type="button"
            className="icon-btn fav-btn tl__fav"
            aria-pressed={m.favorite}
            aria-label={
              m.favorite
                ? `“${m.title}” uit favorieten halen`
                : `“${m.title}” als favoriet markeren`
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
