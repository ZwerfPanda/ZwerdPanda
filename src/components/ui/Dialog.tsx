import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { lockScroll, trapTab } from './scrollLock';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useReducedMotion } from '../../hooks/useMotion';

/** Open dialogs, topmost last — only the top one reacts to Escape and Tab. */
const stack: string[] = [];

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Element to focus first; defaults to the first focusable control. */
  initialFocus?: React.RefObject<HTMLElement | null>;
  className?: string;
  /** Hide the visible title (still announced to screen readers). */
  hideTitle?: boolean;
}

export function Dialog(props: DialogProps) {
  return createPortal(
    <AnimatePresence>{props.open && <DialogInner key="dialog" {...props} />}</AnimatePresence>,
    document.body,
  );
}

function DialogInner({
  onClose,
  title,
  eyebrow,
  children,
  footer,
  size = 'md',
  initialFocus,
  className = '',
  hideTitle,
}: DialogProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const wide = useMediaQuery('(min-width: 720px)');
  const reduce = useReducedMotion();
  const drag = useDragControls();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    stack.push(id);

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      // Focus the dialog itself (announced by its title) unless told otherwise —
      // jumping straight into a field would pop open the iPhone keyboard.
      (initialFocus?.current ?? panel).focus({ preventScroll: true });
    }, 40);

    const onKey = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id || !panelRef.current) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
      } else {
        trapTab(event, panelRef.current);
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      const index = stack.indexOf(id);
      if (index >= 0) stack.splice(index, 1);
      unlock();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
    // initialFocus is read once on open by design.
  }, [id]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  const sheetMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : wide
      ? {
          initial: { opacity: 0, y: 24, scale: 0.97 },
          animate: { opacity: 1, y: 0, scale: 1 },
          exit: { opacity: 0, y: 16, scale: 0.98 },
        }
      : { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };

  return (
    <div className="dialog-root">
      <motion.div
        className="dialog-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`dialog dialog--${size} ${className}`}
        {...sheetMotion}
        transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.9 }}
        drag={!wide && !reduce ? 'y' : false}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={onDragEnd}
      >
        <div
          className="dialog__grab"
          onPointerDown={(e) => !wide && drag.start(e)}
          style={{ touchAction: 'none' }}
        >
          <div className="dialog__handle" aria-hidden="true" />
          <div className="dialog__header">
            <div className={`dialog__titles ${hideTitle ? 'visually-hidden' : ''}`}>
              {eyebrow && <p className="dialog__eyebrow">{eyebrow}</p>}
              <h2 id={titleId} className="dialog__title">
                {title}
              </h2>
            </div>
            <button
              type="button"
              className="icon-btn"
              onClick={onClose}
              aria-label="Sluiten"
              style={hideTitle ? { marginLeft: 'auto' } : undefined}
            >
              <X />
            </button>
          </div>
        </div>
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__footer">{footer}</div>}
      </motion.div>
    </div>
  );
}
