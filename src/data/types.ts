/**
 * Content model for Our Little Universe.
 *
 * Everything the two of us write or upload is described here. The shape is
 * deliberately plain JSON (plus media references) so it can move from local
 * browser storage to a real shared backend later without reshaping it.
 */

export type ID = string;

/**
 * Which of the two of us made something: `you` is the person who set the site
 * up (profile.yourName), `partner` is profile.partnerName.
 */
export type Person = 'you' | 'partner';

/** Illustrated placeholder artwork that ships with the site. */
export type ArtKey =
  | 'phone'
  | 'meet'
  | 'mall'
  | 'matcha'
  | 'boba'
  | 'arcade'
  | 'karaoke'
  | 'train'
  | 'car'
  | 'growth'
  | 'coco'
  | 'house'
  | 'nails'
  | 'stars'
  | 'future';

/**
 * Where a picture or clip comes from.
 * - `sample`: one of the built-in illustrations (clearly labelled as a placeholder)
 * - `local`: a file chosen on this device, stored in IndexedDB under `mediaId`
 */
export type MediaSource =
  | { type: 'sample'; art: ArtKey }
  | { type: 'local'; mediaId: ID; kind: 'image' | 'video'; width?: number; height?: number };

export interface SongRef {
  title: string;
  artist?: string;
  url?: string;
}

export type Motif =
  | 'phone'
  | 'sparkle'
  | 'bag'
  | 'matcha'
  | 'train'
  | 'car'
  | 'leaf'
  | 'rabbit'
  | 'house'
  | 'star'
  | 'heart'
  | 'music';

export interface Milestone {
  id: ID;
  title: string;
  /** Exact date (YYYY-MM-DD), if we know it. */
  date?: string;
  /** Looser label when there is no exact date, e.g. "Spring 2026". */
  dateLabel?: string;
  story: string;
  /** A gentle writing prompt shown on sample chapters. */
  prompt?: string;
  motif: Motif;
  media: MediaSource[];
  song?: SongRef;
  favorite: boolean;
  /** Marks the "still to be written" chapter at the end of the line. */
  future?: boolean;
  isSample?: boolean;
  by?: Person;
  createdAt: string;
}

export interface Album {
  id: ID;
  name: string;
}

export interface Memory {
  id: ID;
  caption: string;
  note?: string;
  date?: string;
  location?: string;
  albumIds: ID[];
  media: MediaSource;
  favorite: boolean;
  isSample?: boolean;
  by?: Person;
  createdAt: string;
}

export type LetterColor = 'blush' | 'lavender' | 'peach' | 'cream' | 'sage' | 'plum';
export type SealIcon = 'heart' | 'star' | 'moon' | 'flower' | 'rabbit' | 'matcha';
export type LetterLock = { type: 'none' } | { type: 'hold' } | { type: 'date'; until: string };

export interface Letter {
  id: ID;
  /** Written without the "Open when" prefix, e.g. "you miss me". */
  occasion: string;
  recipient: string;
  date?: string;
  body: string;
  signature: string;
  color: LetterColor;
  seal: SealIcon;
  /** Drafts stay off the envelope shelf until shared. Not a security feature. */
  status: 'draft' | 'shared';
  lock: LetterLock;
  readAt?: string;
  isSample?: boolean;
  by?: Person;
  createdAt: string;
}

export type DreamCategory =
  | 'places'
  | 'dates'
  | 'try'
  | 'home'
  | 'milestones'
  | 'family'
  | 'learn'
  | 'anniversary'
  | 'bucket';

export type DreamStatus = 'planned' | 'progress' | 'done';

export interface Dream {
  id: ID;
  title: string;
  description?: string;
  category: DreamCategory;
  status: DreamStatus;
  targetDate?: string;
  media?: MediaSource;
  /** "One day…" dreams carry no status and no pressure. */
  someday: boolean;
  completedAt?: string;
  isSample?: boolean;
  by?: Person;
  createdAt: string;
}

export interface TimeCapsule {
  id: ID;
  title: string;
  from: string;
  body: string;
  /** Date (YYYY-MM-DD) on which the capsule unseals itself. */
  openOn: string;
  openedAt?: string;
  by?: Person;
  createdAt: string;
}

export interface Song {
  id: ID;
  title: string;
  artist: string;
  url?: string;
  why?: string;
  memory?: string;
  favorite: boolean;
  by?: Person;
  createdAt: string;
}

/** A Spotify playlist (or album) of ours, shown with Spotify's own player. */
export interface Playlist {
  id: ID;
  /** Our name for it (Spotify's own title shows in the player). */
  title: string;
  /** Canonical link, e.g. https://open.spotify.com/playlist/… */
  url: string;
  note?: string;
  by?: Person;
  createdAt: string;
}

export interface StarNote {
  id: ID;
  text: string;
}

export interface SurpriseContent {
  /** Little reasons — used by the jar and the daily flower. */
  reasons: string[];
  giftMessage: string;
  stars: StarNote[];
  secretNote: string;
  hiddenHeartNote: string;
}

export interface CocoFact {
  id: ID;
  label: string;
  value: string;
}

export interface CocoNote {
  id: ID;
  text: string;
  date?: string;
  by?: Person;
  createdAt: string;
}

export interface CocoContent {
  portrait?: MediaSource;
  facts: CocoFact[];
  notes: CocoNote[];
}

/* ------------------------------------------------------------ digital Coco */

