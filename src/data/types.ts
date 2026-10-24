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

/** A recorded voice message, stored like a photo (on the phone, and in the cloud). */
export interface VoiceNote {
  mediaId: ID;
  seconds: number;
}

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
  /** His or her voice, to listen to with the letter. */
  voice?: VoiceNote;
  /** When each of us opened it on our own screen (the writer never needs to). */
  openedBy?: Partial<Record<Person, string>>;
  /** Older, shared "opened" mark — it couldn't tell who opened it, so it's no longer used. */
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
  | 'outfit'
  | 'cleaned'
  | 'raised'
  | 'activity';

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
  /** Her hutch: fresh bedding and a clean litter box. */
  cleanedAt?: string;
  /** Treats are small and few: counted per calendar day. */
  treats: { date: string; count: number };
  /** Grows with every bit of care, from both of us. */
  bond: number;
  /** Training progress per trick, 0–100. */
  tricks: Partial<Record<PetTrick, number>>;
  outfit: PetOutfit;
  log: PetLogEntry[];
  /** Days (YYYY-MM-DD) someone looked after her: her care streak. */
  careDays: string[];
  /** How well brought up she is, 0–100: grows when we respond kindly to mischief. */
  manners: number;
  /** Mischief moments we already responded to (so the other phone doesn't get them again). */
  handled: string[];
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

/* ------------------------------------------------------- her little world */

export type HerTheme = 'strawberry' | 'lavender' | 'cherry' | 'vanilla' | 'glitter' | 'ocean';
export type HerPattern = 'hearts' | 'bows' | 'stars' | 'checks' | 'dots' | 'plain';
export type HerMood = 'happy' | 'loved' | 'calm' | 'excited' | 'tired' | 'sad' | 'stressed';

/**
 * Things in her space can be private: those never enter the shared content
 * at all — they live only on the device they were written on.
 */
export interface JournalEntry {
  id: ID;
  /** YYYY-MM-DD */
  date: string;
  title?: string;
  text: string;
  mood?: HerMood;
  private?: boolean;
  createdAt: string;
  editedAt?: string;
}

export interface BucketItem {
  id: ID;
  title: string;
  note?: string;
  /** Where tapping it takes her (a place, a product, a video…). */
  link?: string;
  media?: MediaSource;
  done: boolean;
  doneAt?: string;
  private?: boolean;
  createdAt: string;
}

export interface GoalStep {
  id: ID;
  text: string;
  done: boolean;
}

export interface Goal {
  id: ID;
  title: string;
  why?: string;
  steps: GoalStep[];
  /** YYYY-MM-DD, only if she wants one. */
  target?: string;
  done: boolean;
  doneAt?: string;
  private?: boolean;
  createdAt: string;
}

/** A little note from him, waiting in her corner. */
export interface LoveNote {
  id: ID;
  text: string;
  voice?: VoiceNote;
  createdAt: string;
  openedAt?: string;
  hearted?: boolean;
}

/** A song, album or playlist on Spotify, in her music box. */
export interface HerSong {
  id: ID;
  url: string;
  title?: string;
  createdAt: string;
}

export type NailShape = 'almond' | 'square' | 'coffin' | 'stiletto';
export type NailArt =
  | 'none'
  | 'french'
  | 'heart'
  | 'glitter'
  | 'star'
  | 'flower'
  | 'dots'
  | 'ombre'
  | 'cherry'
  | 'bow'
  | 'gem'
  | 'leopard'
  | 'smiley'
  | 'swirl';
export type NailFinish = 'gloss' | 'matte' | 'chrome' | 'jelly';
export type NailLength = 'short' | 'medium' | 'long';

export interface NailSet {
  id: ID;
  shape: NailShape;
  finish: NailFinish;
  length: NailLength;
  /** The second colour: french tips, dots, ombré. */
  accent: string;
  /** Thumb to pinky. */
  colors: string[];
  art: NailArt[];
  savedAt?: string;
  /** When he gave it a heart. */
  loved?: string;
}

/** A set she sent him, to show off. */
export interface SentNails {
  id: ID;
  set: NailSet;
  at: string;
  seenAt?: string;
}

export interface HerSpace {
  /** Empty means "<her name>’s Little World". */
  title: string;
  subtitle: string;
  theme: HerTheme;
  pattern: HerPattern;
  sticker: string;
  /** Her own kind words to herself, one shown per day. */
  affirmations: string[];
  selfCare: string[];
  selfCareDone: { date: string; items: string[] };
  /** Her own Spotify playlist for her music box. */
  playlistUrl?: string;
  /** Coco keeps her company in her corner. */
  coco: boolean;
  /** Her music box: her own songs and playlists. */
  music: HerSong[];
  /** Notes he leaves for her. */
  notes: LoveNote[];
  /** Her nail studio: the set she's designing, and the ones she saved. */
  nails: { current: NailSet; saved: NailSet[]; sent?: SentNails[] };
  journal: JournalEntry[];
  bucket: BucketItem[];
  goals: Goal[];
  /** Her wishes for our app, for him to pass on. */
  ideas: IdeaNote[];
}

export interface IdeaNote {
  id: ID;
  text: string;
  /** new → he has seen it → it's in the app. */
  status: 'new' | 'seen' | 'built';
  createdAt: string;
}

/* ---------------------------------------------------------- museum of us */

/** Which little world a stop's scene is drawn in. */
export type StopTheme =
  | 'home'
  | 'station'
  | 'platform'
  | 'bubbletea'
  | 'mall'
  | 'birds'
  | 'pasta'
  | 'hotel'
  | 'themepark'
  | 'roadtrip'
  | 'cinema'
  | 'chicken'
  | 'ikea'
  | 'amsterdam'
  | 'miniature'
  | 'pumpkin'
  | 'spa'
  | 'holiday'
  | 'christmas'
  | 'date';

