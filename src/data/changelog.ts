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
    id: '2026-10-23',
    when: 'oktober 2026',
    title: 'Hoprace en Bubble Tea Bar, nog mooier 🐰🧋',
    items: [
      {
        emoji: '🌙',
        title: 'Coco rent tot de sterren',
        text: 'Van de tuin door het bloemenveld en langs de gracht tot een sterrennacht met vuurvliegjes. Pas op voor bijen en egeltjes!',
        path: '/games',
      },
      {
        emoji: '💗',
        title: 'Knuffels, gouden wortels en sterren',
        text: 'Een knuffel vergeeft één botsing, een gouden wortel trekt snacks aan, een ster geeft dubbele punten. Tien snacks op rij: ×2.',
        path: '/games',
      },
      {
        emoji: '🧋',
        title: 'Een echte bubble tea-winkel',
        text: 'Theetanks, potjes, schudden voor een perfecte beker, spitsuur, klanten met haast, een fooienpot en sterren voor je dienst.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-22',
    when: 'oktober 2026',
    title: 'Twee nieuwe kasten in de arcade 🐰🧋',
    items: [
      {
        emoji: '🐰',
        title: 'Coco’s Hoprace',
        text: 'Coco rent door de tuin: hop over bloempotten, hekjes en plassen en eet haar wortels en aardbeien onderweg.',
        path: '/games',
      },
      {
        emoji: '🧋',
        title: 'De Bubble Tea Bar',
        text: 'Een dienst achter de bar: thee, topping, suiker, ijs. Soms komt er een VIP met een bekende bestelling…',
        path: '/games',
      },
      {
        emoji: '🎟️',
        title: 'Duel om tickets',
        text: 'Allebei een rondje op je eigen telefoon: de hoogste score wint. Ook tegen Coco of samen op één telefoon.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-21',
    when: 'oktober 2026',
    title: 'Chatten in de arcade 💬',
    items: [
      {
        emoji: '💬',
        title: 'Een chat in de Arcade Hall',
        text: 'Live berichtjes, met "typt…" en "gelezen": rechtsonder in de hal, bovenin bij elk spel. Niet in de app? Dan een melding.',
        path: '/games',
      },
      {
        emoji: '🟢',
        title: 'Zien waar de ander is',
        text: 'Een groen lampje als de ander er is: in de hal staat welk spelletje er gespeeld wordt, met "Ga erheen", en de kast licht op met een naam.',
        path: '/games',
      },
      {
        emoji: '🎮',
        title: 'Daag uit vanuit de chat',
        text: 'Zit je in een spel, stuur dan "Daag uit": de ander tikt op "Doe mee" en staat meteen aan de kast.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-20',
    when: 'oktober 2026',
    title: 'De Muziekkamer 🎶',
    items: [
      {
        emoji: '💿',
        title: 'Onze liedjes op de plank',
        text: 'Elk liedje dat we voor elkaar maken, als plaat op de plank: kies er een en hij draait op de platenspeler.',
        path: '/muziekkamer',
      },
      {
        emoji: '📝',
        title: 'Het verhaal erachter',
        text: 'Waarom je hem maakte, de tekst die meeloopt, een hartje en een berichtje terug.',
        path: '/muziekkamer',
      },
      {
        emoji: '🎁',
        title: 'Een liedje als cadeautje',
        text: 'Een nieuw liedje komt ingepakt binnen. Of pak hem in tot een speciale dag, zoals kerst of je verjaardag.',
        path: '/muziekkamer',
      },
    ],
  },
  {
    id: '2026-10-16',
    when: 'oktober 2026',
    title: 'Medailles, ons jaar en meldingen',
    items: [
      {
        emoji: '🎖️',
        title: 'Medaillekast',
        text: 'Twintig medailles om samen en elk te verdienen. Win je er een, dan komt hij aanzwaaien.',
        path: '/games',
      },
      {
        emoji: '🎯',
        title: 'Weekuitdaging',
        text: 'Speel 5 potjes tegen elkaar in een week en jullie krijgen er allebei 20 tickets bij.',
        path: '/games',
      },
      {
        emoji: '📅',
        title: 'Ons jaar',
        text: 'Ons jaar in kaartjes: dagen samen, herinneringen, dates, potjes en meer, tik voor tik.',
        path: '/jaar',
      },
      {
        emoji: '🔔',
        title: 'Seintjes, ook als de app dicht is',
        text: 'Jouw beurt, een hartje of Gouden Woensdag: zet Meldingen aan bij Instellingen → De app.',
        path: '/settings',
      },
    ],
  },
  {
    id: '2026-10-15',
    when: 'oktober 2026',
    title: 'Gouden Woensdag ✨',
    items: [
      {
        emoji: '🎟️',
        title: 'Elke woensdag dubbele tickets',
        text: 'Op woensdag tellen alle tickets die je wint dubbel. De Arcade Hall wordt goud, met een klok die aftelt tot middernacht.',
        path: '/games',
      },
      {
        emoji: '🪙',
        title: 'Een regen van tickets',
        text: 'Win je tickets, dan regenen ze over je scherm. Op woensdag in goud, en in de Arcade dwarrelen muntjes naar beneden.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-13',
    when: 'oktober 2026',
    title: 'Tickets',
    items: [
      {
        emoji: '🎟️',
        title: 'Lange spellen: 4 extra',
        text: 'Winnen 10, verliezen 4. Go Fish, Pannenkoekenslag, UNO, bowlen en bingo duren langer: daar krijg je er 4 bij.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-11',
    when: 'oktober 2026',
    title: 'Go Fish, helemaal af',
    items: [
      {
        emoji: '🎣',
        title: 'Elke zet in beeld',
        text: 'Vragen in een tekstballon, kaarten die overvliegen, vissen gaat vanzelf, en een feestje bij elk book.',
        path: '/games',
      },
      {
        emoji: '🎟️',
        title: 'Tickets alleen samen',
        text: 'Tickets en gewonnen potjes tellen alleen als je echt tegen elkaar speelt, elk op je eigen telefoon.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-10',
    when: 'oktober 2026',
    title: 'Go Fish!',
    items: [
      {
        emoji: '🐟',
        title: 'Kwartet is nu Go Fish',
        text: 'Vraag om koningen, azen of drietjes: heeft de ander ze, dan krijg je ze allemaal. Niet? Go Fish! Wie de meeste books heeft, wint.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-9',
    when: 'oktober 2026',
    title: 'Darten en bowlen, echter',
    items: [
      {
        emoji: '🎯',
        title: 'Darten: echt gooien',
        text: 'Mik met je vinger op het bord (je hand zwaait) en veeg recht omhoog. Te zacht en hij zakt, te hard en hij vliegt omhoog.',
        path: '/games',
      },
      {
        emoji: '🎳',
        title: 'Bowlen: een nieuwe baan',
        text: 'Stevige kegels die omvallen, rollen en elkaar meenemen. Raak de pocket voor een strike; een veegarm ruimt op.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-8',
    when: 'oktober 2026',
    title: 'Nieuw in de Arcade Hall',
    items: [
      {
        emoji: '🎱',
        title: 'Bingo',
        text: 'Om de beurt een bal trekken, je nummers stempelen en als eerste BINGO roepen. Samen op twee telefoons, op één telefoon, of tegen Coco.',
        path: '/games',
      },
      {
        emoji: '🐟',
        title: 'Kwartet',
        text: 'Acht families uit de zee. Vraag de ander om de kaart die je mist — heeft die hem niet, dan is het vissen!',
        path: '/games',
      },
      {
        emoji: '⚔️',
        title: 'Skeeball en bowlen: duel om tickets',
        text: 'Speel allebei een rondje, ook op je eigen telefoon wanneer het uitkomt. De hoogste score wint tickets, de ander krijgt er ook een paar.',
        path: '/games',
      },
    ],
  },
  {
    id: '2026-10-7',
    when: 'oktober 2026',
    title: 'Privé-opslag: alleen voor ons twee',
    items: [
      {
        emoji: '🔐',
        title: 'Versleuteld op je telefoon',
        text: 'Foto’s en video’s worden op je telefoon op slot gezet voordat ze vertrekken. Alleen wij twee kunnen ze zien.',
        path: '/settings',
      },
      {
        emoji: '🔑',
        title: 'Onze code',
        text: 'Heb je een code van mij gekregen? Vul hem in bij Instellingen → Samen → Privé-opslag.',
        path: '/settings',
      },
      {
        emoji: '🎬',
        title: 'Grote video’s',
        text: 'Met privé-opslag aan passen video’s tot 2 GB.',
        path: '/cinema',
      },
    ],
  },
  {
    id: '2026-10-6',
    when: 'oktober 2026',
    title: 'Coco’s hoekje, helemaal opnieuw',
    items: [
      {
        emoji: '🐰',
        title: 'Een grote kamer voor Coco',
        text: 'Ze is groter, haar kamer heeft licht en diepte, en je ziet meteen hoe het met haar gaat.',
        path: '/coco',
      },
      {
        emoji: '🧹',
        title: 'Zorgen in haar kamer',
        text: 'Tik op haar hooirek om bij te vullen en tik keuteltjes weg. Haar wensjes en kattenkwaad zie je in de kamer zelf.',
        path: '/coco',
      },
      {
        emoji: '🥕',
        title: 'Worteltjes & inrichten',
        text: 'Met zorgen verdien je worteltjes: koop een kleedje, lichtjes, een hangmatje of zelfs een eigen huisje.',
        path: '/coco',
      },
      {
        emoji: '✅',
        title: 'Samen zorgen',
        text: 'Een rondje van vandaag, en je ziet wat de ander net voor haar deed.',
        path: '/coco',
      },
    ],
  },
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
  return log.filter((e) => compareIds(e.id, seen) > 0);
}

/** Ids compare number by number, so "2026-10-10" comes after "2026-10-9". */
export const compareIds = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });
