import { updatePrefs } from '../../data/store';
import { toast } from '../../components/ui/feedback';

/**
 * When Coco stays home, her hutch hides at the edge of one of the pages.
 * Finding it is how you bring her along again.
 */

const PAGES = [
  '/',
  '/story',
  '/memories',
  '/world',
  '/letters',
  '/future',
  '/surprises',
  '/music',
  '/settings',
];

export function pickHome(exclude?: string): { path: string; spot: number } {
  const options = PAGES.filter((p) => p !== exclude);
  return {
    path: options[Math.floor(Math.random() * options.length)],
    spot: Math.floor(Math.random() * 4),
  };
}

export function sendCocoHome(from?: string) {
  updatePrefs({ companion: false, cocoHome: pickHome(from) });
  toast(
    'Coco is naar huis gehupt. Haar hokje staat ergens verstopt in ons universe — vind het om haar weer mee te nemen.',
  );
}

export function bringCocoAlong() {
  updatePrefs({ companion: true, cocoHome: undefined });
}
