/**
 * What our minis can wear — taken from our own photos. Each outfit is a set
 * of garments the figure knows how to draw.
 */

export type Top =
  | { kind: 'tee'; color: string }
  | { kind: 'longsleeve'; color: string; ribbed?: boolean }
  | { kind: 'polo'; color: string }
  | { kind: 'cami'; color: string };

export type Layer =
  | { kind: 'puffer'; color: string; shine: string }
  | { kind: 'zip-hoodie'; color: string; hood?: string }
  | { kind: 'denim'; color: string }
  | { kind: 'blazer'; color: string };

export type Bottom =
  | { kind: 'baggy'; color: string; print?: 'stripe' | 'logo' }
  | { kind: 'leggings'; color: string }
  | { kind: 'shorts'; color: string; cargo?: boolean }
  | { kind: 'skirt'; color: string; tights: string }
  | {
      kind: 'dress';
      color: string;
      length: 'knee' | 'midi' | 'maxi';
      lace?: boolean;
      straps?: boolean;
      /** A slit up one leg. */
      slit?: boolean;
    };

export type Shoes =
  | { kind: 'sneakers'; color: string; laces: string }
  | { kind: 'boots'; color: string }
  | { kind: 'fluffy'; color: string }
  | { kind: 'slides'; color: string; socks: string }
  /** Short ankle boots on a chunky block heel. */
  | { kind: 'heels'; color: string }
  /** Chunky retro runners, New Balance style. */
  | { kind: 'runner'; color: string };

export interface Outfit {
  id: string;
  label: string;
  top: Top;
  layer?: Layer;
  bottom: Bottom;
  shoes: Shoes;
}

export const HIS_OUTFITS: Outfit[] = [
  {
    id: 'black-fit',
    label: 'All black',
    top: { kind: 'tee', color: '#1f1d22' },
    bottom: { kind: 'baggy', color: '#232027' },
    shoes: { kind: 'sneakers', color: '#18161a', laces: '#f4f1ec' },
  },
  {
    id: 'cream-puffer',
    label: 'Cream puffer',
    top: { kind: 'tee', color: '#f4f1ea' },
    layer: { kind: 'puffer', color: '#e9dcc4', shine: '#f7efe0' },
    bottom: { kind: 'baggy', color: '#2a2629', print: 'logo' },
    shoes: { kind: 'sneakers', color: '#18161a', laces: '#f4f1ec' },
  },
  {
    id: 'taupe-tracksuit',
    label: 'Taupe tracksuit',
    top: { kind: 'tee', color: '#1f1d22' },
    layer: { kind: 'zip-hoodie', color: '#6e6159' },
    bottom: { kind: 'baggy', color: '#6a5e56' },
    shoes: { kind: 'sneakers', color: '#18161a', laces: '#f4f1ec' },
  },
  {
    id: 'parachute',
    label: 'Parachute pants',
    top: { kind: 'tee', color: '#1f1d22' },
    bottom: { kind: 'baggy', color: '#ece4d2', print: 'stripe' },
    shoes: { kind: 'sneakers', color: '#18161a', laces: '#bdb6ad' },
  },
  {
    id: 'blazer',
    label: 'Fitting-room blazer',
    top: { kind: 'polo', color: '#c62f36' },
    layer: { kind: 'blazer', color: '#8a8b8f' },
    bottom: { kind: 'shorts', color: '#b9b9bb', cargo: true },
    shoes: { kind: 'sneakers', color: '#18161a', laces: '#f4f1ec' },
  },
  {
    id: 'cosy-shorts',
    label: 'Hoodie & shorts',
    top: { kind: 'tee', color: '#2b282c' },
    layer: { kind: 'zip-hoodie', color: '#1d1b1f' },
    bottom: { kind: 'shorts', color: '#ddd3bf' },
    shoes: { kind: 'slides', color: '#d9cdb5', socks: '#f6f4f0' },
  },
];

