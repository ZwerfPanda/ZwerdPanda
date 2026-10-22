import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Heart } from 'lucide-react';
import { Dialog } from './Dialog';
import { createId } from '../../lib/id';
import { useReducedMotion } from '../../hooks/useMotion';

/* ------------------------------------------------------------------ Toasts */

interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'error';
  action?: { label: string; run: () => void };
}

let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
const emitToasts = () => toastListeners.forEach((l) => l());

export function toast(
  message: string,
  options: { tone?: Toast['tone']; action?: Toast['action'] } = {},
) {
  const item: Toast = {
    id: createId('toast'),
    message,
    tone: options.tone ?? 'info',
    action: options.action,
  };
  toasts = [...toasts.slice(-2), item];
  emitToasts();
  window.setTimeout(() => dismissToast(item.id), options.action ? 6500 : 3600);
}

function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
  );
  return createPortal(
    <div className="toaster" role="status" aria-live="polite">
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <motion.div
            key={t.id}
            layout
            className={`toast ${t.tone === 'error' ? 'toast--error' : ''}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            <span className="toast__icon" aria-hidden="true">
              {t.tone === 'error' ? <AlertTriangle /> : <Heart fill="currentColor" />}
            </span>
            <span className="toast__msg">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  t.action!.run();
                  dismissToast(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/* ----------------------------------------------------------------- Confirm */

interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'danger' | 'default';
  resolve: (ok: boolean) => void;
}

let pending: ConfirmRequest | null = null;
let setPending: ((r: ConfirmRequest | null) => void) | null = null;

/** Promise-based confirmation, e.g. `if (await confirm({...})) remove()`. */
export function confirm(options: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
}): Promise<boolean> {
  return new Promise((resolve) => {
    pending?.resolve(false);
    pending = {
      title: options.title,
      message: options.message,
      confirmLabel: options.confirmLabel ?? 'Yes',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      tone: options.tone ?? 'default',
      resolve,
    };
    setPending?.(pending);
  });
}

export function ConfirmHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  useEffect(() => {
    setPending = setRequest;
    return () => {
      setPending = null;
    };
  }, []);

  const finish = (ok: boolean) => {
    request?.resolve(ok);
    pending = null;
    setRequest(null);
  };

  return (
    <Dialog
      open={request !== null}
      onClose={() => finish(false)}
      title={request?.title ?? ''}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={() => finish(false)}>
            {request?.cancelLabel}
          </button>
          <button
            type="button"
            className={`btn ${request?.tone === 'danger' ? 'btn--danger' : 'btn--primary'}`}
            onClick={() => finish(true)}
          >
            {request?.confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--ink-soft)' }}>{request?.message}</p>
    </Dialog>
  );
}

/* ------------------------------------------------------------- Celebration */

interface Burst {
  id: string;
  x: number;
  y: number;
}

let bursts: Burst[] = [];
const burstListeners = new Set<() => void>();

/** A small burst of hearts and stars at a point on screen (or the centre). */
export function celebrate(origin?: { x: number; y: number }) {
  const burst = {
    id: createId('burst'),
    x: origin?.x ?? window.innerWidth / 2,
    y: origin?.y ?? window.innerHeight / 2,
  };
  bursts = [...bursts, burst];
  burstListeners.forEach((l) => l());
  window.setTimeout(() => {
    bursts = bursts.filter((b) => b.id !== burst.id);
    burstListeners.forEach((l) => l());
  }, 1600);
}

export function celebrateFrom(element: Element | null) {
  if (!element) return celebrate();
  const rect = element.getBoundingClientRect();
  celebrate({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
}

const PARTICLE_COLORS = ['#e8bd6a', '#d48d96', '#cbbfe9', '#f6c5a6', '#b9646f', '#f8e6bb'];

export function CelebrationHost() {
  const items = useSyncExternalStore(
    (l) => {
      burstListeners.add(l);
      return () => burstListeners.delete(l);
    },
    () => bursts,
  );
  const reduce = useReducedMotion();
  return createPortal(
    <div
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 980 }}
    >
      {items.map((burst) =>
        reduce ? (
          <motion.span
            key={burst.id}
            initial={{ opacity: 0.9, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.9 }}
            style={{
              position: 'absolute',
              left: burst.x - 60,
              top: burst.y - 60,
              width: 120,
              height: 120,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(232,189,106,.55), transparent 70%)',
            }}
          />
        ) : (
          Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2 + (i % 2) * 0.2;
            const distance = 70 + (i % 4) * 26;
            const heart = i % 3 === 0;
            return (
              <motion.span
                key={`${burst.id}-${i}`}
                initial={{ x: burst.x, y: burst.y, scale: 0.2, opacity: 1, rotate: 0 }}
                animate={{
                  x: burst.x + Math.cos(angle) * distance,
                  y: burst.y + Math.sin(angle) * distance + 40,
                  scale: [0.2, 1.1, 0.8],
                  opacity: [1, 1, 0],
                  rotate: (i % 2 ? 1 : -1) * 90,
                }}
                transition={{ duration: 1.3, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: 'absolute',
                  left: -8,
                  top: -8,
                  color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  {heart ? (
                    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.2 0 3.6 1.2 4.4 2.5.8-1.3 2.2-2.5 4.4-2.5 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" />
                  ) : (
                    <path d="M12 2l2.2 6.6L21 9.8l-5.4 4.1L17.6 21 12 17l-5.6 4 2-7.1L3 9.8l6.8-1.2z" />
                  )}
                </svg>
              </motion.span>
            );
          })
        ),
      )}
    </div>,
    document.body,
  );
}
