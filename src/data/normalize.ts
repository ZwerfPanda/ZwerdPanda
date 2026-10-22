import { createDefaultContent, defaultPreferences, defaultProfile } from './defaults';
import type {
  Album,
  AppContent,
  ArtKey,
  CocoContent,
  Dream,
  DreamCategory,
  Letter,
  LetterColor,
  MediaSource,
  Memory,
  Milestone,
  Motif,
  Preferences,
  Profile,
  SealIcon,
  Song,
  SongRef,
  SurpriseContent,
  ThemeName,
  TimeCapsule,
} from './types';
import { isValidIsoDate } from '../lib/dates';

/**
 * Defensive parsing for anything read from storage or an imported backup.
 * Unknown fields are dropped, broken items are skipped, and missing fields fall
 * back to sensible defaults — a bad file can never crash the app.
 */

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = '', max = 20_000): string =>
  typeof v === 'string' ? v.slice(0, max) : fallback;
const optStr = (v: unknown, max = 20_000): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;
const optDate = (v: unknown): string | undefined => (isValidIsoDate(v as string) ? (v as string) : undefined);
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const id = (v: unknown, prefix: string, index: number) =>
  typeof v === 'string' && v ? v.slice(0, 120) : `${prefix}-imported-${index}`;
const stamp = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

const ART_KEYS: readonly ArtKey[] = [
  'phone', 'meet', 'mall', 'matcha', 'boba', 'arcade', 'karaoke', 'train', 'car', 'growth', 'coco',
  'house', 'nails', 'stars', 'future',
];
const MOTIFS: readonly Motif[] = [
  'phone', 'sparkle', 'bag', 'matcha', 'train', 'car', 'leaf', 'rabbit', 'house', 'star', 'heart',
  'music',
];
const LETTER_COLORS: readonly LetterColor[] = ['blush', 'lavender', 'peach', 'cream', 'sage', 'plum'];
const SEALS: readonly SealIcon[] = ['heart', 'star', 'moon', 'flower', 'rabbit', 'matcha'];
const CATEGORIES: readonly DreamCategory[] = [
  'places', 'dates', 'try', 'home', 'milestones', 'family', 'learn', 'anniversary', 'bucket',
];
const THEMES: readonly ThemeName[] = ['blush', 'lavender', 'matcha', 'midnight'];

export function normalizeMedia(v: unknown): MediaSource | null {
  if (!isObj(v)) return null;
  if (v.type === 'sample' && ART_KEYS.includes(v.art as ArtKey)) {
    return { type: 'sample', art: v.art as ArtKey };
  }
  if (v.type === 'local' && typeof v.mediaId === 'string') {
    return {
      type: 'local',
      mediaId: v.mediaId,
      kind: v.kind === 'video' ? 'video' : 'image',
      width: typeof v.width === 'number' ? v.width : undefined,
      height: typeof v.height === 'number' ? v.height : undefined,
    };
  }
  return null;
}

function normalizeSong(v: unknown): SongRef | undefined {
  if (!isObj(v) || !optStr(v.title)) return undefined;
  return { title: str(v.title, '', 200), artist: optStr(v.artist, 200), url: optStr(v.url, 2000) };
}

function normalizeProfile(v: unknown): Profile {
  const p = isObj(v) ? v : {};
  return {
    yourName: str(p.yourName, defaultProfile.yourName, 60) || defaultProfile.yourName,
    partnerName: str(p.partnerName, defaultProfile.partnerName, 60) || defaultProfile.partnerName,
    siteTitle: str(p.siteTitle, defaultProfile.siteTitle, 80) || defaultProfile.siteTitle,
    subtitle: str(p.subtitle, defaultProfile.subtitle, 160),
    homeGreeting: str(p.homeGreeting, defaultProfile.homeGreeting, 80),
    homeMessage: str(p.homeMessage, defaultProfile.homeMessage, 4000),
    signature: str(p.signature, defaultProfile.signature, 120),
    startDate: optDate(p.startDate) ?? null,
    counterMode: oneOf(p.counterMode, ['ymd', 'days'] as const, 'ymd'),
    theme: oneOf(p.theme, THEMES, 'blush'),
  };
}

