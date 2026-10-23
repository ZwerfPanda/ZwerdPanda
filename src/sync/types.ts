/**
 * What the sync engine needs from a server. The app ships a Supabase
 * implementation (supabaseBackend.ts); tests use an in-memory one.
 */

export interface Account {
  id: string;
  email: string;
  confirmed: boolean;
}

export interface RemoteContent {
  /** 0 when nothing has been saved to this space yet. */
  version: number;
  content: unknown;
}

export interface SaveResult {
  saved: boolean;
  /** The new version when saved, otherwise the version someone else saved. */
  version: number;
  /** The other person's copy when they saved first (null if unknown). */
  current: unknown;
}

export interface RemoteMediaInfo {
  id: string;
  createdAt: string | null;
}

export interface SyncBackend {
  getAccount(): Promise<Account | null>;
  onAccountChange(listener: (account: Account | null) => void): () => void;
  onPasswordRecovery(listener: () => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;

  joinInvitedSpace(): Promise<string | null>;
  createSpace(partnerEmail: string): Promise<string>;
  invite(spaceId: string, email: string): Promise<void>;
  /** Members, open invites, and the email of whoever created the universe. */
  people(spaceId: string): Promise<{ members: string[]; invites: string[]; owner: string | null }>;

  fetchContent(spaceId: string): Promise<RemoteContent>;
  saveContent(spaceId: string, expectedVersion: number, content: unknown): Promise<SaveResult>;
  /** Calls back when the shared copy changes; returns an unsubscribe function. */
  subscribe(spaceId: string, onChange: () => void): () => void;

  uploadMedia(spaceId: string, mediaId: string, blob: Blob): Promise<void>;
  downloadMedia(spaceId: string, mediaId: string): Promise<Blob | null>;
  listMedia(spaceId: string): Promise<RemoteMediaInfo[]>;
  deleteMedia(spaceId: string, mediaIds: string[]): Promise<void>;
}

export type SyncPhase =
  | 'off' // no server configured: everything stays on this device
  | 'starting'
  | 'signed-out'
  | 'needs-space' // signed in, but not part of a shared universe yet
  | 'syncing'
  | 'synced'
  | 'offline' // will catch up when the connection is back
  | 'error';

export interface SyncState {
  phase: SyncPhase;
  account: Account | null;
  spaceId: string | null;
  members: string[];
  invites: string[];
  /** Email of the person who created the shared universe. */
  owner: string | null;
  lastSyncedAt: string | null;
  pendingChanges: boolean;
  uploading: number;
  error: string | null;
  /** True after opening a password-reset link: ask for a new password. */
  recovery: boolean;
}

/** A failure caused by the connection rather than by what we sent. */
export class OfflineError extends Error {
  constructor(message = 'Even geen verbinding.') {
    super(message);
    this.name = 'OfflineError';
  }
}