/** One stop on our line: a place that's ours. */
export interface MuseumStop {
  id: ID;
  name: string;
  /** Town or a few words under the name. */
  place?: string;
  theme: StopTheme;
  story: string;
  /** Little things we did or always do there. */
  details: string[];
  /** Our favourite memory of this stop. */
  favorite?: string;
  media: MediaSource[];
  /** The story of this stop, told out loud. */
  voice?: VoiceNote;
  /** Loose "when", e.g. "december" or "onze eerste date". */
  when?: string;
  /** The exact day, when we know it (for the countdown and the ticket). */
  date?: string;
  /** A stop we haven't been to yet. */
  upcoming: boolean;
  by?: Person;
  createdAt: string;
}

export interface Museum {
  stops: MuseumStop[];
  /** When one of us first found the way in. */
  foundAt?: string;
}

/* ------------------------------------------------------- who knows who */

export interface QuizQuestion {
  id: ID;
  text: string;
  by?: Person;
  createdAt: string;
}

/** One person's go at one question: about themselves, and a guess about the other. */
export interface QuizAnswer {
  /** `${question}:${who}` — one per person per question. */
  id: ID;
  question: ID;
  who: Person;
  self?: string;
  guess?: string;
  /** How the other person judged this guess. */
  judged?: 'right' | 'close' | 'wrong';
  at: string;
}

export interface Quiz {
  custom: QuizQuestion[];
  answers: QuizAnswer[];
}

/* ---------------------------------------------------------------- games */

export type MatchKind = 'c4' | 'hangman' | 'uno' | 'zeeslag';

/** A game we play together, turn by turn, each on our own phone. */
export interface GameMatch {
  id: ID;
  kind: MatchKind;
  /** The board, the cards… (shape depends on the kind of game). */
  state: Record<string, unknown>;
  turn?: Person;
  winner?: Person | 'draw';
  startedBy: Person;
  createdAt: string;
  updatedAt: string;
}

export type ScoreGame = 'bowling' | 'skeeball' | 'darts';

export interface GameScore {
  id: ID;
  game: ScoreGame;
  who: Player;
  score: number;
  at: string;
}

export type GameId =
  | 'uno'
  | 'c4'
  | 'hangman'
  | 'bowling'
  | 'skeeball'
  | 'darts'
  | 'zeeslag'
  | 'memory'
  | 'hockey';
/** Who can play: the two of us, and Coco. */
export type Player = Person | 'coco';

/** How a game ended, so we (and Coco) can brag about it. */
export interface GameResult {
  id: ID;
  game: GameId;
  players: Player[];
  winner: Player | 'draw';
  at: string;
}

export interface Games {
  matches: GameMatch[];
  scores: GameScore[];
  results: GameResult[];
}

/* -------------------------------------------------------------- star hunt */

/** Stars hidden around the universe, found together: id → when it was found. */
export interface StarHunt {
  found: Record<string, { at: string; by?: Person }>;
  /** The note that opens once every star is found. */
  reward: string;
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
  /** The Spotify song that starts when we open the universe (empty: none). */
  openingSong: string;
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
  her: HerSpace;
  hunt: StarHunt;
  museum: Museum;
  quiz: Quiz;
  games: Games;
  /** Each phone says, after syncing, whether it matched the shared copy (see the Samen-check). */
  syncReports: Partial<Record<Person, SyncReport>>;
  /** Her flower shop: every bouquet he gave her. */
  flowers: Bouquet[];
  /** Arcade prize counter: little promises we make each other, bought with tickets. */
  coupons: Coupon[];
  /** "Ik denk aan je" taps. */
  pings: Ping[];
  /** Answers to the question of the day. */
  daily: DailyAnswer[];
  /** Dates we planned (from an idea), with a countdown and, after, a memory. */
  datePlans: DatePlan[];
}

export interface Bouquet {
  id: ID;
  media?: MediaSource;
  /** YYYY-MM-DD, if we know it. */
  date?: string;
  occasion?: string;
  /** Rozen, tulpen… */
  flowers: string[];
  /** Her own words about it. */
  note?: string;
  /** The little card that came with it (his words). */
  card?: string;
  /** Which vase it stands in on the shelf. */
  vase: number;
  favorite: boolean;
  by?: Person;
  createdAt: string;
}

export interface Coupon {
  id: ID;
  title: string;
  emoji: string;
  /** Tickets it costs. */
  price: number;
  /** Who made it — and will make it happen. It's for the other. */
  from: Person;
  wonAt?: string;
  /** Asked to cash it in. */
  usedAt?: string;
  createdAt: string;
}

export interface Ping {
  id: ID;
  from: Person;
  kind: 'heart' | 'hug' | 'kiss';
  at: string;
}

export interface DailyAnswer {
  /** `${date}:${who}` — one each per day. */
  id: ID;
  date: string;
  who: Person;
  text: string;
  at: string;
}

export interface DatePlan {
  id: ID;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  countdownId?: ID;
  /** The memory we added afterwards. */
  memoryId?: ID;
  /** "Not now" on the after-the-date question. */
  skipped?: boolean;
  by?: Person;
  createdAt: string;
}

export interface SyncReport {
  at: string;
  /** This phone's copy was exactly the server's copy. */
  ok: boolean;
  /** Which version of the app the phone runs. */
  build: string;
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
  /** Soft sound effects when we tap things. */
  sfx: boolean;
  /** Quiet background ambience in some places (bubbles in the spa…). */
  ambience: boolean;
  /** Little notifications on this device when something new arrives. */
  notify: boolean;
  /** While she stays home: the page (and edge) where her hutch is hidden. */
  cocoHome?: { path: string; spot: number };
}
