import type {
  Album,
  AppContent,
  CocoContent,
  Dream,
  Letter,
  Memory,
  Milestone,
  Preferences,
  Profile,
  SurpriseContent,
} from './types';

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
  subtitle: 'A little world that belongs to us.',
  homeGreeting: 'Hey Shenaya,',
  homeMessage:
    "I made this little place for us. For the memories we already have, the ones we're still figuring out, and everything we haven't done yet.\n\nIt isn't perfect — neither are we — but it's ours. Look around, take your time, and open whatever makes you curious.",
  signature: 'Made with love by Valencio',
  startDate: null,
  counterMode: 'ymd',
  theme: 'blush',
};

export const defaultAlbums: Album[] = [
  { id: 'album-dates', name: 'Our dates' },
  { id: 'album-silly', name: 'Silly moments' },
  { id: 'album-her', name: 'Her' },
  { id: 'album-us', name: 'Us' },
  { id: 'album-adventures', name: 'Our adventures' },
  { id: 'album-everyday', name: 'Little everyday moments' },
  { id: 'album-coco', name: 'Coco' },
  { id: 'album-future', name: 'Future memories' },
];

const milestones: Milestone[] = (
  [
    {
      id: 'ms-livestream',
      title: 'Two strangers in a livestream',
      story:
        'It started somewhere neither of us expected: a TikTok livestream. Two people in different places, typing into the same little chat. Neither of us knew it was the beginning of anything.',
      prompt: 'What do you remember about the very first time you talked?',
      motif: 'phone',
      media: [{ type: 'sample', art: 'phone' }],
      favorite: false,
    },
    {
      id: 'ms-meeting',
      title: 'Meeting for real',
      story:
        'After talking through a screen, there was finally a first time standing in the same place. Not a username anymore — just you.',
      prompt: 'Add the date, the place, and the first thing you noticed.',
      motif: 'sparkle',
      media: [{ type: 'sample', art: 'meet' }],
      favorite: false,
    },
    {
      id: 'ms-first-date',
      title: 'Our first date at the mall',
      story: 'Our first date was at a shopping mall. An ordinary place on a not-so-ordinary day.',
      prompt: 'What did we do? What did we eat? Who was more nervous?',
      motif: 'bag',
      media: [{ type: 'sample', art: 'mall' }],
      favorite: false,
    },
    {
      id: 'ms-our-things',
      title: 'Matcha, arcades & karaoke',
      story:
        'Vanilla matcha with extra syrup — always extra. Bubble tea. Arcade machines. Karaoke. A lot of laughing. Somewhere along the way, these quietly became our things.',
      prompt: 'Add a favourite photo from one of these dates.',
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
      title: 'The train & metro era',
      story:
        'For a while, seeing you meant the train and the metro to The Hague. Platforms, transfers, headphones in, counting stops. Every trip ended with you.',
      prompt: 'A song you listened to on the way? A trip you still remember?',
      motif: 'train',
      media: [{ type: 'sample', art: 'train' }],
      favorite: false,
    },
    {
      id: 'ms-car',
      title: 'Picking you up myself',
      story:
        'Then something changed: I got a car. No more timetables — just me pulling up outside to pick you up. A small thing, and a big feeling.',
      prompt: 'When was the first pick-up? Where did we go?',
      motif: 'car',
      media: [{ type: 'sample', art: 'car' }],
      favorite: false,
    },
    {
      id: 'ms-growing',
      title: 'Learning each other',
      story:
        "We've had ups and downs. Arguments we had to work through, mistakes I'm not proud of, and things we're both still learning. This chapter isn't the prettiest one, but it's real — and we're still here, choosing each other.",
      prompt: 'Something you learned from each other (only what you both want here).',
      motif: 'leaf',
      media: [{ type: 'sample', art: 'growth' }],
      favorite: false,
    },
    {
      id: 'ms-coco',
      title: 'Life with Coco',
      story:
        'And then there was Coco — our little dwarf rabbit, and the newest member of our tiny family.',
      prompt: 'The day Coco came home, and the first photo of Coco with us.',
      motif: 'rabbit',
      media: [{ type: 'sample', art: 'coco' }],
      favorite: false,
    },
    {
      id: 'ms-home',
      title: 'A home, and maybe a family',
      story:
        "We're looking for a home together, and dreaming about the family we might have one day. Not rushing it — just dreaming it, together.",
      prompt: 'What does home look like to each of us?',
      motif: 'house',
      media: [{ type: 'sample', art: 'house' }],
      favorite: false,
    },
    {
      id: 'ms-unwritten',
      title: "Chapters we haven't written yet",
      story: 'This page is empty on purpose. Most of our memories are probably still ahead of us.',
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
      caption: 'Vanilla matcha, extra syrup',
      note: 'Her order. Non-negotiable.',
      albumIds: ['album-dates', 'album-her'],
      media: { type: 'sample', art: 'matcha' },
      favorite: true,
    },
    {
      id: 'mem-train',
      caption: 'Window seat to The Hague',
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
      caption: 'Bubble tea break',
      albumIds: ['album-dates'],
      media: { type: 'sample', art: 'boba' },
      favorite: false,
    },
    {
      id: 'mem-karaoke',
      caption: 'Karaoke, loudly',
      albumIds: ['album-silly', 'album-us'],
      media: { type: 'sample', art: 'karaoke' },
      favorite: false,
    },
    {
      id: 'mem-nails',
      caption: 'A fresh set',
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
      caption: 'Late drive home',
      albumIds: ['album-everyday'],
      media: { type: 'sample', art: 'stars' },
      favorite: false,
    },
    {
      id: 'mem-house',
      caption: 'One day: our front door',
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
      body: "Hey you,\n\nIf you're opening this, you probably miss me. Just so you know — I miss you too. Probably more, but I'll let you win this one.\n\nRemember when getting to you meant a train, then the metro, then counting stops? Every one of those trips ended with you.\n\nSo call me. Text me something stupid. Send me a picture of Coco. Whatever you need — I'm never really that far away.",
      signature: 'Yours, Valencio',
      lock: { type: 'none' },
    },
    {
      id: 'letter-smile',
      occasion: 'you need a reason to smile',
      color: 'peach',
      seal: 'star',
      body: "Okay, smile check.\n\nHere's a reason: your laugh. I don't think you realise how much I love it. It's one of my favourite sounds, and I'll happily embarrass myself just to hear it.\n\nHere's another one: picture Coco doing literally anything right now.\n\nAnd one more: somewhere out there is a vanilla matcha with extra syrup that has your name on it.\n\nSee? Told you.",
      signature: '— V',
      lock: { type: 'none' },
    },
    {
      id: 'letter-argued',
      occasion: 'we have argued',
      color: 'lavender',
      seal: 'moon',
      body: "Hey.\n\nIf you're reading this, we probably just argued. Maybe I said something wrong. Maybe we both did.\n\nI know I haven't always gotten things right. I've made mistakes, and I'm still learning how to do better — for you, and for us. But I'd rather work through the hard things with you than have easy things with anyone else.\n\nTake the time you need. When you're ready, I'm here. No winning, no losing. Just us, figuring it out again.",
      signature: 'Always, Valencio',
      lock: { type: 'none' },
    },
    {
      id: 'letter-hug',
      occasion: 'you need a hug',
      color: 'cream',
      seal: 'rabbit',
      body: 'Consider this a hug in letter form.\n\nArms around you. The long kind of hug, where neither of us wants to be the first one to let go.\n\nNow come find me and collect the real one.',
      signature: 'Love, Valencio',
      lock: { type: 'hold' },
    },
    {
      id: 'letter-hard-day',
      occasion: "you're having a difficult day",
      color: 'sage',
      seal: 'flower',
      body: "Hey, love.\n\nToday sounds heavy. You don't have to explain it, and you don't have to be okay right now.\n\nDo one small thing for yourself: drink some water, get under a blanket, put on something comforting. Then tell me what you need — talking, distraction, or just me being there.\n\nBad days end. This one will too. And you don't have to get through it alone.",
      signature: 'Here for you, Valencio',
      lock: { type: 'none' },
    },
    {
      id: 'letter-future',
      occasion: 'you want to dream about our future',
      color: 'plum',
      seal: 'star',
      body: "Close your eyes for a second.\n\nA place that's ours. Our names on the door. Coco doing laps around the living room. Your nail things taking over a whole table (it's fine, I've accepted it).\n\nI don't know exactly what it will look like yet, or when. But I love dreaming about it with you — the home, the family, all of it.\n\nWe're building it a little bit at a time. And I'm really glad it's with you.",
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
      title: 'Find our first home together',
      description: 'A place with our names on the door — and room for Coco to run.',
      category: 'home',
      status: 'progress',
      someday: false,
    },
    {
      id: 'dream-matcha',
      title: 'Try every matcha spot in The Hague',
      description: 'Rated strictly on the vanilla-matcha-with-extra-syrup scale.',
      category: 'dates',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-nails',
      title: 'Learn to do nails',
      description: 'You teach, I try very hard not to ruin them.',
      category: 'learn',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-plush',
      title: 'Win a giant plush at the arcade',
      category: 'dates',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-anniversary',
      title: 'Plan something special for our first anniversary',
      description: 'Add the date in Settings so we never miss it.',
      category: 'anniversary',
      status: 'planned',
      someday: false,
    },
    {
      id: 'dream-family',
      title: 'A little family of our own',
      category: 'family',
      status: 'planned',
      someday: true,
    },
    {
      id: 'dream-far',
      title: 'Somewhere neither of us has been yet',
      category: 'places',
      status: 'planned',
      someday: true,
    },
    {
      id: 'dream-garden',
      title: 'A home with a little garden for Coco',
      category: 'home',
      status: 'planned',
      someday: true,
    },
  ] satisfies Seed<Dream>[]
).map((d) => ({ ...d, isSample: true, createdAt: SEED }));

