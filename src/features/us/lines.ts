import type { AppContent, Person } from '../../data/types';

/**
 * What our minis say. Built only from things that are really ours: the names
 * we call each other, our own memories, chapters and dreams, the lines we
 * teach them, and the little facts we wrote down (matcha with extra syrup,
 * bubble tea, the arcade, karaoke, the train to The Hague, Coco, her laugh).
 */

export type Rng = () => number;
const pick = <T>(list: T[], rng: Rng): T => list[Math.floor(rng() * list.length) % list.length];

/** A name `from` uses for the other one — earlier in our list means used more often. */
export function petNameFor(content: AppContent, from: Person, rng: Rng): string {
  const names = content.us.petNames.filter((p) => p.from === from || p.from === 'both');
  if (!names.length) return from === 'you' ? content.profile.partnerName : content.profile.yourName;
  // Weighted towards the top of the list.
  const weights = names.map((_, i) => 1 / (i + 1.5));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < names.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return names[i].name;
  }
  return names[0].name;
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const SWEET: Record<Person, string[]> = {
  you: [
    'Hey {pet}. Just wanted to say hi.',
    '{Pet}, did I tell you I love your laugh?',
    'Matcha soon, {pet}? Vanilla, extra syrup — I know.',
    'I’d take the train and the metro all over again for you, {pet}.',
    '{Pet}, Coco says hi. (Okay, I say hi.)',
    'You look so good today, {pet}.',
    'Proud of you, {pet}. Always.',
    'Come here, {pet}. Hug. Now.',
  ],
  partner: [
    'Hi {pet} ♡',
    '{Pet}, hold my Stanley for a sec?',
    'You’re so tall, {pet}. I need a ladder to kiss you.',
    'Arcade rematch, {pet}? I’m winning this time.',
    'Karaoke tonight, {pet}?',
    'Bubble tea run, {pet}?',
    '{Pet}, you’re mine. Just so you know.',
    'Miss you already, {pet}.',
  ],
};

const REPLIES: Record<Person, string[]> = {
  you: [
    'Always, {pet}.',
    'Anything for you, {pet}.',
    'Say less, {pet}.',
    'You know I’m in, {pet}.',
  ],
  partner: [
    'Yesss {pet} ♡',
    'Okay but you’re paying, {pet}.',
    'Only if you hold my bag, {pet}.',
    'Deal, {pet}.',
  ],
};

const DATE_IDEAS = [
  'a matcha and bubble tea crawl',
  'an arcade battle — loser buys snacks',
  'a karaoke duet, loudly',
  'a mall day with mirror selfies in every fitting room',
  'the train to The Hague, just because',
  'a movie night with Coco on the couch',
  'a picnic with way too many snacks',
  'trying on silly hats and sunglasses',
];

function fill(template: string, pet: string) {
  return template.replace('{pet}', pet).replace('{Pet}', capital(pet));
}

export interface Exchange {
  who: Person;
  text: string;
}

const other = (p: Person): Person => (p === 'you' ? 'partner' : 'you');

/** One line when you tap someone. */
export function sayHi(content: AppContent, who: Person, rng: Rng): Exchange {
  const taught = content.us[who].lines;
  if (taught.length && rng() < 0.4) return { who, text: pick(taught, rng) };
  return { who, text: fill(pick(SWEET[who], rng), petNameFor(content, who, rng)) };
}

/** A date idea and the answer: from our own date dreams first. */
export function dateIdea(content: AppContent, starter: Person, rng: Rng): Exchange[] {
  const ours = content.dreams
    .filter((d) => d.status !== 'done' && (d.category === 'dates' || d.someday))
    .map((d) => d.title.charAt(0).toLowerCase() + d.title.slice(1));
  const idea = ours.length && rng() < 0.6 ? pick(ours, rng) : pick(DATE_IDEAS, rng);
  return [
    { who: starter, text: fill(`Date idea, {pet}: ${idea}?`, petNameFor(content, starter, rng)) },
    {
      who: other(starter),
      text: fill(pick(REPLIES[other(starter)], rng), petNameFor(content, other(starter), rng)),
    },
  ];
}

/** Remembering one of our own memories or chapters. */
export function rememberWhen(content: AppContent, starter: Person, rng: Rng): Exchange[] {
  const own = [
    ...content.memories.filter((m) => !m.isSample && m.caption.trim()).map((m) => m.caption.trim()),
    ...content.milestones.filter((m) => !m.isSample && !m.future).map((m) => m.title.trim()),
  ];
  const pool = own.length
    ? own
    : [
        ...content.memories.filter((m) => m.caption.trim()).map((m) => m.caption.trim()),
        ...content.milestones.filter((m) => !m.future).map((m) => m.title.trim()),
      ];
  if (!pool.length) {
    return [{ who: starter, text: 'Let’s make a memory today. Then I’ll remember it forever.' }];
  }
  const memory = pick(pool, rng);
  const replies = [
    'I think about that one a lot.',
    'One of my favourites. Again soon?',
    'Stop, I’m smiling again.',
    'Best day. Or one of them.',
  ];
  return [
    { who: starter, text: fill(`Remember “${memory}”, {pet}?`, petNameFor(content, starter, rng)) },
    { who: other(starter), text: pick(replies, rng) },
  ];
}

/** Both of them say something sweet. */
export function sweetTalk(content: AppContent, starter: Person, rng: Rng): Exchange[] {
  const first = sayHi(content, starter, rng);
  return [
    first,
    {
      who: other(starter),
      text: fill(pick(REPLIES[other(starter)], rng), petNameFor(content, other(starter), rng)),
    },
  ];
}

/** Age in whole years on `today` (YYYY-MM-DD dates). */
export function ageOn(birthday: string, today: string): number | null {
  const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!b || !t) return null;
  let age = Number(t[1]) - Number(b[1]);
  if (t[2] < b[2] || (t[2] === b[2] && t[3] < b[3])) age -= 1;
  return age >= 0 ? age : null;
}

export type MomentKind = 'hug' | 'kiss' | 'heart' | 'selfie' | 'highfive' | 'wave';

const MOMENT_LINES: Record<MomentKind, [string[], string[]]> = {
  hug: [
    ['Come here, {pet}.', 'Hug. Now, {pet}.', 'I missed you, {pet}.'],
    ['Five more minutes.', 'Don’t let go yet.', 'My favourite place.'],
  ],
  kiss: [
    ['A forehead kiss for you, {pet}.', 'Hold still, {pet}.'],
    ['♡', 'Again.', 'Okay, I’m melting.'],
  ],
  heart: [
    ['Love you, {pet}.', 'You and me, {pet}.'],
    ['Love you more.', 'Always ♡'],
  ],
  selfie: [
    ['Mirror selfie, {pet}! Peace ✌', 'Pose, {pet}! For the album.'],
    ['One more, I blinked.', 'Okay, that one’s cute.'],
  ],
  highfive: [
    ['Team us, {pet}!', 'We did that, {pet}.'],
    ['Obviously.', 'Best team.'],
  ],
  wave: [
    ['Hiii {pet}!', 'There you are, {pet}.'],
    ['Hi you ♡', 'Hey {pet}.'],
  ],
};

/** What they say during a little moment together. */
export function momentLines(
  content: AppContent,
  kind: MomentKind,
  starter: Person,
  rng: Rng,
): Exchange[] {
  const [first, second] = MOMENT_LINES[kind];
  const answer = other(starter);
  return [
    { who: starter, text: fill(pick(first, rng), petNameFor(content, starter, rng)) },
    { who: answer, text: fill(pick(second, rng), petNameFor(content, answer, rng)) },
  ];
}
