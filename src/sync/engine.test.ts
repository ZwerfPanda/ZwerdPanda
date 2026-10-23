import { describe, expect, it } from 'vitest';
import { createDefaultContent } from '../data/defaults';
import { normalizeContent } from '../data/normalize';
import type { AppContent, Memory } from '../data/types';
import { SyncEngine } from './engine';
import { stableEqual } from './merge';
import { OfflineError, type Account, type SyncBackend } from './types';

/* ------------------------------------------------------------------ fakes */

/** One shared "server" in memory, behaving like the Supabase schema. */
class FakeServer {
  online = true;
  users = new Map<string, { id: string; password: string }>();
  spaces = new Map<string, { members: { id: string; email: string }[]; invites: string[] }>();
  rows = new Map<string, { version: number; json: string }>();
  media = new Map<string, { blob: Blob; createdAt: string }>();
  subscribers = new Map<string, Set<() => void>>();
  private counter = 0;

  id(prefix: string) {
    return `${prefix}-${++this.counter}`;
  }

  check() {
    if (!this.online) throw new OfflineError();
  }

  notify(spaceId: string) {
    setTimeout(() => this.subscribers.get(spaceId)?.forEach((cb) => cb()), 0);
  }
}

/** Mimics jsonb: key order is not preserved. */
const shuffleKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(shuffleKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .reverse()
        .map(([k, v]) => [k, shuffleKeys(v)]),
    );
  }
  return value;
};

class FakeBackend implements SyncBackend {
  account: Account | null = null;
  private accountListeners = new Set<(a: Account | null) => void>();
  constructor(private server: FakeServer) {}

  private me() {
    if (!this.account) throw new Error('not signed in');
    return this.account;
  }
  private member(spaceId: string) {
    const space = this.server.spaces.get(spaceId);
    if (!space?.members.some((m) => m.id === this.me().id)) throw new Error('not a member');
    return space;
  }

  async getAccount() {
    return this.account;
  }
  onAccountChange(listener: (a: Account | null) => void) {
    this.accountListeners.add(listener);
    return () => this.accountListeners.delete(listener);
  }
  onPasswordRecovery() {
    return () => {};
  }
  async signUp(email: string, password: string) {
    this.server.users.set(email, { id: this.server.id('user'), password });
    return { needsConfirmation: false };
  }
  async signIn(email: string, password: string) {
    this.server.check();
    const user = this.server.users.get(email);
    if (!user || user.password !== password) throw new Error('Invalid login credentials');
    this.account = { id: user.id, email, confirmed: true };
    this.accountListeners.forEach((l) => l(this.account));
  }
  async signOut() {
    this.account = null;
    this.accountListeners.forEach((l) => l(null));
  }
  async requestPasswordReset() {}
  async updatePassword() {}

  async joinInvitedSpace() {
    this.server.check();
    const me = this.me();
    for (const [id, space] of this.server.spaces) {
      if (space.members.some((m) => m.id === me.id)) return id;
    }
    for (const [id, space] of this.server.spaces) {
      if (space.invites.includes(me.email)) {
        space.members.push({ id: me.id, email: me.email });
        space.invites = space.invites.filter((e) => e !== me.email);
        return id;
      }
    }
    return null;
  }
  async createSpace(partnerEmail: string) {
    const id = this.server.id('space');
    this.server.spaces.set(id, {
      members: [{ id: this.me().id, email: this.me().email }],
      invites: [partnerEmail],
    });
    return id;
  }
  async invite(spaceId: string, email: string) {
    this.member(spaceId).invites = [email];
  }
  async people(spaceId: string) {
    const space = this.member(spaceId);
    return {
      members: space.members.map((m) => m.email),
      invites: space.invites,
      owner: space.members[0]?.email ?? null,
    };
  }
  async fetchContent(spaceId: string) {
    this.server.check();
    this.member(spaceId);
    const row = this.server.rows.get(spaceId);
    return row
      ? { version: row.version, content: shuffleKeys(JSON.parse(row.json)) }
      : { version: 0, content: null };
  }
  async saveContent(spaceId: string, expected: number, content: unknown) {
    this.server.check();
    this.member(spaceId);
    const row = this.server.rows.get(spaceId);
    const current = row?.version ?? 0;
    if (current !== expected) {
      return {
        saved: false,
        version: current,
        current: row ? shuffleKeys(JSON.parse(row.json)) : null,
      };
    }
    this.server.rows.set(spaceId, { version: current + 1, json: JSON.stringify(content) });
    this.server.notify(spaceId);
    return { saved: true, version: current + 1, current: null };
  }
  subscribe(spaceId: string, onChange: () => void) {
    const set = this.server.subscribers.get(spaceId) ?? new Set();
    set.add(onChange);
    this.server.subscribers.set(spaceId, set);
    return () => set.delete(onChange);
  }
  async uploadMedia(spaceId: string, mediaId: string, blob: Blob) {
    this.server.check();
    this.member(spaceId);
    this.server.media.set(`${spaceId}/${mediaId}`, { blob, createdAt: new Date().toISOString() });
  }
  async downloadMedia(spaceId: string, mediaId: string) {
    this.server.check();
    this.member(spaceId);
    return this.server.media.get(`${spaceId}/${mediaId}`)?.blob ?? null;
  }
  async listMedia(spaceId: string) {
    return [...this.server.media.entries()]
      .filter(([path]) => path.startsWith(`${spaceId}/`))
      .map(([path, m]) => ({ id: path.split('/')[1], createdAt: m.createdAt }));
  }
  async deleteMedia(spaceId: string, ids: string[]) {
    ids.forEach((id) => this.server.media.delete(`${spaceId}/${id}`));
  }

