import { CupSoda, Flower2, Heart, Moon, Rabbit, Star, type LucideIcon } from 'lucide-react';
import type { LetterColor, SealIcon } from '../../data/types';

export const LETTER_COLORS: Record<
  LetterColor,
  { paper: string; deep: string; ink: string; seal: string; label: string }
> = {
  blush: { paper: '#f5dad6', deep: '#e7bdb7', ink: '#34202f', seal: '#a84b5c', label: 'Blush' },
  lavender: {
    paper: '#e4ddf5',
    deep: '#cbbfe9',
    ink: '#34202f',
    seal: '#6a4fa0',
    label: 'Lavendel',
  },
  peach: { paper: '#fbe0cd', deep: '#f2c3a3', ink: '#34202f', seal: '#c0603f', label: 'Perzik' },
  cream: { paper: '#f7eddd', deep: '#e9d8bd', ink: '#34202f', seal: '#a84b5c', label: 'Crème' },
  sage: { paper: '#e0ebd4', deep: '#c6d9b3', ink: '#34202f', seal: '#4f6d43', label: 'Salie' },
  plum: { paper: '#6a3a63', deep: '#52294f', ink: '#fff4ea', seal: '#d29c45', label: 'Pruim' },
};

export const SEALS: { value: SealIcon; label: string; icon: LucideIcon }[] = [
  { value: 'heart', label: 'Hartje', icon: Heart },
  { value: 'star', label: 'Ster', icon: Star },
  { value: 'moon', label: 'Maan', icon: Moon },
  { value: 'flower', label: 'Bloem', icon: Flower2 },
  { value: 'rabbit', label: 'Coco', icon: Rabbit },
  { value: 'matcha', label: 'Matcha', icon: CupSoda },
];

export const sealIcon = (value: SealIcon) =>
  (SEALS.find((s) => s.value === value) ?? SEALS[0]).icon;