function normalizeMilestone(v: unknown, i: number): Milestone | null {
  if (!isObj(v) || !optStr(v.title)) return null;
  return {
    id: id(v.id, 'ms', i),
    title: str(v.title, '', 200),
    date: optDate(v.date),
    dateLabel: optStr(v.dateLabel, 80),
    story: str(v.story),
    prompt: optStr(v.prompt, 300),
    motif: oneOf(v.motif, MOTIFS, 'heart'),
    media: arr(v.media).map(normalizeMedia).filter((m): m is MediaSource => m !== null).slice(0, 24),
    song: normalizeSong(v.song),
    favorite: bool(v.favorite),
    future: bool(v.future) || undefined,
    isSample: bool(v.isSample) || undefined,
    createdAt: stamp(v.createdAt),
  };
}

function normalizeAlbum(v: unknown, i: number): Album | null {
  if (!isObj(v) || !optStr(v.name)) return null;
  return { id: id(v.id, 'album', i), name: str(v.name, '', 60) };
}

function normalizeMemory(v: unknown, i: number): Memory | null {
  if (!isObj(v)) return null;
  const media = normalizeMedia(v.media);
  if (!media) return null;
  return {
    id: id(v.id, 'mem', i),
    caption: str(v.caption, '', 200),
    note: optStr(v.note, 2000),
    date: optDate(v.date),
    location: optStr(v.location, 120),
    albumIds: arr(v.albumIds).filter((a): a is string => typeof a === 'string'),
    media,
    favorite: bool(v.favorite),
    isSample: bool(v.isSample) || undefined,
    createdAt: stamp(v.createdAt),
  };
}

function normalizeLetter(v: unknown, i: number): Letter | null {
  if (!isObj(v) || !optStr(v.occasion)) return null;
  const lock = isObj(v.lock) ? v.lock : {};
  return {
    id: id(v.id, 'letter', i),
    occasion: str(v.occasion, '', 120),
    recipient: str(v.recipient, '', 60),
    date: optDate(v.date),
    body: str(v.body),
    signature: str(v.signature, '', 120),
    color: oneOf(v.color, LETTER_COLORS, 'blush'),
    seal: oneOf(v.seal, SEALS, 'heart'),
    status: oneOf(v.status, ['draft', 'shared'] as const, 'shared'),
    lock:
      lock.type === 'hold'
        ? { type: 'hold' }
        : lock.type === 'date' && isValidIsoDate(lock.until as string)
          ? { type: 'date', until: lock.until as string }
          : { type: 'none' },
    readAt: optStr(v.readAt, 40),
    isSample: bool(v.isSample) || undefined,
    createdAt: stamp(v.createdAt),
  };
}

function normalizeDream(v: unknown, i: number): Dream | null {
  if (!isObj(v) || !optStr(v.title)) return null;
  return {
    id: id(v.id, 'dream', i),
    title: str(v.title, '', 200),
    description: optStr(v.description, 2000),
    category: oneOf(v.category, CATEGORIES, 'bucket'),
    status: oneOf(v.status, ['planned', 'progress', 'done'] as const, 'planned'),
    targetDate: optDate(v.targetDate),
    media: normalizeMedia(v.media) ?? undefined,
    someday: bool(v.someday),
    completedAt: optStr(v.completedAt, 40),
    isSample: bool(v.isSample) || undefined,
    createdAt: stamp(v.createdAt),
  };
}

