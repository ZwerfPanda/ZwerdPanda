import { CARE_DAYS_LIMIT, PET_LOG_LIMIT, localDay } from '../../data/normalize';
import type { CocoPet, Person, PetAction, PetFood, PetOutfit, PetTrick } from '../../data/types';
import { durationBetween, parseIsoDate, todayIso, todayUtc, daysUntil } from '../../lib/dates';
import { createId } from '../../lib/id';

/**
 * Everything about looking after digital Coco that isn't drawing: her needs,
 * what each bit of care does, training, growing up. Pure functions, so both
 * phones agree and it's easy to test.
 */

const HOUR = 3_600_000;

/* ------------------------------------------------------------------ food */

export type FoodKind = 'hay' | 'pellets' | 'greens' | 'treat';

export interface FoodInfo {
  label: string;
  kind: FoodKind;
  /** A true, gentle bit of rabbit-care knowledge. */
  fact: string;
}

export const FOODS: Record<PetFood, FoodInfo> = {
  hay: {
    label: 'Vers hooi',
    kind: 'hay',
    fact: 'Hooi is zo’n 80% van wat een konijn eet. Het houdt haar buikje aan de gang en slijt haar altijd doorgroeiende tandjes.',
  },
  pellets: {
    label: 'Een lepeltje korrels',
    kind: 'pellets',
    fact: 'Korrels zijn een klein extraatje, nooit de hoofdmaaltijd — een lepeltje is genoeg voor een dwergkonijn.',
  },
  romaine: {
    label: 'Romaine sla',
    kind: 'greens',
    fact: 'Donkere bladgroenten zoals romaine zijn top. IJsbergsla niet — dat is vooral water.',
  },
  parsley: {
    label: 'Peterselie',
    kind: 'greens',
    fact: 'Verse kruiden zoals peterselie zijn bij veel konijnen favoriet.',
  },
  coriander: {
    label: 'Koriander',
    kind: 'greens',
    fact: 'Koriander is een veilig, lekker kruid voor konijnen — top gemengd met ander groen.',
  },
  basil: {
    label: 'Basilicum',
    kind: 'greens',
    fact: 'Basilicum is een veilig kruid voor konijntjes en ruikt heerlijk voor dat kleine neusje.',
  },
  carrot: {
    label: 'Een plakje wortel',
    kind: 'treat',
    fact: 'Wortels zijn zoet, dus voor konijnen een snoepje — geen dagelijkse kost.',
  },
  apple: {
    label: 'Een stukje appel',
    kind: 'treat',
    fact: 'Appel is prima als klein snoepje — altijd zonder pitjes.',
  },
  banana: {
    label: 'Een dun plakje banaan',
    kind: 'treat',
    fact: 'Banaan zit vol suiker. Een klein stukje is een grote traktatie voor een klein konijntje.',
  },
  strawberry: {
    label: 'Een halve aardbei',
    kind: 'treat',
    fact: 'Aardbeien zijn af en toe een heerlijk snoepje — het groene kroontje mag ook.',
  },
};

export const TREATS_PER_DAY = 2;

/* ----------------------------------------------------------------- tricks */

export interface TrickInfo {
  label: string;
  /** What she does, shown while training. */
  cue: string;
  fact: string;
}

export const TRICKS: Record<PetTrick, TrickInfo> = {
  come: {
    label: 'Komen als je roept',
    cue: 'Roep haar naam en beloon haar als ze komt aanhuppen.',
    fact: 'Konijnen kunnen hun naam leren en komen aanrennen voor een beloning.',
  },
  boop: {
    label: 'Nose boop',
    cue: 'Houd het targetstokje voor — klik als haar neusje het raakt.',
    fact: 'Met het neusje een doel aanraken is hoe de meeste konijnentrucjes beginnen.',
  },
  spin: {
    label: 'Rondje draaien',
    cue: 'Leid haar neusje met een snoepje in een rondje.',
    fact: 'Clickertraining werkt ook bij konijnen: klik precies als ze het goed doet.',
  },
  stand: {
    label: 'Mannetje maken',
    cue: 'Houd de beloning net boven haar kopje.',
    fact: 'Konijnen gaan uit zichzelf op hun achterpootjes staan om rond te kijken — het trucje is dat op commando doen.',
  },
  jump: {
    label: 'Over een hindernis springen',
    cue: 'Moedig haar aan over een klein sprongetje.',
    fact: 'Konijnen-springconcours — “kaninhop” — begon in Zweden.',
  },
};

