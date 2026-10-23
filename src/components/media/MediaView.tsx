import { ImageOff, Play } from 'lucide-react';
import type { MediaSource } from '../../data/types';
import { useMediaUrl } from '../../lib/media';
import { useSyncState } from '../../sync/sync';
import { SampleArt } from '../art/SampleArt';
import './media.css';

interface MediaViewProps {
  source: MediaSource;
  /** Describes the picture for screen readers (sample art has its own description). */
  alt: string;
  mode?: 'thumb' | 'full';
  className?: string;
  /** Fill the parent box (cover) instead of keeping the natural shape. */
  fit?: 'cover' | 'contain';
}

export function MediaView({
  source,
  alt,
  mode = 'thumb',
  className = '',
  fit = 'cover',
}: MediaViewProps) {
  if (source.type === 'sample') {
    return (
      <div className={`media media--sample ${className}`}>
        <SampleArt art={source.art} />
      </div>
    );
  }
  return <LocalMedia source={source} alt={alt} mode={mode} className={className} fit={fit} />;
}

function LocalMedia({
  source,
  alt,
  mode,
  className,
  fit,
}: {
  source: Extract<MediaSource, { type: 'local' }>;
  alt: string;
  mode: 'thumb' | 'full';
  className: string;
  fit: 'cover' | 'contain';
}) {
  const state = useMediaUrl(source.mediaId);
  const shared = Boolean(useSyncState().spaceId);

  if (state.status === 'loading') {
    return (
      <div className={`media media--loading ${className}`} aria-label="Foto laden" role="img" />
    );
  }
  if (state.status === 'missing') {
    // Shared: the photo is on its way from the other phone and appears by itself.
    const text = shared ? 'Nog niet binnen — komt vanzelf' : 'Niet op dit apparaat';
    return (
      <div className={`media media--missing ${className}`} role="img" aria-label={text}>
        <ImageOff aria-hidden="true" />
        <span>{text}</span>
      </div>
    );
  }
  if (source.kind === 'video') {
    return mode === 'full' ? (
      <video
        className={`media media--video ${className}`}
        src={state.url}
        controls
        playsInline
        preload="metadata"
        style={{ objectFit: fit }}
        aria-label={alt}
      />
    ) : (
      <div className={`media media--video-thumb ${className}`}>
        <video
          src={`${state.url}#t=0.1`}
          muted
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
        <span className="media__play" aria-hidden="true">
          <Play fill="currentColor" />
        </span>
        <span className="visually-hidden">{alt} (video)</span>
      </div>
    );
  }
  return (
    <img
      className={`media media--img ${className}`}
      src={state.url}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{ objectFit: fit }}
      width={source.width}
      height={source.height}
    />
  );
}
