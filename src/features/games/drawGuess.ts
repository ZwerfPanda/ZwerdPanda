/*
 * Tekenen & raden: one of us draws a word, the other guesses it (three
 * tries, a hint after a wrong one). Six rounds, taking turns at drawing.
 * Guessed on the first try is 3 points, then 2, then 1; the one who drew
 * gets a point when it's guessed.
 *
 * A drawing travels as strokes; each stroke's points are packed as base-36
 * pairs (two characters per coordinate on a 300 × 300 canvas).
 */

export type Side = 'you' | 'partner';
export const CANVAS = 300;
export const ROUNDS = 6;
export const TRIES = 3;
/** All the strokes of one drawing together, at most this many points. */
export const MAX_POINTS = 6000;

export const COLORS = [
  '#2b2233',
  '#ff4f9a',
  '#ffc61a',
  '#2f7bff',
  '#3fae5a',
  '#e2462f',
  '#8a5a2b',
  '#ffffff',
];
export const SIZES = [3, 7, 14];

export interface Stroke {
  /** Index into COLORS (the last one is the eraser's white). */
  c: number;
  /** Index into SIZES. */
  w: number;
  /** Packed points. */
  p: string;
}

export const WORDS: { word: string; level: 1 | 2 | 3 }[] = [
  ...'huis zon maan boom bloem kat hond vis appel auto fiets hart ster bal ijsje taart wolk regen paraplu boot trein vliegtuig sneeuwpop banaan aardbei pizza koffie bril schoen kroon slak'
    .split(' ')
    .map((word) => ({ word, level: 1 as const })),
  ...'konijn wortel bubble tea kus regenboog strand vuurwerk kampvuur verjaardag cadeau gitaar microfoon telefoon televisie camera kasteel vulkaan dinosaurus eenhoorn zeemeermin olifant giraf pinguïn ijsbeer schildpad vlinder spin tent piano'
    .replace('bubble tea', 'bubbletea')
    .split(' ')
    .map((word) => ({ word: word === 'bubbletea' ? 'bubble tea' : word, level: 2 as const })),
  ...'knuffel picknick zonsondergang achtbaan bioscoop karaoke dansen slapen verliefd heimwee date sushi nagellak reuzenrad zwembad snorkelen sterrenhemel ontbijt op bed'
    .replace('ontbijt op bed', 'ontbijt-op-bed')
    .split(' ')
    .map((word) => ({ word: word.replace(/-/g, ' '), level: 3 as const })),
];

export interface DrawState {
  round: number;
  drawer: Side;
  /** Three words to pick from, at the start of a round. */
  options: string[];
  word: string;
  level: number;
  strokes: Stroke[];
  guesses: string[];
  status: 'choose' | 'draw' | 'guess' | 'reveal' | 'done';
  points: Record<Side, number>;
  /** How the last round ended, for both to see. */
  result?: { word: string; guessed: boolean; tries: number; by: Side };
}

const other = (s: Side): Side => (s === 'you' ? 'partner' : 'you');

/** Three words of different difficulty that weren't used yet. */
export function pickOptions(used: string[], rng: () => number = Math.random): string[] {
  const out: string[] = [];
  for (const level of [1, 2, 3] as const) {
    const pool = WORDS.filter(
      (w) => w.level === level && !used.includes(w.word) && !out.includes(w.word),
    );
    const list = pool.length ? pool : WORDS.filter((w) => w.level === level);
    out.push(list[Math.floor(rng() * list.length)].word);
  }
  return out;
}

export const levelOf = (word: string) => WORDS.find((w) => w.word === word)?.level ?? 2;

export function newDraw(first: Side, rng: () => number = Math.random): DrawState {
  return {
    round: 1,
    drawer: first,
    options: pickOptions([], rng),
    word: '',
    level: 0,
    strokes: [],
    guesses: [],
    status: 'choose',
    points: { you: 0, partner: 0 },
  };
}

