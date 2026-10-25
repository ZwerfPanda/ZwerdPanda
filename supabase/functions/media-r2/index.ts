/*
 * media-r2 — a tiny Supabase Edge Function between our app and Cloudflare R2.
 *
 * The Cloudflare secret stays here, on the server: the app never sees it.
 * The function checks that you're signed in and a member of the universe,
 * then hands out short-lived links to put or fetch one file, lists files, or
 * removes them. Everything that goes through it is already encrypted on our
 * phones, so R2 (and this function) only ever see sealed bytes.
 *
 * Secrets to set in Supabase (Edge Functions → Secrets):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   (optional) R2_JURISDICTION=eu for a bucket in the EU — found by itself otherwise
 * SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase itself.
 *
 * One self-contained file, so it can be pasted into the Supabase dashboard.
 */

const enc = new TextEncoder();

/* --------------------------------------------------- AWS signature (v4) */

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

async function hmac(key: ArrayBuffer | Uint8Array, text: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    'raw',
    key as unknown as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', k, enc.encode(text));
}

/** RFC 3986 encoding, as S3 wants it. */
function uriEncode(text: string, keepSlash = false): string {
  return [...enc.encode(text)]
    .map((b) => {
      const ch = String.fromCharCode(b);
      if (/[A-Za-z0-9\-._~]/.test(ch) || (keepSlash && ch === '/')) return ch;
      return `%${b.toString(16).toUpperCase().padStart(2, '0')}`;
    })
    .join('');
}

export interface PresignInput {
  method: string;
  host: string;
  /** The path, starting with "/" (not yet encoded). */
  path: string;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** e.g. 20130524T000000Z */
  amzDate: string;
  expires: number;
  query?: Record<string, string>;
}

/** A presigned URL (query-string authentication, AWS Signature Version 4). */
export async function presign(input: PresignInput): Promise<string> {
  const service = input.service ?? 's3';
  const day = input.amzDate.slice(0, 8);
  const scope = `${day}/${input.region}/${service}/aws4_request`;
  const params: Record<string, string> = {
    ...input.query,
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${input.accessKeyId}/${scope}`,
    'X-Amz-Date': input.amzDate,
    'X-Amz-Expires': String(input.expires),
    'X-Amz-SignedHeaders': 'host',
  };
  const query = Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k])}`)
    .join('&');
  const path = uriEncode(input.path, true);
  const canonical = [
    input.method,
    path,
    query,
    `host:${input.host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', input.amzDate, scope, await sha256(canonical)].join('\n');
  let key: ArrayBuffer = await hmac(enc.encode(`AWS4${input.secretAccessKey}`), day);
  key = await hmac(key, input.region);
  key = await hmac(key, service);
  key = await hmac(key, 'aws4_request');
  const signature = hex(await hmac(key, toSign));
  return `https://${input.host}${path}?${query}&X-Amz-Signature=${signature}`;
}

/* ------------------------------------------------------------- the API */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  /** "eu" for a bucket kept in the EU; empty: worked out on first use. */
  R2_JURISDICTION?: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info, x-op, x-space, x-path',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only paths inside this universe's own folder, nothing sneaky. */
function okPath(space: string, path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(`${space}/`) &&
    path.length < 400 &&
    !path.includes('..') &&
    !path.includes('//') &&
    /^[\w\-./]+$/.test(path)
  );
}

/** Members we just checked, for a few minutes (so a big video doesn't ask for every piece). */
const members = new Map<string, number>();
const MEMBER_FOR = 5 * 60_000;

/** Asks Supabase (with the caller's own sign-in) whether they're in this universe. */
async function isMember(env: Env, token: string, space: string, fetcher: typeof fetch) {
  const known = `${space}:${token}`;
  const until = members.get(known);
  if (until && until > Date.now()) return true;
  if (await askMember(env, token, space, fetcher)) {
    if (members.size > 200) members.clear();
    members.set(known, Date.now() + MEMBER_FOR);
    return true;
  }
  return false;
}

