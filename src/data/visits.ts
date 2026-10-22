import { useSyncExternalStore } from 'react';

/**
 * When this device last looked around, so things the other person added in
 * the meantime can be pointed out. Stored per device.
 */

const KEY = 'olu:last-visit:v1';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    return value && !Number.isNaN(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
}

function write(value: string) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // Fine: everything simply counts as seen next time.
  }
}

/** The previous visit; on the very first one, "new" starts counting now. */
let since: string | null = read();
if (!since) {
  since = new Date().toISOString();
  write(since);
}

if (typeof window !== 'undefined') {
  const leave = () => write(new Date().toISOString());
  window.addEventListener('pagehide', leave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      leave();
    } else {
      // Back in a long-running app: "new" means since it was last put away.
      since = read();
      listeners.forEach((listener) => listener());
    }
  });
}

export function useSince(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => since,
  );
}

/** "Got it": everything up to now counts as seen. */
export function markAllSeen() {
  since = new Date().toISOString();
  write(since);
  listeners.forEach((listener) => listener());
}
