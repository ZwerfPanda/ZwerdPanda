import { describe, expect, it } from 'vitest';
import { handle, presign, type Env } from '../../supabase/functions/media-r2/index';

const SPACE = '0b7f6c1e-4a2d-4c3b-9e8f-1a2b3c4d5e6f';
const env: Env = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'AKID',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'ours',
};

describe('presigned URLs (AWS signature v4)', () => {
  it('match the example in the AWS documentation', async () => {
    // "Example: presigned URL" from the S3 Signature Version 4 docs.
    const url = await presign({
      method: 'GET',
      host: 'examplebucket.s3.amazonaws.com',
      path: '/test.txt',
      region: 'us-east-1',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      amzDate: '20130524T000000Z',
      expires: 86400,
    });
    expect(url).toContain(
      'X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
    expect(url).toContain(
      'X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request',
    );
  });
});

/** Supabase answers "member" only for the right token. */
const fakeFetch = (members: Record<string, boolean>, r2 = new Map<string, string>()) =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith(env.SUPABASE_URL)) {
      const token = new Headers(init?.headers).get('Authorization')?.replace('Bearer ', '') ?? '';
      return new Response(JSON.stringify(members[token] ? [{ space_id: SPACE }] : []), {
        status: 200,
      });
    }
    const u = new URL(url);
    if (u.searchParams.get('list-type') === '2') {
      const prefix = u.searchParams.get('prefix') ?? '';
      const keys = [...r2.keys()].filter((k) => k.startsWith(prefix));
      return new Response(
        `<ListBucketResult>${keys.map((k) => `<Contents><Key>${k}</Key><LastModified>2026-10-25T10:00:00.000Z</LastModified></Contents>`).join('')}<IsTruncated>false</IsTruncated></ListBucketResult>`,
      );
    }
    if (init?.method === 'DELETE') {
      r2.delete(decodeURIComponent(u.pathname.replace('/ours/', '')));
      return new Response(null, { status: 204 });
    }
    return new Response('?', { status: 400 });
  }) as typeof fetch;