export type PetFood =
  | 'hay'
  | 'pellets'
  | 'romaine'
  | 'parsley'
  | 'coriander'
  | 'basil'
  | 'carrot'
  | 'apple'
  | 'banana'
  | 'strawberry';

export type PetTrick = 'come' | 'boop' | 'spin' | 'stand' | 'jump';
export type PetOutfit = 'none' | 'bow' | 'flowers' | 'scarf' | 'party';

export type PetAction =
  | 'fed'
  | 'treat'
  | 'hay'
  | 'petted'
  | 'played'
  | 'groomed'
  | 'trained'
  | 'learned'
  | 'outfit';

export interface PetLogEntry {
  id: ID;
  action: PetAction;
  /** Food, toy, trick or outfit involved. */
  detail?: string;
  by?: Person;
  at: string;
}

/**
 * Our digital Coco. Her needs aren't stored as numbers that tick down — they
 * are worked out from when she was last fed, cuddled, played with or brushed,
 * so both phones always agree and nothing needs to run in the background.
 */
export interface CocoPet {
  /** Real facts about Coco. */
  birthday: string;
  sex: 'girl' | 'boy';
  coat: string;
  fedAt?: string;
  hayAt?: string;
  pettedAt?: string;
  playedAt?: string;
  groomedAt?: string;
  /** Treats are small and few: counted per calendar day. */
  treats: { date: string; count: number };
  /** Grows with every bit of care, from both of us. */
  bond: number;
  /** Training progress per trick, 0–100. */
  tricks: Partial<Record<PetTrick, number>>;
  outfit: PetOutfit;
  log: PetLogEntry[];
}

/* -------------------------------------------------------------- countdowns */

export type CountdownIcon =
  | 'heart'
  | 'star'
  | 'plane'
  | 'gift'
  | 'cake'
  | 'home'
  | 'music'
  | 'matcha';

export interface Countdown {
  id: ID;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** Yearly countdowns roll over to next year once the day has passed. */
  yearly: boolean;
  icon: CountdownIcon;
  by?: Person;
  createdAt: string;
}

/* ---------------------------------------------------------------- welcome */

/** The one-time welcome the partner sees the first time she signs in. */
export interface Welcome {
  enabled: boolean;
  title: string;
  message: string;
  signature: string;
  /** Set when the partner has opened it (so it shows only once). */
  seenAt?: string;
}

/* ------------------------------------------------------------- our lists */

export type ListIcon =
  | 'baby'
  | 'heart'
  | 'star'
  | 'film'
  | 'plane'
  | 'utensils'
  | 'gift'
  | 'music'
  | 'book'
  | 'home';

export interface ListItem {
  id: ID;
  text: string;
  note?: string;
  /** Who hearted it — both of us means we both love it. */
  hearts: Person[];
  done: boolean;
  by?: Person;
  createdAt: string;
}

export interface OurList {
  id: ID;
  title: string;
  icon: ListIcon;
  items: ListItem[];
  by?: Person;
  createdAt: string;
}

/* --------------------------------------------------------------- mini us */

export interface Look {
  outfit: string;
  /** Hers: straight or wavy. His: a curly top or a curly slick back. */
  hair: 'straight' | 'wavy' | 'curls' | 'slick-back';
  accessories: string[];
}

export interface MiniMe {
  /** Optional, filled in by us in the app (never shipped with the site). */
  fullName: string;
  birthday: string;
  heightCm: number;
  look: Look;
  /** Things we taught our mini to say. */
  lines: string[];
}

export interface PetName {
  id: ID;
  name: string;
  /** Who uses it: `you` calls `partner` this, or the other way round, or both. */
  from: Person | 'both';
}

export interface ChatLine {
  id: ID;
  /** Which mini said it. */
  who: Person;
  text: string;
  at: string;
}

export interface UsContent {
  you: MiniMe;
  partner: MiniMe;
  /** Most used first. */
  petNames: PetName[];
  chat: ChatLine[];
}

export type ThemeName = 'blush' | 'lavender' | 'matcha' | 'midnight';

export interface Profile {
  yourName: string;
  partnerName: string;
  siteTitle: string;
  subtitle: string;
  homeGreeting: string;
  homeMessage: string;
  signature: string;
  /** Relationship start date (YYYY-MM-DD). Never guessed — null until set. */
  startDate: string | null;
  counterMode: 'ymd' | 'days';
  theme: ThemeName;
}

export interface AppContent {
  version: 1;
  profile: Profile;
  milestones: Milestone[];
  albums: Album[];
  memories: Memory[];
  letters: Letter[];
  dreams: Dream[];
  capsules: TimeCapsule[];
  songs: Song[];
  playlists: Playlist[];
  surprises: SurpriseContent;
  coco: CocoContent;
  pet: CocoPet;
  countdowns: Countdown[];
  welcome: Welcome;
  lists: OurList[];
  us: UsContent;
}

/** Per-device preferences. These never travel with exported content. */
export interface Preferences {
  motion: 'system' | 'reduce' | 'full';
  intro: 'session' | 'always' | 'never';
  soundtrack: 'musicbox' | 'custom';
  customSoundtrackId?: ID;
  customSoundtrackName?: string;
  volume: number;
  worldLight: 'auto' | 'day' | 'dusk' | 'night';
  /** Show the little Coco who hops along on every page. */
  companion: boolean;
  /** While she stays home: the page (and edge) where her hutch is hidden. */
  cocoHome?: { path: string; spot: number };
}