export const TRICK_ORDER: PetTrick[] = ['come', 'boop', 'spin', 'stand', 'jump'];

/** Progress a training rep earns for a timing between 0 (miss) and 1 (perfect). */
export function trainingGain(quality: number): number {
  if (quality <= 0) return 0;
  return Math.round(4 + Math.min(1, quality) * 8);
}

/* ----------------------------------------------------------------- needs */

export interface Needs {
  /** Greens and pellets. */
  tummy: number;
  /** Fresh hay and water. */
  hay: number;
  /** Cuddles. */
  love: number;
  /** Playtime. */
  play: number;
  /** Brushing. */
  fur: number;
  /** A clean hutch and litter box. */
  clean: number;
}

/** 100 right after `at`, sliding to 0 over `hours`. Never done → 0. */
export function level(at: string | undefined, now: number, hours: number): number {
  if (!at) return 0;
  const since = now - Date.parse(at);
  if (Number.isNaN(since)) return 0;
  return Math.round(Math.max(0, Math.min(100, 100 - (Math.max(0, since) / (hours * HOUR)) * 100)));
}

export function needsOf(pet: CocoPet, now: number): Needs {
  return {
    tummy: level(pet.fedAt, now, 8),
    hay: level(pet.hayAt, now, 24),
    love: level(pet.pettedAt, now, 10),
    play: level(pet.playedAt, now, 14),
    fur: level(pet.groomedAt, now, 24 * 5),
    clean: level(pet.cleanedAt, now, 48),
  };
}

/** How she's doing overall, 0–100. Every need that's all but forgotten weighs on it. */
export function wellbeing(needs: Needs): number {
  const values = Object.values(needs);
  const average = values.reduce((a, b) => a + b, 0) / values.length;
  const forgotten = values.filter((v) => v < 10).length;
  return Math.max(0, Math.round(average - forgotten * 10));
}

/** Rabbits are most awake around dawn and dusk and doze in between. */
export function isNapTime(hour: number): boolean {
  return (hour >= 11 && hour < 16) || hour >= 23 || hour < 4;
}

export type Mood =
  | 'sad'
  | 'hungry'
  | 'lonely'
  | 'bored'
  | 'scruffy'
  | 'messy'
  | 'happy'
  | 'content';

export function moodOf(needs: Needs): Mood {
  if (wellbeing(needs) < 25) return 'sad';
  if (needs.hay < 20 || needs.tummy < 15) return 'hungry';
  if (needs.love < 20) return 'lonely';
  if (needs.play < 20) return 'bored';
  if (needs.clean < 15) return 'messy';
  if (needs.fur < 15) return 'scruffy';
  return wellbeing(needs) >= 65 ? 'happy' : 'content';
}

export const MOOD_LINES: Record<Mood, string> = {
  sad: 'Coco zit stilletjes in een hoekje, met haar oortjes plat. Ze heeft jullie echt nodig.',
  messy: 'Haar hokje ruikt niet zo fris meer. Ze wil een schoon plekje.',
  hungry: 'Coco knabbelt aan een leeg hooirekje. Wat hooi, alsjeblieft?',
  lonely: 'Coco blijft je hand aanstoten. Ze wil knuffels.',
  bored: 'Coco graaft in de vloer. Speeltijd?',
  scruffy: 'Er ligt overal een beetje los haar. Tijd om te borstelen.',
  happy: 'Coco maakt kleine binky’s. Ze is een heel blij konijntje.',
  content: 'Coco ligt lekker als een broodje, met een wiebelend neusje.',
};

/* ------------------------------------------------------------- bond & age */

export const BOND_LEVELS = [
  { min: 0, name: 'Verlegen' },
  { min: 25, name: 'Nieuwsgierig' },
  { min: 80, name: 'Vertrouwd' },
  { min: 180, name: 'Best friends' },
  { min: 350, name: 'Family' },
] as const;

