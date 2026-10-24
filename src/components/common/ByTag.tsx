import { useContent } from '../../data/store';
import { sweetName, useMe } from '../../data/people';
import type { Person } from '../../data/types';
import { useSyncState } from '../../sync/sync';

/** "van mij" / "van Baby" — only once two of us share the universe, so it never clutters a solo copy. */
export function ByTag({ by, className = '' }: { by?: Person; className?: string }) {
  const profile = useContent((c) => c.profile);
  const petNames = useContent((c) => c.us.petNames);
  const me = useMe();
  const shared = useSyncState().members.length >= 2;
  if (!by || !shared) return null;
  const label = by === me ? 'van mij' : `van ${sweetName(by, me, petNames, profile)}`;
  return <span className={`by-tag by-tag--${by} ${className}`}>{label}</span>;
}
