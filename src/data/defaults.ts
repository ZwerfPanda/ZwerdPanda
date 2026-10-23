import type {
  Album,
  AppContent,
  CocoContent,
  CocoPet,
  HerSpace,
  StarHunt,
  OurList,
  UsContent,
  Welcome,
  Dream,
  Letter,
  Memory,
  Milestone,
  Preferences,
  Profile,
  SurpriseContent,
} from './types';
import { defaultMuseum } from './museumStops';

/**
 * Starter content.
 *
 * Everything here is either a structural default (album names, settings) or a
 * clearly-marked sample (`isSample: true`) built only from details Valencio
 * shared. No dates, conversations or promises are invented — chapters carry
 * writing prompts instead, and every sample can be removed in one click from
 * Settings → Our data & backups.
 */

const SEED = '2026-10-01T12:00:00.000Z';

/** Seed items get `createdAt` and the sample flag stamped on below. */
type Seed<T, Extra extends keyof T = never> = Omit<T, 'createdAt' | 'isSample' | Extra>;

export const defaultProfile: Profile = {
  yourName: 'Valencio',
  partnerName: 'Shenaya',
  siteTitle: 'Our Little Universe',
  subtitle: 'Een kleine wereld die van ons is.',
  homeGreeting: 'Hey Shenaya,',
  homeMessage:
    'Ik heb dit plekje voor ons gemaakt. Voor de herinneringen die we al hebben, de dingen die we nog aan het uitvogelen zijn, en alles wat we nog niet gedaan hebben.\n\nHet is niet perfect — wij ook niet — maar het is van ons. Kijk rond, neem je tijd, en open wat je nieuwsgierig maakt.',
  signature: 'Made with love door Valencio',
  startDate: null,
  counterMode: 'ymd',
  theme: 'blush',
  // Bruno Mars — Risk It All
  openingSong: 'https://open.spotify.com/track/5y2ijHECwFYWqcAHKTZgzD',
};

export const defaultAlbums: Album[] = [
  { id: 'album-dates', name: 'Onze dates' },
  { id: 'album-silly', name: 'Gekke momentjes' },
  { id: 'album-her', name: 'Jij ♡' },
  { id: 'album-us', name: 'Wij' },
  { id: 'album-adventures', name: 'Onze avonturen' },
  { id: 'album-everyday', name: 'Kleine alledaagse momentjes' },
  { id: 'album-coco', name: 'Coco' },
  { id: 'album-future', name: 'Toekomstige herinneringen' },
];

