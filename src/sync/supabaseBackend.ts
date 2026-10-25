import { createClient, type User } from '@supabase/supabase-js';
import type { SyncConfig } from './config';
import { kvStore } from './kvStore';
import { OfflineError, type Account, type SyncBackend } from './types';
import { r2Store, type ObjectStore } from './objects';

/**
 * The shared universe on Supabase (see supabase/schema.sql).
 * Only loaded when a project is configured, so the app stays small otherwise.
 */

const BUCKET = 'universe-media';

function toAccount(user: User | null | undefined): Account | null {
  if (!user) return null;
  return {
    id: user.id,
    email: (user.email ?? '').toLowerCase(),
    confirmed: Boolean(user.email_confirmed_at),
  };
}

const FRIENDLY: [RegExp, string][] = [
  [/invalid login credentials/i, 'Dat e-mailadres en wachtwoord horen niet bij elkaar.'],
  [/email not confirmed/i, 'Bevestig eerst je e-mailadres — kijk in je inbox (en je spam).'],
  [
    /already registered|already been registered/i,
    'Er is al een account met dit e-mailadres — log gewoon in.',
  ],
  [
    /rate limit/i,
    'Te veel pogingen of e-mails in korte tijd. Wacht een paar minuten en probeer het opnieuw.',
  ],
  [/password should be at least/i, 'Kies een wachtwoord van minstens 8 tekens.'],
  [/jwt expired|invalid jwt/i, 'Je sessie is verlopen — log opnieuw in.'],
  [
    /signups? not allowed|signups? (are|is) disabled/i,
    'Nieuwe accounts staan uit voor ons universe. Laat een account toevoegen in Supabase (zie de handleiding) en log dan in.',
  ],
  [
    /email address not authorized|error sending .*email/i,
    'De e-mail kon nog niet verstuurd worden vanuit dit project. Het account kan ook in Supabase worden toegevoegd — zie de handleiding.',
  ],
  [/should be different from the old/i, 'Dat is al je wachtwoord — kies een nieuwe.'],
];

/** Turns any Supabase error into a readable Error (or OfflineError for connection trouble). */
function toError(error: unknown): Error {
  const e = error as { message?: string; name?: string; status?: number } | null;
  const message = e?.message ?? String(error);
  if (
    e?.name === 'AuthRetryableFetchError' ||
    /failed to fetch|load failed|networkerror|network request failed|fetch failed/i.test(message) ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  ) {
    return new OfflineError();
  }
  for (const [pattern, friendly] of FRIENDLY) if (pattern.test(message)) return new Error(friendly);
  return new Error(message || 'Er ging iets mis in het contact met de server.');
}

function redirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function createSupabaseBackend(config: SyncConfig): SyncBackend {
  const client = createClient(config.url, config.anonKey, {
    auth: {
      storage: kvStore,
      storageKey: 'olu-auth',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  });

  const recoveryListeners = new Set<() => void>();

  const call = async <R extends { data: unknown; error: unknown }>(
    promise: PromiseLike<R>,
  ): Promise<R['data']> => {
    let result: R;
    try {
      result = await promise;
    } catch (error) {
      throw toError(error);
    }
    if (result.error) throw toError(result.error);
    return result.data;
  };

  /** The Supabase bucket as plain file storage. */
  const bucket: ObjectStore = {
    async put(path, data, options) {
      // As a Blob, exactly like our photos always went up.
      const body =
        data instanceof Blob
          ? data
          : new Blob([data as BlobPart], { type: 'application/octet-stream' });
      const { error } = await client.storage.from(BUCKET).upload(path, body, {
        upsert: !options?.create,
        contentType: 'application/octet-stream',
        cacheControl: '31536000',
      });
      if (!error) return true;
      const e = error as { statusCode?: string | number; message?: string };
      if (
        options?.create &&
        (String(e.statusCode) === '409' || /duplicate|already exists/i.test(e.message ?? ''))
      )
        return false;
      throw toError(error);
    },
    async get(path) {
      const { data, error } = await client.storage.from(BUCKET).download(path);
      if (error) {
        const converted = toError(error);
        if (converted instanceof OfflineError) throw converted;
        return null;
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    async list(folder) {
      const all: { name: string; createdAt: string | null; size?: number }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = (await call(
          client.storage.from(BUCKET).list(folder, { limit: 1000, offset }),
        )) as {
          name: string;
          id: string | null;
          created_at?: string | null;
          metadata?: { size?: number } | null;
        }[];
        // Folders come back too (without an id): only files count.
        all.push(
          ...page
            .filter((p) => p.id)
            .map((p) => ({
              name: p.name,
              createdAt: p.created_at ?? null,
              size: p.metadata?.size,
            })),
        );
        if (page.length < 1000) break;
      }
      return all;
    },
    async remove(paths) {
      for (let i = 0; i < paths.length; i += 1000) {
        const batch = paths.slice(i, i + 1000);
        if (batch.length) await call(client.storage.from(BUCKET).remove(batch));
      }
    },
  };

  const sealedObjects =
    config.mediaStore === 'r2'
      ? r2Store({
          functionUrl: `${config.url}/functions/v1/media-r2`,
          anonKey: config.anonKey,
          token: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
          spaceOf: (path) => path.split('/')[0],
        })
      : bucket;

  return {
    objects: bucket,
    sealedObjects,

    async getAccount() {
      const { data } = await client.auth.getSession();
      return toAccount(data.session?.user);
    },

    onAccountChange(listener) {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        // Supabase asks not to call it again from inside this callback.
        setTimeout(() => {
          if (event === 'PASSWORD_RECOVERY') recoveryListeners.forEach((l) => l());
          listener(toAccount(session?.user));
        }, 0);
      });
      return () => data.subscription.unsubscribe();
    },

    onPasswordRecovery(listener) {
      recoveryListeners.add(listener);
      return () => recoveryListeners.delete(listener);
    },

    async signIn(email, password) {
      await call(client.auth.signInWithPassword({ email: email.trim(), password }));
    },

    async signUp(email, password) {
      const data = await call(
        client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: redirectUrl() },
        }),
      );
      return { needsConfirmation: !data.session };
    },

    async signOut() {
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },

    async requestPasswordReset(email) {
      await call(client.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirectUrl() }));
    },

    async updatePassword(password) {
      await call(client.auth.updateUser({ password }));
    },

    async joinInvitedSpace() {
      const id = await call(client.rpc('join_invited_space'));
      return typeof id === 'string' ? id : null;
    },

    async createSpace(partnerEmail) {
      const id = await call(client.rpc('create_space', { p_partner_email: partnerEmail.trim() }));
      if (typeof id !== 'string')
        throw new Error('Het gedeelde universe kon niet worden aangemaakt.');
      return id;
    },

    async invite(spaceId, email) {
      await call(client.rpc('invite_to_space', { p_space: spaceId, p_email: email.trim() }));
    },

    async people(spaceId) {
      const [space, members, invites] = await Promise.all([
        call(client.from('spaces').select('created_by').eq('id', spaceId).maybeSingle()),
        call(client.from('space_members').select('email, user_id').eq('space_id', spaceId)),
        call(client.from('space_invites').select('email').eq('space_id', spaceId)),
      ]);
      const list = members as { email: string; user_id: string }[];
      const ownerId = (space as { created_by: string } | null)?.created_by;
      return {
        members: list.map((m) => m.email),
        invites: (invites as { email: string }[]).map((i) => i.email),
        owner: list.find((m) => m.user_id === ownerId)?.email ?? null,
      };
    },

    async fetchContent(spaceId) {
      const row = await call(
        client
          .from('space_content')
          .select('version, content')
          .eq('space_id', spaceId)
          .maybeSingle(),
      );
      const data = row as { version: number | string; content: unknown } | null;
      return data
        ? { version: Number(data.version), content: data.content }
        : { version: 0, content: null };
    },

    async saveContent(spaceId, expectedVersion, content) {
      const rows = await call(
        client.rpc('save_content', {
          p_space: spaceId,
          p_expected_version: expectedVersion,
          p_content: content,
        }),
      );
      const row = (Array.isArray(rows) ? rows[0] : rows) as
        | { saved: boolean; new_version: number | string; current_content: unknown }
        | undefined;
      if (!row) throw new Error('De server gaf een onverwacht antwoord bij het opslaan.');
      return {
        saved: Boolean(row.saved),
        version: Number(row.new_version),
        current: row.current_content ?? null,
      };
    },

    subscribe(spaceId, onChange) {
      const channel = client
        .channel(`universe-${spaceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'space_content',
            filter: `space_id=eq.${spaceId}`,
          },
          () => onChange(),
        )
        .subscribe();
      return () => {
        void client.removeChannel(channel);
      };
    },

    live(spaceId, onMessage) {
      // A private channel: the server only lets members of this universe in
      // (see the realtime policies in supabase/schema.sql).
      const channel = client
        .channel(`universe-live-${spaceId}`, {
          config: { private: true, broadcast: { self: false } },
        })
        .on('broadcast', { event: 'live' }, ({ payload }) => onMessage(payload))
        .subscribe();
      return {
        send: (message) =>
          void channel
            .send({ type: 'broadcast', event: 'live', payload: message })
            .catch(() => undefined),
        close: () => void client.removeChannel(channel),
      };
    },

    async uploadMedia(spaceId, mediaId, blob) {
      await call(
        client.storage.from(BUCKET).upload(`${spaceId}/${mediaId}`, blob, {
          upsert: true,
          contentType: blob.type || 'application/octet-stream',
          cacheControl: '31536000',
        }),
      );
    },

    async downloadMedia(spaceId, mediaId) {
      const { data, error } = await client.storage.from(BUCKET).download(`${spaceId}/${mediaId}`);
      if (error) {
        const converted = toError(error);
        if (converted instanceof OfflineError) throw converted;
        return null; // not uploaded (yet)
      }
      return data;
    },

    async listMedia(spaceId) {
      const all: { id: string; createdAt: string | null }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await call(client.storage.from(BUCKET).list(spaceId, { limit: 1000, offset }));
        const items = page as { name: string; id?: string | null; created_at?: string | null }[];
        // Our sealed photos live in subfolders (e2e/, key/): those aren't plain photos.
        all.push(
          ...items
            .filter((item) => item.id !== null)
            .map((item) => ({ id: item.name, createdAt: item.created_at ?? null })),
        );
        if (items.length < 1000) break;
      }
      return all;
    },

    async deleteMedia(spaceId, mediaIds) {
      if (mediaIds.length === 0) return;
      await call(client.storage.from(BUCKET).remove(mediaIds.map((id) => `${spaceId}/${id}`)));
    },

    async listHistory(spaceId) {
      const rows = (await call(
        client.from('space_history').select('id, version, saved_at').eq('space_id', spaceId),
      )) as { id: number | string; version: number | string; saved_at: string }[];
      return rows
        .map((r) => ({ id: String(r.id), version: Number(r.version), savedAt: r.saved_at }))
        .sort((a, b) => b.version - a.version);
    },

    async fetchHistory(spaceId, id) {
      const row = (await call(
        client
          .from('space_history')
          .select('content')
          .eq('space_id', spaceId)
          .eq('id', id)
          .maybeSingle(),
      )) as { content: unknown } | null;
      return row?.content ?? null;
    },
  };
}
