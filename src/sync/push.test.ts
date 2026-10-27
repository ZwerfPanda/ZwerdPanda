import { describe, expect, it } from 'vitest';
import {
  b64url,
  encryptPayload,
  fromB64url,
  handle,
  vapidHeader,
  type Env,
} from '../../supabase/functions/push/index';

const enc = new TextEncoder();

async function keyPair() {
  return crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]) as Promise<CryptoKeyPair>;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits',
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
      key,
      length * 8,
    ),
  );
}

/** What the phone does with it (RFC 8291 / 8188), written out separately. */
async function decrypt(body: Uint8Array, phone: CryptoKeyPair, auth: Uint8Array) {
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const sealed = body.slice(21 + idlen);
  expect(rs).toBe(4096);
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', phone.publicKey));
  const asKey = await crypto.subtle.importKey(
    'raw',
    asPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, phone.privateKey, 256),
  );
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed),
  );
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

async function vapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey: b64url(raw), privateKey: jwk.d!, verify: pair.publicKey };
}

async function phone() {
  const pair = await keyPair();
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = b64url(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { pair, auth, keys: { p256dh, auth: b64url(auth) } };
}

describe('push: sealing a message', () => {
  it('only that phone can read it', async () => {
    const p = await phone();
    const body = await encryptPayload(enc.encode('{"title":"Jouw beurt"}'), p.keys);
    expect(await decrypt(body, p.pair, p.auth)).toBe('{"title":"Jouw beurt"}');
    const other = await phone();
    await expect(decrypt(body, other.pair, p.auth)).rejects.toThrow();
  });

  it('signs a VAPID token the push service can check', async () => {
    const v = await vapidKeys();
    const header = await vapidHeader('https://fcm.googleapis.com/fcm/send/abc', {
      ...v,
      subject: 'mailto:ons@example.com',
    });
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(k).toBe(v.publicKey);
    const [h, c, s] = t.split('.');
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(c)));
    expect(claims.aud).toBe('https://fcm.googleapis.com');
    expect(claims.sub).toBe('mailto:ons@example.com');
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      v.verify,
      fromB64url(s) as BufferSource,
      enc.encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});

describe('push: the function', () => {
  const SPACE = '5a1c6c3e-1111-4a4a-8a8a-123456789abc';
  async function setup() {
    const v = await vapidKeys();
    const hers = await phone();
    const env: Env = {
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      VAPID_PUBLIC_KEY: v.publicKey,
      VAPID_PRIVATE_KEY: v.privateKey,
      VAPID_SUBJECT: 'mailto:ons@example.com',
      CRON_SECRET: 'cron-secret',
    };
    const calls: { url: string; init?: RequestInit }[] = [];
    let pushStatus = 201;
    const rows = [
      { endpoint: 'https://fcm.googleapis.com/fcm/send/hers', ...hers.keys, user_id: 'her-id' },
      { endpoint: 'https://evil.example.com/steal', ...hers.keys, user_id: 'her-id' },
    ];
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const auth = (init?.headers as Record<string, string>)?.Authorization ?? '';
      if (url.endsWith('/auth/v1/user'))
        return new Response(JSON.stringify(auth === 'Bearer his-token' ? { id: 'his-id' } : {}), {
          status: auth === 'Bearer his-token' || auth === 'Bearer stranger' ? 200 : 401,
        });
      if (url.includes('/rest/v1/space_members'))
        return new Response(
          JSON.stringify(auth === 'Bearer his-token' ? [{ space_id: SPACE }] : []),
        );
      if (url.includes('/rest/v1/push_subscriptions')) {
        if (init?.method === 'DELETE' || init?.method === 'POST')
          return new Response(null, { status: 201 });
        return new Response(JSON.stringify(rows));
      }
      if (url.startsWith('https://fcm.googleapis.com/'))
        return new Response(null, { status: pushStatus });
      throw new Error(`unexpected ${url}`);
    }) as typeof fetch;
    const call = (body: unknown, token = 'his-token', headers: Record<string, string> = {}) =>
      handle(
        new Request('https://fn/push', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, ...headers },
          body: JSON.stringify(body),
        }),
        env,
        fetcher,
      );
    return { env, calls, call, hers, setStatus: (s: number) => (pushStatus = s) };
  }

  it('sends "your turn" to the other phone, sealed, and only to real push services', async () => {
    const { call, calls, hers } = await setup();
    const res = await call({
      op: 'send',
      space: SPACE,
      kind: 'turn',
      title: 'Jouw beurt 🎮',
      body: 'UNO',
      url: '#/games?g=uno',
    });
    expect(await res.json()).toEqual({ sent: 1, gone: 0, failed: 0 });
    // Only the partner's phones are asked for, never the sender's own.
    const query = calls.find((c) => c.url.includes('push_subscriptions?select'))!;
    expect(query.url).toContain('user_id=neq.his-id');
    expect((query.init!.headers as Record<string, string>).Authorization).toBe('Bearer service');
    const sent = calls.find((c) => c.url.startsWith('https://fcm.googleapis.com/'))!;
    const h = sent.init!.headers as Record<string, string>;
    expect(h['Content-Encoding']).toBe('aes128gcm');
    expect(h.Authorization).toMatch(/^vapid t=.+, k=/);
    const message = JSON.parse(
      await decrypt(new Uint8Array(sent.init!.body as Uint8Array), hers.pair, hers.auth),
    );
    expect(message).toMatchObject({
      kind: 'turn',
      title: 'Jouw beurt 🎮',
      body: 'UNO',
      url: '#/games?g=uno',
    });
    expect(calls.some((c) => c.url.includes('evil.example.com'))).toBe(false);
  });

  it('forgets a phone the push service says is gone', async () => {
    const { call, calls, setStatus } = await setup();
    setStatus(410);
    const res = await call({ op: 'send', space: SPACE, kind: 'ping', title: 'Ik denk aan je' });
    expect(await res.json()).toMatchObject({ sent: 0, gone: 1 });
    expect(
      calls.some((c) => c.init?.method === 'DELETE' && c.url.includes('fcm.googleapis.com')),
    ).toBe(true);
  });

  it('refuses strangers, odd links and made-up kinds', async () => {
    const { call } = await setup();
    expect(
      (await call({ op: 'send', space: SPACE, kind: 'turn', title: 'x' }, 'stranger')).status,
    ).toBe(403);
    expect(
      (await call({ op: 'send', space: SPACE, kind: 'turn', title: 'x' }, 'nope')).status,
    ).toBe(403);
    expect((await call({ op: 'send', space: SPACE, kind: 'spam', title: 'x' })).status).toBe(400);
    expect((await call({ op: 'send', space: 'not-a-uuid', kind: 'turn', title: 'x' })).status).toBe(
      401,
    );
    expect(
      (
        await call({
          op: 'subscribe',
          space: SPACE,
          subscription: {
            endpoint: 'https://evil.example.com/x',
            keys: { p256dh: 'a', auth: 'b' },
          },
        })
      ).status,
    ).toBe(400);
  });

  it('hands out the public key, and lets the Wednesday call in only with the secret', async () => {
    const { call, env } = await setup();
    expect(await (await call({ op: 'key', space: SPACE })).json()).toEqual({
      publicKey: env.VAPID_PUBLIC_KEY,
    });
    expect((await call({ op: 'golden' }, '', { 'x-cron': 'wrong' })).status).toBe(401);
    const ok = await call({ op: 'golden', force: true }, '', { 'x-cron': 'cron-secret' });
    expect(await ok.json()).toMatchObject({ sent: 1 });
  });
});
