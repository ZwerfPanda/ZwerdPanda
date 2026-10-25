import type { RoutePath } from '../lib/router';

/**
 * What changed in the app, newest first — shown once on each phone after an
 * update, and always under "Wat is er nieuw?" in the menu. Add an entry at the
 * top with every update; "{his}" and "{her}" become our names.
 */

export interface ChangeItem {
  emoji: string;
  title: string;
  text: string;
  path?: RoutePath;
}

export interface ChangeEntry {
  /** Unique and sortable: newer entries get a later id. */
  id: string;
  when: string;
  title: string;
  items: ChangeItem[];
}

export const CHANGELOG: ChangeEntry[] = [
  {
    id: '2026-10-5',
    when: 'oktober 2026',
    title: 'Pannenkoekenslag, 3D-bowlen en een nieuw bloemenwinkeltje',
    items: [
      {
        emoji: '🥞',
        title: 'Pannenkoekenslag',
        text: 'Zeeslag op de gracht: pannenkoekenboten, en je gooit pannenkoeken. Plons, splat, toeter!',
        path: '/games',
      },
      {
        emoji: '🎳',
        title: 'Bowlen in 3D',
        text: 'Nu van achter de bal, met een camera die meerolt en kegels die echt omvallen.',
        path: '/games',
      },
      {
        emoji: '🎯',
        title: 'Skeeball, Memory & darts samen',
        text: 'Skeeball gooit veel beter (of houd vast voor de meter), en Memory en darten kunnen nu elk op je eigen telefoon.',
        path: '/games',
      },
      {
        emoji: '⚡',
        title: 'Snellere beurten',
        text: 'Een zet staat in een tel op de andere telefoon — UNO en de rest wachten niet meer op de sync.',
        path: '/games',
      },
      {
        emoji: '💐',
        title: 'Een nieuw bloemenwinkeltje',
        text: 'Met een echte winkelpui, zelf boeketten binden, water geven en wat je bloemen betekenen.',
        path: '/flowers',
      },
    ],
  },
  {
    id: '2026-10-4',
    when: 'oktober 2026',
    title: 'Onze eigen bioscoop',
    items: [
      {
        emoji: '🍿',
        title: 'Onze bioscoop',
        text: 'Zet filmpjes van ons op het grote doek: met poster, kaartje, snacks, gordijn en aftiteling.',
        path: '/cinema',
      },
      {
        emoji: '⭐',
        title: 'Sterren & recensies',
        text: 'Geef elke film je sterren. De best beoordeelde wint De Gouden Popcorn.',
        path: '/cinema',
      },
      {
        emoji: '🧍',
        title: 'Mini Us naar de film',
        text: 'Mini Us kunnen nu ook voor de bioscoop staan.',
        path: '/us',
      },
    ],
  },
  {
    id: '2026-10-3',
    when: 'oktober 2026',
    title: 'Onze agenda & warmere naampjes',
    items: [
      {
        emoji: '🗓️',
        title: 'Onze agenda',
        text: 'Alles op één plek: ons jubileum, onze verjaardagen, Coco, dates en onze eigen afspraken.',
        path: '/agenda',
      },
      {
        emoji: '🎂',
        title: 'Onze verjaardagen',
        text: 'Net als Coco staan onze verjaardagen nu in de app, met een aftelling in de agenda.',
        path: '/agenda',
      },
      {
        emoji: '💞',
        title: 'Lievere naampjes',
        text: 'Op steeds meer plekjes zie je een koosnaampje in plaats van een kille voornaam.',
      },
      {
        emoji: '🎟️',
        title: 'Tickets & prijzen',
        text: 'Tickets verdien je door potjes tegen elkaar (niet tegen Coco); bonnen mogen tot 10.000.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-2',
    when: 'oktober 2026',
    title: 'Bloemen, prijzen en een feestelijke Coco',
    items: [
      {
        emoji: '💐',
        title: 'Bloemenwinkeltje',
        text: 'Al je boeketten van {his} op de plank: met foto, de bloemen, het kaartje en water geven.',
        path: '/flowers',
      },
      {
        emoji: '🎟️',
        title: 'Tickets & prijzenkast',
        text: 'Elk potje levert tickets op. Wissel ze in voor bonnen die jullie voor elkaar maken.',
        path: '/games',
      },
      {
        emoji: '🏆',
        title: 'Kampioen van de maand',
        text: 'Wie wint deze maand de meeste potjes? De winnaar krijgt een plekje in de trofeeënkast.',
        path: '/games',
      },
      {
        emoji: '🃏',
        title: 'Memory & airhockey',
        text: 'Memory met jullie eigen foto’s, en airhockey op één telefoon. Samen of tegen Coco.',
        path: '/games',
      },
      {
        emoji: '💗',
        title: 'Ik denk aan je',
        text: 'Stuur een hartje, knuffel of kusje. De ander ziet het zodra die de app opent.',
        path: '/',
      },
      {
        emoji: '❓',
        title: 'Vraag van de dag',
        text: 'Elke dag een vraag. Het antwoord van de ander zie je pas als je zelf hebt geantwoord.',
        path: '/',
      },
      {
        emoji: '📅',
        title: 'Dates plannen',
        text: 'Zet een date in de agenda met een aftelklok. Na de date vraagt de app om een foto.',
        path: '/',
      },
      {
        emoji: '💅',
        title: 'Nagelgalerij',
        text: '{his} kan hartjes geven aan je sets. Zijn favoriet wordt de set van de maand 👑.',
        path: '/her',
      },
      {
        emoji: '💡',
        title: 'Ideeënbus',
        text: 'Een wens voor de app? Zet hem in de ideeënbus in je hoekje, dan ziet {his} hem.',
        path: '/her',
      },
      {
        emoji: '🎀',
        title: 'Coco in stijl',
        text: 'Draagt Coco haar strikje? Dan krijgt het de kleur van je nieuwste nagelset.',
        path: '/coco',
      },
      {
        emoji: '🎃',
        title: 'Seizoenen in het hok',
        text: 'Halloween, kerst met sneeuw, Valentijn, Pasen en een feest op Coco’s verjaardag.',
        path: '/coco',
      },
      {
        emoji: '🔥',
        title: 'Verzorg-streak',
        text: 'Dagen op rij voor Coco gezorgd, met medailles bij 3, 7, 14, 30 en 100 dagen.',
        path: '/coco',
      },
      {
        emoji: '✨',
        title: 'Wat is er nieuw?',
        text: 'Dit lijstje: na elke update zie je hier in het kort wat er veranderd is.',
      },
    ],
  },
];

/** Entries newer than the one last seen; just the newest on a phone that never looked. */
export function unseenChanges(seen: string | null, log: ChangeEntry[] = CHANGELOG): ChangeEntry[] {
  if (!log.length) return [];
  if (!seen) return [log[0]];
  return log.filter((e) => e.id > seen);
}
