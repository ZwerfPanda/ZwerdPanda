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
  subtitle: 'ons eigen kleine wereldje.. alleen voor ons twee ♡',
  homeGreeting: 'hey liefje,',
  homeMessage:
    'ik heb dit kleine plekje helemaal voor ons gemaakt.. voor alle momentjes die we al samen hebben, de dingen die we nog aan t uitvogelen zijn, en alles wat we nog gaan doen.\n\nt is niet perfect.. wij ook niet haha.. maar t is wel van ons. kijk rustig rond schatje, neem je tijd, en open gewoon wat je leuk lijkt ♡',
  signature: 'met heel veel liefde voor jou gemaakt.. - V',
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
        't begon ergens waar we t allebei totaal niet verwachtten.. een TikTok live. twee mensen op hele verschillende plekken, typend in t zelfde kleine chatje. niemand van ons wist toen dat dit t begin van iets was ♡',
      prompt: 'Wat weet je nog van de allereerste keer dat jullie praatten?',
      motif: 'phone',
      media: [{ type: 'sample', art: 'phone' }],
      favorite: false,
    },
    {
      id: 'ms-meeting',
      title: 'Voor het eerst in het echt',
      story:
        'na al dat praten via een schermpje stonden we eindelijk voor t eerst op dezelfde plek. geen username meer.. gewoon jij.',
      prompt: 'Voeg de datum toe, de plek, en het eerste wat je opviel.',
      motif: 'sparkle',
      media: [{ type: 'sample', art: 'meet' }],
      favorite: false,
    },
    {
      id: 'ms-first-date',
      title: 'Onze eerste date in het winkelcentrum',
      story:
        'onze eerste echte date was gewoon in een winkelcentrum. een hele normale plek, op een niet-zo-normale dag ♡',
      prompt: 'Wat deden we? Wat aten we? Wie was er zenuwachtiger?',
      motif: 'bag',
      media: [{ type: 'sample', art: 'mall' }],
      favorite: false,
    },
    {
      id: 'ms-our-things',
      title: 'Matcha, arcades & karaoke',
      story:
        'vanilla matcha met extra siroop — altijd extra. bubble tea. arcadekasten. karaoke. heel veel lachen. ergens onderweg werden dit stilletjes gewoon onze dingen ♡',
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
        'een tijdje betekende jou zien: de trein en de metro naar Den Haag. perrons, overstappen, oortjes in, haltes tellen.. en elke reis eindigde bij jou.',
      prompt: 'Een liedje dat je onderweg luisterde? Een reis die je nog weet?',
      motif: 'train',
      media: [{ type: 'sample', art: 'train' }],
      favorite: false,
    },
    {
      id: 'ms-car',
      title: 'Jou zelf ophalen',
      story:
        'en toen veranderde er iets.. ik kreeg een auto. geen dienstregelingen meer — gewoon ik die voor je deur stopt om je op te halen. iets kleins, en zo’n groot gevoel ♡',
      prompt: 'Wanneer was de eerste keer ophalen? Waar gingen we heen?',
      motif: 'car',
      media: [{ type: 'sample', art: 'car' }],
      favorite: false,
    },
    {
      id: 'ms-growing',
      title: 'Elkaar leren kennen',
      story:
        'we hebben ups en downs gehad. ruzies waar we doorheen moesten, fouten waar ik niet trots op ben, en dingen die we allebei nog aan t leren zijn. dit hoofdstukje is niet t mooiste.. maar t is wel echt. en we zijn er nog, en kiezen nog steeds elke dag voor elkaar ♡',
      prompt: 'Iets wat jullie van elkaar geleerd hebben (alleen wat jullie allebei hier willen).',
      motif: 'leaf',
      media: [{ type: 'sample', art: 'growth' }],
      favorite: false,
    },
    {
      id: 'ms-coco',
      title: 'Life with Coco',
      story:
        'en toen was er Coco.. ons kleine dwergkonijntje, en t nieuwste lid van ons mini-gezinnetje 🐰',
      prompt: 'De dag dat Coco thuiskwam, en de eerste foto van Coco met ons.',
      motif: 'rabbit',
      media: [{ type: 'sample', art: 'coco' }],
      favorite: false,
    },
    {
      id: 'ms-home',
      title: 'Een thuis, en misschien een gezin',
      story:
        'we zoeken samen een thuis, en dromen over t gezin dat we ooit misschien hebben. geen haast.. gewoon samen dromen ♡',
      prompt: 'Hoe ziet thuis eruit voor ieder van ons?',
      motif: 'house',
      media: [{ type: 'sample', art: 'house' }],
      favorite: false,
    },
    {
      id: 'ms-unwritten',
      title: 'Hoofdstukken die we nog moeten schrijven',
      story:
        'dit pagina’tje is expres nog leeg. de meeste herinneringen liggen denk ik gewoon nog voor ons ♡',
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
      body: 'hey jij..\n\nals je dit openmaakt mis je me waarschijnlijk. nou.. zodat je t weet, ik mis jou ook. waarschijnlijk zelfs meer, maar deze keer laat ik je gewoon winnen.\n\nweet je nog dat naar jou toe gaan betekende: een treintje, dan de metro, dan haltes tellen? elk van die reisjes eindigde bij jou.\n\ndus bel me gewoon. stuur me iets doms. stuur een fotootje van Coco. wat je ook nodig hebt.. ik ben nooit echt ver weg ♡',
      signature: '- jouw V',
      lock: { type: 'none' },
    },
    {
      id: 'letter-smile',
      occasion: 'you need a reason to smile',
      color: 'peach',
      seal: 'star',
      body: 'oke.. smile check 🙂\n\nhier is een reden: je lach. ik denk niet dat je echt doorhebt hoeveel ik ervan hou. t is een van mn favoriete geluiden, en ik maak mezelf met alle liefde belachelijk om m te horen.\n\nnog eentje: stel je Coco even voor die nu letterlijk wat dan ook aan t doen is.\n\nen nog één: ergens staat er een vanilla matcha met extra siroop met jouw naam erop.\n\nzie je wel? told you ♡',
      signature: '- V',
      lock: { type: 'none' },
    },
    {
      id: 'letter-argued',
      occasion: 'we have argued',
      color: 'lavender',
      seal: 'moon',
      body: 'hey..\n\nals je dit leest hebben we waarschijnlijk net ruzie gehad. misschien zei ik iets verkeerds. misschien wij allebei.\n\nik weet dat ik t niet altijd goed doe. ik heb fouten gemaakt, en ik leer nog steeds hoe t beter kan.. voor jou, en voor ons. maar ik ga echt liever samen met jou door de moeilijke dingen heen dan dat ik makkelijke dingen heb met iemand anders.\n\nneem de tijd die je nodig hebt. als je er klaar voor bent, ben ik hier. geen winnen, geen verliezen. gewoon wij, die t weer samen uitzoeken ♡',
      signature: '- altijd, V',
      lock: { type: 'none' },
    },
    {
      id: 'letter-hug',
      occasion: 'you need a hug',
      color: 'cream',
      seal: 'rabbit',
      body: 'zie dit maar als een knuffel in briefvorm 🫂\n\narmen helemaal om je heen. zo’n lange knuffel waarbij niemand van ons als eerste wil loslaten.\n\nkom me nu gewoon zoeken en haal de echte even op ♡',
      signature: '- V',
      lock: { type: 'hold' },
    },
    {
      id: 'letter-hard-day',
      occasion: "you're having a difficult day",
      color: 'sage',
      seal: 'flower',
      body: 'hey liefje..\n\nvandaag klinkt zwaar. je hoeft t niet uit te leggen, en je hoeft nu even niet oké te zijn.\n\ndoe gewoon één klein dingetje voor jezelf: drink wat water, kruip onder een dekentje, zet iets fijns op. en vertel me dan wat je nodig hebt.. praten, afleiding, of gewoon dat ik er ben.\n\nslechte dagen gaan voorbij. deze ook. en je hoeft er echt niet alleen doorheen ♡',
      signature: '- hier voor jou, V',
      lock: { type: 'none' },
    },
    {
      id: 'letter-future',
      occasion: 'you want to dream about our future',
      color: 'plum',
      seal: 'star',
      body: 'doe je oogjes even dicht..\n\neen plekje dat helemaal van ons is. onze namen op de deur. Coco die rondjes rent door de woonkamer. jouw nagelspullen die de hele tafel overnemen (t is oké, ik heb t geaccepteerd haha).\n\nik weet nog niet precies hoe t eruit gaat zien, of wanneer. maar ik droom er zo graag over met jou.. t huis, t gezin, alles.\n\nwe bouwen t gewoon stukje bij beetje. en ik ben echt zo blij dat t met jou is ♡',
      signature: '- jouw V',
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
    'je lach echt.. tbh misschien wel mn favoriete geluid op aarde',
    'hoe je gewoon helemaal jezelf bent, zonder sorry te zeggen',
    'dat je vanilla matcha met extra siroop bestelt alsof t een karaktertrek is 🍵',
    'hoe grappig je bent zonder dat je t eens probeert',
    'hoe lief je voor Coco zorgt',
    'je nageltjes.. elke set is echt een klein kunstwerkje',
    'dat we ruzie kunnen hebben en toch altijd weer bij elkaar terugkomen',
    'dat je nog steeds groeit.. en dat je mij met je mee laat groeien',
    'hoe je over later droomt — t huis, t gezin, alles',
    'alle kleine dingetjes aan jou die niemand anders heeft',
  ],
  giftMessage:
    'er zit hier verder niks in behalve een klein remindertje.. er wordt echt heel heel veel van je gehouden. op de goeie dagen, de moeilijke dagen, en alle dagen daartussenin ♡',
  stars: [
    { id: 'star-1', text: 'de eerste keer dat ik je hoorde lachen' },
    { id: 'star-2', text: 'treinritjes die altijd bij jou eindigden' },
    { id: 'star-3', text: 'vanilla matcha, extra siroop' },
    { id: 'star-4', text: 'karaoke, keihard meezingen' },
    { id: 'star-5', text: 'jou zelf ophalen in mn eigen auto' },
    { id: 'star-6', text: 'Coco, onze kleine chaos' },
    { id: 'star-7', text: 'alles wat we nog niet gedaan hebben' },
  ],
  secretNote:
    'psst.. je hebt de achterkant van de foto gevonden. ik hoop dat je gewoon weet hoe leuk ik je eigenlijk vind ♡',
  hiddenHeartNote:
    'je hebt een verstopt hartje gevonden 🫶 er zitten er een paar verstopt in ons universe.. geen haast, geen score. gewoon kleine hallootjes van mij.',
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
  careDays: [],
  manners: 0,
  handled: [],
  decor: [],
};