export function bondLevel(bond: number) {
  let index = 0;
  BOND_LEVELS.forEach((l, i) => {
    if (bond >= l.min) index = i;
  });
  const current = BOND_LEVELS[index];
  const next = BOND_LEVELS[index + 1];
  return {
    index,
    name: current.name,
    next: next?.name ?? null,
    progress: next ? (bond - current.min) / (next.min - current.min) : 1,
  };
}

export interface OutfitInfo {
  label: string;
  /** Bond level needed to unlock it. */
  level: number;
}

export const OUTFITS: Record<PetOutfit, OutfitInfo> = {
  none: { label: 'Gewoon Coco', level: 0 },
  bow: { label: 'Strikje in nagelkleur 💅', level: 1 },
  flowers: { label: 'Bloemenkroontje', level: 2 },
  scarf: { label: 'Knus sjaaltje', level: 3 },
  party: { label: 'Feesthoedje', level: 4 },
};

export function outfitUnlocked(outfit: PetOutfit, bond: number, isBirthday: boolean): boolean {
  if (outfit === 'party' && isBirthday) return true;
  return bondLevel(bond).index >= OUTFITS[outfit].level;
}

export type Stage = 'Baby' | 'Jonkie' | 'Puber' | 'Volwassen';

export interface Age {
  label: string;
  stage: Stage;
  /** Drawing scale: she grows a little as she gets older. */
  scale: number;
  months: number;
  isBirthday: boolean;
  daysToBirthday: number;
  turning: number;
}

export function ageOf(birthday: string, today: Date = todayUtc()): Age | null {
  const born = parseIsoDate(birthday);
  if (!born) return null;
  const d = durationBetween(born, today);
  if (!d) return null;
  const months = d.years * 12 + d.months;
  const weeks = Math.floor(d.days / 7);
  const parts: string[] = [];
  if (d.years) parts.push(`${d.years} jaar`);
  if (d.months) parts.push(`${d.months} ${d.months === 1 ? 'maand' : 'maanden'}`);
  if (!d.years && weeks) parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weken'}`);
  if (!parts.length) parts.push(d.totalDays === 0 ? 'vandaag geboren' : `${d.totalDays} dagen`);
  const stage: Stage =
    months < 3 ? 'Baby' : months < 7 ? 'Jonkie' : months < 12 ? 'Puber' : 'Volwassen';
  const scale = { Baby: 0.78, Jonkie: 0.88, Puber: 0.95, Volwassen: 1 }[stage];
  let turning = d.years + 1;
  let next = new Date(
    Date.UTC(born.getUTCFullYear() + turning, born.getUTCMonth(), born.getUTCDate()),
  );
  const isBirthday =
    d.totalDays > 0 &&
    today.getUTCMonth() === born.getUTCMonth() &&
    today.getUTCDate() === born.getUTCDate();
  if (isBirthday) {
    turning = d.years;
    next = today;
  }
  return {
    label: parts.join(', '),
    stage,
    scale,
    months,
    isBirthday,
    daysToBirthday: daysUntil(next, today),
    turning,
  };
}

/* ------------------------------------------------------- what she asks */

export type Ask = keyof Needs | 'treat' | 'trick' | 'activity';

export interface Request {
  /** Same on both phones for the same moment, so a wish is fulfilled once. */
  id: string;
  ask: Ask;
  urgent: boolean;
  text: string;
  /** The button that answers her. */
  cta: string;
}

const ASK_URGENT: Record<keyof Needs, { text: string; cta: string }> = {
  hay: { text: 'Mijn hooirekje is leeg… en mijn waterbakje ook 🥺', cta: 'Hooi & water geven' },
  tummy: { text: 'Ik heb zo’n honger! Mag ik wat groente? 🥬', cta: 'Eten geven' },
  love: { text: 'Ik mis je… aai je me even? 🥺', cta: 'Knuffelen' },
  play: { text: 'Ik verveel me zóóó. Spelen?', cta: 'Spelen' },
  fur: { text: 'Ik zit vol losse haartjes. Borstel je me?', cta: 'Borstelen' },
  clean: { text: 'Mijn hokje is vies… maak je het schoon? 🧹', cta: 'Hok schoonmaken' },
};

