import { useEffect, useState } from 'react';
import { todayIso } from '../lib/dates';

/** Today's date (YYYY-MM-DD), refreshed after midnight and when the app wakes up. */
export function useToday(): string {
  const [today, setToday] = useState(todayIso);
  useEffect(() => {
    const refresh = () => setToday(todayIso());
    const timer = setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}
