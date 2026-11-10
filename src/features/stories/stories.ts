import { getContent, updateContent } from '../../data/store';
import { getMe, nameOf } from '../../data/people';
import type {
  AppContent,
  Memory,
  Person,
  Story,
  StoryBg,
  StoryFilter,
  StoryFont,
  StoryHighlight,
} from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { notifyOther } from '../../lib/push';

/*
 * Our stories, like on Instagram, TikTok and WhatsApp: a photo, a clip or a
 * few words on a colour, with text and stickers on top. A story is "new" for
 * a day (that's what the ring shows); after that it stays in our archive, so
 * nothing we shared is ever lost. Highlights keep the best ones together.
 */

/** How long a story counts as new, in the rings. */
export const STORY_HOURS = 24;
const HOUR = 3_600_000;

export const STORY_BGS: { id: StoryBg; label: string; css: string }[] = [
  {
    id: 'sunset',
    label: 'Zonsondergang',
    css: 'linear-gradient(160deg, #ff9a8b, #ff6a88 45%, #ff99ac)',
  },
  { id: 'lilac', label: 'Lila', css: 'linear-gradient(160deg, #c3a6ff, #8f6ed5 55%, #f6a6d8)' },
  { id: 'ocean', label: 'Zee', css: 'linear-gradient(160deg, #6dd5ed, #2193b0 60%, #1c5f8a)' },
  { id: 'mint', label: 'Matcha', css: 'linear-gradient(160deg, #d4fc79, #96e6a1 55%, #4fb38a)' },
  { id: 'night', label: 'Nacht', css: 'linear-gradient(160deg, #3a1c4f, #1f1238 55%, #0d0a1f)' },
  { id: 'blush', label: 'Blush', css: 'linear-gradient(160deg, #fde2e4, #f8b8c8 55%, #e88aa6)' },
];

export const STORY_FILTERS: { id: StoryFilter; label: string; css: string }[] = [
  { id: 'none', label: 'Normaal', css: 'none' },
  {
    id: 'warm',
    label: 'Warm',
    css: 'sepia(0.25) saturate(1.35) hue-rotate(-8deg) brightness(1.04)',
  },
  {
    id: 'cool',
    label: 'Koel',
    css: 'saturate(1.1) hue-rotate(12deg) brightness(1.03) contrast(1.05)',
  },
  { id: 'mono', label: 'Zwart-wit', css: 'grayscale(1) contrast(1.12)' },
  {
    id: 'vintage',
    label: 'Vintage',
    css: 'sepia(0.55) contrast(0.92) brightness(1.06) saturate(0.85)',
  },
  {
    id: 'dream',
    label: 'Dromerig',
    css: 'saturate(1.25) brightness(1.1) contrast(0.9) blur(0.3px)',
  },
];

export const STORY_FONTS: { id: StoryFont; label: string }[] = [
  { id: 'clean', label: 'Strak' },
  { id: 'hand', label: 'Handschrift' },
  { id: 'serif', label: 'Klassiek' },
  { id: 'bold', label: 'Dik' },
];

export const TEXT_COLORS = ['#ffffff', '#2b1630', '#ff5c8a', '#ffd166', '#7ad3ff', '#9be27a'];

export const STICKERS = [
  '❤️',
  '🥰',
  '😘',
  '🥹',
  '😂',
  '🔥',
  '✨',
  '🌸',
  '🐰',
  '🧋',
  '🍵',
  '🌙',
  '⭐',
  '💞',
  '🎀',
  '📍',
  '☀️',
  '🌧️',
  '🍓',
  '🎶',
  '💅',
  '🍿',
  '✈️',
  '🏠',
];

/** The quick reactions in the viewer. */
export const REACTIONS = ['❤️', '😍', '😂', '🥹', '🔥', '👏'];

export const filterCss = (f: StoryFilter) => STORY_FILTERS.find((x) => x.id === f)?.css ?? 'none';
export const bgCss = (b: StoryBg) => STORY_BGS.find((x) => x.id === b)?.css ?? STORY_BGS[0].css;

/* ------------------------------------------------------------- reading */

