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
    label: 'Fresh hay',
    kind: 'hay',
    fact: 'Hay is about 80% of what a rabbit eats. It keeps her tummy moving and her ever-growing teeth worn down.',
  },
  pellets: {
    label: 'A little spoon of pellets',
    kind: 'pellets',
    fact: 'Pellets are a small extra, never the main meal — a spoonful is plenty for a dwarf rabbit.',
  },
  romaine: {
    label: 'Romaine lettuce',
    kind: 'greens',
    fact: 'Dark leafy greens like romaine are great. Iceberg lettuce isn’t — it’s mostly water.',
  },
  parsley: {
    label: 'Parsley',
    kind: 'greens',
    fact: 'Fresh herbs like parsley are a favourite with lots of rabbits.',
  },
  coriander: {
    label: 'Coriander',
    kind: 'greens',
    fact: 'Coriander is a safe, tasty herb for rabbits — great mixed with other greens.',
  },
  basil: {
    label: 'Basil',
    kind: 'greens',
    fact: 'Basil is a safe herb for bunnies and smells amazing to that little nose.',
  },
  carrot: {
    label: 'A slice of carrot',
    kind: 'treat',
    fact: 'Carrots are sweet, so for rabbits they’re a treat — not an everyday food.',
  },
  apple: {
    label: 'A bit of apple',
    kind: 'treat',
    fact: 'Apple is fine as a small treat — always without the seeds.',
  },
  banana: {
    label: 'A thin slice of banana',
    kind: 'treat',
    fact: 'Banana is very sugary. A tiny piece is a big treat for a small bunny.',
  },
  strawberry: {
    label: 'Half a strawberry',
    kind: 'treat',
    fact: 'Strawberries are a lovely treat now and then — the green top is fine too.',
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
    label: 'Come when called',
    cue: 'Call her name and reward her when she hops over.',
    fact: 'Rabbits can learn their name and come running for a reward.',
  },
  boop: {
    label: 'Nose boop',
    cue: 'Hold out the target stick — click when her nose touches it.',
    fact: 'Touching a target with the nose is how most rabbit tricks start.',
  },
  spin: {
    label: 'Spin around',
    cue: 'Lead her nose in a circle with a treat.',
    fact: 'Clicker training works for rabbits too: click the moment she does it right.',
  },
  stand: {
    label: 'Stand up tall',
    cue: 'Hold the reward just above her head.',
    fact: 'Rabbits stand on their back legs naturally to look around — the trick is doing it on cue.',
  },
  jump: {
    label: 'Hop over a hurdle',
    cue: 'Encourage her over a tiny jump.',
    fact: 'Rabbit show jumping — “kaninhop” — started in Sweden.',
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
  hungry: 'Coco is nibbling at an empty hay rack. Some hay, please?',
  lonely: 'Coco keeps nudging your hand. She wants cuddles.',
  bored: 'Coco is digging at the floor. Playtime?',
  scruffy: 'There’s a bit of loose fur everywhere. Time for a brush.',
  happy: 'Coco is doing little binkies. She’s a very happy bunny.',
  content: 'Coco is loafing comfortably, nose twitching.',
};

/* ------------------------------------------------------------- bond & age */

export const BOND_LEVELS = [
  { min: 0, name: 'Shy' },
  { min: 25, name: 'Curious' },
  { min: 80, name: 'Trusting' },
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
  none: { label: 'Just Coco', level: 0 },
  bow: { label: 'Pink bow', level: 1 },
  flowers: { label: 'Flower crown', level: 2 },
  scarf: { label: 'Cosy scarf', level: 3 },
  party: { label: 'Party hat', level: 4 },
};

export function outfitUnlocked(outfit: PetOutfit, bond: number, isBirthday: boolean): boolean {
  if (outfit === 'party' && isBirthday) return true;
  return bondLevel(bond).index >= OUTFITS[outfit].level;
}

