import { CalendarHeart } from 'lucide-react';
import { href } from '../../lib/router';

/** In December and January: a way in to looking back on the year. */
export function YearButton({ now = new Date() }: { now?: Date }) {
  const month = now.getMonth();
  if (month !== 11 && month !== 0) return null;
  const year = month === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return (
    <a className="btn btn--soft wrapped-open" href={href('/jaar')} data-sfx="sparkle">
      <CalendarHeart aria-hidden="true" /> Ons {year}
    </a>
  );
}
