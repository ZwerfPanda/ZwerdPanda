import { useSyncExternalStore } from 'react';

/**
 * Installing Our Little Universe as an app.
 *
 * Chrome, Edge and Android offer a real install prompt (captured below).
 * iPhone/iPad only allow "Add to Home Screen" from the Share menu, so for
 * those we show the steps instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Platform = 'ios' | 'android' | 'mac' | 'desktop';

export interface InstallInfo {
  installed: boolean;
  canPrompt: boolean;
  platform: Platform;
  /** iPhone/iPad browser: only Safari has "Add to Home Screen" on older iOS. */
  iosSafari: boolean;
  /** Safari on a Mac ("File → Add to Dock"). */
  macSafari: boolean;
  firefox: boolean;
  /** Installing needs https (or localhost). */
  secure: boolean;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
let snapshot: InstallInfo | null = null;
const listeners = new Set<() => void>();

function emit() {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    installedNow = true;
    emit();
  });
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', emit);
}

function detect(): InstallInfo {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const ios = /iPad|iPhone|iPod/.test(ua) || iPadOS;
  const android = /Android/i.test(ua);
  const mac = !ios && /Macintosh/.test(ua);
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    installed: installedNow || standalone,
    canPrompt: deferred !== null,
    platform: ios ? 'ios' : android ? 'android' : mac ? 'mac' : 'desktop',
    iosSafari: ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua),
    macSafari: mac && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua),
    firefox: /Firefox|FxiOS/.test(ua),
    secure: window.isSecureContext,
  };
}

export function getInstallInfo(): InstallInfo {
  snapshot ??= detect();
  return snapshot;
}

export function useInstall(): InstallInfo {
  return useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, getInstallInfo);
}

/** Shows the browser's own install dialog, where available. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const event = deferred;
  deferred = null;
  await event.prompt();
  const { outcome } = await event.userChoice;
  if (outcome === 'accepted') installedNow = true;
  emit();
  return outcome;
}