async function askMember(env: Env, token: string, space: string, fetcher: typeof fetch) {
  const res = await fetcher(
    `${env.SUPABASE_URL}/rest/v1/space_members?select=space_id&space_id=eq.${space}`,
    { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** A short, readable reason for what R2 answered. */
function explain(status: number, xml: string, env: Env): string {
  const code = /<Code>([^<]*)<\/Code>/.exec(xml)?.[1] ?? '';
  if (code === 'NoSuchBucket' || status === 404)
    return `Bucket “${env.R2_BUCKET}” niet gevonden. Klopt R2_BUCKET precies, en staat R2_ACCOUNT_ID goed?`;
  if (/InvalidAccessKeyId|SignatureDoesNotMatch|InvalidArgument/.test(code) || status === 401)
    return 'De R2-sleutels kloppen niet. Check R2_ACCESS_KEY_ID en R2_SECRET_ACCESS_KEY in Supabase (geen spaties ervoor of erachter).';
  if (code === 'AccessDenied' || status === 403)
    return `De R2-token mag niet bij bucket “${env.R2_BUCKET}”. Geef hem “Object Read & Write” voor deze bucket.`;
  return `R2 antwoordde ${status}${code ? ` (${code})` : ''}.`;
}

let knownHost: string | null = null;

/**
 * Which R2 address our bucket lives at: the normal one, or the EU one for a
 * bucket kept in the EU. Tried once per start, then remembered.
 */
async function findHost(
  env: Env,
  fetcher: typeof fetch,
  signAt: (
    host: string,
    method: string,
    key: string,
    query?: Record<string, string>,
    expires?: number,
  ) => Promise<string>,
): Promise<{ host: string; problem?: string }> {
  const base = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const named = env.R2_JURISDICTION?.trim().toLowerCase();
  const hosts = named
    ? [`${env.R2_ACCOUNT_ID}.${named}.r2.cloudflarestorage.com`]
    : [base, `${env.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`];
  if (knownHost && hosts.includes(knownHost)) return { host: knownHost };
  let problem = '';
  for (const host of hosts) {
    let res: Response;
    try {
      res = await fetcher(await signAt(host, 'GET', '', { 'list-type': '2', 'max-keys': '1' }, 60));
    } catch {
      problem = `R2 (${host}) is niet bereikbaar. Klopt R2_ACCOUNT_ID?`;
      continue;
    }
    if (res.ok) {
      knownHost = host;
      return { host };
    }
    const xml = await res.text().catch(() => '');
    // Not found here: maybe it lives at the EU address.
    if (res.status === 404 || /NoSuchBucket/.test(xml)) {
      problem = explain(404, xml, env);
      continue;
    }
    return { host, problem: explain(res.status, xml, env) };
  }
  return { host: hosts[0], problem };
}

function amzNow(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export async function handle(
  req: Request,
  env: Env,
  fetcher: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'POST only' });
  const missing = (
    ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'] as const
  ).filter((k) => !env[k]);
  if (missing.length)
    return reply(500, {
      error: `R2 is nog niet ingesteld: deze secrets ontbreken in Supabase: ${missing.join(', ')}.`,
    });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'sign in first' });

  // Carrying a sealed piece ourselves (when the browser can't reach R2 directly):
  // the op and path travel in headers, the bytes are the body.
  const carry = req.headers.get('x-op');
  let body: { op?: string; space?: string; paths?: unknown; method?: string; prefix?: string };
  if (carry === 'put' || carry === 'get') {
    body = {
      op: carry,
      space: req.headers.get('x-space') ?? '',
      paths: [req.headers.get('x-path')],
    };
  } else {
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return reply(400, { error: 'bad request' });
    }
  }
  const space = String(body.space ?? '');
  if (!UUID.test(space)) return reply(400, { error: 'bad universe' });
  if (!(await isMember(env, token, space, fetcher))) return reply(403, { error: 'not yours' });

  const signAt = (
    host: string,
    method: string,
    key: string,
    query?: Record<string, string>,
    expires = 900,
  ) =>
    presign({
      method,
      host,
      path: key ? `/${env.R2_BUCKET}/${key}` : `/${env.R2_BUCKET}`,
      region: 'auto',
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      amzDate: amzNow(now()),
      expires,
      query,
    });
  const resolved = await findHost(env, fetcher, signAt);
  const host = resolved.host;
  const sign = (method: string, key: string, query?: Record<string, string>, expires = 900) =>
    signAt(host, method, key, query, expires);

  if (body.op === 'check') {
    if (resolved.problem) return reply(200, { ok: false, problem: resolved.problem });
    // From here (no browser, so no CORS): a tiny file in, out and away again.
    const probe = `${space}/e2e/_server-check.0`;
    try {
      const put = await fetcher(await sign('PUT', probe, undefined, 60), {
        method: 'PUT',
        body: 'ok',
      });
      if (!put.ok)
        return reply(200, {
          ok: false,
          problem: `Schrijven naar R2 lukt niet: ${explain(put.status, await put.text(), env)}`,
        });
      const got = await fetcher(await sign('GET', probe, undefined, 60));
      await fetcher(await sign('DELETE', probe, undefined, 60), { method: 'DELETE' });
      if (!got.ok)
        return reply(200, {
          ok: false,
          problem: `Lezen uit R2 lukt niet: ${explain(got.status, await got.text(), env)}`,
        });
    } catch {
      return reply(200, { ok: false, problem: `R2 (${host}) is niet bereikbaar.` });
    }
    return reply(200, { ok: true, host, server: 'ok' });
  }

  if (body.op === 'put' || body.op === 'get') {
    const path = (body.paths as unknown[])[0];
    if (!okPath(space, path)) return reply(400, { error: 'bad path' });
    if (body.op === 'put') {
      const bytes = await req.arrayBuffer();
      if (bytes.byteLength > 12 * 1024 * 1024) return reply(413, { error: 'piece too big' });
      const res = await fetcher(await sign('PUT', path, undefined, 120), {
        method: 'PUT',
        body: bytes,
      });
      if (!res.ok)
        return reply(502, {
          error: `Schrijven naar R2 lukt niet: ${explain(res.status, await res.text(), env)}`,
        });
      return reply(200, { ok: true });
    }
    const res = await fetcher(await sign('GET', path, undefined, 120));
    if (res.status === 404) return reply(404, { error: 'not found' });
    if (!res.ok)
      return reply(502, {
        error: `Lezen uit R2 lukt niet: ${explain(res.status, await res.text(), env)}`,
      });
    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/octet-stream' },
    });
  }

  if (body.op === 'sign') {
    const method = body.method === 'PUT' ? 'PUT' : 'GET';
    const paths = Array.isArray(body.paths) ? body.paths : [];
    if (!paths.length || paths.length > 50 || !paths.every((p) => okPath(space, p)))
      return reply(400, { error: 'bad paths' });
    return reply(200, { urls: await Promise.all(paths.map((p) => sign(method, p as string))) });
  }

  if (body.op === 'list') {
    const prefix = String(body.prefix ?? '');
    if (!okPath(space, `${prefix}/x`)) return reply(400, { error: 'bad prefix' });
    const items: { name: string; createdAt: string | null }[] = [];
    let token2: string | undefined;
    for (let page = 0; page < 200; page++) {
      const query: Record<string, string> = {
        'list-type': '2',
        prefix: `${prefix}/`,
        delimiter: '/',
        'max-keys': '1000',
      };
      if (token2) query['continuation-token'] = token2;
      const res = await fetcher(await sign('GET', '', query, 60));
      if (!res.ok) return reply(502, { error: `R2 list failed (${res.status})` });
      const xml = await res.text();
      for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = /<Key>([^<]*)<\/Key>/.exec(m[1])?.[1] ?? '';
        const at = /<LastModified>([^<]*)<\/LastModified>/.exec(m[1])?.[1] ?? null;
        items.push({ name: key.slice(prefix.length + 1), createdAt: at });
      }
      token2 = /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1];
      if (!/<IsTruncated>true<\/IsTruncated>/.test(xml) || !token2) break;
    }
    return reply(200, { items });
  }

  if (body.op === 'delete') {
    const paths = Array.isArray(body.paths) ? body.paths : [];
    if (paths.length > 1000 || !paths.every((p) => okPath(space, p)))
      return reply(400, { error: 'bad paths' });
    for (const p of paths) {
      const res = await fetcher(await sign('DELETE', p as string, undefined, 60), {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 404)
        return reply(502, { error: `R2 delete failed (${res.status})` });
    }
    return reply(200, { ok: true });
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
      R2_ACCOUNT_ID: env('R2_ACCOUNT_ID'),
      R2_ACCESS_KEY_ID: env('R2_ACCESS_KEY_ID'),
      R2_SECRET_ACCESS_KEY: env('R2_SECRET_ACCESS_KEY'),
      R2_BUCKET: env('R2_BUCKET'),
      R2_JURISDICTION: env('R2_JURISDICTION'),
    }),
  );
}
