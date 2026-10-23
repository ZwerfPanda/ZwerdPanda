import type { RoutePath } from '../../lib/router';

/**
 * The stars hidden around our universe. Each has one secret spot on one page,
 * and a hint for whoever is still looking.
 */
export interface HiddenStar {
  id: string;
  path: RoutePath;
  place: string;
  hint: string;
}

export const HIDDEN_STARS: HiddenStar[] = [
  { id: 'home', path: '/', place: 'Home', hint: 'Iets draait rondjes om ons planeetje…' },
  {
    id: 'story',
    path: '/story',
    place: 'Ons Verhaal',
    hint: 'Helemaal aan het eind van ons verhaal — waar het nog verder gaat.',
  },
  {
    id: 'memories',
    path: '/memories',
    place: 'Herinneringen',
    hint: 'Bovenaan het plakboek, bij de titel.',
  },
  {
    id: 'world',
    path: '/world',
    place: 'Onze Kleine Wereld',
    hint: 'Waar staat dat sommige dingen expres verstopt zijn?',
  },
  {
    id: 'letters',
    path: '/letters',
    place: 'Love Letters',
    hint: 'Onder de plank met enveloppen.',
  },
  { id: 'future', path: '/future', place: 'Onze Toekomst', hint: 'Bij de dromen voor “one day…”.' },
  {
    id: 'surprises',
    path: '/surprises',
    place: 'Little Surprises',
    hint: 'Waar de kleine hartjes verstopt zitten.',
  },
  {
    id: 'music',
    path: '/music',
    place: 'Music Corner',
    hint: 'Kijk eens goed naar de platenspeler.',
  },
  { id: 'coco', path: '/coco', place: 'Coco’s Hoekje', hint: 'Bij Coco’s paspoortje.' },
  { id: 'us', path: '/us', place: 'Mini Us', hint: 'Op het podium van ons tweetjes.' },
  { id: 'lists', path: '/lists', place: 'Onze Lijstjes', hint: 'Bovenaan bij de lijstjes.' },
  {
    id: 'her',
    path: '/her',
    place: 'Your Little World',
    hint: 'Bij je sticker, op je eigen plekje.',
  },
  {
    id: 'museum',
    path: '/museum',
    place: 'The Love Line',
    hint: 'Het diepste plekje van ons universe. Luister naar het hart op Home… en blijf tikken.',
  },
];

export const STAR_COUNT = HIDDEN_STARS.length;
