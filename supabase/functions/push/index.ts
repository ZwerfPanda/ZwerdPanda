/*
 * push — a tiny Supabase Edge Function that sends a notification to the other
 * one's phone: "your turn", "she's thinking of you", "Gouden Woensdag".
 *
 * It speaks Web Push itself (RFC 8291 encryption and VAPID, RFC 8292), so it
 * needs nothing but this file. The private VAPID key stays here, in the
 * function's secrets: the app only ever sees the public one.
 *
 * Secrets to set in Supabase (Edge Functions → Secrets):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (made in the app: Instellingen → Meldingen)
 *   VAPID_SUBJECT     e.g. mailto:jij@example.com
 *   CRON_SECRET       any long random text, for the Wednesday-morning call
 * SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY come from Supabase itself.
 *
 * One self-contained file, so it can be pasted into the Supabase dashboard.
 */

const enc = new TextEncoder();
type Key = Awaited<ReturnType<typeof crypto.subtle.importKey>>;
type KeyPair = { publicKey: Key; privateKey: Key };

/* --------------------------------------------------------------- bytes */

export function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm as unknown as ArrayBuffer, 'HKDF', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as ArrayBuffer,
      info: info as unknown as ArrayBuffer,
    },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/* ------------------------------------------------- encryption (RFC 8291) */

export interface PushKeys {
  /** The phone's public key (P-256, uncompressed, base64url). */
  p256dh: string;
  /** The phone's auth secret (16 bytes, base64url). */
  auth: string;
}

/** The message, sealed for one phone only (aes128gcm, one record). */
export async function encryptPayload(
  payload: Uint8Array,
  keys: PushKeys,
  // For tests: a fixed sender key pair and salt.
  fixed?: { pair: KeyPair; salt: Uint8Array },
): Promise<Uint8Array> {
  const uaPublic = fromB64url(keys.p256dh);
  const authSecret = fromB64url(keys.auth);
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('bad keys');
  const pair =
    fixed?.pair ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as KeyPair);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic as unknown as ArrayBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pair.privateKey, 256),
  );
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hkdf(authSecret, shared, keyInfo, 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey(
    'raw',
    cek as unknown as ArrayBuffer,
    'AES-GCM',
    false,
    ['encrypt'],
  );
  // The payload, then the "last record" delimiter.
  const record = concat(payload, new Uint8Array([2]));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as unknown as ArrayBuffer },
      key,
      record as unknown as ArrayBuffer,
    ),
  );
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  return concat(header, asPublic, sealed);
}

/* ------------------------------------------------------ VAPID (RFC 8292) */

export interface Vapid {
  publicKey: string;
  privateKey: string;
  subject: string;
}

async function signingKey(v: Vapid) {
  const pub = fromB64url(v.publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('VAPID_PUBLIC_KEY klopt niet');
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: b64url(pub.slice(1, 33)),
      y: b64url(pub.slice(33, 65)),
      d: v.privateKey.trim(),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/** "vapid t=…, k=…" for one push service. */
export async function vapidHeader(endpoint: string, v: Vapid, now = Date.now()) {
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(
    enc.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 12 * 3600,
        sub: v.subject,
      }),
    ),
  );
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    await signingKey(v),
    enc.encode(`${header}.${claims}`),
  );
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${v.publicKey.trim()}`;
}

/* ------------------------------------------------------------- the API */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  CRON_SECRET?: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-cron',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['turn', 'match', 'ping', 'golden', 'news'] as const;
/** Push services we know; nothing else gets our requests. */
const PUSH_HOSTS =
  /^https:\/\/([a-z0-9-]+\.)*(push\.services\.mozilla\.com|fcm\.googleapis\.com|android\.googleapis\.com|push\.apple\.com|notify\.windows\.com)\//;

interface Row {
  endpoint: string;
  p256dh: string;
  auth: string;
  user_id: string;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Who's calling (from their own sign-in), or null. */
async function whoAmI(env: Env, token: string, fetcher: typeof fetch) {
  const res = await fetcher(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string };
  return typeof user.id === 'string' ? user.id : null;
}

async function isMember(env: Env, token: string, space: string, fetcher: typeof fetch) {
  const res = await fetcher(
    `${env.SUPABASE_URL}/rest/v1/space_members?select=space_id&space_id=eq.${space}`,
    { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** The table, with the caller's sign-in (row-level security applies) or as the server. */
function table(env: Env, fetcher: typeof fetch, token: string | null) {
  const key = token ? env.SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    apikey: key,
    Authorization: `Bearer ${token ?? env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
  const url = `${env.SUPABASE_URL}/rest/v1/push_subscriptions`;
  return {
    select: async (query: string): Promise<Row[]> => {
      const res = await fetcher(`${url}?select=endpoint,p256dh,auth,user_id&${query}`, { headers });
      if (!res.ok) throw new Error(`push_subscriptions: ${res.status}`);
      return (await res.json()) as Row[];
    },
    upsert: (row: Record<string, string>) =>
      fetcher(`${url}?on_conflict=endpoint`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(row),
      }),
    remove: (endpoint: string) =>
      fetcher(`${url}?endpoint=eq.${encodeURIComponent(endpoint)}`, {
        method: 'DELETE',
        headers,
      }),
  };
}

