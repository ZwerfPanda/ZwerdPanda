import { useId, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import type { MediaSource } from '../../data/types';
import { maxVideoBytes, formatBytes, prepareImage, putMedia } from '../../lib/media';
import { MediaView } from './MediaView';
import './media.css';

interface MediaPickerProps {
  label: string;
  value: MediaSource[];
  onChange: (value: MediaSource[]) => void;
  multiple?: boolean;
  allowVideo?: boolean;
  hint?: string;
}

/**
 * Picks photos (and optionally short clips) from the device, shrinks photos,
 * stores them locally in IndexedDB and shows previews.
 */
export function MediaPicker({
  label,
  value,
  onChange,
  multiple = true,
  allowVideo = false,
  hint,
}: MediaPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    const added: MediaSource[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      try {
        if (file.type.startsWith('video/')) {
          if (!allowVideo)
            throw new Error(`“${file.name}” is een video — hier passen alleen foto’s.`);
          if (file.size > maxVideoBytes()) {
            throw new Error(
              `“${file.name}” is ${formatBytes(file.size)}. Filmpjes tot ${formatBytes(maxVideoBytes())} passen hier.`,
            );
          }
          const mediaId = await putMedia(file, file.name);
          added.push({ type: 'local', mediaId, kind: 'video' });
        } else if (file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name)) {
          const prepared = await prepareImage(file);
          const mediaId = await putMedia(prepared.blob, file.name);
          added.push({
            type: 'local',
            mediaId,
            kind: 'image',
            width: prepared.width,
            height: prepared.height,
          });
        } else {
          throw new Error(`“${file.name}” is geen foto${allowVideo ? ' of video' : ''}.`);
        }
      } catch (error) {
        problems.push(
          error instanceof Error ? error.message : `“${file.name}” toevoegen lukte niet.`,
        );
      }
    }
    setErrors(problems);
    if (added.length) onChange(multiple ? [...value, ...added] : added.slice(0, 1));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="field">
      <span className="field__label" id={`${id}-label`}>
        {label}
      </span>
      <div className="picker" role="group" aria-labelledby={`${id}-label`}>
        {value.map((source, index) => (
          <div
            className="picker__item"
            key={source.type === 'local' ? source.mediaId : `${source.art}-${index}`}
          >
            <MediaView source={source} alt={`Gekozen ${index + 1}`} />
            {source.type === 'sample' && (
              <span className="tag tag--sample picker__tag">Voorbeeld</span>
            )}
            <button
              type="button"
              className="picker__remove"
              onClick={() => remove(index)}
              aria-label={`Item ${index + 1} weghalen`}
            >
              <X />
            </button>
          </div>
        ))}
        {(multiple || value.length === 0) && (
          <button
            type="button"
            className="picker__add"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            aria-describedby={hint ? `${id}-hint` : undefined}
          >
            {busy ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : (
              <ImagePlus aria-hidden="true" />
            )}
            <span>
              {busy
                ? 'Toevoegen…'
                : value.length
                  ? 'Meer toevoegen'
                  : allowVideo
                    ? 'Foto’s of een filmpje toevoegen'
                    : 'Foto toevoegen'}
            </span>
          </button>
        )}
        {!multiple && value.length > 0 && (
          <button
            type="button"
            className="picker__add"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <ImagePlus aria-hidden="true" />
            <span>Vervangen</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={allowVideo ? 'image/*,video/*' : 'image/*'}
        multiple={multiple}
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />
      {hint && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {errors.map((message) => (
        <p className="field__error" key={message} role="alert">
          {message}
        </p>
      ))}
    </div>
  );
}