/** Starter words for the welcome — meant to be rewritten in Settings. */
export const defaultWelcome: Welcome = {
  enabled: true,
  title: '',
  message:
    'welkom in ons kleine universe liefje.. ik heb dit helemaal voor ons twee gemaakt. alles hierin is van ons — ons verhaaltje, onze plekjes, de brieven en al onze plannetjes. kijk gewoon lekker rond, voeg van alles toe, en voel je helemaal thuis hier ♡',
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
  ideas: [],
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
    ideas: (her.ideas ?? []).map((i) => ({ ...i })),
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

/**
 * The shape of our content in this version of the app. Bump it whenever a new
 * part is added to our universe, and teach `carryForward` (sync/merge.ts) to
 * keep that part when an older app saves without it.
 *   1 — up to the photo fixes (October 2026)
 *   2 — flower shop, prizes, pings, question of the day, dates, idea box,
 *       hearts on nail sets, care days, Memory and air hockey
 *   3 — our shared agenda (our own events)
 *   4 — our cinema, and his own wording for texts on the site
 *   5 — Memory and darts together on two phones, and our secret place
 *   6 — the things in Coco's room
 *   7 — skeeball and bowling duels, bingo and kwartet
 *   8 — the arcade's spaarpot (older results, added up)
 *   9 — the karaoke room
 *  10 — the music room (songs we made for each other)
 *  11 — our chat in the arcade
 *  12 — Coco's hop-race and the bubble tea bar
 */
export const CONTENT_SCHEMA = 12;

export function createDefaultContent(): AppContent {
  return {
    version: 1,
    schema: CONTENT_SCHEMA,
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
    pet: {
      ...defaultPet,
      treats: { ...defaultPet.treats },
      tricks: {},
      log: [],
      careDays: [],
      handled: [],
      decor: [],
    },
    countdowns: [],
    welcome: { ...defaultWelcome },
    lists: defaultLists.map((l) => ({ ...l, items: [] })),
    us: cloneUs(defaultUs),
    her: cloneHer(defaultHer),
    hunt: { found: {}, reward: defaultHunt.reward },
    quiz: { custom: [], answers: [] },
    karaoke: { songs: [], takes: [] },
    studio: { records: [], listens: [] },
    chat: { messages: [], read: {}, places: {} },
    games: { matches: [], scores: [], results: [] },
    museum: defaultMuseum(),
    syncReports: {},
    flowers: [],
    coupons: [],
    pings: [],
    daily: [],
    datePlans: [],
    agenda: [],
    cinema: { films: [], ratings: [], nights: [] },
    texts: [],
    vault: { items: [], categories: [] },
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