/** Sends one message to these phones; forgets the ones that are gone for good. */
async function deliver(
  env: Env,
  rows: Row[],
  message: Record<string, string>,
  fetcher: typeof fetch,
): Promise<{ sent: number; gone: number; failed: number }> {
  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT || 'mailto:ons@universe.app',
  };
  const payload = enc.encode(JSON.stringify(message));
  let sent = 0;
  let gone = 0;
  let failed = 0;
  const server = table(env, fetcher, null);
  for (const row of rows) {
    if (!PUSH_HOSTS.test(row.endpoint)) continue;
    try {
      const body = await encryptPayload(payload, { p256dh: row.p256dh, auth: row.auth });
      const res = await fetcher(row.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidHeader(row.endpoint, vapid),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          TTL: '86400',
          Urgency: 'high',
          ...(message.tag
            ? { Topic: message.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) }
            : {}),
        },
        body: body as unknown as ArrayBuffer,
      });
      if (res.ok) sent++;
      else if (res.status === 404 || res.status === 410) {
        gone++;
        await server.remove(row.endpoint);
      } else failed++;
    } catch {
      failed++;
    }
  }
  return { sent, gone, failed };
}

/** Sends per caller, so a runaway phone can't flood the other. */
const recent = new Map<string, number[]>();
function tooMany(user: string, now = Date.now()) {
  const list = (recent.get(user) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  if (recent.size > 100) recent.clear();
  recent.set(user, list);
  return list.length > 20;
}

export async function handle(req: Request, env: Env, fetcher: typeof fetch = fetch) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
    return reply(503, { error: 'Meldingen zijn nog niet ingesteld (VAPID-sleutels ontbreken).' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply(400, { error: 'bad json' });
  }

  // Wednesday morning, from the scheduled job: everyone who wants it.
  if (body.op === 'golden') {
    const secret = req.headers.get('x-cron') ?? '';
    if (!env.CRON_SECRET || secret !== env.CRON_SECRET) return reply(401, { error: 'no' });
    // Only on a Wednesday in the Netherlands, whatever the schedule says.
    const day = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone: 'Europe/Amsterdam',
    });
    if (day.format(new Date()) !== 'Wed' && body.force !== true)
      return reply(200, { sent: 0, skipped: 'not wednesday' });
    const rows = await table(env, fetcher, null).select('limit=50');
    const result = await deliver(
      env,
      rows,
      {
        kind: 'golden',
        title: 'Gouden Woensdag is begonnen ✨',
        body: 'Vandaag tellen alle tickets dubbel. Tot middernacht!',
        url: '#/games',
        tag: 'golden',
      },
      fetcher,
    );
    return reply(200, result);
  }

  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const space = String(body.space ?? '');
  if (!token || !UUID.test(space)) return reply(401, { error: 'sign in first' });
  const me = await whoAmI(env, token, fetcher);
  if (!me || !(await isMember(env, token, space, fetcher)))
    return reply(403, { error: 'not in this universe' });

  if (body.op === 'key') return reply(200, { publicKey: env.VAPID_PUBLIC_KEY.trim() });

  if (body.op === 'subscribe') {
    const sub = body.subscription as { endpoint?: unknown; keys?: Record<string, unknown> };
    const endpoint = text(sub?.endpoint, 1000);
    const p256dh = text(sub?.keys?.p256dh, 200);
    const auth = text(sub?.keys?.auth, 100);
    if (!PUSH_HOSTS.test(endpoint) || !p256dh || !auth)
      return reply(400, { error: 'bad subscription' });
    const res = await table(env, fetcher, token).upsert({
      endpoint,
      p256dh,
      auth,
      space_id: space,
      user_id: me,
    });
    if (!res.ok) return reply(502, { error: `Opslaan lukte niet (${res.status}).` });
    return reply(200, { ok: true });
  }

  if (body.op === 'unsubscribe') {
    const endpoint = text(body.endpoint, 1000);
    await table(env, fetcher, token).remove(endpoint);
    return reply(200, { ok: true });
  }

  if (body.op === 'send') {
    const kind = KINDS.find((k) => k === body.kind && k !== 'golden');
    const title = text(body.title, 80);
    if (!kind || !title) return reply(400, { error: 'bad message' });
    if (tooMany(me)) return reply(429, { error: 'even rustig aan' });
    const url = text(body.url, 100);
    const rows = await table(env, fetcher, null).select(
      `space_id=eq.${space}&user_id=neq.${me}&limit=10`,
    );
    const result = await deliver(
      env,
      rows,
      {
        kind,
        title,
        body: text(body.body, 160),
        url: /^#\/[\w\-/?=&.]*$/.test(url) ? url : '#/',
        tag: text(body.tag, 40) || kind,
      },
      fetcher,
    );
    return reply(200, result);
  }

  return reply(400, { error: 'unknown op' });
}

/* -------------------------------------------------------- on Supabase */

const deno = (
  globalThis as {
    Deno?: { serve(h: (r: Request) => Promise<Response>): void; env: { get(k: string): string } };
  }
).Deno;
if (deno) {
  const env = (k: keyof Env) => deno.env.get(k) ?? '';
  deno.serve((req) =>
    handle(req, {
      SUPABASE_URL: env('SUPABASE_URL'),
      SUPABASE_ANON_KEY: env('SUPABASE_ANON_KEY'),
      SUPABASE_SERVICE_ROLE_KEY: env('SUPABASE_SERVICE_ROLE_KEY'),
      VAPID_PUBLIC_KEY: env('VAPID_PUBLIC_KEY'),
      VAPID_PRIVATE_KEY: env('VAPID_PRIVATE_KEY'),
      VAPID_SUBJECT: env('VAPID_SUBJECT'),
      CRON_SECRET: env('CRON_SECRET'),
    }),
  );
}
