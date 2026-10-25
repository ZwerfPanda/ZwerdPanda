import type { AppContent } from '../data/types';
import { fingerprint } from './fingerprint';
import {
  carryForward,
  contentMediaIds,
  mergeContent,
  mergeFirstJoin,
  stableEqual,
  writerSchema,
} from './merge';
import { CONTENT_SCHEMA } from '../data/defaults';
import {
  OfflineError,
  type Account,
  type LiveLine,
  type SyncBackend,
  type SyncState,
} from './types';

/**
 * Keeps this device and the shared universe in step.
 *
 * - Changes made here are saved to the server shortly after they happen.
 * - Changes saved by the other phone arrive live (or on the next check) and
 *   are merged with anything not yet sent from here.
 * - Saves carry the version they were based on; if the other phone saved
 *   first, both sets of changes are merged and the save is retried.
 * - Photos are uploaded in the background and downloaded when first shown.
 * Everything keeps working offline and catches up when the connection returns.
 */

export interface EngineDeps {
  getContent(): AppContent;
  /** Puts a copy that came from the server into the app (without sending it back). */
  applyRemote(content: AppContent): void;
  onLocalChange(listener: () => void): () => void;
  normalize(raw: unknown): AppContent;
  getLocalMedia(id: string): Promise<Blob | null>;
  setRemoteMediaSource(fetcher: ((id: string) => Promise<Blob | null>) | null): void;
  retryMissingMedia(): void;
  /** Photos to keep in the cloud even if nothing uses them now (restore points). */
  keepMedia?(): Promise<Set<string>>;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  /** Hook for window focus/online events; returns a cleanup function. */
  watchConnectivity?(onWake: () => void): () => void;
  pushDelay?: number;
  pollInterval?: number;
}

interface Meta {
  userId: string;
  spaceId: string;
  baseVersion: number;
  pending: boolean;
  lastCleanup?: string;
  /** Cloud photos nothing uses: since when (they're kept a month after). */
  unusedSince?: Record<string, string>;
}

const META_KEY = 'olu:sync:meta:v1';
const BASE_KEY = 'olu:sync:base:v1';
const UPLOADED_KEY = 'olu:sync:uploaded:v1';
/** As long as the oldest copy in the cloud history, plus a little. */
const CLEANUP_AFTER_DAYS = 100;

const INITIAL: SyncState = {
  phase: 'starting',
  account: null,
  spaceId: null,
  members: [],
  invites: [],
  owner: null,
  lastSyncedAt: null,
  pendingChanges: false,
  uploading: 0,
  error: null,
  recovery: false,
};

function isOffline(error: unknown): boolean {
  if (error instanceof OfflineError) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|networkerror|network request failed|load failed|timeout|fetch failed/i.test(
    message,
  );
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Er ging iets mis bij het syncen.';
}

export class SyncEngine {
  private state: SyncState = { ...INITIAL };
  private listeners = new Set<() => void>();
  private meta: Meta | null = null;
  private base: AppContent | null = null;
  private busy = false;
  private again = false;
  private uploading = false;
  /** Photos the server refused this session (shown in the Samen-check). */
  private uploadFailed = new Set<string>();
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cleanups: (() => void)[] = [];
  private line: LiveLine | null = null;
  private liveListeners = new Set<(message: unknown) => void>();
  private accountCleanups: (() => void)[] = [];

  constructor(
    private backend: SyncBackend,
    private deps: EngineDeps,
  ) {
    this.meta = this.read<Meta>(META_KEY);
    this.base = this.meta ? this.readBase() : null;
  }

  // ------------------------------------------------------------- state

  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  // ---------------------------------------------------------- lifecycle

  async start() {
    this.accountCleanups.push(
      this.backend.onAccountChange((account) => void this.accountChanged(account)),
      this.backend.onPasswordRecovery(() => this.set({ recovery: true })),
    );
    try {
      await this.accountChanged(await this.backend.getAccount());
    } catch (error) {
      this.fail(error);
    }
  }

  /** Which account we're connected for (undefined until known), to ignore repeats. */
  private accountId: string | null | undefined = undefined;

  private async accountChanged(account: Account | null) {
    const id = account?.id ?? null;
    if (id === this.accountId) {
      if (account) this.set({ account }); // e.g. a refreshed session
      return;
    }
    this.accountId = id;
    if (!account) {
      this.detach();
      this.set({ ...INITIAL, phase: 'signed-out', recovery: this.state.recovery });
      return;
    }
    this.set({ account, phase: 'syncing', error: null });
    await this.connect();
  }

