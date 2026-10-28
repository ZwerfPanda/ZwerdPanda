import { getContent, updateContent } from '../../data/store';
import type { AppContent, OurRecord, Person, RecordListen } from '../../data/types';
import { nameOf } from '../../data/people';
import { notifyOther } from '../../lib/push';
import { todayIso } from '../../lib/dates';

/*
 * The music room's records: the songs we made for each other. Listening,
 * a heart and a little note are kept per person (each of us only ever
 * changes our own), so the two phones never trip over each other.
 */

/** Sleeves for a record without a photo: our colours, warm like the room. */
export const SLEEVES = [
  { name: 'Roos', bg: 'linear-gradient(145deg, #f7b2c4, #c95d7f)', ink: '#3b0f22', motif: '♡' },
  { name: 'Pruim', bg: 'linear-gradient(145deg, #8a5bb5, #3e1f5c)', ink: '#fbeaff', motif: '☾' },
  {
    name: 'Zonsondergang',
    bg: 'linear-gradient(145deg, #ffcf8a, #e8676b)',
    ink: '#3d1407',
    motif: '☀',
  },
  { name: 'Zee', bg: 'linear-gradient(145deg, #8fd3e8, #2f6aa3)', ink: '#06213b', motif: '〰' },
  { name: 'Matcha', bg: 'linear-gradient(145deg, #c9e4a8, #5e8a4a)', ink: '#18300f', motif: '✿' },
  { name: 'Goud', bg: 'linear-gradient(145deg, #ffe7a1, #c9952e)', ink: '#3a2600', motif: '✦' },
  { name: 'Lavendel', bg: 'linear-gradient(145deg, #e3d4ff, #9a7fd6)', ink: '#24124a', motif: '❀' },
  { name: 'Nacht', bg: 'linear-gradient(145deg, #3a3d6b, #12122a)', ink: '#f3eeff', motif: '★' },
] as const;

export function saveRecord(record: OurRecord) {
  const isNew = !getContent().studio.records.some((r) => r.id === record.id);
  updateContent((c) => ({
    ...c,
    studio: {
      ...c.studio,
      records: isNew
        ? [...c.studio.records, record]
        : c.studio.records.map((r) => (r.id === record.id ? record : r)),
    },
  }));
  if (isNew) {
    const name = nameOf(record.by, getContent().profile);
    const gift = wrapped(record);
    notifyOther('news', {
      title: gift
        ? `${name} heeft een cadeautje voor je ingepakt 🎁`
        : `${name} heeft een liedje voor je gemaakt 🎶`,
      body: gift
        ? `Het mag open op ${record.opensOn}`
        : `“${record.title}” staat in de muziekkamer`,
      url: '#/muziekkamer',
      tag: `record-${record.id}`,
    });
  }
}

export function removeRecord(id: string) {
  updateContent((c) => ({
    ...c,
    studio: {
      records: c.studio.records.filter((r) => r.id !== id),
      listens: c.studio.listens.filter((l) => l.record !== id),
    },
  }));
}

export const listenOf = (c: Pick<AppContent, 'studio'>, record: string, who: Person) =>
  c.studio.listens.find((l) => l.id === `${record}:${who}`);

function changeListen(record: string, who: Person, recipe: (l: RecordListen) => RecordListen) {
  updateContent((c) => {
    const id = `${record}:${who}`;
    const had = c.studio.listens.find((l) => l.id === id);
    const next = recipe(had ?? { id, record, who, plays: 0 });
    return {
      ...c,
      studio: {
        ...c.studio,
        listens: had
          ? c.studio.listens.map((l) => (l.id === id ? next : l))
          : [...c.studio.listens, next],
      },
    };
  });
}

/** One more time listened (counted once a song really got heard). */
export function countPlay(record: string, who: Person) {
  const now = new Date().toISOString();
  changeListen(record, who, (l) => ({
    ...l,
    plays: l.plays + 1,
    firstAt: l.firstAt ?? now,
    lastAt: now,
  }));
}

export function toggleHeart(record: string, who: Person) {
  changeListen(record, who, (l) => {
    const { heart, ...rest } = l;
    return heart ? rest : { ...rest, heart: true };
  });
}

export function setNote(record: string, who: Person, note: string) {
  changeListen(record, who, (l) => ({ ...l, note: note.trim().slice(0, 1000) || undefined }));
}

/** Still wrapped: a gift for a day that hasn't come yet. */
export const wrapped = (r: OurRecord, today = todayIso()) => !!r.opensOn && r.opensOn > today;

/** Made by the other one for me (or us), and I haven't listened yet. */
export function newForMe(c: Pick<AppContent, 'studio'>, me: Person, today = todayIso()) {
  return c.studio.records
    .filter((r) => r.by !== me && (r.for === me || r.for === 'both'))
    .filter((r) => !wrapped(r, today) && !listenOf(c, r.id, me)?.plays)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Days until a wrapped gift opens. */
export function daysUntilOpen(r: OurRecord, today = todayIso()): number {
  if (!r.opensOn) return 0;
  return Math.max(0, Math.round((Date.parse(r.opensOn) - Date.parse(today)) / 86_400_000));
}
