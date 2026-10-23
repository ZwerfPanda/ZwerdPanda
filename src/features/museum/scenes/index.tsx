import type { ComponentType } from 'react';
import type { StopTheme } from '../../../data/types';
import { useContent } from '../../../data/store';
import { UsProvider } from './kit';
import {
  BirdsScene,
  BubbleTeaScene,
  HomeScene,
  MallScene,
  PastaScene,
  PlatformScene,
  StationScene,
} from './scenesA';
import {
  AmsterdamScene,
  ChickenScene,
  CinemaScene,
  HotelScene,
  IkeaScene,
  RoadtripScene,
  ThemeparkScene,
} from './scenesB';
import {
  ChristmasScene,
  DateScene,
  HolidayScene,
  MiniatureScene,
  PumpkinScene,
  SpaScene,
} from './scenesC';
import './scenes.css';

const SCENES: Record<StopTheme, ComponentType> = {
  home: HomeScene,
  station: StationScene,
  platform: PlatformScene,
  bubbletea: BubbleTeaScene,
  mall: MallScene,
  birds: BirdsScene,
  pasta: PastaScene,
  hotel: HotelScene,
  themepark: ThemeparkScene,
  roadtrip: RoadtripScene,
  cinema: CinemaScene,
  chicken: ChickenScene,
  ikea: IkeaScene,
  amsterdam: AmsterdamScene,
  miniature: MiniatureScene,
  pumpkin: PumpkinScene,
  spa: SpaScene,
  holiday: HolidayScene,
  christmas: ChristmasScene,
  date: DateScene,
};

/** Mini us at one of our stops, in that stop's own little world. */
export function StopScene({ theme, label }: { theme: StopTheme; label: string }) {
  const us = useContent((c) => c.us);
  const Scene = SCENES[theme] ?? DateScene;
  return (
    <svg
      className={`stop-scene stop-scene--${theme}`}
      viewBox="-240 -380 480 400"
      role="img"
      aria-label={label}
    >
      <UsProvider us={us}>
        <Scene />
      </UsProvider>
    </svg>
  );
}