const milestones: Milestone[] = (
  [
    {
      id: 'ms-livestream',
      title: 'Twee vreemden in een livestream',
      story:
        'Het begon ergens waar we het allebei niet verwachtten: een TikTok-livestream. Twee mensen op verschillende plekken, typend in hetzelfde kleine chatje. Geen van ons wist dat het het begin van iets was.',
      prompt: 'Wat weet je nog van de allereerste keer dat jullie praatten?',
      motif: 'phone',
      media: [{ type: 'sample', art: 'phone' }],
      favorite: false,
    },
    {
      id: 'ms-meeting',
      title: 'Voor het eerst in het echt',
      story:
        'Na al dat praten via een scherm stonden we eindelijk voor het eerst op dezelfde plek. Geen username meer — gewoon jij.',
      prompt: 'Voeg de datum toe, de plek, en het eerste wat je opviel.',
      motif: 'sparkle',
      media: [{ type: 'sample', art: 'meet' }],
      favorite: false,
    },
    {
      id: 'ms-first-date',
      title: 'Onze eerste date in het winkelcentrum',
      story:
        'Onze eerste date was in een winkelcentrum. Een gewone plek op een niet-zo-gewone dag.',
      prompt: 'Wat deden we? Wat aten we? Wie was er zenuwachtiger?',
      motif: 'bag',
      media: [{ type: 'sample', art: 'mall' }],
      favorite: false,
    },
    {
      id: 'ms-our-things',
      title: 'Matcha, arcades & karaoke',
      story:
        'Vanilla matcha met extra siroop — altijd extra. Bubble tea. Arcadekasten. Karaoke. Heel veel lachen. Ergens onderweg werden dit stilletjes onze dingen.',
      prompt: 'Voeg een favoriete foto van een van deze dates toe.',
      motif: 'matcha',
      media: [
        { type: 'sample', art: 'matcha' },
        { type: 'sample', art: 'arcade' },
        { type: 'sample', art: 'karaoke' },
      ],
      favorite: false,
    },
    {
      id: 'ms-train',
      title: 'Het trein & metro-tijdperk',
      story:
        'Een tijdje betekende jou zien: de trein en de metro naar Den Haag. Perrons, overstappen, oortjes in, haltes tellen. Elke reis eindigde bij jou.',
      prompt: 'Een liedje dat je onderweg luisterde? Een reis die je nog weet?',
      motif: 'train',
      media: [{ type: 'sample', art: 'train' }],
      favorite: false,
    },
    {
      id: 'ms-car',
      title: 'Jou zelf ophalen',
      story:
        'Toen veranderde er iets: ik kreeg een auto. Geen dienstregelingen meer — gewoon ik die voor de deur stopt om jou op te halen. Iets kleins, en een groot gevoel.',
      prompt: 'Wanneer was de eerste keer ophalen? Waar gingen we heen?',
      motif: 'car',
      media: [{ type: 'sample', art: 'car' }],
      favorite: false,
    },
    {
      id: 'ms-growing',
      title: 'Elkaar leren kennen',
      story:
        'We hebben ups en downs gehad. Ruzies waar we doorheen moesten, fouten waar ik niet trots op ben, en dingen die we allebei nog leren. Dit hoofdstuk is niet het mooiste, maar het is echt — en we zijn er nog, en kiezen nog steeds voor elkaar.',
      prompt: 'Iets wat jullie van elkaar geleerd hebben (alleen wat jullie allebei hier willen).',
      motif: 'leaf',
      media: [{ type: 'sample', art: 'growth' }],
      favorite: false,
    },
    {
      id: 'ms-coco',
      title: 'Life with Coco',
      story:
        'En toen was er Coco — ons kleine dwergkonijntje, en het nieuwste lid van ons mini-gezinnetje.',
      prompt: 'De dag dat Coco thuiskwam, en de eerste foto van Coco met ons.',
      motif: 'rabbit',
      media: [{ type: 'sample', art: 'coco' }],
      favorite: false,
    },
    {
      id: 'ms-home',
      title: 'Een thuis, en misschien een gezin',
      story:
        'We zoeken samen een thuis, en dromen over het gezin dat we ooit misschien hebben. Geen haast — gewoon samen dromen.',
      prompt: 'Hoe ziet thuis eruit voor ieder van ons?',
      motif: 'house',
      media: [{ type: 'sample', art: 'house' }],
      favorite: false,
    },
    {
      id: 'ms-unwritten',
      title: 'Hoofdstukken die we nog moeten schrijven',
      story:
        'Deze pagina is expres leeg. De meeste herinneringen liggen waarschijnlijk nog voor ons.',
      motif: 'star',
      media: [{ type: 'sample', art: 'future' }],
      favorite: false,
      future: true,
    },
  ] satisfies Seed<Milestone>[]
).map((m) => ({ ...m, isSample: true, createdAt: SEED }));

