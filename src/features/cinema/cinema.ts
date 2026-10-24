import type { Cinema, Film, FilmGenre, FilmNight, FilmRating, Person } from '../../data/types';

/*
 * Our own little cinema: the films are videos of ourselves, every film gets a
 * poster in its genre's style, and a film night comes with a ticket, snacks
 * and a stub we keep afterwards.
 */

export interface GenreStyle {
  label: string;
  emoji: string;
  /** Poster background, top to bottom. */
  from: string;
  to: string;
  /** Title colour and the accent for stars and lines. */
  ink: string;
  accent: string;
  /** The poster's lettering. */
  font: 'display' | 'hand' | 'block';
  /** A line on the poster when we didn't write one. */
  tagline: string;
}

export const GENRES: Record<FilmGenre, GenreStyle> = {
  romcom: {
    label: 'Romcom',
    emoji: '💕',
    from: '#ffd1dc',
    to: '#f48fb1',
    ink: '#6a1b3a',
    accent: '#c2185b',
    font: 'hand',
    tagline: 'twee mensen. één heel groot gevoel.',
  },
  avontuur: {
    label: 'Avontuur',
    emoji: '🗺️',
    from: '#ffcc80',
    to: '#e65100',
    ink: '#3e1a00',
    accent: '#fff3c4',
    font: 'block',
    tagline: 'waar we ook gaan, we gaan samen.',
  },
  komedie: {
    label: 'Komedie',
    emoji: '😂',
    from: '#fff59d',
    to: '#ffb300',
    ink: '#3b2a00',
    accent: '#d84315',
    font: 'block',
    tagline: 'je gaat zo hard lachen.. echt.',
  },
  drama: {
    label: 'Drama',
    emoji: '🎭',
    from: '#5c6bc0',
    to: '#1a1f4d',
    ink: '#fff4e0',
    accent: '#ffcf70',
    font: 'display',
    tagline: 'sommige momenten vergeet je nooit.',
  },
  griezel: {
    label: 'Griezel',
    emoji: '👻',
    from: '#37474f',
    to: '#0b0f12',
    ink: '#d4f5c4',
    accent: '#8bc34a',
    font: 'block',
    tagline: 'niet alleen kijken.. knijp maar in mijn hand.',
  },
  docu: {
    label: 'Docu',
    emoji: '🎥',
    from: '#c8e6c9',
    to: '#4f7f52',
    ink: '#16301a',
    accent: '#fffbe6',
    font: 'display',
    tagline: 'gewoon wij. precies zoals we zijn.',
  },
  musical: {
    label: 'Musical',
    emoji: '🎶',
    from: '#e1bee7',
    to: '#7b1fa2',
    ink: '#fff6fb',
    accent: '#ffd54f',
    font: 'hand',
    tagline: 'zing maar mee, niemand kijkt.',
  },
  sprookje: {
    label: 'Sprookje',
    emoji: '🏰',
    from: '#b3e5fc',
    to: '#9575cd',
    ink: '#24124a',
    accent: '#fff59d',
    font: 'hand',
    tagline: 'er was eens.. ons.',
  },
};

export const GENRE_IDS = Object.keys(GENRES) as FilmGenre[];

export interface Snack {
  id: string;
  emoji: string;
  label: string;
}

export const SNACKS: Snack[] = [
  { id: 'popcorn-zoet', emoji: '🍿', label: 'Popcorn zoet' },
  { id: 'popcorn-zout', emoji: '🧂', label: 'Popcorn zout' },
  { id: 'nachos', emoji: '🧀', label: 'Nachos met kaas' },
  { id: 'cola', emoji: '🥤', label: 'Cola' },
  { id: 'bubbletea', emoji: '🧋', label: 'Jasmijn bubble tea' },
  { id: 'ijsje', emoji: '🍦', label: 'Ijsje' },
  { id: 'snoep', emoji: '🍬', label: 'Zak snoep' },
  { id: 'choco', emoji: '🍫', label: 'Chocolaatjes' },
];

export const snackById = (id: string) => SNACKS.find((s) => s.id === id);

const ROWS = 'ABCDEFGHJK';

/** Two seats next to each other, somewhere nice in the room. */
export function pickSeat(rand: () => number = Math.random): { seat: string; zaal: number } {
  // The middle rows are the best ones, so they come up more often.
  const row = ROWS[Math.min(ROWS.length - 1, Math.floor((rand() + rand()) * (ROWS.length / 2)))];
  const seat = 3 + Math.floor(rand() * 10);
  return { seat: `Rij ${row} · stoel ${seat} & ${seat + 1}`, zaal: 1 + Math.floor(rand() * 6) };
}

