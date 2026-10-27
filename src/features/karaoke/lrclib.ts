/*
 * Looking a song up: LRCLIB (lrclib.net) is a free, open collection of song
 * lyrics, many of them already on time (.lrc). Only what you type goes there;
 * nothing of ours.
 */

export interface FoundLyrics {
  id: number;
  title: string;
  artist: string;
  album?: string;
  /** Seconds, the length of the version the timing belongs to. */
  duration?: number;
  /** On time: ready to sing. */
  synced: string | null;
  plain: string | null;
}

const API = 'https://lrclib.net/api/search';

export async function searchLyrics(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<FoundLyrics[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12_000);
  let res: Response;
  try {
    res = await fetcher(`${API}?q=${encodeURIComponent(q)}`, { signal: abort.signal });
  } catch {
    throw new Error('Zoeken lukt nu niet (geen verbinding?). Je kunt de tekst ook zelf plakken.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Zoeken lukt nu niet (${res.status}). Probeer het zo nog eens.`);
  const raw = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(raw)) return [];
  const out: FoundLyrics[] = [];
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== 'object') continue;
    const x = r as Record<string, unknown>;
    if (x.instrumental === true) continue;
    const synced =
      typeof x.syncedLyrics === 'string' && x.syncedLyrics.trim() ? x.syncedLyrics : null;
    const plain = typeof x.plainLyrics === 'string' && x.plainLyrics.trim() ? x.plainLyrics : null;
    if (!synced && !plain) continue;
    out.push({
      id: typeof x.id === 'number' ? x.id : out.length,
      title: String(x.trackName ?? x.name ?? '').slice(0, 120) || 'Onbekend nummer',
      artist: String(x.artistName ?? '').slice(0, 120),
      album: typeof x.albumName === 'string' ? x.albumName.slice(0, 120) : undefined,
      duration: typeof x.duration === 'number' ? x.duration : undefined,
      synced,
      plain,
    });
  }
  // Ready to sing first; and the same song only once.
  const seen = new Set<string>();
  return out
    .sort((a, b) => Number(!!b.synced) - Number(!!a.synced))
    .filter((r) => {
      const key = `${r.title.toLowerCase()}|${r.artist.toLowerCase()}|${Math.round(r.duration ?? 0)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}