const post = (body: unknown, token = 'good') =>
  new Request('https://fn/media-r2', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('the media-r2 function', () => {
  it('signs links only for members, only inside their own universe', async () => {
    const f = fakeFetch({ good: true });
    const ok = await handle(
      post({ op: 'sign', space: SPACE, method: 'PUT', paths: [`${SPACE}/e2e/a.0`] }),
      env,
      f,
    );
    expect(ok.status).toBe(200);
    const { urls } = await ok.json();
    expect(urls[0]).toMatch(
      new RegExp(`^https://acct\\.r2\\.cloudflarestorage\\.com/ours/${SPACE}/e2e/a\\.0\\?`),
    );
    expect(urls[0]).not.toContain('secret');

    const stranger = await handle(
      post({ op: 'sign', space: SPACE, paths: [`${SPACE}/e2e/a.0`] }, 'bad'),
      env,
      f,
    );
    expect(stranger.status).toBe(403);

    const noToken = await handle(new Request('https://fn', { method: 'POST', body: '{}' }), env, f);
    expect(noToken.status).toBe(401);

    for (const path of [
      `other/e2e/a.0`,
      `${SPACE}/../other/x`,
      `${SPACE}//x`,
      `${SPACE}/e2e/a b`,
    ]) {
      const res = await handle(post({ op: 'sign', space: SPACE, paths: [path] }), env, f);
      expect(res.status, path).toBe(400);
    }
  });

  it('lists and removes files in a folder', async () => {
    const r2 = new Map([
      [`${SPACE}/e2e/a.m`, 'x'],
      [`${SPACE}/e2e/a.0`, 'x'],
    ]);
    const f = fakeFetch({ good: true }, r2);
    const list = await handle(post({ op: 'list', space: SPACE, prefix: `${SPACE}/e2e` }), env, f);
    const { items } = await list.json();
    expect(items.map((i: { name: string }) => i.name).sort()).toEqual(['a.0', 'a.m']);
    const del = await handle(
      post({ op: 'delete', space: SPACE, paths: [`${SPACE}/e2e/a.0`] }),
      env,
      f,
    );
    expect(del.status).toBe(200);
    expect([...r2.keys()]).toEqual([`${SPACE}/e2e/a.m`]);
  });

  it('answers the browser’s CORS check and refuses when R2 isn’t set up', async () => {
    const pre = await handle(new Request('https://fn', { method: 'OPTIONS' }), env);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const res = await handle(post({ op: 'sign' }), { ...env, R2_BUCKET: '' }, fakeFetch({}));
    expect(res.status).toBe(500);
  });
});

describe('finding the bucket', () => {
  it('finds a bucket kept in the EU by itself, and explains wrong keys', async () => {
    const seen: string[] = [];
    const eu = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(env.SUPABASE_URL)) return new Response('[{"space_id":"x"}]');
      const u = new URL(url);
      seen.push(u.host);
      if (!u.host.includes('.eu.'))
        return new Response('<Error><Code>NoSuchBucket</Code></Error>', { status: 404 });
      void init;
      return new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
    }) as typeof fetch;
    const euEnv = { ...env, R2_ACCOUNT_ID: 'acct-eu' };
    const res = await handle(post({ op: 'check', space: SPACE }), euEnv, eu);
    expect(await res.json()).toMatchObject({
      ok: true,
      host: 'acct-eu.eu.r2.cloudflarestorage.com',
    });
    const signed = await handle(
      post({ op: 'sign', space: SPACE, method: 'PUT', paths: [`${SPACE}/e2e/a.0`] }),
      euEnv,
      eu,
    );
    expect((await signed.json()).urls[0]).toContain('acct-eu.eu.r2.cloudflarestorage.com');

    const badKeys = (async (input: RequestInfo | URL) =>
      String(input).startsWith(env.SUPABASE_URL)
        ? new Response('[{"space_id":"x"}]')
        : new Response('<Error><Code>InvalidAccessKeyId</Code></Error>', {
            status: 403,
          })) as typeof fetch;
    const wrong = await handle(
      post({ op: 'check', space: SPACE }),
      { ...env, R2_ACCOUNT_ID: 'acct-wrong' },
      badKeys,
    );
    expect((await wrong.json()).problem).toMatch(/R2-sleutels in Supabase kloppen niet .*…AKID.*InvalidAccessKeyId/);

    const missing = await handle(
      post({ op: 'check', space: SPACE }),
      { ...env, R2_SECRET_ACCESS_KEY: '' },
      badKeys,
    );
    expect((await missing.json()).error).toMatch(/R2_SECRET_ACCESS_KEY/);
  });
});

describe('carrying pieces when the browser can’t reach R2', () => {
  it('puts and gets sealed pieces through the function, only for members', async () => {
    const r2 = new Map<string, Uint8Array>();
    const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(env.SUPABASE_URL)) {
        const token = new Headers(init?.headers).get('Authorization') ?? '';
        return new Response(token.endsWith('good') ? '[{"space_id":"x"}]' : '[]');
      }
      const u = new URL(url);
      const key = decodeURIComponent(u.pathname).replace(/^\/ours\/?/, '');
      if (u.searchParams.get('list-type')) return new Response('<ListBucketResult/>');
      if (init?.method === 'PUT') {
        r2.set(key, new Uint8Array(init.body as ArrayBuffer));
        return new Response(null);
      }
      const v = r2.get(key);
      return v ? new Response(v as BlobPart) : new Response('', { status: 404 });
    }) as typeof fetch;
    const carry = (op: string, path: string, body?: Uint8Array, token = 'good') =>
      new Request('https://fn/media-r2', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-op': op,
          'x-space': SPACE,
          'x-path': path,
        },
        body: (body ?? new Uint8Array()) as BlobPart,
      });
    const piece = new Uint8Array([1, 2, 3, 250]);
    expect((await handle(carry('put', `${SPACE}/e2e/a.0`, piece), env, f)).status).toBe(200);
    const got = await handle(carry('get', `${SPACE}/e2e/a.0`), env, f);
    expect([...new Uint8Array(await got.arrayBuffer())]).toEqual([1, 2, 3, 250]);
    expect((await handle(carry('get', `${SPACE}/e2e/nope.0`), env, f)).status).toBe(404);
    expect((await handle(carry('get', `${SPACE}/e2e/a.0`, undefined, 'bad'), env, f)).status).toBe(
      403,
    );
    expect((await handle(carry('put', `other/e2e/a.0`, piece), env, f)).status).toBe(400);
  });
});