const WISHES: { ask: Ask; text: string; cta: string }[] = [
  { ask: 'treat', text: 'Mag ik een snoepje? Eentje maar 🍓', cta: 'Snoepje geven' },
  { ask: 'trick', text: 'Ik wil een nieuw trucje leren! 🎓', cta: 'Trucje oefenen' },
  { ask: 'activity', text: 'Ik wil iets leuks doen vandaag! 🎪', cta: 'Iets leuks doen' },
  { ask: 'love', text: 'Kom je even bij me zitten? ♡', cta: 'Knuffelen' },
  { ask: 'play', text: 'Gooi je mijn balletje? 🎾', cta: 'Spelen' },
];

/** A small, stable number from a string — both phones get the same one. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const ASK_ACTIONS: Record<Ask, PetAction[]> = {
  hay: ['hay'],
  tummy: ['fed'],
  love: ['petted'],
  play: ['played', 'activity'],
  fur: ['groomed'],
  clean: ['cleaned'],
  treat: ['treat'],
  trick: ['trained', 'learned'],
  activity: ['activity'],
};

/**
 * What Coco asks for right now. A need that runs low comes first; when she's
 * well, she has a little wish every few hours — until one of us grants it.
 */
export function requestOf(pet: CocoPet, now: number): Request | null {
  const needs = needsOf(pet, now);
  const lowest = (Object.keys(ASK_URGENT) as (keyof Needs)[])
    .map((k) => [k, needs[k]] as const)
    .sort((a, b) => a[1] - b[1])[0];
  if (lowest[1] < 30) {
    const [ask] = lowest;
    return { id: `need-${ask}`, ask, urgent: true, ...ASK_URGENT[ask] };
  }
  const window = Math.floor(now / (3 * HOUR));
  const wish = WISHES[Math.floor(hash(`wish-${window}`) * WISHES.length)];
  const since = new Date(window * 3 * HOUR).toISOString();
  const granted = pet.log.some((e) => e.at >= since && ASK_ACTIONS[wish.ask].includes(e.action));
  if (granted) return null;
  if (wish.ask === 'treat') {
    const today = todayIso(new Date(now));
    if (pet.treats.date === today && pet.treats.count >= TREATS_PER_DAY) return null;
  }
  if (wish.ask === 'trick' && TRICK_ORDER.every((t) => (pet.tricks[t] ?? 0) >= 100)) return null;
  return { id: `wish-${window}`, ask: wish.ask, urgent: false, text: wish.text, cta: wish.cta };
}

/** Which care answers which ask. */
export function answers(action: Care, ask: Ask): boolean {
  switch (action.type) {
    case 'feed': {
      const kind = FOODS[action.food].kind;
      return (
        (ask === 'hay' && kind === 'hay') ||
        (ask === 'tummy' && (kind === 'greens' || kind === 'pellets')) ||
        (ask === 'treat' && kind === 'treat')
      );
    }
    case 'pet':
      return ask === 'love';
    case 'play':
      return ask === 'play';
    case 'groom':
      return ask === 'fur';
    case 'clean':
      return ask === 'clean';
    case 'train':
      return ask === 'trick';
    case 'activity':
      return ask === 'activity' || ask === 'play';
    default:
      return false;
  }
}

/* ------------------------------------------------------------ upbringing */

export interface Mischief {
  text: string;
  options: { label: string; good: boolean; reply: string }[];
  /** What actually works with rabbits, and why. */
  fact: string;
}

