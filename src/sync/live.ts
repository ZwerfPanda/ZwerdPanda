import { getContent, replaceContent } from '../data/store';
import { DUEL_KINDS, normalizeMatch } from '../data/normalize';
import type { GameMatch } from '../data/types';
import type { SyncEngine } from './engine';

/*
 * Moves in a game travel straight to the other phone over the live line, so
 * a turn is there in a moment instead of after a whole sync. The saved copy
 * follows as usual and agrees, because it holds exactly the same match.
 */

let engine: SyncEngine | null = null;

export function connectLive(next: SyncEngine | null): () => void {
  engine = next;
  if (!next) return () => {};
  const off = next.onLive(receive);
  return () => {
    off();
    if (engine === next) engine = null;
  };
}

/** Other kinds of live messages (the chat, who's where) and who handles them. */
const handlers = new Map<string, (message: Record<string, unknown>) => void>();

export function onLiveMessage(type: string, handler: (message: Record<string, unknown>) => void) {
  handlers.set(type, handler);
  return () => {
    if (handlers.get(type) === handler) handlers.delete(type);
  };
}

/** Whether there's a live line to the other phone at all. */
export const liveConnected = () => engine !== null;

/** Sends something small to the other phone right away (if the live line is up). */
export function sendLiveMessage(message: Record<string, unknown> & { type: string }) {
  engine?.sendLive(message);
}

/** Sends this match as it is now. */
export function sendMatch(match: GameMatch) {
  engine?.sendLive({ type: 'match', match });
}

/** A match from the other phone: shown right away when it's newer than ours. */
export function receive(message: unknown) {
  if (typeof message !== 'object' || message === null) return;
  const { type, match } = message as { type?: unknown; match?: unknown };
  if (type !== 'match') {
    if (typeof type === 'string') handlers.get(type)?.(message as Record<string, unknown>);
    return;
  }
  const m = normalizeMatch(match);
  if (!m) return;
  const c = getContent();
  const ours = c.games.matches.find((x) => x.id === m.id);
  if (ours && ours.updatedAt >= m.updatedAt) return;
  const others = c.games.matches.filter((x) => x.id !== m.id);
  // A new match replaces an unfinished one of the same game, like startMatch does
  // (a duel's open rounds wait side by side).
  const kept =
    ours || DUEL_KINDS.includes(m.kind)
      ? others
      : others.filter((x) => x.kind !== m.kind || x.winner);
  replaceContent({ ...c, games: { ...c.games, matches: [...kept, m].slice(-100) } }, 'remote');
}
