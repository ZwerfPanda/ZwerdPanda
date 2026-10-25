import type { Bouquet } from '../../data/types';

/** Flowers to pick from when adding a bouquet (more can be typed in). */
export const FLOWER_KINDS = [
  { name: 'Rozen', emoji: '🌹' },
  { name: 'Tulpen', emoji: '🌷' },
  { name: 'Pioenrozen', emoji: '🌸' },
  { name: 'Zonnebloemen', emoji: '🌻' },
  { name: 'Lelies', emoji: '⚜️' },
  { name: 'Gerbera’s', emoji: '🌼' },
  { name: 'Hortensia', emoji: '💠' },
  { name: 'Lavendel', emoji: '🪻' },
  { name: 'Gemengd', emoji: '💐' },
] as const;

export const OCCASIONS = [
  'Zomaar',
  'Verjaardag',
  'Valentijn',
  'Jubileum',
  'Date',
  'Sorry',
  'Gefeliciteerd',
  'Beterschap',
] as const;

export const emojiFor = (flower: string) =>
  FLOWER_KINDS.find((f) => f.name.toLowerCase() === flower.toLowerCase())?.emoji ?? '🌸';

/** Six vases for the shelves: [body colour, rim/shine colour]. */
export const VASES: { name: string; body: string; rim: string }[] = [
  { name: 'Glazen pot', body: '#cfe8f2', rim: '#ffffff' },
  { name: 'Roze bol', body: '#f4b6c8', rim: '#ffe3ec' },
  { name: 'Hoge cilinder', body: '#b9d7b0', rim: '#e6f3df' },
  { name: 'Lavendel kruik', body: '#cbbfe9', rim: '#ece6fa' },
  { name: 'Weckpot', body: '#e9dcc4', rim: '#fff7e8' },
  { name: 'Terracotta kan', body: '#d99a72', rim: '#f6cfb4' },
];

/** Newest first, the way they'd stand in the shop window. */
export function byDate(flowers: Bouquet[]): Bouquet[] {
  const key = (b: Bouquet) => b.date ?? b.createdAt.slice(0, 10);
  return [...flowers].sort((a, b) => (key(a) < key(b) ? 1 : key(a) > key(b) ? -1 : 0));
}

/** For the herbarium: grouped per year, newest year first. */
export function byYear(flowers: Bouquet[]): { year: string; items: Bouquet[] }[] {
  const groups = new Map<string, Bouquet[]>();
  for (const b of byDate(flowers)) {
    const year = (b.date ?? b.createdAt).slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), b]);
  }
  return [...groups.entries()].map(([year, items]) => ({ year, items }));
}

/** A little summary for the shop sign: how many, since when, the favourite flower. */
export function shopStats(flowers: Bouquet[]) {
  const dates = flowers
    .map((b) => b.date)
    .filter((d): d is string => Boolean(d))
    .sort();
  const counts = new Map<string, number>();
  flowers.forEach((b) => b.flowers.forEach((f) => counts.set(f, (counts.get(f) ?? 0) + 1)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { count: flowers.length, since: dates[0], topFlower: top?.[0] };
}

/** What each flower says, in the language of flowers. */
export const MEANINGS: Record<string, string> = {
  Rozen: 'ik hou van je — rood is liefde, roze is dankjewel',
  Tulpen: 'perfecte liefde, en de lente in Nederland',
  Pioenrozen: 'geluk, en een lang en mooi leven samen',
  Zonnebloemen: 'ik kijk alleen naar jou, zoals zij naar de zon',
  Lelies: 'pure, eerlijke liefde',
  'Gerbera’s': 'vrolijkheid — jij maakt alles lichter',
  Hortensia: 'dankjewel dat je me begrijpt',
  Lavendel: 'rust en toewijding, altijd',
  Gemengd: 'een beetje van alles, net als wij',
};

export const meaningOf = (flower: string) =>
  MEANINGS[FLOWER_KINDS.find((f) => f.name.toLowerCase() === flower.toLowerCase())?.name ?? ''];

/** The flower on the chalkboard today: a different one every day. */
export function flowerOfDay(date: Date = new Date()) {
  const day = Math.floor(date.getTime() / 86_400_000);
  const kinds = FLOWER_KINDS.filter((f) => f.name !== 'Gemengd');
  const k = kinds[((day % kinds.length) + kinds.length) % kinds.length];
  return { ...k, meaning: MEANINGS[k.name] };
}

/* ------------------------------------------------ watering, on this phone */

const WATER_KEY = 'olu:flowers-watered:v1';
/** After this many days without water, a bouquet starts to droop a little. */
export const FRESH_DAYS = 3;

export function readWatered(): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(WATER_KEY) ?? '{}');
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
}

export function water(id: string, at = new Date()): Record<string, string> {
  const next = { ...readWatered(), [id]: at.toISOString() };
  try {
    localStorage.setItem(WATER_KEY, JSON.stringify(next));
  } catch {
    // Fine: they'll just want water again next time.
  }
  return next;
}

/** True when a bouquet could use some water (never watered counts from when it was added). */
export function isThirsty(b: Bouquet, watered: Record<string, string>, now = new Date()) {
  const last = watered[b.id] ?? b.createdAt;
  return now.getTime() - Date.parse(last) > FRESH_DAYS * 86_400_000;
}