const memories: Memory[] = (
  [
    {
      id: 'mem-matcha',
      caption: 'Vanilla matcha, extra siroop',
      note: 'Jouw bestelling. Non-negotiable.',
      albumIds: ['album-dates', 'album-her'],
      media: { type: 'sample', art: 'matcha' },
      favorite: true,
    },
    {
      id: 'mem-train',
      caption: 'Raamplekje naar Den Haag',
      albumIds: ['album-adventures'],
      media: { type: 'sample', art: 'train' },
      favorite: false,
    },
    {
      id: 'mem-arcade',
      caption: 'Arcade night',
      albumIds: ['album-dates', 'album-silly'],
      media: { type: 'sample', art: 'arcade' },
      favorite: false,
    },
    {
      id: 'mem-coco',
      caption: 'Coco, being Coco',
      albumIds: ['album-coco', 'album-everyday'],
      media: { type: 'sample', art: 'coco' },
      favorite: true,
    },
    {
      id: 'mem-boba',
      caption: 'Bubble tea-pauze',
      albumIds: ['album-dates'],
      media: { type: 'sample', art: 'boba' },
      favorite: false,
    },
    {
      id: 'mem-karaoke',
      caption: 'Karaoke, keihard',
      albumIds: ['album-silly', 'album-us'],
      media: { type: 'sample', art: 'karaoke' },
      favorite: false,
    },
    {
      id: 'mem-nails',
      caption: 'Een fresh set',
      albumIds: ['album-her'],
      media: { type: 'sample', art: 'nails' },
      favorite: false,
    },
    {
      id: 'mem-car',
      caption: 'Your ride is here',
      albumIds: ['album-us', 'album-adventures'],
      media: { type: 'sample', art: 'car' },
      favorite: false,
    },
    {
      id: 'mem-stars',
      caption: 'Laat naar huis rijden',
      albumIds: ['album-everyday'],
      media: { type: 'sample', art: 'stars' },
      favorite: false,
    },
    {
      id: 'mem-house',
      caption: 'Ooit: onze voordeur',
      albumIds: ['album-future'],
      media: { type: 'sample', art: 'house' },
      favorite: false,
    },
  ] satisfies Seed<Memory>[]
).map((m) => ({ ...m, isSample: true, createdAt: SEED }));

const letters: Letter[] = (
  [
    {
      id: 'letter-miss',
      occasion: 'you miss me',
      color: 'blush',
      seal: 'heart',
      body: 'Hey you,\n\nAls je dit openmaakt, mis je me waarschijnlijk. Zodat je het weet — ik mis jou ook. Waarschijnlijk meer, maar deze laat ik je winnen.\n\nWeet je nog dat naar jou toe gaan betekende: een trein, dan de metro, dan haltes tellen? Elke van die reizen eindigde bij jou.\n\nDus bel me. Stuur me iets doms. Stuur een foto van Coco. Wat je ook nodig hebt — ik ben nooit echt ver weg.',
      signature: 'Yours, Valencio',
      lock: { type: 'none' },
    },
    {
      id: 'letter-smile',
      occasion: 'you need a reason to smile',
      color: 'peach',
      seal: 'star',
      body: 'Oké, smile check.\n\nHier is een reden: je lach. Ik denk niet dat je beseft hoeveel ik ervan hou. Het is een van mijn favoriete geluiden, en ik maak mezelf graag belachelijk om hem te horen.\n\nNog eentje: stel je Coco voor die nu letterlijk wat dan ook doet.\n\nEn nog één: ergens is er een vanilla matcha met extra siroop waar jouw naam op staat.\n\nZie je? Told you.',
      signature: '— V',
      lock: { type: 'none' },
    },
    {
      id: 'letter-argued',
      occasion: 'we have argued',
      color: 'lavender',
      seal: 'moon',
      body: 'Hey.\n\nAls je dit leest, hebben we waarschijnlijk net ruzie gehad. Misschien zei ik iets verkeerds. Misschien wij allebei.\n\nIk weet dat ik het niet altijd goed heb gedaan. Ik heb fouten gemaakt, en ik leer nog steeds hoe het beter kan — voor jou, en voor ons. Maar ik ga liever samen met jou door de moeilijke dingen dan dat ik makkelijke dingen heb met iemand anders.\n\nNeem de tijd die je nodig hebt. Als je er klaar voor bent, ben ik hier. Geen winnen, geen verliezen. Gewoon wij, die het weer samen uitzoeken.',
      signature: 'Always, Valencio',
      lock: { type: 'none' },
    },
    {
      id: 'letter-hug',
      occasion: 'you need a hug',
      color: 'cream',
      seal: 'rabbit',
      body: 'Zie dit als een knuffel in briefvorm.\n\nArmen om je heen. Zo’n lange knuffel, waarbij niemand van ons als eerste wil loslaten.\n\nKom me nu zoeken en haal de echte op.',
      signature: 'Love, Valencio',
      lock: { type: 'hold' },
    },
    {
      id: 'letter-hard-day',
      occasion: "you're having a difficult day",
      color: 'sage',
      seal: 'flower',
      body: 'Hey, love.\n\nVandaag klinkt zwaar. Je hoeft het niet uit te leggen, en je hoeft nu niet oké te zijn.\n\nDoe één klein ding voor jezelf: drink wat water, kruip onder een dekentje, zet iets fijns op. Vertel me dan wat je nodig hebt — praten, afleiding, of gewoon dat ik er ben.\n\nSlechte dagen gaan voorbij. Deze ook. En je hoeft er niet alleen doorheen.',
      signature: 'Hier voor jou, Valencio',
      lock: { type: 'none' },
    },
    {
      id: 'letter-future',
      occasion: 'you want to dream about our future',
      color: 'plum',
      seal: 'star',
      body: 'Doe je ogen even dicht.\n\nEen plek die van ons is. Onze namen op de deur. Coco die rondjes rent door de woonkamer. Jouw nagelspullen die een hele tafel overnemen (het is oké, ik heb het geaccepteerd).\n\nIk weet nog niet precies hoe het eruit gaat zien, of wanneer. Maar ik droom er zo graag over met jou — het huis, het gezin, alles.\n\nWe bouwen het stukje bij beetje. En ik ben echt blij dat het met jou is.',
      signature: 'Yours, Valencio',
      lock: { type: 'none' },
    },
  ] satisfies Seed<Letter, 'recipient' | 'status'>[]
).map((l) => ({
  ...l,
  recipient: 'Shenaya',
  status: 'shared' as const,
  isSample: true,
  createdAt: SEED,
}));

