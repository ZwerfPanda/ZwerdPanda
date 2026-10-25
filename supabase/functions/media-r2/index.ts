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
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
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

/** Asks Supabase (with the caller's own sign-in) whether they're in this universe. */
async function isMember(env: Env, token: string, space: string, fetcher: typeof fetch) {
  const res = await fetcher(
    `${env.SUPABASE_URL}/rest/v1/space_members?select=space_id&space_id=eq.${space}`,
    { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return false;
  const rows = (await res.json()) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
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
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET)
    return reply(500, { error: 'R2 is not configured' });

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'sign in first' });

  let body: { op?: string; space?: string; paths?: unknown; method?: string; prefix?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return reply(400, { error: 'bad request' });
  }
  const space = String(body.space ?? '');
  if (!UUID.test(space)) return reply(400, { error: 'bad universe' });
  if (!(await isMember(env, token, space, fetcher))) return reply(403, { error: 'not yours' });

  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const sign = (method: string, key: string, query?: Record<string, string>, expires = 900) =>
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
    }),
  );
}
