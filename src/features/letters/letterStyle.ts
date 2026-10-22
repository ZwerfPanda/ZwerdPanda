import { CupSoda, Flower2, Heart, Moon, Rabbit, Star, type LucideIcon } from 'lucide-react';
import type { LetterColor, SealIcon } from '../../data/types';

export const LETTER_COLORS: Record<LetterColor, { paper: string; deep: string; ink: string; seal: string; label: string }> = {
  blush: { paper: '#f5dad6', deep: '#e7bdb7', ink: '#34202f', seal: '#a84b5c', label: 'Blush' },
  lavender: { paper: '#e4ddf5', deep: '#cbbfe9', ink: '#34202f', seal: '#6a4fa0', label: 'Lavender' },
  peach: { paper: '#fbe0cd', deep: '#f2c3a3', ink: '#34202f', seal: '#c0603f', label: 'Peach' },
  cream: { paper: '#f7eddd', deep: '#e9d8bd', ink: '#34202f', seal: '#a84b5c', label: 'Cream' },
  sage: { paper: '#e0ebd4', deep: '#c6d9b3', ink: '#34202f', seal: '#4f6d43', label: 'Sage' },
  plum: { paper: '#6a3a63', deep: '#52294f', ink: '#fff4ea', seal: '#d29c45', label: 'Plum' },
};

export const SEALS: { value: SealIcon; label: string; icon: LucideIcon }[] = [
  { value: 'heart', label: 'Heart', icon: Heart },
  { value: 'star', label: 'Star', icon: Star },
  { value: 'moon', label: 'Moon', icon: Moon },
  { value: 'flower', label: 'Flower', icon: Flower2 },
  { value: 'rabbit', label: 'Coco', icon: Rabbit },
  { value: 'matcha', label: 'Matcha', icon: CupSoda },
];

export const sealIcon = (value: SealIcon) => (SEALS.find((s) => s.value === value) ?? SEALS[0]).icon;