export const MISCHIEF: Mischief[] = [
  {
    text: 'Coco knaagt aan een oplaadkabel! 🔌',
    options: [
      {
        label: 'Kabel weg, knaaghoutje geven',
        good: true,
        reply: 'Ze snuffelt aan het hout… en knaagt daar verder. Goed zo!',
      },
      {
        label: 'Boos “NEE!” roepen',
        good: false,
        reply: 'Ze schrikt en rent weg. Begrijpen doet ze het niet.',
      },
      { label: 'Laten gaan', good: false, reply: 'Krak. Die kabel is stuk… en dat is gevaarlijk.' },
    ],
    fact: 'Knagen is normaal voor konijnen. Kabels wegwerken en iets veiligs aanbieden werkt het best.',
  },
  {
    text: 'Coco graaft een gat in het tapijt.',
    options: [
      {
        label: 'Een graafbak met papiersnippers geven',
        good: true,
        reply: 'Ze duikt erin en graaft als een kampioen. Tapijt gered!',
      },
      {
        label: 'Op haar billen tikken',
        good: false,
        reply: 'Au. Ze vertrouwt je even wat minder.',
      },
      {
        label: 'Tapijt opgeven',
        good: false,
        reply: 'Het gat wordt groter. Ze leert dat het mag.',
      },
    ],
    fact: 'Graven zit in hun natuur. Geef haar een eigen plek waar het wél mag.',
  },
  {
    text: 'Coco plast naast haar bakje 💧',
    options: [
      {
        label: 'Opruimen en wat keutels in de bak leggen',
        good: true,
        reply: 'Ze ruikt het en snapt het: dáár is de wc.',
      },
      {
        label: 'Haar neus erin duwen',
        good: false,
        reply: 'Dat werkt bij konijnen echt niet — ze wordt er alleen bang van.',
      },
      { label: 'Niks doen', good: false, reply: 'De plek blijft ruiken… dus ze doet het weer.' },
    ],
    fact: 'Konijnen zijn makkelijk zindelijk te maken: zet de bak waar ze zelf graag gaat, met hooi erbij.',
  },
  {
    text: 'Coco bijt zachtjes in je sok en trekt eraan 🧦',
    options: [
      {
        label: 'Rustig wegstappen en haar later aaien',
        good: true,
        reply: 'Ze leert: trekken = aandacht weg, rustig = knuffels.',
      },
      {
        label: 'Gillen en springen',
        good: false,
        reply: 'Wow, dat was een spannend spelletje! Nog eens?',
      },
      { label: 'Terugtrekken aan haar', good: false, reply: 'Ze vindt het een wedstrijdje. Oei.' },
    ],
    fact: 'Een zacht beetje is vaak “let op mij!”. Reageer rustig en beloon kalm gedrag.',
  },
  {
    text: 'Coco springt op de bank en wil niet meer weg 🛋️',
    options: [
      {
        label: 'Met een snoepje naar beneden lokken',
        good: true,
        reply: 'Hop, ze springt er netjes af. Wat een slimmerd.',
      },
      {
        label: 'Haar aan haar oren pakken',
        good: false,
        reply: 'Nooit doen! Oren zijn heel gevoelig — til haar altijd met steun onder haar billen.',
      },
      { label: 'Wegduwen', good: false, reply: 'Ze bonkt boos met haar achterpoot. Thump!' },
    ],
    fact: 'Lokken en belonen werkt veel beter dan duwen of trekken.',
  },
  {
    text: 'Coco bonkt hard met haar achterpoot — THUMP!',
    options: [
      {
        label: 'Zacht praten en kijken wat haar liet schrikken',
        good: true,
        reply: 'Het was de stofzuiger. Ze ontspant weer naast je.',
      },
      { label: 'Terug-thumpen', good: false, reply: 'Nu denkt ze dat er écht gevaar is. Paniek!' },
      { label: 'Negeren', good: false, reply: 'Ze blijft gespannen in haar hoekje zitten.' },
    ],
    fact: 'Een thump betekent “gevaar!”. Een rustige stem helpt haar te kalmeren.',
  },
];

export const MANNERS_LEVELS = [
  { min: 0, name: 'Wildebras' },
  { min: 25, name: 'Leert al' },
  { min: 60, name: 'Braaf' },
  { min: 90, name: 'Voorbeeldig' },
] as const;

export function mannersLevel(manners: number) {
  let current: (typeof MANNERS_LEVELS)[number] = MANNERS_LEVELS[0];
  for (const l of MANNERS_LEVELS) if (manners >= l.min) current = l;
  return current.name;
}

/**
 * Now and then (a few times a day for a young wildebras, rarely once she's
 * well brought up) she gets into mischief. Same moment on both phones.
 */
export function mischiefOf(pet: CocoPet, now: number): { id: string; mischief: Mischief } | null {
  const window = Math.floor(now / (5 * HOUR));
  const chance = 0.75 - (pet.manners / 100) * 0.5;
  if (hash(`mischief-${window}`) >= chance) return null;
  const id = `m-${window}`;
  if (pet.handled.includes(id)) return null;
  return { id, mischief: MISCHIEF[Math.floor(hash(`which-${window}`) * MISCHIEF.length)] };
}

/* ------------------------------------------------------------ activities */

export type ActivityId = 'digbox' | 'castle' | 'forage' | 'garden' | 'photo' | 'movie';

