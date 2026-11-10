import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookImage,
  Eye,
  MoreHorizontal,
  Pause,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useContent } from '../../data/store';
import { nameOf, useMe } from '../../data/people';
import type { Story } from '../../data/types';
import { confirm, toast } from '../../components/ui/feedback';
import { lockScroll, trapTab } from '../../components/ui/scrollLock';
import { playSfx } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../hooks/useMotion';
import { sendChat } from '../chat/chatData';
import { StoryAvatar } from './StoryAvatar';
import { StoryCanvas } from './StoryCanvas';
import {
  REACTIONS,
  deleteStory,
  markSeen,
  react,
  saveHighlight,
  storySeconds,
  storyToMemory,
  storyWords,
  timeAgo,
  toggleInHighlight,
} from './stories';

const TAP_MS = 260;

/**
 * Watching stories, full screen: bars at the top, tap right for the next one,
 * left for the one before, hold to pause, swipe down to close.
 */
export function StoryViewer({
  queue,
  start = 0,
  title,
  onClose,
}: {
  queue: Story[];
  start?: number;
  /** A highlight's name, shown instead of who posted it. */
  title?: string;
  onClose: () => void;
}) {
  const me = useMe();
  const reduce = useReducedMotion();
  const profile = useContent((c) => c.profile);
  const views = useContent((c) => c.stories.views);
  const reactions = useContent((c) => c.stories.reactions);
  const highlights = useContent((c) => c.stories.highlights);
  const messages = useContent((c) => c.chat.messages);
  const items = useContent((c) => c.stories.items);
  // Stories deleted while watching drop out of the queue.
  const list = useMemo(() => queue.filter((s) => items.some((x) => x.id === s.id)), [queue, items]);
  const [i, setI] = useState(Math.min(start, Math.max(0, queue.length - 1)));
  const story = list[Math.min(i, list.length - 1)];
  const [progress, setProgressState] = useState(0);
  const progressRef = useRef(0);
  const setProgress = (p: number) => {
    progressRef.current = p;
    setProgressState(p);
  };
  const [held, setHeld] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'menu' | 'highlight' | 'seen'>('none');
  const [muted, setMuted] = useState(false);
  const [reply, setReply] = useState('');
  const [burst, setBurst] = useState<{ id: number; emoji: string } | null>(null);
  const [dragY, setDragY] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const press = useRef<{ t: number; x: number; y: number; timer: number } | null>(null);
  const paused = held || typing || sheet !== 'none';

  const go = (d: number) => {
    const next = i + d;
    if (next < 0) {
      setProgress(0);
      if (video.current) video.current.currentTime = 0;
      return;
    }
    if (next >= list.length) return onClose();
    setI(next);
    setProgress(0);
  };

  useEffect(() => {
    if (!list.length) onClose();
  }, [list.length]);

  useEffect(() => {
    const unlock = lockScroll();
    root.current?.querySelector<HTMLElement>('.story-view__close')?.focus();
    return unlock;
  }, []);

  useEffect(() => {
    if (story && story.by !== me) markSeen(story);
  }, [story?.id]);

  // The clock: a photo or text shows a few seconds, a clip as long as it runs.
  useEffect(() => {
    if (!story) return;
    const isClip = story.media?.kind === 'video';
    const start = (v: HTMLVideoElement) =>
      v.play().catch(() => {
        // Sound before a tap isn't allowed everywhere: play without.
        setMuted(true);
        v.muted = true;
        void v.play().catch(() => undefined);
      });
    // The clip may still be loading: it's started once it's there.
    let started = false;
    const v = video.current;
    if (isClip && v) {
      if (paused) v.pause();
      else {
        started = true;
        void start(v);
      }
    }
    if (paused) return;
    let raf = 0;
    let last = performance.now();
    const total = storySeconds(story) * 1000;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      const vid = video.current;
      if (isClip && vid && !started) {
        started = true;
        void start(vid);
      }
      if (isClip && vid && vid.duration > 0 && Number.isFinite(vid.duration)) {
        setProgress(vid.currentTime / vid.duration);
        if (vid.ended) return go(1);
      } else if (isClip && vid && vid.readyState < 2) {
        // still loading: wait, the bar doesn't run yet
      } else {
        const next = Math.min(1, progressRef.current + dt / total);
        setProgress(next);
        if (next >= 1) return go(1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [story?.id, paused, i]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing) {
        if (e.key === 'Escape') (document.activeElement as HTMLElement)?.blur();
        return;
      }
      if (e.key === 'Escape') {
        if (sheet !== 'none') setSheet('none');
        else onClose();
      }
      if (sheet !== 'none') {
        if (e.key === 'Tab' && root.current) trapTab(e, root.current);
        return;
      }
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'Tab' && root.current) trapTab(e, root.current);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  if (!story) return null;
  const mine = story.by === me;
  const who = nameOf(story.by, profile);
  const otherName = nameOf(me === 'you' ? 'partner' : 'you', profile);
  const seen = views.find((v) => v.story === story.id && v.by !== story.by);
  const got = reactions.filter((r) => r.story === story.id);
  const replies = messages.filter((m) => m.story === story.id);

  // Tap, hold or swipe on the picture.
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const timer = window.setTimeout(() => setHeld(true), 180);
    press.current = { t: performance.now(), x: e.clientX, y: e.clientY, timer };
  };
  const moveP = (e: React.PointerEvent) => {
    if (!press.current) return;
    const dy = e.clientY - press.current.y;
    if (dy > 10) setDragY(dy);
  };
  const up = (e: React.PointerEvent) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    window.clearTimeout(p.timer);
    setHeld(false);
    const dy = e.clientY - p.y;
    setDragY(0);
    if (dy > 110) return onClose();
    if (performance.now() - p.t > TAP_MS || Math.abs(e.clientX - p.x) > 24) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    go(e.clientX - box.left < box.width * 0.3 ? -1 : 1);
  };
  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
    setHeld(false);
    setDragY(0);
  };

  const sendReaction = (emoji: string) => {
    react(story, emoji);
    setBurst({ id: Date.now(), emoji });
    playSfx('pop', true);
  };

  const sendReply = (e: React.FormEvent) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    sendChat(text, undefined, story.id);
    setReply('');
    (document.activeElement as HTMLElement)?.blur();
    toast(`Verstuurd naar ${who} ♡`);
  };

  const remove = async () => {
    setSheet('none');
    const ok = await confirm({
      title: 'Story verwijderen?',
      message: 'Hij verdwijnt bij jullie allebei, ook uit het archief en de highlights.',
      confirmLabel: 'Verwijderen',
      tone: 'danger',
    });
    if (ok) {
      deleteStory(story.id);
      toast('Story verwijderd');
    }
  };

  const keep = () => {
    setSheet('none');
    if (storyToMemory(story)) toast('In ons plakboek gezet ♡');
  };

  return createPortal(
    <motion.div
      ref={root}
      className="story-view"
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Highlight: ${title}` : `Story van ${who}`}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      style={{ transform: dragY ? `translateY(${dragY}px) scale(${1 - dragY / 2000})` : undefined }}
    >
      <div className="story-view__frame">
        <div
          className="story-view__stage"
          onPointerDown={down}
          onPointerMove={moveP}
          onPointerUp={up}
          onPointerCancel={cancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          <StoryCanvas
            key={story.id}
            story={story}
            mode="play"
            videoRef={video}
            muted={muted}
            label={storyWords(story)}
          />
        </div>

        <div className="story-view__bars" aria-hidden="true">
          {list.map((s, n) => (
            <span key={s.id}>
              <span style={{ transform: `scaleX(${n < i ? 1 : n === i ? progress : 0})` }} />
            </span>
          ))}
        </div>

        <div className="story-view__head">
          <StoryAvatar who={story.by} size={36} />
          <p className="story-view__who">
            <strong>{title ?? who}</strong>
            <span>{title ? `${who} · ${timeAgo(story.createdAt)}` : timeAgo(story.createdAt)}</span>
          </p>
          {paused && sheet === 'none' && !typing && (
            <Pause className="story-view__paused" aria-label="Gepauzeerd" />
          )}
          {story.media?.kind === 'video' && (
            <button
              type="button"
              className="story-icon"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Geluid aan' : 'Geluid uit'}
            >
              {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
            </button>
          )}
          <button
            type="button"
            className="story-icon"
            onClick={() => setSheet('menu')}
            aria-label="Meer"
          >
            <MoreHorizontal aria-hidden="true" />
          </button>
          <button
            type="button"
            className="story-icon story-view__close"
            onClick={onClose}
            aria-label="Sluiten"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <span className="visually-hidden" aria-live="polite">
          {`Story ${i + 1} van ${list.length}`}
        </span>
        <div className="story-view__nav">
          <button type="button" className="visually-hidden" onClick={() => go(-1)}>
            Vorige story
          </button>
          <button type="button" className="visually-hidden" onClick={() => go(1)}>
            Volgende story
          </button>
        </div>

        <AnimatePresence>
          {burst && (
            <motion.div
              key={burst.id}
              className="story-burst"
              aria-hidden="true"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 1.4, delay: 0.4 }}
              onAnimationComplete={() => setBurst(null)}
            >
              {Array.from({ length: 7 }, (_, n) => (
                <motion.span
                  key={n}
                  initial={{ y: 0, x: 0, scale: 0.4 }}
                  animate={{ y: -220 - n * 18, x: (n - 3) * 26, scale: 1.3 - (n % 3) * 0.2 }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: n * 0.04 }}
                >
                  {burst.emoji}
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="story-view__foot">
        {mine ? (
          <button type="button" className="story-seen" onClick={() => setSheet('seen')}>
            <Eye aria-hidden="true" />
            {seen
              ? `Gezien door ${otherName} · ${new Date(seen.at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
              : 'Nog niet gezien'}
            {got.length > 0 && (
              <span className="story-seen__emoji">
                {got
                  .slice(-5)
                  .map((r) => r.emoji)
                  .join('')}
              </span>
            )}
            {replies.length > 0 && <span className="story-seen__count">💬 {replies.length}</span>}
          </button>
        ) : (
          <>
            <div className="story-reacts" role="group" aria-label="Snel reageren">
              {REACTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => sendReaction(r)}
                  aria-label={`Reageer met ${r}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <form className="story-reply" onSubmit={sendReply}>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => setTyping(true)}
                onBlur={() => setTyping(false)}
                placeholder={`Stuur ${who} een berichtje…`}
                aria-label={`Antwoord aan ${who}`}
                maxLength={1000}
                enterKeyHint="send"
              />
              <button
                type="submit"
                className="story-icon"
                aria-label="Versturen"
                disabled={!reply.trim()}
              >
                <Send aria-hidden="true" />
              </button>
            </form>
          </>
        )}
      </div>

      <AnimatePresence>
        {sheet !== 'none' && (
          <motion.div
            className="story-sheet-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheet('none')}
          >
            <motion.div
              className="story-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              {sheet === 'menu' && (
                <div className="story-sheet__list">
                  <button type="button" onClick={() => setSheet('highlight')}>
                    <Sparkles aria-hidden="true" /> In een highlight
                  </button>
                  {story.media && (
                    <button type="button" onClick={keep}>
                      <BookImage aria-hidden="true" /> In ons plakboek
                    </button>
                  )}
                  {mine && (
                    <button type="button" className="is-danger" onClick={() => void remove()}>
                      <Trash2 aria-hidden="true" /> Verwijderen
                    </button>
                  )}
                  <button type="button" onClick={() => setSheet('none')}>
                    Annuleren
                  </button>
                </div>
              )}
              {sheet === 'highlight' && (
                <HighlightPicker storyId={story.id} highlights={highlights} />
              )}
              {sheet === 'seen' && (
                <div className="story-sheet__seen">
                  <p className="story-sheet__title">
                    <Eye aria-hidden="true" />{' '}
                    {seen
                      ? `${otherName} zag hem ${timeAgo(seen.at)} geleden`.replace(
                          'nu geleden',
                          'net',
                        )
                      : `${otherName} heeft hem nog niet gezien`}
                  </p>
                  {got.length > 0 && (
                    <p className="story-sheet__reacts" aria-label="Reacties">
                      {got.map((r) => (
                        <span key={r.id}>{r.emoji}</span>
                      ))}
                    </p>
                  )}
                  {replies.length > 0 ? (
                    <ul className="story-sheet__replies">
                      {replies.map((m) => (
                        <li key={m.id} className={m.from === me ? 'is-mine' : ''}>
                          {m.text}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="story-sheet__none">Nog geen berichtjes op deze story.</p>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}

function HighlightPicker({
  storyId,
  highlights,
}: {
  storyId: string;
  highlights: { id: string; title: string; emoji: string; stories: string[] }[];
}) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('💞');
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    saveHighlight({ title: t.slice(0, 40), emoji, stories: [storyId] });
    setTitle('');
    toast(`Highlight “${t}” gemaakt ✨`);
  };
  return (
    <div className="story-sheet__highlights">
      <p className="story-sheet__title">In een highlight</p>
      {highlights.length > 0 && (
        <ul>
          {highlights.map((h) => {
            const on = h.stories.includes(storyId);
            return (
              <li key={h.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  className={on ? 'is-on' : ''}
                  onClick={() => toggleInHighlight(h.id, storyId)}
                >
                  <span aria-hidden="true">{h.emoji}</span> {h.title}
                  <span className="story-sheet__check" aria-hidden="true">
                    {on ? '✓' : '+'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form className="story-sheet__new" onSubmit={create}>
        <select value={emoji} onChange={(e) => setEmoji(e.target.value)} aria-label="Icoontje">
          {['💞', '✈️', '🐰', '🍓', '🌙', '🎀', '🍿', '🏖️', '🎂', '⭐'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nieuwe highlight…"
          aria-label="Naam van de nieuwe highlight"
          maxLength={40}
        />
        <button type="submit" className="btn btn--primary" disabled={!title.trim()}>
          Maak
        </button>
      </form>
    </div>
  );
}
