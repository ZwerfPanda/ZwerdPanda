import type { AppContent } from './types';
import { createDefaultContent } from './defaults';

/**
 * The starter texts as they first shipped, in English, before the site
 * became Dutch. A device that still holds one of them unchanged gets the
 * Dutch version; anything we wrote or edited ourselves is left alone.
 */
const ENGLISH = {
  profile: {
    subtitle: 'A little world that belongs to us.',
    homeMessage:
      "I made this little place for us. For the memories we already have, the ones we're still figuring out, and everything we haven't done yet.\n\nIt isn't perfect — neither are we — but it's ours. Look around, take your time, and open whatever makes you curious.",
    signature: 'Made with love by Valencio',
  },
  albums: {
    'album-dates': 'Our dates',
    'album-silly': 'Silly moments',
    'album-her': 'Her',
    'album-us': 'Us',
    'album-adventures': 'Our adventures',
    'album-everyday': 'Little everyday moments',
    'album-coco': 'Coco',
    'album-future': 'Future memories',
  },
  reasons: [
    'Your laugh. Honestly, it might be my favourite sound.',
    'How completely, unapologetically yourself you are.',
    'That you order vanilla matcha with extra syrup like it’s a personality trait.',
    'How funny you are without even trying.',
    'The way you look after Coco.',
    'Your nails. Every set is a tiny piece of art.',
    'That we can argue and still find our way back to each other.',
    "That you're still growing — and you let me grow with you.",
    'How you dream about the future — the home, the family, all of it.',
    'All the little things about you that nobody else has.',
  ],
  giftMessage:
    'Nothing in here except a reminder: you are very, very loved. On the good days, the hard days, and all the in-between ones.',
  stars: {
    'star-1': 'The first time I heard you laugh.',
    'star-2': 'Train rides that ended with you.',
    'star-3': 'Vanilla matcha, extra syrup.',
    'star-4': 'Karaoke, loudly.',
    'star-5': 'Picking you up in my own car.',
    'star-6': 'Coco, our tiny chaos.',
    'star-7': 'Everything we haven’t done yet.',
  },
  secretNote: 'Psst. You found the back of the photo. I hope you know how much I like you.',
  hiddenHeartNote:
    'You found a hidden heart. There are a few of these around our universe — no rush, no score. Just little hellos.',
  facts: {
    'fact-species': ['Species', 'Dwarf rabbit'],
    'fact-humans': ['Humans', 'Valencio & Shenaya'],
    'fact-snack': ['Favourite snack', ''],
    'fact-known': ['Known for', ''],
    'fact-home': ['Gotcha day', ''],
  },
  coat: 'Black with a grey undertone and white paws',
  welcome:
    'I made this little universe for us. Everything in here is ours — our story, our places, our letters and our plans. Look around, add to it, and make yourself at home.',
  lists: {
    'list-baby-names': 'Baby names we love',
  },
};

/**
 * Museum stops as they first read, about her rather than to her. Unchanged
 * ones get the new words; anything we rewrote ourselves stays.
 */