export const ACTIVITIES: Record<
  ActivityId,
  { label: string; emoji: string; done: string; fact: string }
> = {
  digbox: {
    label: 'Graafbak met papiersnippers',
    emoji: '🪣',
    done: 'Ze graaft tot alleen haar staartje nog zichtbaar is. Pure blijdschap.',
    fact: 'Graven is natuurlijk gedrag. Een eigen graafbak houdt haar blij (en je tapijt heel).',
  },
  castle: {
    label: 'Kartonnen kasteel bouwen',
    emoji: '🏰',
    done: 'Ze knaagt een eigen raampje en kijkt trots naar buiten. Koningin Coco.',
    fact: 'Onbedrukt karton is veilig om op te knagen en een topspeeltje.',
  },
  forage: {
    label: 'Snoepjes verstoppen in hooi',
    emoji: '🌾',
    done: 'Snuffel snuffel… gevonden! Ze is heel trots op zichzelf.',
    fact: 'Zoeken naar eten (foerageren) houdt konijnen slim en actief.',
  },
  garden: {
    label: 'Rennen in de tuin (met hekje)',
    emoji: '🌷',
    done: 'Zoomies over het gras en drie binky’s op rij!',
    fact: 'Buiten spelen is heerlijk, maar altijd met een hekje en onder toezicht.',
  },
  photo: {
    label: 'Fotoshoot',
    emoji: '📸',
    done: 'Ze poseert als een echt model. Iconic.',
    fact: 'Zonder flits fotograferen — dat is fijner voor haar oogjes.',
  },
  movie: {
    label: 'Samen film kijken op de bank',
    emoji: '🎬',
    done: 'Ze flopt naast je neer en valt halverwege in slaap. Cozy.',
    fact: 'Een flop — opeens op haar zij vallen — betekent dat ze zich helemaal veilig voelt.',
  },
};

export const ACTIVITY_ORDER: ActivityId[] = [
  'digbox',
  'castle',
  'forage',
  'garden',
  'photo',
  'movie',
];

/** Each outing is special: once a day. */
export function activityDoneToday(pet: CocoPet, activity: ActivityId, now: Date): boolean {
  const today = todayIso(now);
  return pet.log.some(
    (e) => e.action === 'activity' && e.detail === activity && todayIso(new Date(e.at)) === today,
  );
}

/* ------------------------------------------------------------------ care */

export type Care =
  | { type: 'feed'; food: PetFood }
  | { type: 'pet' }
  | { type: 'play'; toy: string }
  | { type: 'groom' }
  | { type: 'train'; trick: PetTrick; gain: number }
  | { type: 'outfit'; outfit: PetOutfit }
  | { type: 'clean' }
  | { type: 'activity'; activity: ActivityId }
  | { type: 'raise'; id: string; good: boolean };

export interface CareResult {
  pet: CocoPet;
  /** False when Coco politely declined (full, too many treats…). */
  ok: boolean;
  message: string;
  /** Love earned. */
  bond: number;
  learned?: PetTrick;
  /** She had asked for exactly this. */
  granted?: boolean;
}

function addLog(
  pet: CocoPet,
  action: PetAction,
  detail: string | undefined,
  by: Person,
  at: string,
): CocoPet['log'] {
  const [latest, ...rest] = pet.log;
  // Ten strokes in a row are one cuddle in the diary, not ten.
  if (
    latest &&
    latest.action === action &&
    latest.detail === detail &&
    latest.by === by &&
    Date.parse(at) - Date.parse(latest.at) < 10 * 60_000
  ) {
    return [{ ...latest, at }, ...rest];
  }
  return [{ id: createId('care'), action, detail, by, at }, ...pet.log].slice(0, PET_LOG_LIMIT);
}

/** Today counts for her care streak (dressing up doesn't). */
function addCareDay(pet: CocoPet, at: string): string[] {
  const day = localDay(at);
  if (pet.careDays.includes(day)) return pet.careDays;
  return [...pet.careDays, day].sort().slice(-CARE_DAYS_LIMIT);
}

