import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useContent } from '../../data/store';
import type { AppContent } from '../../data/types';
import { countContent } from '../../data/restorePoints';
import { durationBetween, parseIsoDate, todayIso } from '../../lib/dates';
import { useReducedMotion } from '../../hooks/useMotion';
import { playSfx } from '../../lib/audio/sfx';
import { MediaView } from '../../components/media/MediaView';
import { CocoFigure } from '../../components/art/SampleArt';
import { usePetName } from '../her/HerNotes';
import './wrapped.css';

interface Slide {
  key: string;
  bg: string;
  kicker: string;
  big?: ReactNode;
  text: ReactNode;
  art?: ReactNode;
}

const STEP_MS = 5200;

const n = (count: number, one: string, more: string) => `${count} ${count === 1 ? one : more}`;

/** Our story so far, in numbers and moments — built from what's really here. */
function buildSlides(c: AppContent, petName: string): Slide[] {
  const slides: Slide[] = [];
  const start = parseIsoDate(c.profile.startDate ?? '');
  const today = parseIsoDate(todayIso())!;
  const days = start ? (durationBetween(start, today)?.totalDays ?? 0) : 0;
  const counts = countContent(c);
  const been = c.museum.stops.filter((s) => !s.upcoming);

  slides.push({
    key: 'hello',
    bg: 'linear-gradient(160deg, #2a1530, #6a2c5c)',
    kicker: 'ons verhaal tot nu toe',
    big: '✨',
    text: `Hé ${petName}. Zullen we even terugkijken?`,
  });
  if (days) {
    slides.push({
      key: 'days',
      bg: 'linear-gradient(160deg, #96485a, #d98a6a)',
      kicker: 'samen',
      big: days.toLocaleString('nl-NL'),
      text: `dagen. En elke dag een beetje meer.`,
    });
  }
  if (c.museum.foundAt && been.length) {
    slides.push({
      key: 'line',
      bg: 'linear-gradient(160deg, #003082, #2f5bb7)',
      kicker: 'de love line',
      big: been.length,
      text: `${been.length === 1 ? 'halte' : 'haltes'}, van ${been[0].name} tot ${been.at(-1)!.name}. 🚆`,
    });
  }
  if (counts["foto's"] || counts.herinneringen) {
    const fav =
      c.memories.find((m) => m.favorite && m.media.type === 'local') ??
      c.memories.find((m) => !m.isSample && m.media.type === 'local');
    slides.push({
      key: 'photos',
      bg: 'linear-gradient(160deg, #9a6b12, #d9a441)',
      kicker: 'vastgelegd',
      big: counts["foto's"] || counts.herinneringen,
      text: counts["foto's"]
        ? `${counts["foto's"] === 1 ? 'foto' : "foto's"} van ons. ${fav ? `Deze is een favoriet: “${fav.caption}”` : ''}`
        : `${counts.herinneringen === 1 ? 'herinnering' : 'herinneringen'} in ons plakboek.`,
      art: fav ? (
        <div className="wrapped__photo">
          <MediaView source={fav.media} alt={fav.caption} />
        </div>
      ) : undefined,
    });
  }
  const notes = c.her.notes.length;
  const letters = c.letters.filter((l) => !l.isSample).length;
  if (notes || letters) {
    const voices =
      c.her.notes.filter((x) => x.voice).length + c.letters.filter((l) => l.voice).length;
    slides.push({
      key: 'words',
      bg: 'linear-gradient(160deg, #96485a, #d48d96)',
      kicker: 'woorden',
      big: notes + letters,
      text: [
        letters ? n(letters, 'brief', 'brieven') : '',
        notes ? n(notes, 'love note', 'love notes') : '',
        voices ? `${n(voices, 'keer', 'keer')} met mijn stem erbij` : '',
      ]
        .filter(Boolean)
        .join(' · '),
    });
  }
  const songs = c.songs;
  const ours = songs.find((s) => s.favorite) ?? songs[0];
  if (ours) {
    slides.push({
      key: 'song',
      bg: 'linear-gradient(160deg, #2d172f, #7d68b5)',
      kicker: 'ons liedje',
      big: '🎶',
      text: `${ours.title}${ours.artist ? ` — ${ours.artist}` : ''}`,
    });
  }
  const born = parseIsoDate(c.pet.birthday);
  if (born) {
    const months = durationBetween(born, today);
    slides.push({
      key: 'coco',
      bg: 'linear-gradient(160deg, #6b3a26, #b9646f)',
      kicker: 'ons kleine chaosje',
      text: months
        ? `Coco is al ${
            [
              months.years ? n(months.years, 'jaar', 'jaar') : '',
              months.months ? n(months.months, 'maand', 'maanden') : '',
            ]
              .filter(Boolean)
              .join(' en ') || 'een paar dagen'
          } oud. 🐰`
        : 'Coco. 🐰',
      art: (
        <svg viewBox="-90 -90 180 170" className="wrapped__coco" aria-hidden="true">
          <CocoFigure x={0} y={0} scale={0.9} blink />
        </svg>
      ),
    });
  }
  const ahead = c.museum.foundAt ? c.museum.stops.filter((s) => s.upcoming) : [];
  slides.push({
    key: 'end',
    bg: 'linear-gradient(160deg, #2a1530, #b9646f)',
    kicker: ahead.length ? `en straks: ${ahead.map((s) => s.name).join(', ')}` : 'en nu?',
    big: '♡',
    text: `En dit is pas het begin, ${petName}.`,
  });
  return slides;
}