export const defaultSurprises: SurpriseContent = {
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
  stars: [
    { id: 'star-1', text: 'The first time I heard you laugh.' },
    { id: 'star-2', text: 'Train rides that ended with you.' },
    { id: 'star-3', text: 'Vanilla matcha, extra syrup.' },
    { id: 'star-4', text: 'Karaoke, loudly.' },
    { id: 'star-5', text: 'Picking you up in my own car.' },
    { id: 'star-6', text: 'Coco, our tiny chaos.' },
    { id: 'star-7', text: 'Everything we haven’t done yet.' },
  ],
  secretNote: 'Psst. You found the back of the photo. I hope you know how much I like you.',
  hiddenHeartNote:
    'You found a hidden heart. There are a few of these around our universe — no rush, no score. Just little hellos.',
};

export const defaultCoco: CocoContent = {
  facts: [
    { id: 'fact-species', label: 'Species', value: 'Dwarf rabbit' },
    { id: 'fact-humans', label: 'Humans', value: 'Valencio & Shenaya' },
    { id: 'fact-snack', label: 'Favourite snack', value: '' },
    { id: 'fact-known', label: 'Known for', value: '' },
    { id: 'fact-home', label: 'Gotcha day', value: '' },
  ],
  notes: [],
};

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
    surprises: {
      ...defaultSurprises,
      reasons: [...defaultSurprises.reasons],
      stars: defaultSurprises.stars.map((s) => ({ ...s })),
    },
    coco: { facts: defaultCoco.facts.map((f) => ({ ...f })), notes: [] },
  };
}

export const defaultPreferences: Preferences = {
  motion: 'system',
  intro: 'session',
  soundtrack: 'musicbox',
  volume: 0.6,
  worldLight: 'auto',
};
