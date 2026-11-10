import { useRef, type ReactNode, type RefObject } from 'react';
import type { Story, StorySticker, StoryText } from '../../data/types';
import { useMediaUrl } from '../../lib/media';
import { bgCss, filterCss } from './stories';

export type StoryLook = Pick<Story, 'media' | 'bg' | 'filter' | 'texts' | 'stickers' | 'from'>;

/** Moving a text or a sticker with a finger, in the editor. */
export interface Editing {
  selected: { kind: 'text' | 'sticker'; index: number } | null;
  onSelect: (sel: { kind: 'text' | 'sticker'; index: number } | null) => void;
  onMove: (kind: 'text' | 'sticker', index: number, x: number, y: number) => void;
}

/**
 * One story, drawn in a 9:16 frame: the colour, the photo or clip (with its
 * filter), and the texts and stickers where they were put.
 */
export function StoryCanvas({
  story,
  mode,
  videoRef,
  muted = true,
  editing,
  label,
  children,
}: {
  story: StoryLook;
  /** play: the clip runs (the viewer drives it); still: no sound, no autoplay. */
  mode: 'play' | 'still';
  videoRef?: RefObject<HTMLVideoElement | null>;
  muted?: boolean;
  editing?: Editing;
  label?: string;
  children?: ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const state = useMediaUrl(story.media?.mediaId);
  const url = story.media && state.status === 'ready' ? state.url : null;
  const filter = filterCss(story.filter);

  const drag = (kind: 'text' | 'sticker', index: number) => (e: React.PointerEvent) => {
    if (!editing || !frame.current) return;
    e.stopPropagation();
    editing.onSelect({ kind, index });
    const box = frame.current.getBoundingClientRect();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      const x = Math.min(0.97, Math.max(0.03, (ev.clientX - box.left) / box.width));
      const y = Math.min(0.97, Math.max(0.03, (ev.clientY - box.top) / box.height));
      editing.onMove(kind, index, x, y);
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  const isSel = (kind: 'text' | 'sticker', i: number) =>
    editing?.selected?.kind === kind && editing.selected.index === i;

  return (
    <div
      ref={frame}
      className={`story-canvas${editing ? ' is-editing' : ''}`}
      style={{ background: bgCss(story.bg) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      onPointerDown={editing ? () => editing.onSelect(null) : undefined}
    >
      {story.media && (
        <div className={`story-canvas__media${story.from ? ' is-whole' : ''}`} style={{ filter }}>
          {!url ? (
            <span className="story-canvas__wait">
              {state.status === 'missing' ? 'Nog niet binnen — komt vanzelf' : ''}
            </span>
          ) : story.media.kind === 'video' ? (
            <video
              ref={videoRef}
              src={mode === 'still' ? `${url}#t=0.1` : url}
              playsInline
              muted={mode === 'still' || muted}
              preload={mode === 'still' ? 'metadata' : 'auto'}
              loop={Boolean(editing)}
              autoPlay={Boolean(editing)}
            />
          ) : (
            <img src={url} alt="" draggable={false} />
          )}
        </div>
      )}
      {story.stickers.map((k, i) => (
        <Sticker
          key={`k${i}`}
          sticker={k}
          selected={isSel('sticker', i)}
          onPointerDown={editing ? drag('sticker', i) : undefined}
        />
      ))}
      {story.texts.map((t, i) => (
        <Text
          key={`t${i}`}
          text={t}
          selected={isSel('text', i)}
          onPointerDown={editing ? drag('text', i) : undefined}
        />
      ))}
      {story.from && mode === 'play' && (
        <span className="story-canvas__from">via {SOURCE_NAMES[story.from]}</span>
      )}
      {children}
    </div>
  );
}

export const SOURCE_NAMES: Record<NonNullable<Story['from']>, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  snapchat: 'Snapchat',
  other: 'eigen upload',
};

function Text({
  text,
  selected,
  onPointerDown,
}: {
  text: StoryText;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const dark = text.color === '#2b1630';
  return (
    <span
      className={`story-text story-text--${text.font}${text.boxed ? ' is-boxed' : ''}${selected ? ' is-selected' : ''}`}
      style={{
        left: `${text.x * 100}%`,
        top: `${text.y * 100}%`,
        color: text.boxed ? (dark ? '#fff' : '#2b1630') : text.color,
        background: text.boxed ? text.color : undefined,
      }}
      onPointerDown={onPointerDown}
    >
      {text.text}
    </span>
  );
}

function Sticker({
  sticker,
  selected,
  onPointerDown,
}: {
  sticker: StorySticker;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  return (
    <span
      className={`story-sticker${selected ? ' is-selected' : ''}`}
      style={{
        left: `${sticker.x * 100}%`,
        top: `${sticker.y * 100}%`,
        fontSize: `calc(${sticker.size} * var(--sticker, 13cqw))`,
      }}
      onPointerDown={onPointerDown}
      aria-hidden={onPointerDown ? undefined : true}
    >
      {sticker.emoji}
    </span>
  );
}