  async listHistory() {
    return [];
  }

  async fetchHistory() {
    return null;
  }
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/** A phone: its own copy of the content, photos and storage. */
function phone(server: FakeServer) {
  let content: AppContent = createDefaultContent();
  const listeners = new Set<() => void>();
  const localMedia = new Map<string, Blob>();
  let fetcher: ((id: string) => Promise<Blob | null>) | null = null;
  const backend = new FakeBackend(server);
  const engine = new SyncEngine(backend, {
    getContent: () => content,
    applyRemote: (next) => {
      content = next;
    },
    onLocalChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    normalize: normalizeContent,
    getLocalMedia: async (id) => localMedia.get(id) ?? null,
    setRemoteMediaSource: (f) => {
      fetcher = f;
    },
    retryMissingMedia: () => {},
    storage: memoryStorage(),
    pushDelay: 5,
    pollInterval: 0,
  });
  return {
    engine,
    backend,
    localMedia,
    get content() {
      return content;
    },
    edit(recipe: (c: AppContent) => AppContent) {
      content = recipe(content);
      listeners.forEach((l) => l());
    },
    fetchMedia: (id: string) => (fetcher ? fetcher(id) : Promise.resolve(null)),
  };
}

const wait = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));
const memory = (id: string, caption: string, mediaId?: string): Memory => ({
  id,
  caption,
  albumIds: [],
  media: mediaId ? { type: 'local', mediaId, kind: 'image' } : { type: 'sample', art: 'stars' },
  favorite: false,
  createdAt: '2026-10-22T10:00:00.000Z',
});

/* ------------------------------------------------------------------ tests */

async function connectedPair() {
  const server = new FakeServer();
  const valencio = phone(server);
  const shenaya = phone(server);
  await valencio.engine.start();
  await shenaya.engine.start();
  await valencio.backend.signUp('valencio@example.com', 'secret-1');
  await shenaya.backend.signUp('shenaya@example.com', 'secret-2');

  valencio.edit((c) => ({ ...c, profile: { ...c.profile, startDate: '2026-03-10' } }));
  await valencio.backend.signIn('valencio@example.com', 'secret-1');
  await wait();
  expect(valencio.engine.getState().phase).toBe('needs-space');
  await valencio.engine.createSpace('shenaya@example.com');

  await shenaya.backend.signIn('shenaya@example.com', 'secret-2');
  await wait();
  return { server, valencio, shenaya };
}