export function care(pet: CocoPet, action: Care, by: Person, now: Date = new Date()): CareResult {
  const request = requestOf(pet, now.getTime());
  const result = careOnly(pet, action, by, now);
  // Doing exactly what she asked for makes her extra happy.
  if (result.ok && request && answers(action, request.ask)) {
    const extra = request.urgent ? 3 : 4;
    return {
      ...result,
      pet: { ...result.pet, bond: result.pet.bond + extra },
      bond: result.bond + extra,
      granted: true,
      message: `${result.message} Ze is zo blij dat je naar haar luisterde ♡`,
    };
  }
  return result;
}

function careOnly(pet: CocoPet, action: Care, by: Person, now: Date): CareResult {
  const at = now.toISOString();
  const t = now.getTime();
  const needs = needsOf(pet, t);
  const done = (
    next: Partial<CocoPet>,
    log: PetAction,
    detail: string | undefined,
    bond: number,
    message: string,
    learned?: PetTrick,
  ): CareResult => ({
    pet: {
      ...pet,
      ...next,
      bond: pet.bond + bond,
      log: addLog(pet, log, detail, by, at),
      careDays: log === 'outfit' ? pet.careDays : addCareDay(pet, at),
    },
    ok: true,
    message,
    bond,
    learned,
  });
  const decline = (message: string): CareResult => ({ pet, ok: false, message, bond: 0 });

  switch (action.type) {
    case 'feed': {
      const food = FOODS[action.food];
      if (food.kind === 'hay') {
        return done(
          { hayAt: at },
          'hay',
          action.food,
          needs.hay < 80 ? 2 : 0,
          'Vers hooi en water. Krak, krak, krak.',
        );
      }
      if (food.kind === 'treat') {
        const today = todayIso(now);
        const count = pet.treats.date === today ? pet.treats.count : 0;
        if (count >= TREATS_PER_DAY) {
          return decline('Genoeg snoepjes voor vandaag — haar buikje is klein. Hooi mag altijd!');
        }
        return done(
          { treats: { date: today, count: count + 1 } },
          'treat',
          action.food,
          2,
          'Ze pakt het zo voorzichtig… en weg is het.',
        );
      }
      if (needs.tummy > 85) return decline('Coco snuffelt eraan en hupt weg. Ze zit even vol.');
      return done(
        { fedAt: at },
        'fed',
        action.food,
        3,
        food.kind === 'pellets' ? 'Tot de laatste korrel op.' : 'Smikkel smikkel smikkel.',
      );
    }
    case 'pet':
      return done(
        { pettedAt: at },
        'petted',
        undefined,
        needs.love < 80 ? 4 : 1,
        'Zacht tandengeknars — dat is een heel tevreden konijntje.',
      );
    case 'play':
      return done(
        { playedAt: at },
        'played',
        action.toy,
        needs.play < 80 ? 5 : 2,
        'Zoomies! En een binky als afsluiter.',
      );
    case 'groom':
      return done(
        { groomedAt: at },
        'groomed',
        undefined,
        needs.fur < 70 ? 3 : 1,
        'Weer helemaal zacht en glanzend.',
      );
    case 'train': {
      // A hungry or sad bunny doesn't learn tricks; care comes first.
      if (needs.hay < 20 || needs.tummy < 15)
        return decline('Coco heeft honger — eerst eten, dan pas trucjes.');
      if (wellbeing(needs) < 30)
        return decline(
          'Coco heeft nu geen zin in trucjes. Ze heeft eerst wat liefde en zorg nodig.',
        );
      if (action.gain <= 0) return decline('Bijna — probeer te klikken precies als ze het doet.');
      const before = pet.tricks[action.trick] ?? 0;
      if (before >= 100) {
        return done({}, 'trained', action.trick, 1, 'Deze kent ze al! Good girl.');
      }
      const after = Math.min(100, before + action.gain);
      const learned = after >= 100;
      return done(
        { tricks: { ...pet.tricks, [action.trick]: after } },
        learned ? 'learned' : 'trained',
        action.trick,
        learned ? 15 : 2,
        learned
          ? `Coco heeft “${TRICKS[action.trick].label}” geleerd!`
          : 'Klik — snoepje! Ze begint het te snappen.',
        learned ? action.trick : undefined,
      );
    }
    case 'clean':
      return done(
        { cleanedAt: at },
        'cleaned',
        undefined,
        needs.clean < 70 ? 3 : 1,
        'Vers stro, een schone bak. Ze rolt meteen door haar schone hokje.',
      );
    case 'activity': {
      if (activityDoneToday(pet, action.activity, now))
        return decline('Dat hebben jullie vandaag al gedaan — morgen weer!');
      return done(
        { playedAt: at, pettedAt: at },
        'activity',
        action.activity,
        6,
        ACTIVITIES[action.activity].done,
      );
    }
    case 'raise': {
      if (pet.handled.includes(action.id)) return decline('Dat is al opgelost ♡');
      const handled = [...pet.handled, action.id].slice(-40);
      return action.good
        ? done(
            { handled, manners: Math.min(100, pet.manners + 8) },
            'raised',
            'good',
            3,
            'Goed opgevoed! Ze leert er echt van.',
          )
        : {
            pet: {
              ...pet,
              handled,
              bond: Math.max(0, pet.bond - 2),
              log: addLog(pet, 'raised', 'oops', by, at),
              careDays: addCareDay(pet, at),
            },
            ok: true,
            message: 'Oei. Daar schrok ze van — ze vertrouwt je even wat minder.',
            bond: 0,
          };
    }
    case 'outfit':
      return done(
        { outfit: action.outfit },
        'outfit',
        action.outfit,
        0,
        action.outfit === 'none'
          ? 'Gewoon Coco. Perfect zoals ze is.'
          : `${OUTFITS[action.outfit].label} aan!`,
      );
  }
}