const byTime = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;

export const isFresh = (s: Story, now = Date.now()) =>
  now - Date.parse(s.createdAt) < STORY_HOURS * HOUR;

/** One person's stories of the last day, oldest first (the order they're watched in). */
export function freshStories(stories: Story[], who: Person, now = Date.now()): Story[] {
  return stories.filter((s) => s.by === who && isFresh(s, now)).sort(byTime);
}

export const viewId = (story: string, by: Person) => `sview-${story}-${by}`;

export function hasSeen(content: Pick<AppContent, 'stories'>, story: Story, me: Person) {
  return story.by === me || content.stories.views.some((v) => v.story === story.id && v.by === me);
}

/** The other one's new stories I haven't watched yet. */
export function unseenCount(content: Pick<AppContent, 'stories'>, me: Person, now = Date.now()) {
  const other: Person = me === 'you' ? 'partner' : 'you';
  return freshStories(content.stories.items, other, now).filter((s) => !hasSeen(content, s, me))
    .length;
}

/** Where to start watching someone's stories: the first one I haven't seen yet. */
export function startAt(content: Pick<AppContent, 'stories'>, list: Story[], me: Person) {
  const i = list.findIndex((s) => !hasSeen(content, s, me));
  return i < 0 ? 0 : i;
}

/** How long a story shows, in seconds: a clip as long as it is, a photo a moment. */
export function storySeconds(s: Story): number {
  if (s.media?.kind === 'video') return Math.min(60, Math.max(3, s.seconds || 15));
  const words = s.texts.reduce((n, t) => n + t.text.split(/\s+/).length, 0);
  return Math.min(10, 5 + Math.max(0, words - 8) * 0.25);
}

/** "nu", "12m", "3u", "gisteren", or the date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const ms = Math.max(0, now - Date.parse(iso));
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'nu';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}u`;
  if (h < 48) return 'gisteren';
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/** The archive, newest day first, each day's stories in the order they were posted. */
export function storiesByDay(stories: Story[]): { day: string; stories: Story[] }[] {
  const days = new Map<string, Story[]>();
  for (const s of [...stories].sort(byTime)) {
    const d = new Date(s.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    days.set(key, [...(days.get(key) ?? []), s]);
  }
  return [...days.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, list]) => ({ day, stories: list }));
}

/** A few words that say what a story is (for screen readers and the plakboek). */
export function storyWords(s: Story): string {
  const text = s.texts.map((t) => t.text).join(' · ');
  const what = s.media ? (s.media.kind === 'video' ? 'Filmpje' : 'Foto') : 'Tekst';
  return text
    ? `${what}: ${text}`
    : s.stickers.length
      ? `${what} met ${s.stickers.map((k) => k.emoji).join('')}`
      : what;
}

/* ------------------------------------------------------------- writing */

export type StoryDraft = Omit<Story, 'id' | 'by' | 'createdAt'>;

export function postStory(draft: StoryDraft): Story {
  const me = getMe();
  const story: Story = { ...draft, id: createId('story'), by: me, createdAt: nowIso() };
  updateContent((c) => ({ ...c, stories: { ...c.stories, items: [...c.stories.items, story] } }));
  notifyOther(
    'news',
    {
      title: `📸 ${nameOf(me, getContent().profile)} heeft een nieuwe story`,
      body: storyWords(story).slice(0, 120),
      url: `#/stories?s=${story.id}`,
      tag: 'story',
    },
    60_000,
  );
  return story;
}

/**
 * Stories made outside the app, uploaded together. Today they show in the
 * rings like any story; with an earlier day they go straight to the archive.
 */
