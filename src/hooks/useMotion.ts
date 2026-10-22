import { usePrefs } from '../data/store';
import { useMediaQuery } from './useMediaQuery';

/** True when animations should be calm: from the OS setting or the in-app preference. */
export function useReducedMotion(): boolean {
  const { motion } = usePrefs();
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (motion === 'reduce') return true;
  if (motion === 'full') return false;
  return systemReduce;
}