export const ratingId = (film: string, who: Person) => `${film}:${who}`;

export function ratingsFor(
  ratings: FilmRating[],
  film: string,
): Partial<Record<Person, FilmRating>> {
  const out: Partial<Record<Person, FilmRating>> = {};
  for (const r of ratings) if (r.film === film) out[r.who] = r;
  return out;
}

/** The average of our stars, or null when neither of us rated it yet. */
export function averageStars(ratings: FilmRating[], film: string): number | null {
  const mine = ratings.filter((r) => r.film === film);
  if (!mine.length) return null;
  return mine.reduce((sum, r) => sum + r.stars, 0) / mine.length;
}

export const nightsFor = (nights: FilmNight[], film: string) =>
  nights.filter((n) => n.film === film);

/** Newest first. */
export const filmsByNewest = (films: Film[]) =>
  [...films].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

/**
 * De Gouden Popcorn: our best-rated film. Both of us rating it counts for more
 * than one person's five stars, and a tie goes to the one we watched most.
 */
export function goldenPopcorn(cinema: Cinema): Film | null {
  let best: { film: Film; score: number; nights: number } | null = null;
  for (const film of cinema.films) {
    const mine = cinema.ratings.filter((r) => r.film === film.id);
    if (!mine.length) continue;
    const avg = mine.reduce((s, r) => s + r.stars, 0) / mine.length;
    const score = avg + (mine.length > 1 ? 0.5 : 0);
    const nights = nightsFor(cinema.nights, film.id).length;
    if (!best || score > best.score || (score === best.score && nights > best.nights))
      best = { film, score, nights };
  }
  return best?.film ?? null;
}

export interface CinemaStats {
  films: number;
  nights: number;
  /** Our usual snack, if we have one. */
  snack: Snack | null;
  /** The film we watched most. */
  favourite: Film | null;
}

export function cinemaStats(cinema: Cinema): CinemaStats {
  const snacks = new Map<string, number>();
  const watched = new Map<string, number>();
  for (const n of cinema.nights) {
    n.snacks.forEach((s) => snacks.set(s, (snacks.get(s) ?? 0) + 1));
    watched.set(n.film, (watched.get(n.film) ?? 0) + 1);
  }
  const top = <K>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const snackId = top(snacks);
  const filmId = top(watched);
  return {
    films: cinema.films.length,
    nights: cinema.nights.length,
    snack: snackId ? (snackById(snackId) ?? null) : null,
    favourite: cinema.films.find((f) => f.id === filmId) ?? null,
  };
}

/** The lines that roll by after the film. */
export function creditsFor(
  film: Film,
  names: Record<Person, string>,
  snacks: string[],
): { role: string; who: string }[] {
  const starring = `${names.partner} & ${names.you}`;
  const lines = [
    { role: 'met in de hoofdrol', who: starring },
    { role: 'een film van', who: film.by ? names[film.by] : starring },
    { role: 'genre', who: `${GENRES[film.genre].emoji} ${GENRES[film.genre].label}` },
  ];
  const eaten = snacks.map((s) => snackById(s)?.label).filter(Boolean);
  if (eaten.length) lines.push({ role: 'catering', who: eaten.join(', ') });
  lines.push(
    { role: 'Coco', who: 'als zichzelf 🐰' },
    { role: 'muziek', who: 'onze hartjes, de hele tijd' },
    { role: 'met dank aan', who: 'elkaar ♡' },
  );
  return lines;
}

/** m:ss */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Takes a still from a video (a third of the way in) for its poster. Resolves
 * to null when this browser can't decode the clip, so a poster photo is
 * always optional.
 */
export function captureStill(blob: Blob): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    let done = false;
    const finish = (out: Blob | null) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      resolve(out);
    };
    const timer = window.setTimeout(() => finish(null), 8000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      const d = video.duration;
      video.currentTime = Number.isFinite(d) && d > 0 ? Math.min(d / 3, 4) : 0;
    };
    video.onseeked = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return finish(null);
      const scale = Math.min(1, 900 / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return finish(null);
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => finish(b), 'image/jpeg', 0.85);
      } catch {
        finish(null);
      }
    };
    video.src = url;
  });
}
