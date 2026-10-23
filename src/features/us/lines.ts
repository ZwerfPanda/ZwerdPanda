import type { AppContent, Person } from '../../data/types';
import { gameBrag } from '../games/gameStats';

/**
 * What our minis say. Built only from things that are really ours: the names
 * we call each other, our own memories, chapters and dreams, the lines we
 * teach them, and the little facts we wrote down (matcha with extra syrup,
 * jasmine bubble tea with tapioca, lots of sugar and little ice, the arcade, karaoke, the train to The Hague, Coco, her laugh).
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
    'Hey {pet}. Wilde gewoon even hoi zeggen.',
    '{Pet}, heb ik al gezegd dat ik je lach zo mooi vind?',
    'Matcha binnenkort, {pet}? Vanilla, extra siroop — I know.',
    'Jasmijn bubble tea met tapioca, {pet}? Veel suiker, weinig ijs — ik weet het 🧋',
    'Ik zou die trein en metro zo weer voor je pakken, {pet}.',
    '{Pet}, Coco zegt hoi. (Oké, ík zeg hoi.)',
    'Je ziet er zo mooi uit vandaag, {pet}.',
    'Proud of you, {pet}. Altijd.',
    'Kom hier, {pet}. Knuffel. Nu.',
  ],
  partner: [
    'Hi {pet} ♡',
    '{Pet}, hou je mijn Stanley even vast?',
    'Je bent zó lang, {pet}. Ik heb een trapje nodig om je te kussen.',
    'Arcade rematch, {pet}? Deze keer win ik.',
    'Karaoke vanavond, {pet}?',
    'Bubble tea halen, {pet}? Jasmijn, veel suiker, weinig ijs 🧋',
    '{Pet}, je bent van mij. Just so you know.',
    'Ik mis je nu al, {pet}.',
  ],
};

const REPLIES: Record<Person, string[]> = {
  you: [
    'Altijd, {pet}.',
    'Alles voor jou, {pet}.',
    'Say less, {pet}.',
    'Je weet dat ik erbij ben, {pet}.',
  ],
  partner: [
    'Yesss {pet} ♡',
    'Oké, maar jij betaalt, {pet}.',
    'Alleen als jij mijn tas draagt, {pet}.',
    'Deal, {pet}.',
  ],
};

export const DATE_IDEAS = [
  'een matcha- en bubble tea-tour',
  'een arcade battle — de verliezer trakteert op snacks',
  'een karaoke-duet, keihard',
  'een shopdag met spiegelselfies in elke paskamer',
  'de trein naar Den Haag, gewoon omdat het kan',
  'een movie night met Coco op de bank',
  'een picknick met veel te veel snacks',
  'gekke hoedjes en zonnebrillen passen',
  'samen pannenkoeken bakken (en ze proberen om te gooien)',
  'een fotowandeling door de stad, alleen maar foto’s van elkaar',
  'een avond bordspellen met veel te veel snacks',
  'de zonsondergang kijken op het strand',
  'samen een nieuw recept koken dat we nog nooit gemaakt hebben',
  'een museumdate met een eigen audiotour van elkaar',
  'jasmijn bubble tea halen — veel suiker, weinig ijs',
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
  // Now and then, a little bragging about the arcade (only by whoever leads).
  if (rng() < 0.2) {
    const brag = gameBrag(content, rng);
    if (brag && brag.leader === who)
      return { who, text: fill(brag.text, petNameFor(content, who, rng)) };
  }
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
    { who: starter, text: fill(`Date-idee, {pet}: ${idea}?`, petNameFor(content, starter, rng)) },
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
    return [
      { who: starter, text: 'Laten we vandaag een herinnering maken. Dan onthoud ik hem forever.' },
    ];
  }
  const memory = pick(pool, rng);
  const replies = [
    'Daar denk ik nog vaak aan.',
    'Een van mijn favorieten. Snel weer?',
    'Stop, ik zit alweer te lachen.',
    'Best day ever. Of een van de besten.',
  ];
  return [
    {
      who: starter,
      text: fill(`Weet je nog, “${memory}”, {pet}?`, petNameFor(content, starter, rng)),
    },
    { who: other(starter), text: pick(replies, rng) },
  ];
}

/** Teasing each other about the arcade: who's the UNO queen. */
export function gameTalk(content: AppContent, starter: Person, rng: Rng): Exchange[] {
  const brag = gameBrag(content, rng);
  if (!brag) {
    return [
      {
        who: starter,
        text: fill(
          'Potje in de Arcade Hall, {pet}? De verliezer trakteert.',
          petNameFor(content, starter, rng),
        ),
      },
      {
        who: other(starter),
        text: fill('Deal. Maar ik ga winnen, {pet}.', petNameFor(content, other(starter), rng)),
      },
    ];
  }
  return [
    { who: brag.leader, text: fill(brag.text, petNameFor(content, brag.leader, rng)) },
    {
      who: other(brag.leader),
      text: fill(brag.reply, petNameFor(content, other(brag.leader), rng)),
    },
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

export type MomentKind = 'hug' | 'kiss' | 'heart' | 'selfie' | 'highfive' | 'wave' | 'twirl';

const MOMENT_LINES: Record<MomentKind, [string[], string[]]> = {
  hug: [
    ['Kom hier, {pet}.', 'Knuffel. Nu, {pet}.', 'Ik heb je gemist, {pet}.'],
    ['Nog vijf minuutjes.', 'Nog niet loslaten.', 'Mijn favoriete plekje.'],
  ],
  kiss: [
    ['Een kusje op je voorhoofd, {pet}.', 'Even stilstaan, {pet}.'],
    ['♡', 'Nog een keer.', 'Oké, ik smelt.'],
  ],
  heart: [
    ['Love you, {pet}.', 'Jij en ik, {pet}.'],
    ['Love you more.', 'Altijd ♡'],
  ],
  selfie: [
    ['Spiegelselfie, {pet}! Peace ✌', 'Pose, {pet}! Voor het album.'],
    ['Nog eentje, ik knipperde.', 'Oké, die is cute.'],
  ],
  highfive: [
    ['Team us, {pet}!', 'Dat hebben we geflikt, {pet}.'],
    ['Obviously.', 'Beste team.'],
  ],
  twirl: [
    ['Draai voor me, {pet}.', 'Eén rondje, {pet}. Go!'],
    ['Wieee!', 'Nog een keer, nog een keer!', 'Ik ben duizelig. Vang me.'],
  ],
  wave: [
    ['Hoiii {pet}!', 'Daar ben je, {pet}.'],
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
