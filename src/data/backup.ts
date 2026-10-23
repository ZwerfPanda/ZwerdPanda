import { getContent, replaceContent } from './store';
import { looksLikeContent, normalizeContent } from './normalize';
import { referencedMediaIds } from './actions';
import { blobToDataUrl, dataUrlToBlob, getMedia, putMedia } from '../lib/media';
import { todayIso } from '../lib/dates';
import {
  getHerPrivate,
  normalizeHerPrivate,
  updateHerPrivate,
  type HerPrivate,
} from './herPrivate';

/**
 * Backups: a single JSON file containing all written content and, optionally,
 * the photos/clips themselves (embedded as data URLs). Restoring a backup is
 * how content moves between devices until a shared backend exists.
 */

interface BackupFile {
  app: 'our-little-universe';
  exportedAt: string;
  content: unknown;
  media?: Record<string, { name: string; dataUrl: string }>;
  /** Her private things, only when the backup is made on her own phone. */
  herPrivate?: HerPrivate;
}

export async function createBackup(
  includeMedia: boolean,
): Promise<{ blob: Blob; filename: string; mediaCount: number }> {
  const backup: BackupFile = {
    app: 'our-little-universe',
    exportedAt: new Date().toISOString(),
    content: getContent(),
  };
  const mine = getHerPrivate();
  if (mine.journal.length || mine.bucket.length || mine.goals.length) backup.herPrivate = mine;
  let mediaCount = 0;
  if (includeMedia) {
    backup.media = {};
    for (const mediaId of referencedMediaIds()) {
      const record = await getMedia(mediaId);
      if (!record) continue;
      backup.media[mediaId] = { name: record.name, dataUrl: await blobToDataUrl(record.blob) };
      mediaCount++;
    }
  }
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const suffix = includeMedia ? 'with-photos' : 'text-only';
  return { blob, filename: `our-little-universe-${todayIso()}-${suffix}.json`, mediaCount };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ImportPreview {
  content: ReturnType<typeof normalizeContent>;
  media: BackupFile['media'];
  herPrivate?: HerPrivate;
  summary: string;
}

/** Reads and validates a backup file without changing anything yet. */
export async function readBackup(file: File): Promise<ImportPreview> {
  if (file.size > 600 * 1024 * 1024)
    throw new Error('Dat bestand is te groot om een van onze backups te zijn.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('Dat bestand is geen geldige backup (het is geen leesbare JSON).');
  }
  const wrapper = parsed as Partial<BackupFile>;
  const raw = wrapper && wrapper.app === 'our-little-universe' ? wrapper.content : parsed;
  if (!looksLikeContent(raw)) {
    throw new Error('Dat bestand lijkt geen Our Little Universe-backup.');
  }
  const content = normalizeContent(raw);
  const media = wrapper.app === 'our-little-universe' ? wrapper.media : undefined;
  const herPrivate =
    wrapper.app === 'our-little-universe' && wrapper.herPrivate
      ? normalizeHerPrivate(wrapper.herPrivate)
      : undefined;
  const privateCount = herPrivate
    ? herPrivate.journal.length + herPrivate.bucket.length + herPrivate.goals.length
    : 0;
  const parts = [
    `${content.milestones.length} hoofdstukken`,
    `${content.memories.length} herinneringen`,
    `${content.letters.length} brieven`,
    `${content.dreams.length} dromen`,
    `${content.songs.length} liedjes`,
    `${content.playlists.length} playlists`,
    ...(privateCount ? [`${privateCount} privé dingen uit haar plekje`] : []),
  ];
  const mediaCount = media ? Object.keys(media).length : 0;
  return {
    content,
    media,
    herPrivate,
    summary: `${parts.join(', ')}${mediaCount ? ` en ${mediaCount} foto’s/clips` : ' (zonder foto’s)'}.`,
  };
}

export async function applyBackup(preview: ImportPreview) {
  if (preview.media) {
    for (const [mediaId, entry] of Object.entries(preview.media)) {
      if (!entry || typeof entry.dataUrl !== 'string' || !entry.dataUrl.startsWith('data:'))
        continue;
      const blob = await dataUrlToBlob(entry.dataUrl);
      await putMedia(blob, String(entry.name ?? 'imported'), mediaId);
    }
  }
  if (preview.herPrivate) {
    // Added to what's here; nothing private on this phone is overwritten.
    const incoming = preview.herPrivate;
    updateHerPrivate((mine) => {
      const add = <T extends { id: string }>(a: T[], b: T[]) => [
        ...a,
        ...b.filter((x) => !a.some((y) => y.id === x.id)),
      ];
      return {
        journal: add(mine.journal, incoming.journal),
        bucket: add(mine.bucket, incoming.bucket),
        goals: add(mine.goals, incoming.goals),
      };
    });
  }
  replaceContent(preview.content);
}
