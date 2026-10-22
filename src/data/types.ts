/**
 * Content model for Our Little Universe.
 *
 * Everything the two of us write or upload is described here. The shape is
 * deliberately plain JSON (plus media references) so it can move from local
 * browser storage to a real shared backend later without reshaping it.
 */

export type ID = string;

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
  createdAt: string;
}

export type LetterColor = 'blush' | 'lavender' | 'peach' | 'cream' | 'sage' | 'plum';
export type SealIcon = 'heart' | 'star' | 'moon' | 'flower' | 'rabbit' | 'matcha';
export type LetterLock =
  | { type: 'none' }
  | { type: 'hold' }
  | { type: 'date'; until: string };

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
  createdAt: string;
}

export interface CocoContent {
  portrait?: MediaSource;
  facts: CocoFact[];
  notes: CocoNote[];
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
  surprises: SurpriseContent;
  coco: CocoContent;
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
}