export const HER_OUTFITS: Outfit[] = [
  {
    id: 'pink-top',
    label: 'Pink dress',
    top: { kind: 'longsleeve', color: '#f2c3d3' },
    bottom: { kind: 'dress', color: '#f2c3d3', length: 'maxi' },
    shoes: { kind: 'runner', color: '#1d1b1f' },
  },
  {
    id: 'blue-dress',
    label: 'Blue dress',
    top: { kind: 'cami', color: '#2f73c9' },
    bottom: { kind: 'dress', color: '#2f73c9', length: 'maxi', straps: true, slit: true },
    shoes: { kind: 'fluffy', color: '#1d1b1f' },
  },
  {
    id: 'teal-puffer',
    label: 'Teal puffer',
    top: { kind: 'longsleeve', color: '#1f1d22', ribbed: true },
    layer: { kind: 'puffer', color: '#1f5560', shine: '#2f7180' },
    bottom: { kind: 'leggings', color: '#1f1d22' },
    shoes: { kind: 'sneakers', color: '#1d1b1f', laces: '#e8e4de' },
  },
  {
    id: 'denim-boots',
    label: 'Denim & boots',
    top: { kind: 'cami', color: '#1f1d22' },
    layer: { kind: 'denim', color: '#a9c1db' },
    bottom: { kind: 'leggings', color: '#1f1d22' },
    shoes: { kind: 'boots', color: '#c9965a' },
  },
  {
    id: 'burgundy',
    label: 'Red dress',
    top: { kind: 'longsleeve', color: '#8e2433' },
    bottom: { kind: 'dress', color: '#8e2433', length: 'maxi', slit: true },
    shoes: { kind: 'heels', color: '#141215' },
  },
  {
    id: 'brown-dress',
    label: 'Brown dress',
    top: { kind: 'cami', color: '#5a3527' },
    bottom: { kind: 'dress', color: '#5a3527', length: 'maxi', lace: true, straps: true },
    shoes: { kind: 'runner', color: '#1d1b1f' },
  },
  {
    id: 'cosy-black',
    label: 'Cosy black',
    top: { kind: 'longsleeve', color: '#1f1d22' },
    layer: { kind: 'zip-hoodie', color: '#1c1a20', hood: '#7a2a3c' },
    bottom: { kind: 'leggings', color: '#1f1d22' },
    shoes: { kind: 'fluffy', color: '#1d1b1f' },
  },
  {
    id: 'denim-skirt',
    label: 'Denim & skirt',
    top: { kind: 'tee', color: '#1f1d22' },
    layer: { kind: 'denim', color: '#9fb9d6' },
    bottom: { kind: 'skirt', color: '#1f1d22', tights: '#2b2730' },
    shoes: { kind: 'fluffy', color: '#1d1b1f' },
  },
];

export interface Accessory {
  id: string;
  label: string;
}

export const HIS_ACCESSORIES: Accessory[] = [
  { id: 'chain', label: 'Silver chain & cross' },
  { id: 'bracelet', label: 'Bracelet' },
  { id: 'cap', label: 'Flat cap' },
  { id: 'sunglasses', label: 'Sunglasses' },
  { id: 'backpack', label: 'Backpack' },
];

export const HER_ACCESSORIES: Accessory[] = [
  { id: 'necklace', label: 'Gold necklace' },
  { id: 'ring', label: 'Ring' },
  { id: 'stanley', label: 'Her Stanley cup' },
  { id: 'pink-bag', label: 'Pink handbag' },
  { id: 'black-bag', label: 'Black shoulder bag' },
  { id: 'bucket-hat', label: 'Bucket hat' },
  { id: 'teddy', label: 'Giant teddy bear' },
];

export function outfitFor(person: 'you' | 'partner', id: string): Outfit {
  const list = person === 'you' ? HIS_OUTFITS : HER_OUTFITS;
  return list.find((o) => o.id === id) ?? list[0];
}