const dreams: Dream[] = (
  [
    {
      id: 'dream-home',
      title: 'Ons eerste huis samen vinden',
      description: 'Een plek met onze namen op de deur — en ruimte voor Coco om te rennen.',
      category: 'home',
      status: 'progress',
      someday: false,
    },
    {
      id: 'dream-matcha',
      title: 'Elke matchaplek in Den Haag proberen',
      description: 'Streng beoordeeld op de vanilla-matcha-met-extra-siroop-schaal.',
      category: 'dates',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-nails',
      title: 'Nagels leren doen',
      description: 'Jij leert het me, ik doe heel erg mijn best ze niet te verpesten.',
      category: 'learn',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-plush',
      title: 'Een gigantische knuffel winnen bij de arcade',
      category: 'dates',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-anniversary',
      title: 'Iets speciaals plannen voor ons eerste jubileum',
      description: 'Zet de datum bij Instellingen zodat we hem nooit missen.',
      category: 'anniversary',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-family',
      title: 'Een eigen klein gezinnetje',
      category: 'family',
      status: 'planned',
      someday: true,
    },
    {
      id: 'dream-far',
      title: 'Ergens waar we allebei nog nooit geweest zijn',
      category: 'places',
      status: 'planned',
      someday: true,
    },
    {
      id: 'dream-garden',
      title: 'Een huis met een tuintje voor Coco',
      category: 'home',
      status: 'planned',
      someday: true,
    },
  ] satisfies Seed<Dream>[]
).map((d) => ({ ...d, isSample: true, createdAt: SEED }));

export const defaultSurprises: SurpriseContent = {
  reasons: [
    'Je lach. Eerlijk, misschien mijn favoriete geluid.',
    'Hoe helemaal, unapologetically jezelf je bent.',
    'Dat je vanilla matcha met extra siroop bestelt alsof het een karaktertrek is.',
    'Hoe grappig je bent zonder dat je het probeert.',
    'Hoe je voor Coco zorgt.',
    'Je nagels. Elke set is een klein kunstwerkje.',
    'Dat we ruzie kunnen hebben en toch altijd weer bij elkaar terugkomen.',
    'Dat je nog steeds groeit — en dat je mij met je mee laat groeien.',
    'Hoe je over de toekomst droomt — het huis, het gezin, alles.',
    'Alle kleine dingen aan jou die niemand anders heeft.',
  ],
  giftMessage:
    'Er zit niks in behalve een reminder: er wordt heel, heel veel van je gehouden. Op de goede dagen, de moeilijke dagen, en alle dagen daartussen.',
  stars: [
    { id: 'star-1', text: 'De eerste keer dat ik je hoorde lachen.' },
    { id: 'star-2', text: 'Treinritjes die eindigden bij jou.' },
    { id: 'star-3', text: 'Vanilla matcha, extra siroop.' },
    { id: 'star-4', text: 'Karaoke, keihard.' },
    { id: 'star-5', text: 'Jou ophalen in mijn eigen auto.' },
    { id: 'star-6', text: 'Coco, onze kleine chaos.' },
    { id: 'star-7', text: 'Alles wat we nog niet gedaan hebben.' },
  ],
  secretNote:
    'Psst. Je hebt de achterkant van de foto gevonden. Ik hoop dat je weet hoe leuk ik je vind.',
  hiddenHeartNote:
    'Je hebt een verstopt hartje gevonden. Er zijn er een paar in ons universe — geen haast, geen score. Gewoon kleine hellos.',
};