/** "Our story in slides": a little recap, story-style. Tap to go on. */
export function Wrapped({ open, onClose }: { open: boolean; onClose: () => void }) {
  const content = useContent((c) => c);
  const petName = usePetName();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const slides = buildSlides(content, petName);
  const slide = slides[Math.min(index, slides.length - 1)];

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open || reduce || index >= slides.length - 1) return;
    const t = window.setTimeout(() => setIndex((i) => i + 1), STEP_MS);
    return () => window.clearTimeout(t);
  }, [open, index, reduce, slides.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, slides.length]);

  if (!open) return null;

  const tap = (e: React.MouseEvent<HTMLDivElement>) => {
    const left = e.clientX < window.innerWidth / 3;
    playSfx('pop', true);
    setIndex((i) => (left ? Math.max(0, i - 1) : Math.min(slides.length - 1, i + 1)));
  };

  return (
    <div
      className="wrapped"
      role="dialog"
      aria-modal="true"
      aria-label="Ons verhaal in slides"
      style={{ background: slide.bg }}
    >
      <div className="wrapped__bars" aria-hidden="true">
        {slides.map((s, i) => (
          <span key={s.key} className={i < index ? 'is-done' : i === index ? 'is-now' : ''}>
            <span style={{ animationDuration: reduce ? '0s' : `${STEP_MS}ms` }} />
          </span>
        ))}
      </div>
      <button type="button" className="wrapped__close" aria-label="Sluiten" onClick={onClose}>
        <X />
      </button>
      <div className="wrapped__stage" onClick={tap}>
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.key}
            className="wrapped__slide"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -20 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
          >
            <p className="wrapped__kicker">{slide.kicker}</p>
            {slide.big !== undefined && <p className="wrapped__big">{slide.big}</p>}
            {slide.art}
            <p className="wrapped__text">{slide.text}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="wrapped__hint" aria-hidden="true">
        {index < slides.length - 1 ? 'tik om verder te gaan' : 'tik op ✕ om terug te gaan'}
      </p>
    </div>
  );
}

/** The button that opens it. */
export function WrappedButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn btn--soft wrapped-open"
        data-sfx="sparkle"
        onClick={() => setOpen(true)}
      >
        <Sparkles aria-hidden="true" /> Ons verhaal in slides
      </button>
      <Wrapped open={open} onClose={() => setOpen(false)} />
    </>
  );
}