function normalizeCapsule(v: unknown, i: number): TimeCapsule | null {
  if (!isObj(v) || !optStr(v.title) || !isValidIsoDate(v.openOn as string)) return null;
  return {
    id: id(v.id, 'capsule', i),
    title: str(v.title, '', 200),
    from: str(v.from, '', 120),
    body: str(v.body),
    openOn: v.openOn as string,
    openedAt: optStr(v.openedAt, 40),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeSongItem(v: unknown, i: number): Song | null {
  if (!isObj(v) || !optStr(v.title)) return null;
  return {
    id: id(v.id, 'song', i),
    title: str(v.title, '', 200),
    artist: str(v.artist, '', 200),
    url: optStr(v.url, 2000),
    why: optStr(v.why, 2000),
    memory: optStr(v.memory, 2000),
    favorite: bool(v.favorite),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeSurprises(v: unknown, fallback: SurpriseContent): SurpriseContent {
  if (!isObj(v)) return fallback;
  const reasons = arr(v.reasons).filter((r): r is string => typeof r === 'string' && !!r.trim());
  const stars = arr(v.stars)
    .map((s, i) => (isObj(s) && optStr(s.text) ? { id: id(s.id, 'star', i), text: str(s.text, '', 300) } : null))
    .filter((s): s is { id: string; text: string } => s !== null);
  return {
    reasons: reasons.length ? reasons.map((r) => r.slice(0, 300)) : fallback.reasons,
    giftMessage: str(v.giftMessage, fallback.giftMessage, 1000),
    stars: stars.length ? stars.slice(0, 16) : fallback.stars,
    secretNote: str(v.secretNote, fallback.secretNote, 1000),
    hiddenHeartNote: str(v.hiddenHeartNote, fallback.hiddenHeartNote, 1000),
  };
}

function normalizeCoco(v: unknown, fallback: CocoContent): CocoContent {
  if (!isObj(v)) return fallback;
  return {
    portrait: normalizeMedia(v.portrait) ?? undefined,
    facts: arr(v.facts)
      .map((f, i) =>
        isObj(f) && optStr(f.label)
          ? { id: id(f.id, 'fact', i), label: str(f.label, '', 60), value: str(f.value, '', 200) }
          : null,
      )
      .filter((f): f is CocoContent['facts'][number] => f !== null),
    notes: arr(v.notes)
      .map((n, i): CocoContent['notes'][number] | null =>
        isObj(n) && optStr(n.text)
          ? {
              id: id(n.id, 'coconote', i),
              text: str(n.text, '', 2000),
              date: optDate(n.date),
              createdAt: stamp(n.createdAt),
            }
          : null,
      )
      .filter((n): n is CocoContent['notes'][number] => n !== null),
  };
}

function list<T>(v: unknown, fn: (item: unknown, i: number) => T | null): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  arr(v).forEach((item, i) => {
    const parsed = fn(item, i) as (T & { id: string }) | null;
    if (parsed && !seen.has(parsed.id)) {
      seen.add(parsed.id);
      out.push(parsed);
    }
  });
  return out;
}

export function normalizeContent(raw: unknown): AppContent {
  const defaults = createDefaultContent();
  if (!isObj(raw)) return defaults;
  const albums = list(raw.albums, normalizeAlbum);
  return {
    version: 1,
    profile: normalizeProfile(raw.profile),
    milestones: Array.isArray(raw.milestones) ? list(raw.milestones, normalizeMilestone) : defaults.milestones,
    albums: Array.isArray(raw.albums) ? albums : defaults.albums,
    memories: Array.isArray(raw.memories) ? list(raw.memories, normalizeMemory) : defaults.memories,
    letters: Array.isArray(raw.letters) ? list(raw.letters, normalizeLetter) : defaults.letters,
    dreams: Array.isArray(raw.dreams) ? list(raw.dreams, normalizeDream) : defaults.dreams,
    capsules: list(raw.capsules, normalizeCapsule),
    songs: list(raw.songs, normalizeSongItem),
    surprises: normalizeSurprises(raw.surprises, defaults.surprises),
    coco: normalizeCoco(raw.coco, defaults.coco),
  };
}

/** True when the object looks like one of our content files at all. */
export function looksLikeContent(raw: unknown): boolean {
  return isObj(raw) && raw.version === 1 && isObj(raw.profile);
}

export function normalizePreferences(raw: unknown): Preferences {
  const p = isObj(raw) ? raw : {};
  return {
    motion: oneOf(p.motion, ['system', 'reduce', 'full'] as const, defaultPreferences.motion),
    intro: oneOf(p.intro, ['session', 'always', 'never'] as const, defaultPreferences.intro),
    soundtrack: oneOf(p.soundtrack, ['musicbox', 'custom'] as const, defaultPreferences.soundtrack),
    customSoundtrackId: optStr(p.customSoundtrackId, 120),
    customSoundtrackName: optStr(p.customSoundtrackName, 200),
    volume:
      typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1 ? p.volume : defaultPreferences.volume,
    worldLight: oneOf(p.worldLight, ['auto', 'day', 'dusk', 'night'] as const, defaultPreferences.worldLight),
  };
}