export const defaultCoco: CocoContent = {
  facts: [
    { id: 'fact-species', label: 'Soort', value: 'Dwergkonijn' },
    { id: 'fact-humans', label: 'Mensjes', value: 'Valencio & Shenaya' },
    { id: 'fact-snack', label: 'Lievelingssnack', value: '' },
    { id: 'fact-known', label: 'Bekend om', value: '' },
    { id: 'fact-home', label: 'Gotcha day', value: '' },
  ],
  notes: [],
};

/** Coco's real details: a girl, born 1 June 2026, black with a grey undertone and white paws. */
export const defaultPet: CocoPet = {
  birthday: '2026-06-01',
  sex: 'girl',
  coat: 'Zwart met een grijze ondertoon en witte pootjes',
  treats: { date: '', count: 0 },
  bond: 0,
  tricks: {},
  outfit: 'none',
  log: [],
};

/** Starter words for the welcome — meant to be rewritten in Settings. */
export const defaultWelcome: Welcome = {
  enabled: true,
  title: '',
  message:
    'Ik heb dit kleine universe voor ons gemaakt. Alles hierin is van ons — ons verhaal, onze plekjes, onze brieven en onze plannen. Kijk rond, voeg dingen toe, en voel je thuis.',
  signature: '',
};

/** Our lists start with one empty list to fill together. */
export const defaultLists: OurList[] = [
  {
    id: 'list-baby-names',
    title: 'Babynamen die we mooi vinden',
    icon: 'baby',
    items: [],
    createdAt: '2026-10-22T00:00:00.000Z',
  },
];

/**
 * Mini us. Heights and the names we call each other ship with the site;
 * full names and birthdays don't — we fill those in ourselves in the app.
 */
export const defaultUs: UsContent = {
  you: {
    fullName: '',
    birthday: '',
    heightCm: 192,
    look: { outfit: 'black-fit', hair: 'slick-back', accessories: ['chain', 'bracelet'] },
    lines: [],
  },
  partner: {
    fullName: '',
    birthday: '',
    heightCm: 158,
    look: { outfit: 'pink-top', hair: 'straight', accessories: ['necklace', 'ring', 'stanley'] },
    lines: [],
  },
  petNames: [
    { id: 'pet-baby', name: 'baby', from: 'both' },
    { id: 'pet-schatje', name: 'schatje', from: 'both' },
    { id: 'pet-beautiful', name: 'beautiful', from: 'you' },
    { id: 'pet-princess', name: 'my princess', from: 'you' },
    { id: 'pet-babygirl', name: 'baby girl', from: 'you' },
    { id: 'pet-handsome', name: 'handsome', from: 'partner' },
    { id: 'pet-sexy', name: 'sexy', from: 'both' },
    { id: 'pet-booboo', name: 'booboo', from: 'partner' },
    { id: 'pet-pookie', name: 'pookie wookie cookie', from: 'both' },
  ],
  chat: [],
};

