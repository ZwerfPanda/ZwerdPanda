import { getContent, replaceContent } from './store';
import { looksLikeContent, normalizeContent } from './normalize';
import { referencedMediaIds } from './actions';
import { blobToDataUrl, dataUrlToBlob, getMedia, putMedia } from '../lib/media';
import { todayIso } from '../lib/dates';

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
}

export async function createBackup(includeMedia: boolean): Promise<{ blob: Blob; filename: string; mediaCount: number }> {
  const backup: BackupFile = {
    app: 'our-little-universe',
    exportedAt: new Date().toISOString(),
    content: getContent(),
  };
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
  summary: string;
}

/** Reads and validates a backup file without changing anything yet. */
export async function readBackup(file: File): Promise<ImportPreview> {
  if (file.size > 600 * 1024 * 1024) throw new Error('That file is too large to be one of our backups.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('That file isn’t a valid backup (it isn’t readable JSON).');
  }
  const wrapper = parsed as Partial<BackupFile>;
  const raw = wrapper && wrapper.app === 'our-little-universe' ? wrapper.content : parsed;
  if (!looksLikeContent(raw)) {
    throw new Error('That file doesn’t look like an Our Little Universe backup.');
  }
  const content = normalizeContent(raw);
  const media = wrapper.app === 'our-little-universe' ? wrapper.media : undefined;
  const parts = [
    `${content.milestones.length} chapters`,
    `${content.memories.length} memories`,
    `${content.letters.length} letters`,
    `${content.dreams.length} dreams`,
    `${content.songs.length} songs`,
  ];
  const mediaCount = media ? Object.keys(media).length : 0;
  return {
    content,
    media,
    summary: `${parts.join(', ')}${mediaCount ? `, and ${mediaCount} photos/clips` : ' (no photos included)'}.`,
  };
}

export async function applyBackup(preview: ImportPreview) {
  if (preview.media) {
    for (const [mediaId, entry] of Object.entries(preview.media)) {
      if (!entry || typeof entry.dataUrl !== 'string' || !entry.dataUrl.startsWith('data:')) continue;
      const blob = await dataUrlToBlob(entry.dataUrl);
      await putMedia(blob, String(entry.name ?? 'imported'), mediaId);
    }
  }
  replaceContent(preview.content);
}