/** One line for the care diary. */
export function describeCare(entry: CocoPet['log'][number]): string {
  const food = entry.detail && entry.detail in FOODS ? FOODS[entry.detail as PetFood].label : '';
  switch (entry.action) {
    case 'fed':
      return `gaf haar ${food.toLowerCase() || 'eten'}`;
    case 'treat':
      return `gaf haar een snoepje (${food.toLowerCase() || 'iets zoets'})`;
    case 'hay':
      return 'vulde haar hooi en water bij';
    case 'petted':
      return 'gaf haar knuffels';
    case 'played':
      return entry.detail ? `speelde ${entry.detail} met haar` : 'speelde met haar';
    case 'groomed':
      return 'borstelde haar vacht';
    case 'trained':
      return `oefende “${entry.detail && entry.detail in TRICKS ? TRICKS[entry.detail as PetTrick].label : 'een trucje'}”`;
    case 'learned':
      return `leerde haar “${entry.detail && entry.detail in TRICKS ? TRICKS[entry.detail as PetTrick].label : 'een trucje'}”`;
    case 'cleaned':
      return 'maakte haar hokje schoon';
    case 'raised':
      return entry.detail === 'good' ? 'voedde haar lief en goed op' : 'schrok haar een beetje af';
    case 'activity':
      return entry.detail && entry.detail in ACTIVITIES
        ? `deed iets leuks: ${ACTIVITIES[entry.detail as ActivityId].label.toLowerCase()}`
        : 'deed iets leuks met haar';
    case 'outfit':
      return entry.detail === 'none'
        ? 'deed haar outfit uit'
        : `deed haar ${entry.detail && entry.detail in OUTFITS ? OUTFITS[entry.detail as PetOutfit].label.toLowerCase() : 'een outfit'} aan`;
  }
}

/** Short, true rabbit facts shown around Coco's den. */
export const BUNNY_FACTS = [
  'Een “binky” is een blij sprongetje met een draai in de lucht.',
  'Een “flop” — opeens op haar zij vallen — betekent dat ze zich helemaal veilig voelt.',
  'Zacht tandengeknars terwijl je haar aait betekent dat ze tevreden is.',
  'Een harde thump met een achterpoot betekent “er klopt iets niet!”',
  'Konijnen zijn het wakkerst rond zonsopgang en schemering — dat heet schemeractief.',
  'De tandjes van een konijn groeien altijd door, daarom is hooi zo belangrijk.',
  'De meeste konijnen houden van aaitjes op hun voorhoofd en wangen, maar niet aan hun pootjes of buik.',
  'Dwergkonijnen zijn meestal volgroeid rond 6 tot 8 maanden.',
  'Huiskonijnen worden vaak 8 tot 12 jaar.',
  'Met hun kin langs iets wrijven is hoe konijnen zeggen “dit is van mij” — jij ook.',
];