/** Her own corner. Everything here is hers to rename, restyle and rewrite. */
export const defaultHer: HerSpace = {
  title: '',
  subtitle: 'Mijn eigen plekje. Mijn regels, mijn vibe.',
  theme: 'strawberry',
  pattern: 'hearts',
  sticker: '🎀',
  affirmations: [
    'Ik ben genoeg, precies zoals ik ben.',
    'Ik mag rustig aan doen vandaag.',
    'Kleine stapjes tellen ook.',
    'Ik verdien zachte dagen.',
    'Mijn gevoel mag er zijn.',
    'Ik ben trots op hoe ver ik al ben.',
    'Vandaag kies ik voor mezelf.',
  ],
  selfCare: [
    'Water drinken 💧',
    'Skincare 🧴',
    'Iets lekkers eten 🍓',
    'Even naar buiten 🌸',
    'Iets liefs voor mezelf 🎀',
  ],
  selfCareDone: { date: '', items: [] },
  coco: true,
  music: [],
  notes: [],
  nails: {
    current: {
      id: 'nails-current',
      shape: 'almond',
      finish: 'gloss',
      length: 'medium',
      accent: '#fbf8f4',
      colors: ['#f2b8c6', '#f2b8c6', '#f2b8c6', '#f2b8c6', '#f2b8c6'],
      art: ['none', 'none', 'heart', 'none', 'none'],
    },
    saved: [],
    sent: [],
  },
  journal: [],
  bucket: [],
  goals: [],
};

export const defaultHunt: StarHunt = {
  found: {},
  reward:
    'Je hebt ze allemaal gevonden. Elk sterretje was een klein stukje van ons universe — en jij bent de reden dat het bestaat. ♡',
};

export function cloneHer(her: HerSpace): HerSpace {
  return {
    ...her,
    affirmations: [...her.affirmations],
    selfCare: [...her.selfCare],
    selfCareDone: { ...her.selfCareDone, items: [...her.selfCareDone.items] },
    music: her.music.map((m) => ({ ...m })),
    notes: her.notes.map((n) => ({ ...n })),
    nails: {
      current: {
        ...her.nails.current,
        colors: [...her.nails.current.colors],
        art: [...her.nails.current.art],
      },
      saved: her.nails.saved.map((n) => ({ ...n, colors: [...n.colors], art: [...n.art] })),
      sent: (her.nails.sent ?? []).map((s) => ({ ...s })),
    },
    journal: her.journal.map((j) => ({ ...j })),
    bucket: her.bucket.map((b) => ({ ...b })),
    goals: her.goals.map((g) => ({ ...g, steps: g.steps.map((s) => ({ ...s })) })),
  };
}

export function cloneUs(us: UsContent): UsContent {
  const me = (m: UsContent['you']) => ({
    ...m,
    look: { ...m.look, accessories: [...m.look.accessories] },
    lines: [...m.lines],
  });
  return {
    you: me(us.you),
    partner: me(us.partner),
    petNames: us.petNames.map((p) => ({ ...p })),
    chat: us.chat.map((c) => ({ ...c })),
  };
}

export function createDefaultContent(): AppContent {
  return {
    version: 1,
    profile: { ...defaultProfile },
    milestones: milestones.map((m) => ({ ...m, media: [...m.media] })),
    albums: defaultAlbums.map((a) => ({ ...a })),
    memories: memories.map((m) => ({ ...m, albumIds: [...m.albumIds] })),
    letters: letters.map((l) => ({ ...l })),
    dreams: dreams.map((d) => ({ ...d })),
    capsules: [],
    songs: [],
    playlists: [],
    surprises: {
      ...defaultSurprises,
      reasons: [...defaultSurprises.reasons],
      stars: defaultSurprises.stars.map((s) => ({ ...s })),
    },
    coco: { facts: defaultCoco.facts.map((f) => ({ ...f })), notes: [] },
    pet: { ...defaultPet, treats: { ...defaultPet.treats }, tricks: {}, log: [] },
    countdowns: [],
    welcome: { ...defaultWelcome },
    lists: defaultLists.map((l) => ({ ...l, items: [] })),
    us: cloneUs(defaultUs),
    her: cloneHer(defaultHer),
    hunt: { found: {}, reward: defaultHunt.reward },
    quiz: { custom: [], answers: [] },
    games: { matches: [], scores: [] },
    museum: defaultMuseum(),
  };
}

export const defaultPreferences: Preferences = {
  motion: 'system',
  intro: 'session',
  soundtrack: 'musicbox',
  volume: 0.6,
  worldLight: 'auto',
  companion: true,
  sfx: true,
  ambience: true,
  notify: false,
};
