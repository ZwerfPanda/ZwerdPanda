import { PET_LOG_LIMIT } from '../../data/normalize';
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
  };
}

/** Rabbits are most awake around dawn and dusk and doze in between. */
export function isNapTime(hour: number): boolean {
  return (hour >= 11 && hour < 16) || hour >= 23 || hour < 4;
}

export type Mood = 'hungry' | 'lonely' | 'bored' | 'scruffy' | 'happy' | 'content';

export function moodOf(needs: Needs): Mood {
  if (needs.hay < 20 || needs.tummy < 15) return 'hungry';
  if (needs.love < 20) return 'lonely';
  if (needs.play < 20) return 'bored';
  if (needs.fur < 15) return 'scruffy';
  const average = (needs.tummy + needs.hay + needs.love + needs.play + needs.fur) / 5;
  return average >= 65 ? 'happy' : 'content';
}

export const MOOD_LINES: Record<Mood, string> = {
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
  bow: { label: 'Roze strikje', level: 1 },
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

/* ------------------------------------------------------------------ care */

export type Care =
  | { type: 'feed'; food: PetFood }
  | { type: 'pet' }
  | { type: 'play'; toy: string }
  | { type: 'groom' }
  | { type: 'train'; trick: PetTrick; gain: number }
  | { type: 'outfit'; outfit: PetOutfit };

export interface CareResult {
  pet: CocoPet;
  /** False when Coco politely declined (full, too many treats…). */
  ok: boolean;
  message: string;
  /** Love earned. */
  bond: number;
  learned?: PetTrick;
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

export function care(pet: CocoPet, action: Care, by: Person, now: Date = new Date()): CareResult {
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
    pet: { ...pet, ...next, bond: pet.bond + bond, log: addLog(pet, log, detail, by, at) },
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
