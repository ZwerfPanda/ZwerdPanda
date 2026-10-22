/**
 * A tiny async key-value store in IndexedDB. Used for the sign-in session so
 * it stays out of localStorage; passwords are never stored anywhere.
 */

const DB_NAME = 'our-little-universe-kv';
const STORE = 'kv';
let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = fn(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export const kvStore = {
  async getItem(key: string): Promise<string | null> {
    try {
      const value = await run<unknown>('readonly', (s) => s.get(key));
      return typeof value === 'string' ? value : null;
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    await run('readwrite', (s) => s.put(value, key));
  },
  async removeItem(key: string): Promise<void> {
    await run('readwrite', (s) => s.delete(key));
  },
};