  /** Finds (or joins, when invited) our shared universe and starts syncing. */
  async connect() {
    try {
      this.set({ phase: 'syncing', error: null });
      const spaceId = await this.backend.joinInvitedSpace();
      if (!spaceId) {
        this.set({ phase: 'needs-space', spaceId: null });
        return;
      }
      await this.attach(spaceId);
    } catch (error) {
      this.fail(error);
    }
  }

  async createSpace(partnerEmail: string) {
    const spaceId = await this.backend.createSpace(partnerEmail);
    await this.attach(spaceId);
  }

  async invite(email: string) {
    if (!this.state.spaceId) throw new Error('Maak eerst ons gedeelde universe aan.');
    await this.backend.invite(this.state.spaceId, email);
    await this.refreshPeople();
  }

  private async attach(spaceId: string) {
    this.detach();
    const account = this.state.account;
    if (!account) return;
    this.set({ spaceId, phase: 'syncing' });
    this.deps.setRemoteMediaSource((id) => this.downloadMedia(id));

    const known =
      this.meta && this.meta.spaceId === spaceId && this.meta.userId === account.id && this.base;
    if (!known) {
      // First time this device meets this universe.
      const remote = await this.backend.fetchContent(spaceId);
      if (remote.version === 0) {
        this.meta = { userId: account.id, spaceId, baseVersion: 0, pending: true };
        this.base = this.deps.getContent();
      } else {
        const { shared, restored } = this.adopt(remote.content, this.deps.getContent());
        const merged = mergeFirstJoin(this.deps.getContent(), shared);
        this.meta = {
          userId: account.id,
          spaceId,
          baseVersion: remote.version,
          pending: restored || !stableEqual(merged, shared),
        };
        this.base = shared;
        this.deps.applyRemote(merged);
      }
      this.persist();
    }

    this.cleanups.push(
      this.deps.onLocalChange(() => this.localChanged()),
      this.backend.subscribe(spaceId, () => void this.pull()),
    );
    if (this.backend.live) {
      const line = this.backend.live(spaceId, (message) =>
        this.liveListeners.forEach((listener) => listener(message)),
      );
      this.line = line;
      this.cleanups.push(() => {
        line.close();
        if (this.line === line) this.line = null;
      });
    }
    if (this.deps.watchConnectivity)
      this.cleanups.push(this.deps.watchConnectivity(() => void this.syncNow()));
    const interval = this.deps.pollInterval ?? 90_000;
    if (interval > 0) this.pollTimer = setInterval(() => void this.pull(), interval);

    await this.syncNow();
    void this.refreshPeople();
    void this.cleanupRemoteMedia();
  }

  private detach() {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    if (this.pushTimer) clearTimeout(this.pushTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pushTimer = null;
    this.pollTimer = null;
    this.deps.setRemoteMediaSource(null);
  }

  /** Stops syncing on this device. The device keeps its own copy. */
  async signOut() {
    this.detach();
    this.forget();
    this.accountId = null;
    await this.backend.signOut();
    this.set({ ...INITIAL, phase: 'signed-out' });
  }

  stop() {
    this.detach();
    this.accountCleanups.forEach((cleanup) => cleanup());
    this.accountCleanups = [];
  }

  private forget() {
    this.meta = null;
    this.base = null;
    this.deps.storage.removeItem(META_KEY);
    this.deps.storage.removeItem(BASE_KEY);
    this.deps.storage.removeItem(UPLOADED_KEY);
  }

  // ---------------------------------------------------------------- live

  /** Sends something to the other phone right away (if it's listening). */
  sendLive(message: unknown) {
    this.line?.send(message);
  }

  /** What the other phone sends right away. */
  onLive(listener: (message: unknown) => void): () => void {
    this.liveListeners.add(listener);
    return () => this.liveListeners.delete(listener);
  }

  // ------------------------------------------------------------- syncing

  private localChanged() {
    if (!this.meta) return;
    if (!this.meta.pending) {
      this.meta.pending = true;
      this.persistMeta();
      this.set({ pendingChanges: true });
    }
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => void this.syncNow(), this.deps.pushDelay ?? 1200);
  }

  /** Fetches the latest shared copy, merges, and sends anything unsent. */
  async syncNow() {
    if (!this.meta || !this.state.spaceId) return;
    if (this.busy) {
      this.again = true;
      return;
    }
    this.busy = true;
    this.set({ phase: 'syncing' });
    try {
      do {
        this.again = false;
        await this.pullOnce();
        if (this.meta.pending) await this.pushOnce();
      } while (this.again);
      this.set({
        phase: 'synced',
        lastSyncedAt: new Date().toISOString(),
        error: null,
        pendingChanges: this.meta.pending,
      });
      // Photos the other phone was still uploading last time: look again on every sync,
      // not only when the content changed (an upload alone doesn't change it).
      this.deps.retryMissingMedia();
      void this.uploadMedia();
      // Until both of us are in, keep an eye out for the other person joining.
      if (this.state.members.length < 2) void this.refreshPeople();
    } catch (error) {
      this.fail(error);
    } finally {
      this.busy = false;
    }
  }

