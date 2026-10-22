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
  places: { label: 'Places to visit', icon: MapPin, look: 'postcard' },
  dates: { label: 'Dates to go on', icon: Ticket, look: 'ticket' },
  try: { label: 'Things to try', icon: Sparkles, look: 'card' },
  home: { label: 'Home & living', icon: House, look: 'blueprint' },
  milestones: { label: 'Personal milestones', icon: Flag, look: 'soft' },
  family: { label: 'Family dreams', icon: HeartHandshake, look: 'soft' },
  learn: { label: 'Learn together', icon: GraduationCap, look: 'card' },
  anniversary: { label: 'Anniversary ideas', icon: CalendarHeart, look: 'soft' },
  bucket: { label: 'Bucket list', icon: ListChecks, look: 'card' },
};

export const CATEGORY_ORDER = Object.keys(CATEGORIES) as DreamCategory[];

export const STATUSES: Record<DreamStatus, { label: string; icon: LucideIcon; next: DreamStatus }> =
  {
    planned: { label: 'Planned', icon: CircleDashed, next: 'progress' },
    progress: { label: 'In progress', icon: LoaderCircle, next: 'done' },
    done: { label: 'Done', icon: CircleCheck, next: 'planned' },
  };
