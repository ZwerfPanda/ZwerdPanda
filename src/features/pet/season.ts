import { useSyncExternalStore } from 'react';
import type { PetOutfit } from '../../data/types';

/** Times of year when Coco's den is decorated. */
export type Season = 'birthday' | 'halloween' | 'christmas' | 'valentine' | 'easter';

/** What she wears for the occasion (drawn like an outfit, never saved as one). */
export type Costume = 'witch' | 'santa';
export type CocoLook = PetOutfit | Costume;

const pad = (n: number) => String(n).padStart(2, '0');

/** Easter Sunday as YYYY-MM-DD (the Gregorian computus). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${pad(month)}-${pad(day)}`;
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Which season it is on a day (YYYY-MM-DD), if any. Her birthday wins. */
export function seasonOn(today: string, cocoBirthday?: string): Season | null {
  const md = today.slice(5);
  if (cocoBirthday && cocoBirthday.slice(5) === md) return 'birthday';
  if (md >= '10-15' && md <= '10-31') return 'halloween';
  if (md >= '12-01' || md <= '01-06') return 'christmas';
  if (md >= '02-07' && md <= '02-14') return 'valentine';
  const easter = easterSunday(Number(today.slice(0, 4)));
  if (today >= shift(easter, -7) && today <= shift(easter, 1)) return 'easter';
  return null;
}

/** The little line in her den, for the season. */
export function seasonLine(season: Season, today: string): string {
  const md = today.slice(5);
  switch (season) {
    case 'birthday':
      return '🎈 Feest in het hok: slingers, ballonnen en Coco met haar feesthoedje op.';
    case 'halloween':
      return md === '10-31'
        ? '🎃 Fijne Halloween! Coco is verkleed als klein heksje — snoep of een wortel?'
        : '🎃 Het is bijna Halloween: Coco is verkleed als klein heksje.';
    case 'christmas':
      return md >= '12-24' && md <= '12-26'
        ? '🎄 Fijne kerst! Coco draagt haar kerstmuts en het sneeuwt buiten.'
        : md <= '01-06'
          ? '❄️ Gelukkig nieuwjaar! Het sneeuwt nog even in Coco’s hok.'
          : '❄️ Het sneeuwt buiten en Coco heeft haar kerstmuts op.';
    case 'valentine':
      return md === '02-14'
        ? '💗 Fijne Valentijnsdag! Coco’s hok hangt vol hartjes.'
        : '💗 Valentijnsweek: Coco’s hok hangt vol hartjes.';
    case 'easter':
      return '🥚 Vrolijk Pasen! Een echt paashaasje — ze heeft eitjes in haar hok gelegd.';
  }
}

/** What she wears, if the season gives her something. */
export function seasonLook(season: Season | null): CocoLook | null {
  if (season === 'birthday') return 'party';
  if (season === 'halloween') return 'witch';
  if (season === 'christmas') return 'santa';
  return null;
}

/* The costume can be taken off: a per-device choice, remembered per season. */

const KEY = 'olu:costume-off:v1';
const listeners = new Set<() => void>();

function readOff(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

let off = typeof window !== 'undefined' ? readOff() : '';

/** e.g. "halloween-2026": one choice per season per year. */
export const seasonKey = (season: Season, today: string) => {
  // Christmas runs into January: it belongs to the December it started in.
  const year =
    Number(today.slice(0, 4)) - (season === 'christmas' && today.slice(5) <= '01-06' ? 1 : 0);
  return `${season}-${year}`;
};

export function setCostumeOff(key: string, value: boolean) {
  off = value ? key : '';
  try {
    if (off) localStorage.setItem(KEY, off);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * The season in her den, and whether she has its costume on. The costume can
 * be taken off (per device, per season); dressing her up yourself does that too.
 */
export function useCocoSeason(today: string, birthday: string) {
  const offKey = useSyncExternalStore(
    subscribe,
    () => off,
    () => off,
  );
  const season = seasonOn(today, birthday);
  const costume = seasonLook(season);
  const key = season ? seasonKey(season, today) : '';
  const wearing = Boolean(costume) && offKey !== key;
  return {
    season,
    costume,
    wearing,
    look: (outfit: PetOutfit): CocoLook => (wearing && costume ? costume : outfit),
    setWearing: (on: boolean) => {
      if (key) setCostumeOff(key, !on);
    },
  };
}
