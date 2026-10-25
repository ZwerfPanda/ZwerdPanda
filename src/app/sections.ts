import {
  BookHeart,
  CalendarDays,
  Clapperboard,
  Lock,
  TrainFront,
  Flower,
  Flower2,
  Gamepad2,
  Gift,
  House,
  ListChecks,
  Images,
  Mail,
  Music,
  Orbit,
  Puzzle,
  Rabbit,
  Settings2,
  Telescope,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import type { RoutePath } from '../lib/router';

export interface Section {
  path: RoutePath;
  label: string;
  short: string;
  blurb: string;
  icon: LucideIcon;
  /** Tint used for the section's little badge in menus. */
  tint: string;
  /** A secret place: only in the menu once one of us has found it. */
  secret?: boolean;
  /** Which planet of our universe it belongs to. */
  group?: GroupId;
  /** Lives inside another place (like the quiz in the arcade), not in the menus. */
  inside?: RoutePath;
}

export type GroupId = 'story' | 'together' | 'you' | 'home';

export interface Group {
  id: GroupId;
  label: string;
  emoji: string;
  blurb: string;
  /** The planet's colours: body and ring. */
  color: string;
  ring: string;
}

/** Our universe in four little planets, so everything has a place. */
export const GROUPS: Group[] = [
  {
    id: 'story',
    label: 'Ons verhaal',
    emoji: '📖',
    blurb: 'Alles wat we al samen beleefd hebben',
    color: '#ebbfba',
    ring: '#b9646f',
  },
  {
    id: 'together',
    label: 'Samen',
    emoji: '💞',
    blurb: 'Wat we samen doen, luisteren en dromen',
    color: '#cbbfe9',
    ring: '#7d68b5',
  },
  {
    id: 'you',
    label: 'Voor jou',
    emoji: '🎀',
    blurb: 'Jouw eigen plekje en kleine verrassingen',
    color: '#f9d0e0',
    ring: '#d0668f',
  },
  {
    id: 'home',
    label: 'Ons wereldje',
    emoji: '🏡',
    blurb: 'Ons kaartje en ons kleine konijntje',
    color: '#e0ebd4',
    ring: '#6f9160',
  },
];

export const SECTIONS: Section[] = [
  {
    path: '/',
    label: 'Home',
    short: 'Home',
    blurb: 'Waar alles begint',
    icon: House,
    tint: '#f6c5a6',
  },
  {
    path: '/her',
    group: 'you',
    label: 'Your Little World',
    short: 'Jouw plekje',
    blurb: 'Helemaal van jou',
    icon: Flower2,
    tint: '#f9d0e0',
  },
  {
    path: '/flowers',
    group: 'you',
    label: 'Bloemenwinkeltje',
    short: 'Bloemen',
    blurb: 'Al je boeketten, elk in een eigen vaasje',
    icon: Flower,
    tint: '#fbd3e0',
  },
  {
    path: '/story',
    group: 'story',
    label: 'Ons Verhaal',
    short: 'Verhaal',
    blurb: 'De hoofdstukken tot nu toe',
    icon: BookHeart,
    tint: '#ebbfba',
  },
  {
    path: '/memories',
    group: 'story',
    label: 'Herinneringen',
    short: 'Momenten',
    blurb: 'Ons plakboek',
    icon: Images,
    tint: '#f8e6bb',
  },
  {
    path: '/world',
    group: 'home',
    label: 'Onze Kleine Wereld',
    short: 'Wereld',
    blurb: 'Een klein kaartje van ons',
    icon: Orbit,
    tint: '#cbbfe9',
  },
  {
    path: '/letters',
    group: 'story',
    label: 'Love Letters',
    short: 'Brieven',
    blurb: 'Open when…',
    icon: Mail,
    tint: '#f5dad6',
  },
  {
    path: '/future',
    group: 'together',
    label: 'Onze Toekomst',
    short: 'Toekomst',
    blurb: 'Dromen & ooit-plannen',
    icon: Telescope,
    tint: '#e0ebd4',
  },
  {
    path: '/surprises',
    group: 'you',
    label: 'Little Surprises',
    short: 'Surprises',
    blurb: 'Expres verstopt',
    icon: Gift,
    tint: '#fbe0cd',
  },
  {
    path: '/music',
    group: 'together',
    label: 'Music Corner',
    short: 'Muziek',
    blurb: 'Liedjes die naar ons klinken',
    icon: Music,
    tint: '#e4ddf5',
  },
  {
    path: '/coco',
    group: 'home',
    label: 'Coco’s Hoekje',
    short: 'Coco',
    blurb: 'Ons kleine konijntje',
    icon: Rabbit,
    tint: '#f0dcc4',
  },
  {
    path: '/us',
    group: 'together',
    label: 'Mini Us',
    short: 'Mini us',
    blurb: 'Wij tweetjes, maar dan mini',
    icon: UsersRound,
    tint: '#f8d3dc',
  },
  {
    path: '/games',
    group: 'together',
    label: 'Arcade Hall',
    short: 'Arcade',
    blurb: 'Neon, muntjes en UNO — samen of tegen Coco',
    icon: Gamepad2,
    tint: '#c9e4f5',
  },
  {
    path: '/quiz',
    group: 'together',
    label: 'Wie kent wie?',
    short: 'Quiz',
    inside: '/games',
    blurb: 'Hoe goed ken je de ander?',
    icon: Puzzle,
    tint: '#ffd8a8',
  },
  {
    path: '/lists',
    group: 'together',
    label: 'Onze Lijstjes',
    short: 'Lijstjes',
    blurb: 'Namen, films, eetplekjes',
    icon: ListChecks,
    tint: '#dbe6f2',
  },
  {
    path: '/agenda',
    group: 'together',
    label: 'Onze Agenda',
    short: 'Agenda',
    blurb: 'Jubileums, verjaardagen, dates & afspraken',
    icon: CalendarDays,
    tint: '#d7e8ff',
  },
  {
    path: '/cinema',
    group: 'together',
    label: 'Onze Bioscoop',
    short: 'Bioscoop',
    blurb: 'Filmpjes van ons op het grote doek, met popcorn',
    icon: Clapperboard,
    tint: '#ffd1dc',
  },
  {
    path: '/museum',
    group: 'story',
    label: 'The Love Line',
    short: 'Love Line',
    blurb: 'Het museum van ons',
    icon: TrainFront,
    tint: '#ffd75e',
    secret: true,
  },
  {
    // Not in any menu: reached through the little lock at the bottom of a page.
    path: '/secret',
    label: 'Ons geheimpje',
    short: 'Geheimpje',
    blurb: 'Alleen voor ons twee',
    icon: Lock,
    tint: '#2c0b22',
  },
  {
    path: '/settings',
    label: 'Instellingen',
    short: 'Instellingen',
    blurb: 'Namen, datums & back-ups',
    icon: Settings2,
    tint: '#f3e7d8',
  },
];

export const sectionFor = (path: RoutePath) => SECTIONS.find((s) => s.path === path) ?? SECTIONS[0];

/** Mobile tab bar: the five places we visit most. Everything else lives in the menu. */
export const TAB_PATHS: RoutePath[] = ['/', '/story', '/world', '/memories', '/letters'];

/** Desktop top navigation. */
export const DESKTOP_PATHS: RoutePath[] = [
  '/story',
  '/memories',
  '/world',
  '/letters',
  '/future',
  '/surprises',
];

/** The places on one planet, in menu order. */
export const sectionsIn = (group: GroupId) =>
  SECTIONS.filter((s) => s.group === group && !s.inside);
