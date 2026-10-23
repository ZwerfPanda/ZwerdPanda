import { useState } from 'react';
import { Dialog } from '../ui/Dialog';
import { useContent } from '../../data/store';
import { HeartIcon } from '../art/shapes';
import './common.css';

/**
 * A tiny heart tucked somewhere in the universe. Easy to miss on purpose;
 * finding one opens a little note. No counters, no score.
 */
export function HiddenHeart({
  className = '',
  tone = 'light',
}: {
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const note = useContent((c) => c.surprises.hiddenHeartNote);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={`hidden-heart hidden-heart--${tone} ${className}`}
        onClick={() => setOpen(true)}
        aria-label="Een klein verstopt hartje"
      >
        <HeartIcon size={14} />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Je vond een verstopt hartje ♡"
        eyebrow="psst"
        size="sm"
      >
        <div className="hidden-heart__note">
          <HeartIcon size={40} color="var(--rose-400)" />
          <p>{note}</p>
        </div>
      </Dialog>
    </>
  );
}