  /** Called when the other phone saved something. */
  async pull() {
    await this.syncNow();
  }

  private async pullOnce() {
    const meta = this.meta!;
    const remote = await this.backend.fetchContent(meta.spaceId);
    if (remote.version === 0) {
      meta.pending = true;
      return;
    }
    if (remote.version === meta.baseVersion) return;
    const local = this.deps.getContent();
    const { shared, restored } = this.adopt(remote.content, this.base ?? local);
    const next = meta.pending && this.base ? mergeContent(this.base, local, shared) : shared;
    this.base = shared;
    meta.baseVersion = remote.version;
    // What an older app couldn't save goes back to the server straight away.
    meta.pending = (meta.pending && !stableEqual(next, shared)) || restored;
    if (!stableEqual(next, local)) this.deps.applyRemote(next);
    this.persist();
    this.deps.retryMissingMedia();
  }

  private async pushOnce() {
    const meta = this.meta!;
    for (let attempt = 0; attempt < 5; attempt++) {
      const snapshot = this.deps.getContent();
      const result = await this.backend.saveContent(meta.spaceId, meta.baseVersion, snapshot);
      if (result.saved) {
        this.base = snapshot;
        meta.baseVersion = result.version;
        meta.pending = this.deps.getContent() !== snapshot; // edited while saving
        this.persist();
        return;
      }
      if (result.current == null) {
        // The shared copy disappeared (or never existed): save ours as the first.
        meta.baseVersion = result.version;
        continue;
      }
      const local = this.deps.getContent();
      const { shared, restored } = this.adopt(result.current, this.base ?? local);
      const merged =
        meta.baseVersion === 0 || !this.base
          ? mergeFirstJoin(local, shared)
          : mergeContent(this.base, local, shared);
      this.base = shared;
      meta.baseVersion = result.version;
      if (!stableEqual(merged, local)) this.deps.applyRemote(merged);
      this.persist();
      if (!restored && stableEqual(merged, shared)) {
        meta.pending = false;
        this.persistMeta();
        return;
      }
    }
    throw new Error('De andere telefoon slaat precies tegelijk op — we proberen het zo opnieuw.');
  }

  /**
   * The shared copy as this app reads it. An older app on the other phone
   * saves without the parts it doesn't know; those are kept from `ours` and
   * `restored` says they still have to go back to the server.
   */
  private adopt(raw: unknown, ours: AppContent): { shared: AppContent; restored: boolean } {
    const shared = this.deps.normalize(raw);
    const writer = writerSchema(raw);
    if (writer >= CONTENT_SCHEMA) return { shared, restored: false };
    const kept = carryForward(shared, ours, writer);
    return { shared: kept, restored: !stableEqual(kept, shared) };
  }

  private fail(error: unknown) {
    if (isOffline(error)) {
      this.set({ phase: 'offline', error: null, pendingChanges: Boolean(this.meta?.pending) });
    } else {
      this.set({ phase: 'error', error: messageOf(error) });
    }
  }

  private async refreshPeople() {
    if (!this.state.spaceId) return;
    try {
      const people = await this.backend.people(this.state.spaceId);
      this.set({ members: people.members, invites: people.invites, owner: people.owner });
    } catch {
      // Not important enough to interrupt anything.
    }
  }

  // --------------------------------------------------------------- media

  private uploadedIds(): Set<string> {
    return new Set(this.read<string[]>(UPLOADED_KEY) ?? []);
  }

  private markUploaded(ids: Set<string>) {
    this.write(UPLOADED_KEY, [...ids]);
  }

  private async downloadMedia(id: string): Promise<Blob | null> {
    const spaceId = this.state.spaceId;
    if (!spaceId) return null;
    try {
      const blob = await this.backend.downloadMedia(spaceId, id);
      if (blob) {
        const ids = this.uploadedIds();
        ids.add(id);
        this.markUploaded(ids);
      }
      return blob;
    } catch {
      return null;
    }
  }

  /** Sends photos added on this device to the shared storage, one by one. */
  private async uploadMedia() {
    const spaceId = this.state.spaceId;
    if (this.uploading || !spaceId) return;
    this.uploading = true;
    try {
      const done = this.uploadedIds();
      const todo = contentMediaIds(this.deps.getContent()).filter((id) => !done.has(id));
      let left = todo.length;
      for (const id of todo) {
        const blob = await this.deps.getLocalMedia(id);
        if (blob) {
          this.set({ uploading: left });
          try {
            await this.backend.uploadMedia(spaceId, id, blob);
            done.add(id);
            this.markUploaded(done);
          } catch (error) {
            // No connection: stop and try everything again later.
            if (error instanceof OfflineError) throw error;
            // One photo the server refuses (too big, say) mustn't hold up all the others.
            this.uploadFailed.add(id);
          }
        }
        left--;
      }
    } catch (error) {
      this.fail(error);
    } finally {
      this.uploading = false;
      this.set({ uploading: 0 });
    }
  }

