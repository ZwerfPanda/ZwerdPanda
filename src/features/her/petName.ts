import { useContent } from '../../data/store';

/** One of the names he calls her, different each day. */
export function usePetName(): string {
  const names = useContent((c) => c.us.petNames);
  const mine = names.filter((n) => n.from !== 'partner').map((n) => n.name);
  if (!mine.length) return 'baby';
  const day = Math.floor(Date.now() / 86_400_000);
  return mine[day % mine.length];
}
