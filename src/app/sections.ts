import {
  BookHeart,
  TrainFront,
  Flower2,
  Gift,
  House,
  ListChecks,
  Images,
  Mail,
  Music,
  Orbit,
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
}

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
    label: 'Her Little World',
    short: 'Haar plekje',
    blurb: 'Helemaal van haar',
    icon: Flower2,
    tint: '#f9d0e0',
  },
  {
    path: '/story',
    label: 'Ons Verhaal',
    short: 'Verhaal',
    blurb: 'De hoofdstukken tot nu toe',
    icon: BookHeart,
    tint: '#ebbfba',
  },
  {
    path: '/memories',
    label: 'Herinneringen',
    short: 'Momenten',
    blurb: 'Ons plakboek',
    icon: Images,
    tint: '#f8e6bb',
  },
  {
    path: '/world',
    label: 'Onze Kleine Wereld',
    short: 'Wereld',
    blurb: 'Een klein kaartje van ons',
    icon: Orbit,
    tint: '#cbbfe9',
  },
  {
    path: '/letters',
    label: 'Love Letters',
    short: 'Brieven',
    blurb: 'Open when…',
    icon: Mail,
    tint: '#f5dad6',
  },
  {
    path: '/future',
    label: 'Onze Toekomst',
    short: 'Toekomst',
    blurb: 'Dromen & ooit-plannen',
    icon: Telescope,
    tint: '#e0ebd4',
  },
  {
    path: '/surprises',
    label: 'Little Surprises',
    short: 'Surprises',
    blurb: 'Expres verstopt',
    icon: Gift,
    tint: '#fbe0cd',
  },
  {
    path: '/music',
    label: 'Music Corner',
    short: 'Muziek',
    blurb: 'Liedjes die naar ons klinken',
    icon: Music,
    tint: '#e4ddf5',
  },
  {
    path: '/coco',
    label: 'Coco’s Hoekje',
    short: 'Coco',
    blurb: 'Ons kleine konijntje',
    icon: Rabbit,
    tint: '#f0dcc4',
  },
  {
    path: '/us',
    label: 'Mini Us',
    short: 'Mini us',
    blurb: 'Wij tweetjes, maar dan mini',
    icon: UsersRound,
    tint: '#f8d3dc',
  },
  {
    path: '/lists',
    label: 'Onze Lijstjes',
    short: 'Lijstjes',
    blurb: 'Namen, films, eetplekjes',
    icon: ListChecks,
    tint: '#dbe6f2',
  },
  {
    path: '/museum',
    label: 'The Love Line',
    short: 'Love Line',
    blurb: 'Het museum van ons',
    icon: TrainFront,
    tint: '#ffd75e',
    secret: true,
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
