import { OfflineError } from './types';

/**
 * Plain file storage, by path ("<universe>/e2e/<id>.0"). Two kinds: the
 * Supabase bucket we always have, and Cloudflare R2 (through our media-r2
 * function) once that's set up. Our photos only ever reach either one sealed.
 */
export interface StoredObject {
  /** The file name inside the folder that was listed. */
  name: string;
  createdAt: string | null;
}

export interface ObjectStore {
  /** With `create`, refuses to overwrite: false when the file already exists. */
  put(path: string, data: Blob | Uint8Array, options?: { create?: boolean }): Promise<boolean>;
  get(path: string): Promise<Uint8Array | null>;
  /** Files directly inside a folder (not in its subfolders). */
  list(folder: string): Promise<StoredObject[]>;
  remove(paths: string[]): Promise<void>;
  /** Only for R2: is the bucket reachable with our settings? */
  check?(space: string): Promise<{ ok: boolean; problem?: string }>;
}

/** The function answered, but the browser wasn't allowed to talk to R2 itself. */
export const CORS_PROBLEM =
  'Je browser mag niet bij Cloudflare R2. Controleer de CORS-regel van de bucket: daar moet precies dit adres in staan:';

function bodyOf(data: Blob | Uint8Array): Blob {
  return data instanceof Blob
    ? data
    : new Blob([data as BlobPart], { type: 'application/octet-stream' });
}

const isNetworkError = (error: unknown) =>
  error instanceof TypeError ||
  /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(
    String((error as Error)?.message ?? error),
  );

/**
 * Cloudflare R2 through the media-r2 Edge Function: the function signs a
 * short-lived link, the file goes straight between this phone and R2.
 */
export function r2Store(options: {
  functionUrl: string;
  anonKey: string;
  token: () => Promise<string | null>;
  spaceOf: (path: string) => string;
}): ObjectStore {
  const call = async <T>(body: Record<string, unknown>): Promise<T> => {
    const token = await options.token();
    if (!token) throw new Error('Log eerst in.');
    let res: Response;
    try {
      res = await fetch(options.functionUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: options.anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      if (isNetworkError(error)) throw new OfflineError();
      throw error;
    }
    const json = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(json.error ?? `Opslag gaf een fout (${res.status}).`);
    return json;
  };
  const sign = async (method: 'GET' | 'PUT', path: string) =>
    (
      await call<{ urls: string[] }>({
        op: 'sign',
        space: options.spaceOf(path),
        method,
        paths: [path],
      })
    ).urls[0];
  const send = async (url: string, init?: RequestInit) => {
    try {
      return await fetch(url, init);
    } catch (error) {
      // Just signed by our function, so we're online: this is R2 saying no (CORS).
      if (isNetworkError(error) && (typeof navigator === 'undefined' || navigator.onLine))
        throw new Error(
          `${CORS_PROBLEM} ${typeof location !== 'undefined' ? location.origin : ''}`,
        );
      if (isNetworkError(error)) throw new OfflineError();
      throw error;
    }
  };

  return {
    async put(path, data) {
      const res = await send(await sign('PUT', path), { method: 'PUT', body: bodyOf(data) });
      if (!res.ok) throw new Error(`Uploaden naar R2 lukte niet (${res.status}).`);
      return true;
    },
    async get(path) {
      const res = await send(await sign('GET', path));
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Ophalen uit R2 lukte niet (${res.status}).`);
      return new Uint8Array(await res.arrayBuffer());
    },
    async list(folder) {
      return (
        await call<{ items: StoredObject[] }>({
          op: 'list',
          space: options.spaceOf(folder),
          prefix: folder,
        })
      ).items;
    },
    async check(space) {
      try {
        return await call<{ ok: boolean; problem?: string }>({ op: 'check', space });
      } catch (error) {
        return { ok: false, problem: error instanceof Error ? error.message : String(error) };
      }
    },
    async remove(paths) {
      for (let i = 0; i < paths.length; i += 500) {
        const batch = paths.slice(i, i + 500);
        if (batch.length)
          await call({ op: 'delete', space: options.spaceOf(batch[0]), paths: batch });
      }
    },
  };
}
