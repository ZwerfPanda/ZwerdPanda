import { refreshStarterTexts } from './starterTexts';
import {
  createDefaultContent,
  defaultPet,
  cloneUs,
  defaultLists,
  defaultPreferences,
  defaultProfile,
  defaultUs,
  defaultWelcome,
  cloneHer,
  defaultHer,
  defaultHunt,
} from './defaults';
import type {
  Album,
  AppContent,
  ArtKey,
  CocoContent,
  ChatLine,
  CocoPet,
  Countdown,
  ListIcon,
  ListItem,
  MiniMe,
  OurList,
  PetName,
  UsContent,
  CountdownIcon,
  Person,
  PetAction,
  PetLogEntry,
  PetOutfit,
  PetTrick,
  Welcome,
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
  Playlist,
  Song,
  SongRef,
  SurpriseContent,
  ThemeName,
  TimeCapsule,
  BucketItem,
  Goal,
  GoalStep,
  HerMood,
  HerPattern,
  HerSpace,
  HerTheme,
  JournalEntry,
  StarHunt,
  HerSong,
  LoveNote,
  NailArt,
  NailFinish,
  GameId,
  Player,
  Games,
  MatchKind,
  ScoreGame,
  Quiz,
  QuizAnswer,
  VoiceNote,
  NailLength,
  NailSet,
  NailShape,
  Museum,
  MuseumStop,
  StopTheme,
} from './types';
import { defaultMuseum } from './museumStops';
import { isValidIsoDate } from '../lib/dates';
import { isHttpUrl, spotifyCollection, spotifyItem } from '../lib/embeds';

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
const optDate = (v: unknown): string | undefined =>
  isValidIsoDate(v as string) ? (v as string) : undefined;
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const id = (v: unknown, prefix: string, index: number) =>
  typeof v === 'string' && v ? v.slice(0, 120) : `${prefix}-imported-${index}`;
