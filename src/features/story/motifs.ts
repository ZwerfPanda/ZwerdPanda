import {
  CarFront,
  CupSoda,
  Heart,
  House,
  Music,
  Rabbit,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sprout,
  Star,
  TrainFront,
  type LucideIcon,
} from 'lucide-react';
import type { Motif } from '../../data/types';

export const MOTIFS: { value: Motif; label: string; icon: LucideIcon; tint: string }[] = [
  { value: 'phone', label: 'Phone', icon: Smartphone, tint: '#e4ddf5' },
  { value: 'sparkle', label: 'Spark', icon: Sparkles, tint: '#f8e6bb' },
  { value: 'bag', label: 'Date', icon: ShoppingBag, tint: '#f5dad6' },
  { value: 'matcha', label: 'Matcha', icon: CupSoda, tint: '#e0ebd4' },
  { value: 'train', label: 'Train', icon: TrainFront, tint: '#fbe0cd' },
  { value: 'car', label: 'Car', icon: CarFront, tint: '#f6c5a6' },
  { value: 'leaf', label: 'Growth', icon: Sprout, tint: '#e0ebd4' },
  { value: 'rabbit', label: 'Coco', icon: Rabbit, tint: '#f0dcc4' },
  { value: 'house', label: 'Home', icon: House, tint: '#ebbfba' },
  { value: 'star', label: 'Star', icon: Star, tint: '#f8e6bb' },
  { value: 'heart', label: 'Heart', icon: Heart, tint: '#f5dad6' },
  { value: 'music', label: 'Music', icon: Music, tint: '#e4ddf5' },
];

export const motifFor = (value: Motif) => MOTIFS.find((m) => m.value === value) ?? MOTIFS[10];

export function roman(n: number): string {
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let rest = n;
  for (const [value, symbol] of table) {
    while (rest >= value) {
      out += symbol;
      rest -= value;
    }
  }
  return out;
}
