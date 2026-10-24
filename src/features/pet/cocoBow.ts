import { useEffect } from 'react';
import { useHer } from '../her/herStore';
import { bowColor, knotColor } from '../her/nailGallery';

/** Coco's bow takes the colour of her newest nail set (pink until there is one). */
export function useCocoBow() {
  const color = useHer((h) => bowColor(h.nails));
  useEffect(() => {
    const root = document.documentElement.style;
    if (color) {
      root.setProperty('--coco-bow', color);
      root.setProperty('--coco-bow-knot', knotColor(color));
    } else {
      root.removeProperty('--coco-bow');
      root.removeProperty('--coco-bow-knot');
    }
  }, [color]);
}