const stamp = (v: unknown) =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString();
const optStamp = (v: unknown) =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : undefined;
const person = (v: unknown): Person | undefined => (v === 'you' || v === 'partner' ? v : undefined);
const clampNumber = (v: unknown, min: number, max: number, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const ART_KEYS: readonly ArtKey[] = [
  'phone',
  'meet',
  'mall',
  'matcha',
  'boba',
  'arcade',
  'karaoke',
  'train',
  'car',
  'growth',
  'coco',
  'house',
  'nails',
  'stars',
  'future',
];
const MOTIFS: readonly Motif[] = [
  'phone',
  'sparkle',
  'bag',
  'matcha',
  'train',
  'car',
  'leaf',
  'rabbit',
  'house',
  'star',
  'heart',
  'music',
];
const LETTER_COLORS: readonly LetterColor[] = [
  'blush',
  'lavender',
  'peach',
  'cream',
  'sage',
  'plum',
];
const SEALS: readonly SealIcon[] = ['heart', 'star', 'moon', 'flower', 'rabbit', 'matcha'];
const CATEGORIES: readonly DreamCategory[] = [
  'places',
  'dates',
  'try',
  'home',
  'milestones',
  'family',
  'learn',
  'anniversary',
  'bucket',
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

export function normalizeVoice(v: unknown): VoiceNote | undefined {
  if (!isObj(v) || typeof v.mediaId !== 'string' || !v.mediaId) return undefined;
  const seconds = typeof v.seconds === 'number' && v.seconds > 0 ? v.seconds : 0;
  return { mediaId: v.mediaId.slice(0, 120), seconds: Math.min(Math.round(seconds), 3600) };
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
    homeMessage: str(p.homeMessage, defaultProfile.homeMessage, 20_000),
    signature: str(p.signature, defaultProfile.signature, 120),
    startDate: optDate(p.startDate) ?? null,
    counterMode: oneOf(p.counterMode, ['ymd', 'days'] as const, 'ymd'),
    theme: oneOf(p.theme, THEMES, 'blush'),
    openingSong:
      typeof p.openingSong === 'string'
        ? (spotifyItem(p.openingSong)?.url ?? '')
        : defaultProfile.openingSong,
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
    media: arr(v.media)
      .map(normalizeMedia)
      .filter((m): m is MediaSource => m !== null)
      .slice(0, 500),
    song: normalizeSong(v.song),
    favorite: bool(v.favorite),
    future: bool(v.future) || undefined,
    isSample: bool(v.isSample) || undefined,
    by: person(v.by),
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
    note: optStr(v.note, 20_000),
    date: optDate(v.date),
    location: optStr(v.location, 120),
    albumIds: arr(v.albumIds).filter((a): a is string => typeof a === 'string'),
    media,
    favorite: bool(v.favorite),
    isSample: bool(v.isSample) || undefined,
    by: person(v.by),
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
    voice: normalizeVoice(v.voice),
    openedBy: openedBy(v.openedBy),
    readAt: optStr(v.readAt, 40),
    isSample: bool(v.isSample) || undefined,
    by: person(v.by),
    createdAt: stamp(v.createdAt),
  };
}

function openedBy(v: unknown): Letter['openedBy'] {
  if (!isObj(v)) return undefined;
  const out: Partial<Record<Person, string>> = {};
  for (const who of ['you', 'partner'] as const) {
    const at = optStamp(v[who]);
    if (at) out[who] = at;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeDream(v: unknown, i: number): Dream | null {
  if (!isObj(v) || !optStr(v.title)) return null;
  return {
    id: id(v.id, 'dream', i),
    title: str(v.title, '', 200),
    description: optStr(v.description, 20_000),
    category: oneOf(v.category, CATEGORIES, 'bucket'),
    status: oneOf(v.status, ['planned', 'progress', 'done'] as const, 'planned'),
    targetDate: optDate(v.targetDate),
    media: normalizeMedia(v.media) ?? undefined,
    someday: bool(v.someday),
    completedAt: optStr(v.completedAt, 40),
    isSample: bool(v.isSample) || undefined,
    by: person(v.by),
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
    by: person(v.by),
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
    why: optStr(v.why, 20_000),
    memory: optStr(v.memory, 20_000),
    favorite: bool(v.favorite),
    by: person(v.by),
    createdAt: stamp(v.createdAt),
  };
}

function normalizePlaylist(v: unknown, i: number): Playlist | null {
  if (!isObj(v)) return null;
  const spotify = spotifyCollection(typeof v.url === 'string' ? v.url : '');
  if (!spotify) return null;
  return {
    id: id(v.id, 'playlist', i),
    title: str(v.title, '', 120),
    url: spotify.url,
    note: optStr(v.note, 20_000),
    by: person(v.by),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeSurprises(v: unknown, fallback: SurpriseContent): SurpriseContent {
  if (!isObj(v)) return fallback;
  const reasons = arr(v.reasons).filter((r): r is string => typeof r === 'string' && !!r.trim());
  const stars = arr(v.stars)
    .map((s, i) =>
      isObj(s) && optStr(s.text) ? { id: id(s.id, 'star', i), text: str(s.text, '', 300) } : null,
    )
    .filter((s): s is { id: string; text: string } => s !== null);
  return {
    reasons: reasons.length ? reasons.map((r) => r.slice(0, 300)) : fallback.reasons,
    giftMessage: str(v.giftMessage, fallback.giftMessage, 20_000),
    stars: stars.length ? stars.slice(0, 16) : fallback.stars,
    secretNote: str(v.secretNote, fallback.secretNote, 20_000),
    hiddenHeartNote: str(v.hiddenHeartNote, fallback.hiddenHeartNote, 20_000),
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
              by: person(n.by),
              createdAt: stamp(n.createdAt),
            }
          : null,
      )
      .filter((n): n is CocoContent['notes'][number] => n !== null),
  };
}

const TRICKS: readonly PetTrick[] = ['come', 'boop', 'spin', 'stand', 'jump'];
const OUTFITS: readonly PetOutfit[] = ['none', 'bow', 'flowers', 'scarf', 'party'];
const PET_ACTIONS: readonly PetAction[] = [
  'fed',
  'treat',
  'hay',
  'petted',
  'played',
  'groomed',
  'trained',
  'learned',
  'outfit',
  'cleaned',
  'raised',
  'activity',
];
const COUNTDOWN_ICONS: readonly CountdownIcon[] = [
  'heart',
  'star',
  'plane',
  'gift',
  'cake',
  'home',
  'music',
  'matcha',
];

/** The most care-log entries we keep (newest first). */
export const PET_LOG_LIMIT = 40;

function normalizePet(v: unknown): CocoPet {
  if (!isObj(v))
    return { ...defaultPet, treats: { ...defaultPet.treats }, tricks: {}, log: [], handled: [] };
  const treats = isObj(v.treats) ? v.treats : {};
  const tricks: CocoPet['tricks'] = {};
  if (isObj(v.tricks)) {
    for (const trick of TRICKS) {
      if (typeof v.tricks[trick] === 'number') tricks[trick] = clampNumber(v.tricks[trick], 0, 100);
    }
  }
  const log = list(v.log, (e, i): PetLogEntry | null =>
    isObj(e) && PET_ACTIONS.includes(e.action as PetAction) && optStamp(e.at)
      ? {
          id: id(e.id, 'care', i),
          action: e.action as PetAction,
          detail: optStr(e.detail, 60),
          by: person(e.by),
          at: e.at as string,
        }
      : null,
  )
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, PET_LOG_LIMIT);
  return {
    birthday: optDate(v.birthday) ?? defaultPet.birthday,
    sex: oneOf(v.sex, ['girl', 'boy'] as const, defaultPet.sex),
    coat: str(v.coat, defaultPet.coat, 120) || defaultPet.coat,
    fedAt: optStamp(v.fedAt),
    hayAt: optStamp(v.hayAt),
    pettedAt: optStamp(v.pettedAt),
    playedAt: optStamp(v.playedAt),
    groomedAt: optStamp(v.groomedAt),
    cleanedAt: optStamp(v.cleanedAt),
    treats: {
      date: optDate(treats.date) ?? '',
      count: Math.round(clampNumber(treats.count, 0, 99)),
    },
    bond: Math.round(clampNumber(v.bond, 0, 1_000_000)),
    tricks,
    outfit: oneOf(v.outfit, OUTFITS, 'none'),
    log,
    manners: Math.round(clampNumber(v.manners, 0, 100)),
    handled: arr(v.handled)
      .filter((h): h is string => typeof h === 'string' && h.length <= 40)
      .slice(-40),
  };
}

function normalizeCountdown(v: unknown, i: number): Countdown | null {
  if (!isObj(v) || !optStr(v.title) || !optDate(v.date)) return null;
  return {
    id: id(v.id, 'countdown', i),
    title: str(v.title, '', 80),
    date: v.date as string,
    yearly: bool(v.yearly),
    icon: oneOf(v.icon, COUNTDOWN_ICONS, 'heart'),
    by: person(v.by),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeWelcome(v: unknown): Welcome {
  if (!isObj(v)) return { ...defaultWelcome };
  return {
    enabled: bool(v.enabled, defaultWelcome.enabled),
    title: str(v.title, '', 120),
    message: str(v.message, defaultWelcome.message, 20_000),
    signature: str(v.signature, '', 80),
    seenAt: optStamp(v.seenAt),
  };
}

const LIST_ICONS: readonly ListIcon[] = [
  'baby',
  'heart',
  'star',
  'film',
  'plane',
  'utensils',
  'gift',
  'music',
  'book',
  'home',
];
export const CHAT_LIMIT = 80;

function normalizeListItem(v: unknown, i: number): ListItem | null {
  if (!isObj(v) || !optStr(v.text)) return null;
  const hearts = arr(v.hearts).filter(
    (h): h is 'you' | 'partner' => h === 'you' || h === 'partner',
  );
  return {
    id: id(v.id, 'item', i),
    text: str(v.text, '', 200),
    note: optStr(v.note, 20_000),
    hearts: [...new Set(hearts)],
    done: bool(v.done),
    by: person(v.by),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeList(v: unknown, i: number): OurList | null {
  if (!isObj(v) || !optStr(v.title)) return null;
  return {
    id: id(v.id, 'list', i),
    title: str(v.title, '', 80),
    icon: oneOf(v.icon, LIST_ICONS, 'heart'),
    items: list(v.items, normalizeListItem).slice(0, 500),
    by: person(v.by),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeMiniMe(v: unknown, fallback: MiniMe): MiniMe {
  if (!isObj(v)) return { ...fallback, look: { ...fallback.look }, lines: [...fallback.lines] };
  const look = isObj(v.look) ? v.look : {};
  const accessories = arr(look.accessories)
    .filter((a): a is string => typeof a === 'string' && a.length < 30)
    .slice(0, 12);
  return {
    fullName: str(v.fullName, '', 120),
    birthday: optDate(v.birthday) ?? '',
    heightCm: Math.round(clampNumber(v.heightCm, 100, 230, fallback.heightCm)),
    look: {
      outfit:
        typeof look.outfit === 'string' && look.outfit
          ? look.outfit.slice(0, 30)
          : fallback.look.outfit,
      hair: oneOf(
        look.hair,
        ['straight', 'wavy', 'curls', 'slick-back'] as const,
        fallback.look.hair,
      ),
      accessories: Array.isArray(look.accessories)
        ? [...new Set(accessories)]
        : [...fallback.look.accessories],
    },
    lines: arr(v.lines)
      .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
      .map((l) => l.slice(0, 200))
      .slice(0, 40),
  };
}

function normalizeUs(v: unknown): UsContent {
  if (!isObj(v)) return cloneUs(defaultUs);
  return {
    you: normalizeMiniMe(v.you, defaultUs.you),
    partner: normalizeMiniMe(v.partner, defaultUs.partner),
    petNames: Array.isArray(v.petNames)
      ? list(v.petNames, (p, i): PetName | null =>
          isObj(p) && optStr(p.name)
            ? {
                id: id(p.id, 'pet', i),
                name: str(p.name, '', 40),
                from: oneOf(p.from, ['you', 'partner', 'both'] as const, 'both'),
              }
            : null,
        ).slice(0, 40)
      : defaultUs.petNames.map((p) => ({ ...p })),
    chat: list(v.chat, (c, i): ChatLine | null =>
      isObj(c) && optStr(c.text) && (c.who === 'you' || c.who === 'partner')
        ? { id: id(c.id, 'chat', i), who: c.who, text: str(c.text, '', 300), at: stamp(c.at) }
        : null,
    )
      .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
      .slice(0, CHAT_LIMIT),
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

/* ------------------------------------------------------- her little world */

const HER_THEMES: readonly HerTheme[] = [
  'strawberry',
  'lavender',
  'cherry',
  'vanilla',
  'glitter',
  'ocean',
];
const HER_PATTERNS: readonly HerPattern[] = ['hearts', 'bows', 'stars', 'checks', 'dots', 'plain'];
export const HER_MOODS: readonly HerMood[] = [
  'happy',
  'loved',
  'calm',
  'excited',
  'tired',
  'sad',
  'stressed',
];

/** Only ordinary web links — never `javascript:` or anything else. */
const optLink = (v: unknown): string | undefined =>
  typeof v === 'string' && isHttpUrl(v.trim()) ? v.trim().slice(0, 2000) : undefined;

export function normalizeJournalEntry(v: unknown, i: number): JournalEntry | null {
  if (!isObj(v) || !optStr(v.text) || !isValidIsoDate(v.date as string)) return null;
  return {
    id: id(v.id, 'journal', i),
    date: v.date as string,
    title: optStr(v.title, 140),
    text: str(v.text, '', 20_000),
    mood: HER_MOODS.includes(v.mood as HerMood) ? (v.mood as HerMood) : undefined,
    private: bool(v.private) || undefined,
    createdAt: stamp(v.createdAt),
    editedAt: optStamp(v.editedAt),
  };
}

export function normalizeBucketItem(v: unknown, i: number): BucketItem | null {
  if (!isObj(v) || !optStr(v.title)) return null;
  return {
    id: id(v.id, 'bucket', i),
    title: str(v.title, '', 200),
    note: optStr(v.note, 20_000),
    link: optLink(v.link),
    media: normalizeMedia(v.media) ?? undefined,
    done: bool(v.done),
    doneAt: optStamp(v.doneAt),
    private: bool(v.private) || undefined,
    createdAt: stamp(v.createdAt),
  };
}

function normalizeGoalStep(v: unknown, i: number): GoalStep | null {
  if (!isObj(v) || !optStr(v.text)) return null;
  return { id: id(v.id, 'step', i), text: str(v.text, '', 200), done: bool(v.done) };
}

export function normalizeGoal(v: unknown, i: number): Goal | null {
  if (!isObj(v) || !optStr(v.title)) return null;
  return {
    id: id(v.id, 'goal', i),
    title: str(v.title, '', 200),
    why: optStr(v.why, 20_000),
    steps: list(v.steps, normalizeGoalStep).slice(0, 40),
    target: optDate(v.target),
    done: bool(v.done),
    doneAt: optStamp(v.doneAt),
    private: bool(v.private) || undefined,
    createdAt: stamp(v.createdAt),
  };
}

const lines = (v: unknown, max: number, fallback: string[]) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
        .map((x) => x.slice(0, 200))
        .slice(0, max)
    : [...fallback];

const NAIL_SHAPES: readonly NailShape[] = ['almond', 'square', 'coffin', 'stiletto'];
const NAIL_ART: readonly NailArt[] = [
  'none',
  'french',
  'heart',
  'glitter',
  'star',
  'flower',
  'dots',
  'ombre',
  'cherry',
  'bow',
  'gem',
  'leopard',
  'smiley',
  'swirl',
];
const NAIL_FINISHES: readonly NailFinish[] = ['gloss', 'matte', 'chrome', 'jelly'];
const NAIL_LENGTHS: readonly NailLength[] = ['short', 'medium', 'long'];
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function normalizeNailSet(v: unknown, i: number): NailSet | null {
  if (!isObj(v)) return null;
  const fallback = defaultHer.nails.current;
  const colors = arr(v.colors).filter(isColor).slice(0, 5);
  const art = arr(v.art)
    .map((a) => oneOf(a, NAIL_ART, 'none'))
    .slice(0, 5);
  return {
    id: id(v.id, 'nails', i),
    shape: oneOf(v.shape, NAIL_SHAPES, fallback.shape),
    finish: oneOf(v.finish, NAIL_FINISHES, fallback.finish),
    length: oneOf(v.length, NAIL_LENGTHS, fallback.length),
    accent: isColor(v.accent) ? v.accent : fallback.accent,
    colors: colors.length === 5 ? colors : [...fallback.colors],
    art: art.length === 5 ? art : [...fallback.art],
    savedAt: optStamp(v.savedAt),
  };
}

function normalizeHerSong(v: unknown, i: number): HerSong | null {
  if (!isObj(v) || typeof v.url !== 'string') return null;
  const item = spotifyItem(v.url);
  if (!item) return null;
  return {
    id: id(v.id, 'song', i),
    url: item.url,
    title: optStr(v.title, 120),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeNote(v: unknown, i: number): LoveNote | null {
  if (!isObj(v)) return null;
  const voice = normalizeVoice(v.voice);
  // A note can be words, a voice message, or both.
  if (!optStr(v.text) && !voice) return null;
  return {
    id: id(v.id, 'note', i),
    text: str(v.text, '', 20_000),
    voice,
    createdAt: stamp(v.createdAt),
    openedAt: optStamp(v.openedAt),
    hearted: bool(v.hearted) || undefined,
  };
}

export function normalizeHer(v: unknown): HerSpace {
  if (!isObj(v)) return cloneHer(defaultHer);
  const done = isObj(v.selfCareDone) ? v.selfCareDone : {};
  return {
    title: str(v.title, '', 80),
    subtitle: str(v.subtitle, defaultHer.subtitle, 200),
    theme: oneOf(v.theme, HER_THEMES, defaultHer.theme),
    pattern: oneOf(v.pattern, HER_PATTERNS, defaultHer.pattern),
    sticker: str(v.sticker, defaultHer.sticker, 16) || defaultHer.sticker,
    affirmations: lines(v.affirmations, 60, defaultHer.affirmations),
    selfCare: lines(v.selfCare, 12, defaultHer.selfCare),
    selfCareDone: {
      date: optDate(done.date) ?? '',
      items: lines(done.items, 12, []),
    },
    playlistUrl: spotifyCollection(str(v.playlistUrl))?.url,
    coco: bool(v.coco, defaultHer.coco),
    music: (() => {
      const songs = list(v.music, normalizeHerSong).slice(0, 60);
      // Her first playlist (from before the music box held more) comes along.
      const old = spotifyCollection(str(v.playlistUrl));
      return songs.length === 0 && old
        ? [
            {
              id: 'her-playlist',
              url: old.url,
              title: 'Mijn playlist',
              createdAt: stamp(undefined),
            },
          ]
        : songs;
    })(),
    notes: list(v.notes, normalizeNote).slice(0, 5000),
    nails: {
      current: normalizeNailSet(isObj(v.nails) ? v.nails.current : undefined, 0) ?? {
        ...defaultHer.nails.current,
        colors: [...defaultHer.nails.current.colors],
        art: [...defaultHer.nails.current.art],
      },
      saved: isObj(v.nails) ? list(v.nails.saved, normalizeNailSet).slice(0, 24) : [],
      sent: isObj(v.nails)
        ? list(v.nails.sent, (x, i) => {
            if (!isObj(x)) return null;
            const set = normalizeNailSet(x.set, i);
            return set
              ? { id: id(x.id, 'sent', i), set, at: stamp(x.at), seenAt: optStamp(x.seenAt) }
              : null;
          }).slice(0, 50)
        : [],
    },
    // Private things never belong in the shared copy.
    journal: list(v.journal, normalizeJournalEntry)
      .filter((j) => !j.private)
      .slice(0, 2000),
    bucket: list(v.bucket, normalizeBucketItem)
      .filter((b) => !b.private)
      .slice(0, 500),
    goals: list(v.goals, normalizeGoal)
      .filter((g) => !g.private)
      .slice(0, 200),
  };
}

function normalizeHunt(v: unknown): StarHunt {
  const h = isObj(v) ? v : {};
  const found: StarHunt['found'] = {};
  if (isObj(h.found)) {
    for (const [star, value] of Object.entries(h.found).slice(0, 100)) {
      if (isObj(value) && optStamp(value.at))
        found[star.slice(0, 40)] = { at: value.at as string, by: person(value.by) };
    }
  }
  return { found, reward: str(h.reward, defaultHunt.reward, 4000) };
}

/* ------------------------------------------------------------ museum of us */

export const STOP_THEMES: readonly StopTheme[] = [
  'home',
  'station',
  'platform',
  'bubbletea',
  'mall',
  'birds',
  'pasta',
  'hotel',
  'themepark',
  'roadtrip',
  'cinema',
  'chicken',
  'ikea',
  'amsterdam',
  'miniature',
  'pumpkin',
  'spa',
  'holiday',
  'christmas',
  'date',
];

function normalizeStop(v: unknown, i: number): MuseumStop | null {
  if (!isObj(v) || !optStr(v.name)) return null;
  return {
    id: id(v.id, 'stop', i),
    name: str(v.name, '', 80),
    place: optStr(v.place, 80),
    theme: oneOf(v.theme, STOP_THEMES, 'date'),
    story: str(v.story, '', 20_000),
    details: lines(v.details, 30, []),
    favorite: optStr(v.favorite, 20_000),
    media: list(v.media, (m) => normalizeMedia(m)).slice(0, 500),
    voice: normalizeVoice(v.voice),
    when: optStr(v.when, 60),
    date: optDate(v.date),
    upcoming: bool(v.upcoming),
    by: person(v.by),
    createdAt: stamp(v.createdAt),
  };
}

function normalizeMuseum(v: unknown): Museum {
  if (!isObj(v) || !Array.isArray(v.stops)) return defaultMuseum();
  return { stops: list(v.stops, normalizeStop).slice(0, 120), foundAt: optStamp(v.foundAt) };
}

const MATCH_KINDS: readonly MatchKind[] = ['c4', 'hangman', 'uno', 'zeeslag'];
const SCORE_GAMES: readonly ScoreGame[] = ['bowling', 'skeeball', 'darts'];

function normalizeGames(v: unknown): Games {
  if (!isObj(v)) return { matches: [], scores: [], results: [] };
  return {
    matches: list(v.matches, (m, i) => {
      if (!isObj(m) || !MATCH_KINDS.includes(m.kind as MatchKind) || !isObj(m.state)) return null;
      const startedBy = person(m.startedBy);
      // A game's state is small; anything huge is not ours.
      if (!startedBy || JSON.stringify(m.state).length > 60_000) return null;
      return {
        id: id(m.id, 'match', i),
        kind: m.kind as MatchKind,
        state: m.state,
        turn: person(m.turn),
        winner: m.winner === 'draw' ? ('draw' as const) : person(m.winner),
        startedBy,
        createdAt: stamp(m.createdAt),
        updatedAt: stamp(m.updatedAt),
      };
    }).slice(-100),
    scores: list(v.scores, (s, i) => {
      const who = isObj(s) ? (s.who === 'coco' ? ('coco' as const) : person(s.who)) : undefined;
      if (!isObj(s) || !who || !SCORE_GAMES.includes(s.game as ScoreGame)) return null;
      const score = Number(s.score);
      if (!Number.isFinite(score) || score < 0 || score > 100_000) return null;
      return {
        id: id(s.id, 'score', i),
        game: s.game as ScoreGame,
        who,
        score: Math.round(score),
        at: stamp(s.at),
      };
    }).slice(-500),
    results: list(v.results, (r, i) => {
      if (!isObj(r) || !GAME_IDS.includes(r.game as GameId)) return null;
      const players = arr(r.players).filter((p): p is Player => PLAYERS.includes(p as Player));
      const winner: Player | 'draw' | null =
        r.winner === 'draw'
          ? 'draw'
          : PLAYERS.includes(r.winner as Player)
            ? (r.winner as Player)
            : null;
      if (players.length < 2 || !winner) return null;
      return {
        id: id(r.id, 'result', i),
        game: r.game as GameId,
        players,
        winner,
        at: stamp(r.at),
      };
    }).slice(-2000),
  };
}

const GAME_IDS: readonly GameId[] = [
  'uno',
  'c4',
  'hangman',
  'bowling',
  'skeeball',
  'darts',
  'zeeslag',
];
const PLAYERS: readonly Player[] = ['you', 'partner', 'coco'];

const JUDGEMENTS = ['right', 'close', 'wrong'] as const;

function normalizeSyncReports(v: unknown): AppContent['syncReports'] {
  if (!isObj(v)) return {};
  const out: AppContent['syncReports'] = {};
  for (const who of ['you', 'partner'] as const) {
    const r = v[who];
    if (!isObj(r) || !optStamp(r.at)) continue;
    out[who] = { at: r.at as string, ok: r.ok === true, build: str(r.build, '', 40) };
  }
  return out;
}

function normalizeQuiz(v: unknown): Quiz {
  if (!isObj(v)) return { custom: [], answers: [] };
  return {
    custom: list(v.custom, (q, i) =>
      isObj(q) && optStr(q.text)
        ? {
            id: id(q.id, 'question', i),
            text: str(q.text, '', 300),
            by: person(q.by),
            createdAt: stamp(q.createdAt),
          }
        : null,
    ).slice(0, 200),
    answers: list(v.answers, (a) => {
      if (!isObj(a) || typeof a.question !== 'string') return null;
      const who = person(a.who);
      if (!who) return null;
      return {
        id: `${a.question}:${who}`,
        question: a.question.slice(0, 120),
        who,
        self: optStr(a.self, 2000),
        guess: optStr(a.guess, 2000),
        judged: JUDGEMENTS.includes(a.judged as never)
          ? (a.judged as QuizAnswer['judged'])
          : undefined,
        at: stamp(a.at),
      };
    }).slice(0, 1000),
  };
}

export function normalizeContent(raw: unknown): AppContent {
  const defaults = createDefaultContent();
  if (!isObj(raw)) return defaults;
  const albums = list(raw.albums, normalizeAlbum);
  return refreshStarterTexts({
    version: 1,
    profile: normalizeProfile(raw.profile),
    milestones: Array.isArray(raw.milestones)
      ? list(raw.milestones, normalizeMilestone)
      : defaults.milestones,
    albums: Array.isArray(raw.albums) ? albums : defaults.albums,
    memories: Array.isArray(raw.memories) ? list(raw.memories, normalizeMemory) : defaults.memories,
    letters: Array.isArray(raw.letters) ? list(raw.letters, normalizeLetter) : defaults.letters,
    dreams: Array.isArray(raw.dreams) ? list(raw.dreams, normalizeDream) : defaults.dreams,
    capsules: list(raw.capsules, normalizeCapsule),
    songs: list(raw.songs, normalizeSongItem),
    playlists: list(raw.playlists, normalizePlaylist).slice(0, 30),
    surprises: normalizeSurprises(raw.surprises, defaults.surprises),
    coco: normalizeCoco(raw.coco, defaults.coco),
    pet: normalizePet(raw.pet),
    countdowns: list(raw.countdowns, normalizeCountdown),
    welcome: normalizeWelcome(raw.welcome),
    lists: Array.isArray(raw.lists)
      ? list(raw.lists, normalizeList).slice(0, 60)
      : defaultLists.map((l) => ({ ...l, items: [] })),
    us: normalizeUs(raw.us),
    her: normalizeHer(raw.her),
    hunt: normalizeHunt(raw.hunt),
    museum: normalizeMuseum(raw.museum),
    quiz: normalizeQuiz(raw.quiz),
    games: normalizeGames(raw.games),
    syncReports: normalizeSyncReports(raw.syncReports),
  });
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
      typeof p.volume === 'number' && p.volume >= 0 && p.volume <= 1
        ? p.volume
        : defaultPreferences.volume,
    worldLight: oneOf(
      p.worldLight,
      ['auto', 'day', 'dusk', 'night'] as const,
      defaultPreferences.worldLight,
    ),
    companion: bool(p.companion, defaultPreferences.companion),
    sfx: bool(p.sfx, defaultPreferences.sfx),
    ambience: bool(p.ambience, defaultPreferences.ambience),
    notify: bool(p.notify, defaultPreferences.notify),
    cocoHome:
      isObj(p.cocoHome) &&
      typeof p.cocoHome.path === 'string' &&
      typeof p.cocoHome.spot === 'number'
        ? { path: p.cocoHome.path.slice(0, 40), spot: Math.abs(Math.round(p.cocoHome.spot)) % 4 }
        : undefined,
  };
}
