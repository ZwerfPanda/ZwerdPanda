import { useSyncExternalStore } from 'react';

/**
 * A tiny hash router. Hash URLs (#/memories) work on any static host and as an
 * installed home-screen app without server rewrites.
 */

export type RoutePath =
  | '/'
  | '/story'
  | '/memories'
  | '/world'
  | '/letters'
  | '/future'
  | '/surprises'
  | '/music'
  | '/coco'
  | '/us'
  | '/lists'
  | '/her'
  | '/settings';

export interface Route {
  path: RoutePath;
  params: URLSearchParams;
}

const KNOWN = new Set<RoutePath>([
  '/',
  '/story',
  '/memories',
  '/world',
  '/letters',
  '/future',
  '/surprises',
  '/music',
  '/coco',
  '/us',
  '/lists',
  '/her',
  '/settings',
]);

function readHash(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

let cachedHash = '';
let cachedRoute: Route = { path: '/', params: new URLSearchParams() };

function snapshot(): Route {
  const hash = readHash();
  if (hash !== cachedHash) {
    cachedHash = hash;
    const [rawPath, query = ''] = hash.split('?');
    const path = (KNOWN.has(rawPath as RoutePath) ? rawPath : '/') as RoutePath;
    cachedRoute = { path, params: new URLSearchParams(query) };
  }
  return cachedRoute;
}

function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export function href(path: RoutePath, params?: Record<string, string>): string {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  return `#${path}${query}`;
}

export function navigate(path: RoutePath, params?: Record<string, string>) {
  const target = href(path, params);
  if (window.location.hash === target) return;
  window.location.hash = target;
}

/** Updates query params without adding a history entry (filters, open panels). */
export function replaceParams(params: Record<string, string | null>) {
  const { path, params: current } = snapshot();
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === '') next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  const target = `#${path}${query ? `?${query}` : ''}`;
  if (window.location.hash !== target) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}