const STOPS_V1: Record<string, { story: string; place?: string; details: string[] }> = {
  'stop-home': {
    story:
      'Waar elke reis naar haar begon. Hier stapte ik de deur uit om naar Den Haag te gaan — en hier kwam ik pas diep in de nacht weer thuis.',
    place: 'Amsterdam',
    details: ['Vertrekpunt van elke reis naar haar'],
  },
  'stop-den-haag-cs': {
    story:
      'Hier vergaten we per ongeluk de dodenherdenking. Het hele station viel stil… en wij bleven gewoon doorpraten. Iedereen keek ons aan. Awkwarddd — maar eerlijk? Ook wel romantisch.',
    place: 'Den Haag',
    details: ['Twee minuten stilte, behalve bij ons', 'Iedereen keek ons aan 🙈'],
  },
  'stop-moerwijk': {
    story:
      'Haar thuisstation. Hier kwam ik haar altijd ophalen. Ik was er vroeg, ging pas laat in de avond weer weg, en kwam zelf pas in de nacht thuis.',
    place: 'Haar thuisstation',
    details: ['Vroeg aankomen', 'Laat in de avond weer weg', 'Pas in de nacht thuis'],
  },
  'stop-sisi': {
    story: 'Onze bubble tea-plek. Zij neemt altijd hetzelfde.',
    place: 'Bubble tea',
    details: ['Haar order: jasmine bubble tea met tapioca-balletjes'],
  },
  'stop-westfield': {
    story: 'Onze eerste date — en daarna kwamen we er nog heel vaak terug.',
    place: 'Leidschendam',
    details: [
      'Een mooie Pandora-ring voor haar gekocht',
      'New Balance-schoenen',
      'Kleren shoppen',
      'Karaoke met mijn moeder en zus',
      'Twee keer naar de arcadehal',
      'Mijn eerste cadeautje van haar uitgepakt',
      'Onze eerste kus, bij de matchawinkel',
      'Altijd even naar de matchawinkel',
      'Kippie: zij een broodje kipkroket, ik gehaktballen of kippenbouten en -vleugels',
      'Kruidvat voor make-up, Action voor random spulletjes',
    ],
  },
  'stop-juicy': {
    story: 'Zij wil hier altijd hetzelfde: de creamy pasta pesto.',
    place: 'Onze eetplek',
    details: ['Haar vaste keuze: creamy pasta pesto'],
  },
  'stop-walibi-holland': {
    story:
      'Een romantisch, gezellig dagje samen. De zon was heel fel en op het laatst voelde ze zich niet zo lekker — maar het is goed gekomen.',
    place: 'Biddinghuizen',
    details: [
      'De grootste knuffel van het park voor haar gewonnen, met basketbal',
      'Romantisch samen in het reuzenrad',
      'Veel enge achtbanen, waar zij bang voor was',
    ],
  },
  'stop-walibi-belgium': {
    story:
      'Met haar broertje en haar moeder — een superleuke dag vol unieke attracties en achtbanen. Op de terugweg lag iedereen te slapen, terwijl ik ze veilig naar huis reed.',
    place: 'Waver, België',
    details: [
      'Unieke attracties en achtbanen',
      'Iedereen sliep, ik reed ons veilig naar huis',
      'Ooit gaan we hier met z’n tweetjes heen',
    ],
  },
  'stop-pathe': {
    story: 'We zagen de Michael Jackson-film en Resident Evil… maar ik keek toch vooral naar haar.',
    place: 'Bioscoop',
    details: ['Michael Jackson', 'Resident Evil'],
  },
  'stop-amsterdam': {
    story:
      'Scootertoeren, een theehuisje, de Wallen ontdekken, mijn familie ontmoeten — en Coco zien.',
    place: 'Mijn stad',
    details: [
      'Scootertoeren door de stad',
      'Een theehuisje',
      'De Wallen ontdekken (en zij ging flirten met iemand achter een raam 👀)',
      'Mijn moeder, zus en oma ontmoeten',
      'Coco zien',
    ],
  },
  'stop-pumpkin': {
    story:
      'Allemaal enge Halloween-dingen. We zochten allebei de perfecte pompoen om te carven, en gingen door een eng doolhof — maar het engste daar was ik, want ik ging haar bang maken.',
    place: 'Almere',
    details: ['Op zoek naar de perfecte pompoen 🎃', 'Pompoenen carven', 'Het enge doolhof'],
  },
};

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const swap = (value: string, old: string | undefined, next: string) =>
  old !== undefined && value === old ? next : value;

