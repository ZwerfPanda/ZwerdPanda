import {
  CalendarHeart,
  CircleCheck,
  CircleDashed,
  Flag,
  GraduationCap,
  HeartHandshake,
  House,
  ListChecks,
  LoaderCircle,
  MapPin,
  Sparkles,
  Ticket,
  type LucideIcon,
} from 'lucide-react';
import type { DreamCategory, DreamStatus } from '../../data/types';

export type DreamLook = 'postcard' | 'ticket' | 'card' | 'blueprint' | 'soft';

export const CATEGORIES: Record<
  DreamCategory,
  { label: string; icon: LucideIcon; look: DreamLook }
> = {
  places: { label: 'Plekken om te bezoeken', icon: MapPin, look: 'postcard' },
  dates: { label: 'Dates om te doen', icon: Ticket, look: 'ticket' },
  try: { label: 'Dingen om te proberen', icon: Sparkles, look: 'card' },
  home: { label: 'Thuis & wonen', icon: House, look: 'blueprint' },
  milestones: { label: 'Persoonlijke mijlpalen', icon: Flag, look: 'soft' },
  family: { label: 'Gezinsdromen', icon: HeartHandshake, look: 'soft' },
  learn: { label: 'Samen leren', icon: GraduationCap, look: 'card' },
  anniversary: { label: 'Jubileum-ideeën', icon: CalendarHeart, look: 'soft' },
  bucket: { label: 'Bucket list', icon: ListChecks, look: 'card' },
};

export const CATEGORY_ORDER = Object.keys(CATEGORIES) as DreamCategory[];

export const STATUSES: Record<DreamStatus, { label: string; icon: LucideIcon; next: DreamStatus }> =
  {
    planned: { label: 'Gepland', icon: CircleDashed, next: 'progress' },
    progress: { label: 'Bezig', icon: LoaderCircle, next: 'done' },
    done: { label: 'Gedaan', icon: CircleCheck, next: 'planned' },
  };
