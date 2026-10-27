import { getContent, updateContent } from '../../data/store';
import type { KaraokeSong, KaraokeTake, KaraokeVoice, Person } from '../../data/types';
import { createId, nowIso } from '../../lib/id';
import { putMedia } from '../../lib/media';
import { nameOf } from '../../data/people';
import { notifyOther } from '../../lib/push';

/* What the karaoke room keeps: our songs, and every take (open or official). */

export function saveSong(song: KaraokeSong) {
  updateContent((c) => ({
    ...c,
    karaoke: {
      ...c.karaoke,
      songs: c.karaoke.songs.some((s) => s.id === song.id)
        ? c.karaoke.songs.map((s) => (s.id === song.id ? song : s))
        : [...c.karaoke.songs, song],
    },
  }));
}

export function removeSong(id: string) {
  updateContent((c) => ({
    ...c,
    karaoke: {
      songs: c.karaoke.songs.filter((s) => s.id !== id),
      takes: c.karaoke.takes.filter((t) => t.song !== id),
    },
  }));
}

export function saveTake(take: KaraokeTake) {
  updateContent((c) => ({
    ...c,
    karaoke: {
      ...c.karaoke,
      takes: c.karaoke.takes.some((t) => t.id === take.id)
        ? c.karaoke.takes.map((t) => (t.id === take.id ? take : t))
        : [...c.karaoke.takes, take],
    },
  }));
}

export function removeTake(id: string) {
  updateContent((c) => ({
    ...c,
    karaoke: { ...c.karaoke, takes: c.karaoke.takes.filter((t) => t.id !== id) },
  }));
}

/** A fresh recording, kept like a photo (on this phone, and in our private cloud). */
export async function keepVoice(
  blob: Blob,
  seconds: number,
  who: KaraokeVoice['who'],
  delay: number,
  volume = 1,
): Promise<KaraokeVoice> {
  const mediaId = await putMedia(blob, 'karaoke-voice');
  return { who, mediaId, seconds, delay, volume };
}

export const newTakeId = () => createId('take');
export const now = nowIso;

/** Tells the other phone: a duet waits for them, or it's finished. */
export function tellDuet(kind: 'waiting' | 'done', me: Person, song: KaraokeSong) {
  const name = nameOf(me, getContent().profile);
  notifyOther(
    'news',
    kind === 'waiting'
      ? {
          title: `${name} zong een duet voor je in 🎤`,
          body: `“${song.title}” — zing jouw stukjes erbij`,
          url: '#/karaoke',
          tag: `duet-${song.id}`,
        }
      : {
          title: `Jullie duet is klaar 🎶`,
          body: `“${song.title}” staat bij de officiële opnames`,
          url: '#/karaoke',
          tag: `duet-${song.id}`,
        },
  );
}