/** Untouched English starter texts → their Dutch versions. */
export function refreshStarterTexts(c: AppContent): AppContent {
  const d = createDefaultContent();
  const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]));
  const ms = byId(d.milestones);
  const mem = byId(d.memories);
  const let_ = byId(d.letters);
  const dr = byId(d.dreams);
  const albums = byId(d.albums);
  const stars = byId(d.surprises.stars);
  const facts = byId(d.coco.facts);
  const lists = byId(d.lists);
  const stops = byId(d.museum.stops);
  const reasons = ENGLISH.reasons as readonly string[];

  return {
    ...c,
    profile: {
      ...c.profile,
      subtitle: swap(c.profile.subtitle, ENGLISH.profile.subtitle, d.profile.subtitle),
      homeMessage: swap(c.profile.homeMessage, ENGLISH.profile.homeMessage, d.profile.homeMessage),
      signature: swap(c.profile.signature, ENGLISH.profile.signature, d.profile.signature),
    },
    // Starter items stay samples until they're edited, so their text is still ours to update.
    milestones: c.milestones.map((m) => {
      const s = m.isSample && ms.get(m.id);
      return s ? { ...m, title: s.title, story: s.story, prompt: s.prompt } : m;
    }),
    memories: c.memories.map((m) => {
      const s = m.isSample && mem.get(m.id);
      return s ? { ...m, caption: s.caption, note: s.note } : m;
    }),
    letters: c.letters.map((l) => {
      const s = l.isSample && let_.get(l.id);
      return s ? { ...l, occasion: s.occasion, body: s.body, signature: s.signature } : l;
    }),
    dreams: c.dreams.map((x) => {
      const s = x.isSample && dr.get(x.id);
      return s ? { ...x, title: s.title, description: s.description } : x;
    }),
    museum: {
      ...c.museum,
      stops: c.museum.stops.map((s) => {
        const old = STOPS_V1[s.id];
        const next = stops.get(s.id);
        if (!old || !next) return s;
        return {
          ...s,
          story: swap(s.story, old.story, next.story),
          place: old.place && s.place === old.place ? next.place : s.place,
          details: sameList(s.details, old.details) ? [...next.details] : s.details,
        };
      }),
    },
    albums: c.albums.map((a) => {
      const next = albums.get(a.id);
      if (!next) return a;
      const name = swap(a.name, ENGLISH.albums[a.id as keyof typeof ENGLISH.albums], next.name);
      // "Zij" was her album's first Dutch name.
      return { ...a, name: a.id === 'album-her' ? swap(name, 'Zij', next.name) : name };
    }),
    surprises: {
      ...c.surprises,
      reasons: c.surprises.reasons.map((r) => {
        const i = reasons.indexOf(r);
        return i >= 0 ? (d.surprises.reasons[i] ?? r) : r;
      }),
      giftMessage: swap(c.surprises.giftMessage, ENGLISH.giftMessage, d.surprises.giftMessage),
      stars: c.surprises.stars.map((s) => {
        const next = stars.get(s.id);
        return next
          ? {
              ...s,
              text: swap(s.text, ENGLISH.stars[s.id as keyof typeof ENGLISH.stars], next.text),
            }
          : s;
      }),
      secretNote: swap(c.surprises.secretNote, ENGLISH.secretNote, d.surprises.secretNote),
      hiddenHeartNote: swap(
        c.surprises.hiddenHeartNote,
        ENGLISH.hiddenHeartNote,
        d.surprises.hiddenHeartNote,
      ),
    },
    coco: {
      ...c.coco,
      facts: c.coco.facts.map((f) => {
        const next = facts.get(f.id);
        const old = ENGLISH.facts[f.id as keyof typeof ENGLISH.facts];
        if (!next || !old) return f;
        return {
          ...f,
          label: swap(f.label, old[0], next.label),
          value: old[1] ? swap(f.value, old[1], next.value) : f.value,
        };
      }),
    },
    pet: { ...c.pet, coat: swap(c.pet.coat, ENGLISH.coat, d.pet.coat) },
    welcome: { ...c.welcome, message: swap(c.welcome.message, ENGLISH.welcome, d.welcome.message) },
    lists: c.lists.map((l) => {
      const next = lists.get(l.id);
      return next
        ? {
            ...l,
            title: swap(l.title, ENGLISH.lists[l.id as keyof typeof ENGLISH.lists], next.title),
          }
        : l;
    }),
  };
}
