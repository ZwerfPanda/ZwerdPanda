import type { AppContent } from '../data/types';
import { contentMediaIds, mergeContent, mergeFirstJoin, stableEqual } from './merge';
import { OfflineError, type Account, type SyncBackend, type SyncState } from './types';

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
}

const META_KEY = 'olu:sync:meta:v1';
const BASE_KEY = 'olu:sync:base:v1';
const UPLOADED_KEY = 'olu:sync:uploaded:v1';
const CLEANUP_AFTER_DAYS = 30;

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
  return 'Something went wrong while syncing.';
}

export class SyncEngine {
  private state: SyncState = { ...INITIAL };
  private listeners = new Set<() => void>();
  private meta: Meta | null = null;
  private base: AppContent | null = null;
  private busy = false;
  private again = false;
  private uploading = false;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cleanups: (() => void)[] = [];
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
    if (!this.state.spaceId) throw new Error('Create our shared universe first.');
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
        const shared = this.deps.normalize(remote.content);
        const merged = mergeFirstJoin(this.deps.getContent(), shared);
        this.meta = {
          userId: account.id,
          spaceId,
          baseVersion: remote.version,
          pending: !stableEqual(merged, shared),
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
    const shared = this.deps.normalize(remote.content);
    const local = this.deps.getContent();
    const next = meta.pending && this.base ? mergeContent(this.base, local, shared) : shared;
    this.base = shared;
    meta.baseVersion = remote.version;
    meta.pending = meta.pending && !stableEqual(next, shared);
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
      const shared = this.deps.normalize(result.current);
      const local = this.deps.getContent();
      const merged =
        meta.baseVersion === 0 || !this.base
          ? mergeFirstJoin(local, shared)
          : mergeContent(this.base, local, shared);
      this.base = shared;
      meta.baseVersion = result.version;
      if (!stableEqual(merged, local)) this.deps.applyRemote(merged);
      this.persist();
      if (stableEqual(merged, shared)) {
        meta.pending = false;
        this.persistMeta();
        return;
      }
    }
    throw new Error('The other phone keeps saving at the same moment — trying again shortly.');
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
          await this.backend.uploadMedia(spaceId, id, blob);
          done.add(id);
          this.markUploaded(done);
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

  /** Removes photos nothing uses any more (only long-unused ones, to be safe). */
  private async cleanupRemoteMedia() {
    const meta = this.meta;
    if (!meta || !this.state.spaceId) return;
    const day = new Date().toISOString().slice(0, 10);
    if (meta.lastCleanup === day) return;
    try {
      const used = new Set(contentMediaIds(this.deps.getContent()));
      const cutoff = Date.now() - CLEANUP_AFTER_DAYS * 86_400_000;
      const stale = (await this.backend.listMedia(this.state.spaceId))
        .filter((m) => !used.has(m.id) && m.createdAt && Date.parse(m.createdAt) < cutoff)
        .map((m) => m.id);
      if (stale.length) await this.backend.deleteMedia(this.state.spaceId, stale);
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
