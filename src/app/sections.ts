import {
  BookHeart,
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
}

export const SECTIONS: Section[] = [
  {
    path: '/',
    label: 'Home',
    short: 'Home',
    blurb: 'Where everything starts',
    icon: House,
    tint: '#f6c5a6',
  },
  {
    path: '/story',
    label: 'Our Story',
    short: 'Story',
    blurb: 'The chapters so far',
    icon: BookHeart,
    tint: '#ebbfba',
  },
  {
    path: '/memories',
    label: 'Memories',
    short: 'Memories',
    blurb: 'Our scrapbook',
    icon: Images,
    tint: '#f8e6bb',
  },
  {
    path: '/world',
    label: 'Our Little World',
    short: 'World',
    blurb: 'A tiny map of us',
    icon: Orbit,
    tint: '#cbbfe9',
  },
  {
    path: '/letters',
    label: 'Love Letters',
    short: 'Letters',
    blurb: 'Open when…',
    icon: Mail,
    tint: '#f5dad6',
  },
  {
    path: '/future',
    label: 'Our Future',
    short: 'Future',
    blurb: 'Dreams & one-days',
    icon: Telescope,
    tint: '#e0ebd4',
  },
  {
    path: '/surprises',
    label: 'Little Surprises',
    short: 'Surprises',
    blurb: 'Hidden on purpose',
    icon: Gift,
    tint: '#fbe0cd',
  },
  {
    path: '/music',
    label: 'Music Corner',
    short: 'Music',
    blurb: 'Songs that sound like us',
    icon: Music,
    tint: '#e4ddf5',
  },
  {
    path: '/coco',
    label: 'Coco’s Corner',
    short: 'Coco',
    blurb: 'Our little rabbit',
    icon: Rabbit,
    tint: '#f0dcc4',
  },
  {
    path: '/us',
    label: 'Mini Us',
    short: 'Mini us',
    blurb: 'The two of us, but tiny',
    icon: UsersRound,
    tint: '#f8d3dc',
  },
  {
    path: '/lists',
    label: 'Our Lists',
    short: 'Lists',
    blurb: 'Names, films, places to eat',
    icon: ListChecks,
    tint: '#dbe6f2',
  },
  {
    path: '/settings',
    label: 'Settings',
    short: 'Settings',
    blurb: 'Names, dates & backups',
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