  /**
   * Fetches the shared copy and compares it with this phone's: the same
   * fingerprint means this phone sees exactly what's on the server.
   */
  async verify(): Promise<{ local: string; server: string } | null> {
    const spaceId = this.state.spaceId;
    if (!spaceId) return null;
    const remote = await this.backend.fetchContent(spaceId);
    if (!remote.version) return null;
    return {
      local: fingerprint(this.deps.getContent()),
      server: fingerprint(this.deps.normalize(remote.content)),
    };
  }

  /** Photos we use: how many are online, and which are missing there (and if this phone has them). */
  async mediaStatus(): Promise<{
    total: number;
    online: number;
    missing: number;
    here: number;
    refused: number;
  }> {
    const spaceId = this.state.spaceId;
    const used = contentMediaIds(this.deps.getContent());
    if (!spaceId)
      return { total: used.length, online: 0, missing: used.length, here: 0, refused: 0 };
    const remote = new Set((await this.backend.listMedia(spaceId)).map((m) => m.id));
    const missing = used.filter((id) => !remote.has(id));
    let here = 0;
    for (const id of missing) if (await this.deps.getLocalMedia(id)) here++;
    return {
      total: used.length,
      online: used.length - missing.length,
      missing: missing.length,
      here,
      refused: missing.filter((id) => this.uploadFailed.has(id)).length,
    };
  }

  /** Earlier copies the server kept, newest first. */
  async cloudHistory() {
    if (!this.state.spaceId) return [];
    return this.backend.listHistory(this.state.spaceId);
  }

  async readCloudHistory(id: string): Promise<AppContent | null> {
    if (!this.state.spaceId) return null;
    const raw = await this.backend.fetchHistory(this.state.spaceId, id);
    return raw ? this.deps.normalize(raw) : null;
  }

  /** Cloud photos nothing in our universe uses right now. */
  async listUnusedMedia(): Promise<string[]> {
    if (!this.state.spaceId) return [];
    const used = new Set(contentMediaIds(this.deps.getContent()));
    (await this.deps.keepMedia?.().catch(() => new Set<string>()))?.forEach((id) => used.add(id));
    return (await this.backend.listMedia(this.state.spaceId))
      .map((m) => m.id)
      .filter((id) => !used.has(id));
  }

  /**
   * Removes photos nothing uses any more — only once they've been unused for
   * a whole month, so a photo that went missing can still be brought back.
   */
  private async cleanupRemoteMedia() {
    const meta = this.meta;
    if (!meta || !this.state.spaceId) return;
    const day = new Date().toISOString().slice(0, 10);
    if (meta.lastCleanup === day) return;
    try {
      const unused = await this.listUnusedMedia();
      const since = meta.unusedSince ?? {};
      const now = Date.now();
      const next: Record<string, string> = {};
      const stale: string[] = [];
      for (const id of unused) {
        const first = since[id] ?? new Date(now).toISOString();
        if (now - Date.parse(first) > CLEANUP_AFTER_DAYS * 86_400_000) stale.push(id);
        else next[id] = first;
      }
      if (stale.length) await this.backend.deleteMedia(this.state.spaceId, stale);
      meta.unusedSince = next;
      meta.lastCleanup = day;
      this.persistMeta();
    } catch {
      // Tidy-up is best effort.
    }
  }

  // ------------------------------------------------------------- storage

  private persist() {
    this.persistMeta();
    if (this.base) this.write(BASE_KEY, this.base);
  }

  private persistMeta() {
    if (this.meta) this.write(META_KEY, this.meta);
  }

  private readBase(): AppContent | null {
    const raw = this.read<unknown>(BASE_KEY);
    return raw ? this.deps.normalize(raw) : null;
  }

  private read<T>(key: string): T | null {
    try {
      const raw = this.deps.storage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown) {
    try {
      this.deps.storage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full: syncing still works this session.
    }
  }

  // ------------------------------------------------------- account actions

  signIn = (email: string, password: string) => this.backend.signIn(email, password);
  signUp = (email: string, password: string) => this.backend.signUp(email, password);
  requestPasswordReset = (email: string) => this.backend.requestPasswordReset(email);

  async updatePassword(password: string) {
    await this.backend.updatePassword(password);
    this.set({ recovery: false });
  }
}
