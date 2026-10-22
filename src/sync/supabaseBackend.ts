import { createClient, type User } from '@supabase/supabase-js';
import type { SyncConfig } from './config';
import { kvStore } from './kvStore';
import { OfflineError, type Account, type SyncBackend } from './types';

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
  [/invalid login credentials/i, 'That email and password don’t match.'],
  [/email not confirmed/i, 'Please confirm your email first — check your inbox (and spam folder).'],
  [
    /already registered|already been registered/i,
    'There’s already an account with this email — sign in instead.',
  ],
  [/rate limit/i, 'Too many attempts or emails in a short time. Wait a few minutes and try again.'],
  [/password should be at least/i, 'Choose a password of at least 8 characters.'],
  [/jwt expired|invalid jwt/i, 'Your session expired — please sign in again.'],
  [
    /signups? not allowed|signups? (are|is) disabled/i,
    'New accounts are switched off for our universe. Ask for an account to be added in Supabase (see the guide), then sign in.',
  ],
  [
    /email address not authorized|error sending .*email/i,
    'The email couldn’t be sent from this project yet. The account can be added in Supabase instead — see the guide.',
  ],
  [/should be different from the old/i, 'That’s already your password — pick a new one.'],
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
  return new Error(message || 'Something went wrong talking to the server.');
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

  return {
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
      if (typeof id !== 'string') throw new Error('The shared universe could not be created.');
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
      if (!row) throw new Error('The server gave an unexpected answer while saving.');
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
        const items = page as { name: string; created_at?: string | null }[];
        all.push(...items.map((item) => ({ id: item.name, createdAt: item.created_at ?? null })));
        if (items.length < 1000) break;
      }
      return all;
    },

    async deleteMedia(spaceId, mediaIds) {
      if (mediaIds.length === 0) return;
      await call(client.storage.from(BUCKET).remove(mediaIds.map((id) => `${spaceId}/${id}`)));
    },
  };
}
