import { getContent, updateContent } from '../data/store';
import { getAuthor } from '../data/people';
import type { SyncEngine } from './engine';

/**
 * After a sync, each phone notes (in our shared content) whether it matched
 * the server and which app version it runs — so on his phone the Samen-check
 * can say how her phone is doing, without holding it. At most every 20
 * minutes, or sooner when something changed.
 */

const EVERY = 20 * 60_000;
let running = false;

export async function reportAfterSync(engine: SyncEngine) {
  const me = getAuthor();
  if (!me || running) return;
  const last = getContent().syncReports[me];
  const fresh = last && Date.now() - Date.parse(last.at) < EVERY && last.build === __BUILD__;
  if (fresh && last.ok) return;
  running = true;
  try {
    const check = await engine.verify();
    if (!check) return;
    const ok = check.local === check.server;
    if (fresh && last.ok === ok) return;
    updateContent((c) => ({
      ...c,
      syncReports: {
        ...c.syncReports,
        [me]: { at: new Date().toISOString(), ok, build: __BUILD__ },
      },
    }));
  } catch {
    // A check that can't run now runs after the next sync.
  } finally {
    running = false;
  }
}