describe('SyncEngine with two phones', () => {
  it('creates the universe on one phone and joins it on the other', async () => {
    const { valencio, shenaya, server } = await connectedPair();
    expect(valencio.engine.getState().phase).toBe('synced');
    expect(shenaya.engine.getState().phase).toBe('synced');
    expect(shenaya.content.profile.startDate).toBe('2026-03-10');
    expect(server.rows.size).toBe(1);
    expect(stableEqual(valencio.content, shenaya.content)).toBe(true);
  });

  it('notices the other person joining and knows who created the universe', async () => {
    const { valencio, shenaya } = await connectedPair();
    await valencio.engine.syncNow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(valencio.engine.getState().members).toHaveLength(2);
    expect(valencio.engine.getState().owner).toBe(valencio.engine.getState().account?.email);
    expect(shenaya.engine.getState().owner).toBe(valencio.engine.getState().account?.email);
  });

  it('merges edits made on both phones at the same time', async () => {
    const { valencio, shenaya } = await connectedPair();
    valencio.edit((c) => ({ ...c, memories: [memory('m-v', 'From Valencio'), ...c.memories] }));
    shenaya.edit((c) => ({
      ...c,
      letters: c.letters.slice(1),
      profile: { ...c.profile, homeGreeting: 'Hi you,' },
    }));
    await Promise.all([valencio.engine.syncNow(), shenaya.engine.syncNow()]);
    await valencio.engine.syncNow();
    await shenaya.engine.syncNow();
    for (const p of [valencio, shenaya]) {
      expect(p.content.memories[0].caption).toBe('From Valencio');
      expect(p.content.letters).toHaveLength(createDefaultContent().letters.length - 1);
      expect(p.content.profile.homeGreeting).toBe('Hi you,');
      expect(p.content.profile.startDate).toBe('2026-03-10');
    }
    expect(stableEqual(valencio.content, shenaya.content)).toBe(true);
  });

  it('delivers changes live to the other phone', async () => {
    const { valencio, shenaya } = await connectedPair();
    valencio.edit((c) => ({ ...c, profile: { ...c.profile, subtitle: 'Live from Valencio' } }));
    await wait(120);
    expect(shenaya.content.profile.subtitle).toBe('Live from Valencio');
  });

  it('keeps working offline and catches up afterwards', async () => {
    const { valencio, shenaya, server } = await connectedPair();
    server.online = false;
    valencio.edit((c) => ({
      ...c,
      memories: [memory('m-offline', 'Written on the train'), ...c.memories],
    }));
    await valencio.engine.syncNow();
    expect(valencio.engine.getState().phase).toBe('offline');
    expect(valencio.engine.getState().pendingChanges).toBe(true);
    server.online = true;
    await valencio.engine.syncNow();
    await shenaya.engine.syncNow();
    expect(valencio.engine.getState().phase).toBe('synced');
    expect(shenaya.content.memories[0].caption).toBe('Written on the train');
  });

  it('shares photos between the phones', async () => {
    const { valencio, shenaya, server } = await connectedPair();
    const photo = new Blob(['pretend jpeg'], { type: 'image/jpeg' });
    valencio.localMedia.set('media-photo', photo);
    valencio.edit((c) => ({
      ...c,
      memories: [memory('m-photo', 'Us', 'media-photo'), ...c.memories],
    }));
    await valencio.engine.syncNow();
    await wait();
    expect(server.media.size).toBe(1);
    await shenaya.engine.syncNow();
    const received = await shenaya.fetchMedia('media-photo');
    expect(await received?.text()).toBe('pretend jpeg');
  });

  it('applies deletions on the other phone', async () => {
    const { valencio, shenaya } = await connectedPair();
    const firstId = shenaya.content.memories[0].id;
    shenaya.edit((c) => ({ ...c, memories: c.memories.filter((m) => m.id !== firstId) }));
    await shenaya.engine.syncNow();
    await valencio.engine.syncNow();
    expect(valencio.content.memories.some((m) => m.id === firstId)).toBe(false);
  });

  it('signing out stops syncing but keeps this phone’s copy', async () => {
    const { valencio } = await connectedPair();
    const before = valencio.content;
    await valencio.engine.signOut();
    expect(valencio.engine.getState().phase).toBe('signed-out');
    expect(valencio.content).toBe(before);
  });

  it('a stranger cannot join', async () => {
    const { server } = await connectedPair();
    const stranger = phone(server);
    await stranger.engine.start();
    await stranger.backend.signUp('stranger@example.com', 'pw-12345');
    await stranger.backend.signIn('stranger@example.com', 'pw-12345');
    await wait();
    expect(stranger.engine.getState().phase).toBe('needs-space');
  });
});