export function normalizeDraw(raw: unknown): DrawState {
  const r = (raw ?? {}) as Partial<DrawState>;
  const side = (v: unknown): Side => (v === 'partner' ? 'partner' : 'you');
  const strokes = (Array.isArray(r.strokes) ? r.strokes : [])
    .filter(
      (s): s is Stroke =>
        !!s && typeof s.p === 'string' && /^[0-9a-z]*$/.test(s.p) && s.p.length % 4 === 0,
    )
    .map((s) => ({
      c: Math.max(0, Math.min(COLORS.length - 1, Number(s.c) | 0)),
      w: Math.max(0, Math.min(SIZES.length - 1, Number(s.w) | 0)),
      p: s.p,
    }));
  const status = (['choose', 'draw', 'guess', 'reveal', 'done'] as const).includes(
    r.status as DrawState['status'],
  )
    ? (r.status as DrawState['status'])
    : 'choose';
  const pts = (v: unknown) => (Number.isFinite(v) ? Math.max(0, Math.round(v as number)) : 0);
  return {
    round: Math.max(1, Math.min(ROUNDS, Number(r.round) | 0 || 1)),
    drawer: side(r.drawer),
    options: (Array.isArray(r.options) ? r.options : [])
      .filter((x): x is string => typeof x === 'string')
      .slice(0, 3),
    word: typeof r.word === 'string' ? r.word.slice(0, 40) : '',
    level: Number(r.level) || 0,
    strokes,
    guesses: (Array.isArray(r.guesses) ? r.guesses : [])
      .filter((x): x is string => typeof x === 'string')
      .slice(0, TRIES),
    status,
    points: { you: pts(r.points?.you), partner: pts(r.points?.partner) },
    ...(r.result ? { result: r.result } : {}),
  };
}

/* --------------------------------------------------------------- points */

const enc = (n: number) =>
  Math.max(0, Math.min(1295, Math.round(n)))
    .toString(36)
    .padStart(2, '0');

export function pack(points: { x: number; y: number }[]): string {
  return points.map((p) => enc(p.x) + enc(p.y)).join('');
}

export function unpack(p: string): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i + 3 < p.length; i += 4)
    out.push({ x: parseInt(p.slice(i, i + 2), 36), y: parseInt(p.slice(i + 2, i + 4), 36) });
  return out;
}

export const pointCount = (strokes: Stroke[]) => strokes.reduce((n, s) => n + s.p.length / 4, 0);

/* ---------------------------------------------------------------- guess */

/** Lowercase, no accents or spaces or dashes. */
export const plain = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, '');

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length][b.length];
}

/** Right, or near enough (one typo in a longer word). */
export function isRight(guess: string, word: string): boolean {
  const g = plain(guess);
  const w = plain(word);
  if (!g) return false;
  if (g === w) return true;
  return w.length >= 5 && distance(g, w) <= 1;
}

/** A hint after a wrong guess: how many letters, then the first one too. */
export function hint(word: string, wrong: number): string {
  const letters = word
    .split('')
    .map((ch, i) => (ch === ' ' ? '  ' : wrong >= 2 && i === 0 ? ch.toUpperCase() : '_'))
    .join(' ');
  return wrong <= 0 ? '' : `${letters}  (${plain(word).length} letters)`;
}

/* ----------------------------------------------------------- the rounds */

export function choose(s: DrawState, word: string): DrawState {
  if (s.status !== 'choose' || !s.options.includes(word)) return s;
  return { ...s, word, level: levelOf(word), status: 'draw', strokes: [], guesses: [] };
}

export function finishDrawing(s: DrawState, strokes: Stroke[]): DrawState {
  if (s.status !== 'draw') return s;
  return { ...s, strokes, status: 'guess' };
}

/** A guess. The round ends when it's right or the tries are used up. */
export function guess(
  s: DrawState,
  text: string,
): { state: DrawState; right: boolean; over: boolean } {
  if (s.status !== 'guess') return { state: s, right: false, over: false };
  const guesses = [...s.guesses, text.trim().slice(0, 40)];
  const right = isRight(text, s.word);
  const over = right || guesses.length >= TRIES;
  if (!over) return { state: { ...s, guesses }, right, over };
  const guesser = other(s.drawer);
  const points = { ...s.points };
  if (right) {
    points[guesser] += TRIES + 1 - guesses.length;
    points[s.drawer] += 1;
  }
  return {
    state: {
      ...s,
      guesses,
      points,
      status: 'reveal',
      result: { word: s.word, guessed: right, tries: guesses.length, by: guesser },
    },
    right,
    over,
  };
}

/** On to the next round (the other draws), or the end. */
export function nextRound(
  s: DrawState,
  used: string[],
  rng: () => number = Math.random,
): DrawState {
  if (s.round >= ROUNDS) return { ...s, status: 'done' };
  return {
    ...s,
    round: s.round + 1,
    drawer: other(s.drawer),
    options: pickOptions([...used, s.word], rng),
    word: '',
    level: 0,
    strokes: [],
    guesses: [],
    status: 'choose',
  };
}

export function winnerOf(s: DrawState): Side | 'draw' | null {
  if (s.status !== 'done') return null;
  return s.points.you === s.points.partner
    ? 'draw'
    : s.points.you > s.points.partner
      ? 'you'
      : 'partner';
}

/** Who acts now: the drawer while choosing and drawing, else the guesser. */
export const actor = (s: DrawState): Side =>
  s.status === 'guess' || s.status === 'reveal' ? other(s.drawer) : s.drawer;