export function postStories(drafts: StoryDraft[], day?: string): Story[] {
  const me = getMe();
  const base = day ? Date.parse(`${day}T12:00:00`) : Date.now();
  const stories: Story[] = drafts.map((d, i) => ({
    ...d,
    id: createId('story'),
    by: me,
    // One second apart, so they keep the order they were picked in.
    createdAt: new Date(base + i * 1000).toISOString(),
  }));
  updateContent((c) => ({
    ...c,
    stories: { ...c.stories, items: [...c.stories.items, ...stories] },
  }));
  if (!day && stories.length)
    notifyOther(
      'news',
      {
        title: `📸 ${nameOf(me, getContent().profile)} heeft ${stories.length === 1 ? 'een nieuwe story' : `${stories.length} nieuwe stories`}`,
        url: `#/stories?s=${stories[0].id}`,
        tag: 'story',
      },
      60_000,
    );
  return stories;
}

/** I watched it (once per story is enough). */
export function markSeen(story: Story) {
  const me = getMe();
  if (hasSeen(getContent(), story, me)) return;
  updateContent((c) =>
    hasSeen(c, story, me)
      ? c
      : {
          ...c,
          stories: {
            ...c.stories,
            views: [
              ...c.stories.views,
              { id: viewId(story.id, me), story: story.id, by: me, at: nowIso() },
            ],
          },
        },
  );
}

export function react(story: Story, emoji: string) {
  const me = getMe();
  updateContent((c) => ({
    ...c,
    stories: {
      ...c.stories,
      reactions: [
        ...c.stories.reactions,
        { id: createId('sreact'), story: story.id, by: me, emoji, at: nowIso() },
      ],
    },
  }));
  if (story.by !== me)
    notifyOther(
      'news',
      {
        title: `${emoji} ${nameOf(me, getContent().profile)} reageerde op je story`,
        url: `#/stories?s=${story.id}`,
        tag: 'story-react',
      },
      20_000,
    );
}

export function deleteStory(id: string) {
  updateContent((c) => ({
    ...c,
    stories: {
      items: c.stories.items.filter((s) => s.id !== id),
      views: c.stories.views.filter((v) => v.story !== id),
      reactions: c.stories.reactions.filter((r) => r.story !== id),
      highlights: c.stories.highlights.map((h) =>
        h.stories.includes(id) ? { ...h, stories: h.stories.filter((x) => x !== id) } : h,
      ),
    },
  }));
}

export function saveHighlight(h: Omit<StoryHighlight, 'id' | 'createdAt'> & { id?: string }) {
  updateContent((c) => {
    const old = h.id ? c.stories.highlights.find((x) => x.id === h.id) : undefined;
    const next: StoryHighlight = {
      id: old?.id ?? createId('shl'),
      createdAt: old?.createdAt ?? nowIso(),
      title: h.title,
      emoji: h.emoji,
      stories: h.stories,
    };
    return {
      ...c,
      stories: {
        ...c.stories,
        highlights: old
          ? c.stories.highlights.map((x) => (x.id === old.id ? next : x))
          : [...c.stories.highlights, next],
      },
    };
  });
}

export function deleteHighlight(id: string) {
  updateContent((c) => ({
    ...c,
    stories: { ...c.stories, highlights: c.stories.highlights.filter((h) => h.id !== id) },
  }));
}

/** Add a story to a highlight (or take it out when it's already there). */
export function toggleInHighlight(highlightId: string, storyId: string) {
  updateContent((c) => ({
    ...c,
    stories: {
      ...c.stories,
      highlights: c.stories.highlights.map((h) =>
        h.id !== highlightId
          ? h
          : {
              ...h,
              stories: h.stories.includes(storyId)
                ? h.stories.filter((x) => x !== storyId)
                : [...h.stories, storyId],
            },
      ),
    },
  }));
}

/** Keep a story for good in our plakboek, as a memory. */
export function storyToMemory(story: Story): Memory | null {
  if (!story.media) return null;
  const caption = story.texts
    .map((t) => t.text)
    .join(' ')
    .slice(0, 140);
  const d = new Date(story.createdAt);
  const memory: Memory = {
    id: createId('mem'),
    caption:
      caption || (story.media.kind === 'video' ? 'Uit onze stories 🎬' : 'Uit onze stories 📸'),
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    albumIds: [],
    media: story.media,
    favorite: false,
    by: story.by,
    createdAt: nowIso(),
  };
  updateContent((c) => ({ ...c, memories: [memory, ...c.memories] }));
  return memory;
}
