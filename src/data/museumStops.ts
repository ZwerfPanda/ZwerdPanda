import type { Museum, MuseumStop } from './types';

/**
 * Our line: the places that are ours, in the order we got to know them, as
 * Valencio told them. Favourite memories and photos are left for us to fill
 * in ourselves.
 */

const SEED = '2026-10-23T12:00:00.000Z';

type Seed = Omit<MuseumStop, 'createdAt' | 'media' | 'upcoming'> & { upcoming?: boolean };

const STOPS: Seed[] = [
  {
    id: 'stop-home',
    name: 'Mijn huis',
    place: 'Amsterdam',
    theme: 'home',
    story:
      'Waar elke reis naar jou begon, baby. Hier stapte ik de deur uit om naar Den Haag te gaan — en hier kwam ik pas diep in de nacht weer thuis.',
    details: ['Vertrekpunt van elke reis naar jou'],
  },
  {
    id: 'stop-den-haag-cs',
    name: 'Den Haag Centraal',
    place: 'Den Haag',
    theme: 'station',
    story:
      'Hier vergaten we per ongeluk de dodenherdenking. Het hele station viel stil… en wij bleven gewoon doorpraten. Iedereen keek ons aan. Awkwarddd — maar eerlijk, beautiful? Ook wel romantisch.',
    details: ['Twee minuten stilte, behalve bij ons', 'Iedereen keek ons aan 🙈'],
  },
  {
    id: 'stop-moerwijk',
    name: 'Den Haag Moerwijk',
    place: 'Jouw thuisstation',
    theme: 'platform',
    story:
      'Jouw thuisstation. Hier kwam ik je altijd ophalen. Ik was er vroeg, ging pas laat in de avond weer weg, en kwam zelf pas in de nacht thuis.',
    details: ['Vroeg aankomen', 'Laat in de avond weer weg', 'Pas in de nacht thuis'],
  },
  {
    id: 'stop-sisi',
    name: 'SiSi',
    place: 'Bubble tea',
    theme: 'bubbletea',
    story: 'Onze bubble tea-plek. Jij neemt altijd hetzelfde, schatje.',
    details: ['Jouw order: jasmine bubble tea met tapioca-balletjes'],
  },
  {
    id: 'stop-westfield',
    name: 'Westfield Mall of the Netherlands',
    place: 'Leidschendam',
    theme: 'mall',
    when: 'onze eerste date',
    story: 'Onze eerste date — en daarna kwamen we er nog heel vaak terug.',
    details: [
      'Een mooie Pandora-ring voor jou gekocht',
      'New Balance-schoenen',
      'Kleren shoppen',
      'Karaoke met mijn moeder en zus',
      'Twee keer naar de arcadehal',
      'Mijn eerste cadeautje van jou uitgepakt',
      'Onze eerste kus, bij de matchawinkel',
      'Altijd even naar de matchawinkel',
      'Kippie: jij een broodje kipkroket, ik gehaktballen of kippenbouten en -vleugels',
      'Kruidvat voor make-up, Action voor random spulletjes',
    ],
  },
  {
    id: 'stop-vogeltuin',
    name: 'De Vogeltuin',
    place: 'Den Haag',
    theme: 'birds',
    story: 'Flamingo’s gezien, en spulletjes voor Coco gehaald.',
    details: ['Flamingo’s! 🦩', 'Shoppen voor Coco'],
  },
  {
    id: 'stop-juicy',
    name: 'Juicy Burgers & Pasta',
    place: 'Onze eetplek',
    theme: 'pasta',
    story: 'Jij wilt hier altijd hetzelfde, my princess: de creamy pasta pesto.',
    details: ['Jouw vaste keuze: creamy pasta pesto'],
  },
  {
    id: 'stop-teleport',
    name: 'The Teleport Hotel',
    place: 'Den Haag',
    theme: 'hotel',
    story: 'Ons eigen kamertje voor een dag. Wat in de Teleport gebeurt, blijft in de Teleport. 🤫',
    details: ['Vaak een dagkamertje gehuurd', 'Niet storen ♡'],
  },
  {
    id: 'stop-walibi-holland',
    name: 'Walibi Holland',
    place: 'Biddinghuizen',
    theme: 'themepark',
    story:
      'Een romantisch, gezellig dagje samen. De zon was heel fel en op het laatst voelde jij je niet zo lekker — maar het is goed gekomen.',
    details: [
      'De grootste knuffel van het park voor jou gewonnen, met basketbal',
      'Romantisch samen in het reuzenrad',
      'Veel enge achtbanen, waar jij bang voor was',
    ],
  },
  {
    id: 'stop-walibi-belgium',
    name: 'Walibi Belgium',
    place: 'Waver, België',
    theme: 'roadtrip',
    story:
      'Met jouw broertje en je moeder — een superleuke dag vol unieke attracties en achtbanen. Op de terugweg lag iedereen te slapen, terwijl ik jullie veilig naar huis reed.',
    details: [
      'Unieke attracties en achtbanen',
      'Iedereen sliep, ik reed jullie veilig naar huis',
      'Ooit gaan we hier met z’n tweetjes heen',
    ],
  },
  {
    id: 'stop-pathe',
    name: 'Pathé',
    place: 'Bioscoop',
    theme: 'cinema',
    story: 'We zagen de Michael Jackson-film en Resident Evil… maar ik keek toch vooral naar jou.',
    details: ['Michael Jackson', 'Resident Evil'],
  },
  {
    id: 'stop-kfc',
    name: 'KFC',
    place: 'Altijd een goed idee',
    theme: 'chicken',
    story: 'We houden van kip. Simpel.',
    details: [],
  },
  {
    id: 'stop-ikea',
    name: 'IKEA',
    place: 'Date-plek',
    theme: 'ikea',
    story: 'IKEA-dates, en hotdogs met heeeeel veel saus!',
    details: ['Hotdogs met héél veel saus 🌭'],
  },
  {
    id: 'stop-amsterdam',
    name: 'Amsterdam',
    place: 'Mijn stad',
    theme: 'amsterdam',
    story:
      'Scootertoeren, een theehuisje, de Wallen ontdekken, mijn familie ontmoeten — en Coco zien.',
    details: [
      'Scootertoeren door de stad',
      'Een theehuisje',
      'De Wallen ontdekken (en jij ging flirten met iemand achter een raam 👀)',
      'Mijn moeder, zus en oma ontmoeten',
      'Coco zien',
    ],
  },
  {
    id: 'stop-madurodam',
    name: 'Madurodam',
    place: 'Den Haag',
    theme: 'miniature',
    story: 'We gingen snel weer weg. 😅',
    details: [],
  },
  {
    id: 'stop-pumpkin',
    name: 'Pumpkin Patch',
    place: 'Almere',
    theme: 'pumpkin',
    story:
      'Allemaal enge Halloween-dingen. We zochten allebei de perfecte pompoen om te carven, en gingen door een eng doolhof — maar het engste daar was ik, want ik ging jou bang maken.',
    details: ['Op zoek naar de perfecte pompoen 🎃', 'Pompoenen carven', 'Het enge doolhof'],
  },
  {
    id: 'stop-spa',
    name: 'Privé spa',
    place: 'Alleen wij',
    theme: 'spa',
    story: 'Een privé spa, alleen voor ons twee.',
    details: [],
  },
  {
    id: 'stop-december',
    name: 'Twee weken vakantie',
    place: 'Samen weg',
    theme: 'holiday',
    when: 'december',
    story: 'In december gaan we samen twee weken op vakantie.',
    details: [],
    upcoming: true,
  },
  {
    id: 'stop-kerst',
    name: 'Kerstdate',
    place: 'Een kerstcentrum',
    theme: 'christmas',
    story: 'Een schattige kerstdate: samen naar een kerstcentrum.',
    details: [],
    upcoming: true,
  },
];

export function defaultMuseum(): Museum {
  return {
    stops: STOPS.map((s) => ({
      ...s,
      details: [...s.details],
      media: [],
      upcoming: Boolean(s.upcoming),
      createdAt: SEED,
    })),
  };
}