export type Stage = 'Baby' | 'Youngster' | 'Teen' | 'Grown-up';

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
  if (d.years) parts.push(`${d.years} ${d.years === 1 ? 'year' : 'years'}`);
  if (d.months) parts.push(`${d.months} ${d.months === 1 ? 'month' : 'months'}`);
  if (!d.years && weeks) parts.push(`${weeks} ${weeks === 1 ? 'week' : 'weeks'}`);
  if (!parts.length) parts.push(d.totalDays === 0 ? 'born today' : `${d.totalDays} days`);
  const stage: Stage =
    months < 3 ? 'Baby' : months < 7 ? 'Youngster' : months < 12 ? 'Teen' : 'Grown-up';
  const scale = { Baby: 0.78, Youngster: 0.88, Teen: 0.95, 'Grown-up': 1 }[stage];
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
          'Fresh hay and water. Crunch, crunch, crunch.',
        );
      }
      if (food.kind === 'treat') {
        const today = todayIso(now);
        const count = pet.treats.date === today ? pet.treats.count : 0;
        if (count >= TREATS_PER_DAY) {
          return decline(
            'That’s enough treats for today — her tummy is small. Hay is always okay!',
          );
        }
        return done(
          { treats: { date: today, count: count + 1 } },
          'treat',
          action.food,
          2,
          'She takes it so gently… and it’s gone.',
        );
      }
      if (needs.tummy > 85) return decline('Coco sniffs it and hops away. She’s full for now.');
      return done(
        { fedAt: at },
        'fed',
        action.food,
        3,
        food.kind === 'pellets' ? 'Every last pellet, gone.' : 'Munch munch munch.',
      );
    }
    case 'pet':
      return done(
        { pettedAt: at },
        'petted',
        undefined,
        needs.love < 80 ? 4 : 1,
        'A soft tooth purr — that’s a very content bunny.',
      );
    case 'play':
      return done(
        { playedAt: at },
        'played',
        action.toy,
        needs.play < 80 ? 5 : 2,
        'Zoomies! And a binky to finish.',
      );
    case 'groom':
      return done(
        { groomedAt: at },
        'groomed',
        undefined,
        needs.fur < 70 ? 3 : 1,
        'All soft and shiny again.',
      );
    case 'train': {
      if (action.gain <= 0) return decline('Almost — try clicking right as she does it.');
      const before = pet.tricks[action.trick] ?? 0;
      if (before >= 100) {
        return done({}, 'trained', action.trick, 1, 'She knows this one! Good girl.');
      }
      const after = Math.min(100, before + action.gain);
      const learned = after >= 100;
      return done(
        { tricks: { ...pet.tricks, [action.trick]: after } },
        learned ? 'learned' : 'trained',
        action.trick,
        learned ? 15 : 2,
        learned
          ? `Coco learned “${TRICKS[action.trick].label}”!`
          : 'Click — treat! She’s getting it.',
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
          ? 'Just Coco. Perfect as she is.'
          : `${OUTFITS[action.outfit].label} on!`,
      );
  }
}

/** One line for the care diary. */
export function describeCare(entry: CocoPet['log'][number]): string {
  const food = entry.detail && entry.detail in FOODS ? FOODS[entry.detail as PetFood].label : '';
  switch (entry.action) {
    case 'fed':
      return `gave her ${food.toLowerCase() || 'a meal'}`;
    case 'treat':
      return `gave her a treat (${food.toLowerCase() || 'something sweet'})`;
    case 'hay':
      return 'topped up her hay and water';
    case 'petted':
      return 'gave her cuddles';
    case 'played':
      return entry.detail ? `played ${entry.detail} with her` : 'played with her';
    case 'groomed':
      return 'brushed her fur';
    case 'trained':
      return `practised “${entry.detail && entry.detail in TRICKS ? TRICKS[entry.detail as PetTrick].label : 'a trick'}”`;
    case 'learned':
      return `taught her “${entry.detail && entry.detail in TRICKS ? TRICKS[entry.detail as PetTrick].label : 'a trick'}”`;
    case 'outfit':
      return entry.detail === 'none'
        ? 'took off her outfit'
        : `dressed her in the ${entry.detail && entry.detail in OUTFITS ? OUTFITS[entry.detail as PetOutfit].label.toLowerCase() : 'outfit'}`;
  }
}

/** Short, true rabbit facts shown around Coco's den. */
export const BUNNY_FACTS = [
  'A “binky” is a happy jump with a twist in mid-air.',
  'A “flop” — suddenly falling onto her side — means she feels completely safe.',
  'A soft teeth-grinding “purr” while being stroked means she’s content.',
  'A loud thump with a back foot means “something’s not right!”',
  'Rabbits are most awake around dawn and dusk — that’s called crepuscular.',
  'A rabbit’s teeth never stop growing, which is why hay matters so much.',
  'Most rabbits love forehead and cheek strokes, but not their feet or belly being touched.',
  'Dwarf rabbits are usually fully grown at around 6 to 8 months.',
  'Pet rabbits often live 8 to 12 years.',
  'Chin rubbing is how rabbits say “this is mine” — including you.',
];
