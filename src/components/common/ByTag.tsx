import { useContent } from '../../data/store';
import { nameOf } from '../../data/people';
import type { Person } from '../../data/types';
import { useSyncState } from '../../sync/sync';

/** "from Shenaya" — only once two of us share the universe, so it never clutters a solo copy. */
export function ByTag({ by, className = '' }: { by?: Person; className?: string }) {
  const profile = useContent((c) => c.profile);
  const shared = useSyncState().members.length >= 2;
  if (!by || !shared) return null;
  return <span className={`by-tag by-tag--${by} ${className}`}>from {nameOf(by, profile)}</span>;
}
