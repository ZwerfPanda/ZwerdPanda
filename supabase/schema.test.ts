// Runs supabase/schema.sql inside a real Postgres (PGlite, in-process) with
// small stand-ins for what Supabase provides (auth.uid(), storage.objects…),
// then checks the security rules as different people. The tests in this file
// build on each other, in order.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, describe, expect, it } from 'vitest';

interface Person {
  id: string;
  email: string;
  confirmed: boolean;
}
type Row = Record<string, unknown>;

const people = {
  valencio: {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'valencio@example.com',
    confirmed: true,
  },
  shenaya: {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'Shenaya@Example.com',
    confirmed: true,
  },
  stranger: {
    id: '33333333-3333-3333-3333-333333333333',
    email: 'stranger@example.com',
    confirmed: true,
  },
  unconfirmed: {
    id: '44444444-4444-4444-4444-444444444444',
    email: 'shenaya@example.com.fake',
    confirmed: false,
  },
} satisfies Record<string, Person>;

const db = new PGlite({ extensions: { pgcrypto } });
let space = '';

/** Runs one statement as a signed-in person (or an anonymous visitor). */
async function as(
  person: Person | null,
  sql: string,
  params: unknown[] = [],
): Promise<{ rows?: Row[]; error?: string }> {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [person?.id ?? '']);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify(person ? { sub: person.id, email: person.email } : {}),
  ]);
  await db.exec(person ? 'set role authenticated' : 'set role anon');
  try {
    return { rows: (await db.query<Row>(sql, params)).rows };
  } catch (error) {
    return { error: (error as Error).message };
  } finally {
    await db.exec('reset role');
  }
}

const first = (result: { rows?: Row[] }) => result.rows?.[0] ?? {};

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    create publication supabase_realtime;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
  `);
  // Run the real schema twice: it must be safe to re-run.
  const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await db.exec(schema);
  await db.exec(schema);
  for (const p of Object.values(people)) {
    await db.query('insert into auth.users (id, email, email_confirmed_at) values ($1, $2, $3)', [
      p.id,
      p.email,
      p.confirmed ? new Date().toISOString() : null,
    ]);
  }
}, 60_000);

describe('supabase/schema.sql', () => {
  it('lets Valencio create the shared universe once (invite email case does not matter)', async () => {
    const created = await as(
      people.valencio,
      `select public.create_space('  shenaya@example.com ') as id`,
    );
    space = String(first(created).id ?? '');
    expect(space).toMatch(/^[0-9a-f-]{36}$/);
    const again = await as(people.valencio, `select public.create_space('x@example.com')`);
    expect(again.error).toMatch(/already part/);
  });

  it('versions saves and refuses a stale save, returning the current copy', async () => {
    const saved = first(
      await as(people.valencio, `select * from public.save_content($1, 0, $2)`, [
        space,
        { hello: 'v1' },
      ]),
    );
    expect(saved.saved).toBe(true);
    expect(Number(saved.new_version)).toBe(1);
    const stale = first(
      await as(people.valencio, `select * from public.save_content($1, 0, $2)`, [
        space,
        { hello: 'no' },
      ]),
    );
    expect(stale.saved).toBe(false);
    expect((stale.current_content as Row).hello).toBe('v1');
  });

  it('shows nothing to the invited person before they join', async () => {
    expect(
      first(await as(people.shenaya, `select count(*)::int as n from public.space_content`)).n,
    ).toBe(0);
  });

  it('does not let an unconfirmed look-alike account claim the invite', async () => {
    expect(
      first(await as(people.unconfirmed, `select public.join_invited_space() as id`)).id,
    ).toBeNull();
  });

  it('lets Shenaya join through her invite, then read and save', async () => {
    expect(first(await as(people.shenaya, `select public.join_invited_space() as id`)).id).toBe(
      space,
    );
    const read = first(await as(people.shenaya, `select content from public.space_content`));
    expect((read.content as Row).hello).toBe('v1');
    const hers = first(
      await as(people.shenaya, `select * from public.save_content($1, 1, $2)`, [
        space,
        { hello: 'v2' },
      ]),
    );
    expect(hers.saved).toBe(true);
    expect(Number(hers.new_version)).toBe(2);
  });

  it('detects a simultaneous edit instead of overwriting', async () => {
    const clash = first(
      await as(people.valencio, `select * from public.save_content($1, 1, $2)`, [
        space,
        { hello: 'mine' },
      ]),
    );
    expect(clash.saved).toBe(false);
    expect(Number(clash.new_version)).toBe(2);
  });

  it('lists both members and uses up the invite', async () => {
    expect((await as(people.valencio, `select email from public.space_members`)).rows).toHaveLength(
      2,
    );
    expect(
      first(await as(people.valencio, `select count(*)::int as n from public.space_invites`)).n,
    ).toBe(0);
  });

  it('gives a stranger nothing', async () => {
    expect(
      first(await as(people.stranger, `select public.join_invited_space() as id`)).id,
    ).toBeNull();
    expect(
      first(await as(people.stranger, `select count(*)::int as n from public.space_content`)).n,
    ).toBe(0);
    expect(
      (
        await as(people.stranger, `select * from public.save_content($1, 2, $2)`, [
          space,
          { hacked: true },
        ])
      ).error,
    ).toBeTruthy();
    expect(
      (
        await as(people.stranger, `select public.invite_to_space($1, 'friend@example.com')`, [
          space,
        ])
      ).error,
    ).toBeTruthy();
  });

  it('never allows a third person', async () => {
    const third = await as(
      people.valencio,
      `select public.invite_to_space($1, 'third@example.com')`,
      [space],
    );
    expect(third.error).toMatch(/two people/);
  });

  it('blocks direct table writes and anonymous visitors', async () => {
    expect(
      (await as(people.valencio, `update public.space_content set content = '{}'::jsonb`)).error,
    ).toBeTruthy();
    const anonRead = await as(null, `select count(*)::int as n from public.space_content`);
    expect(Boolean(anonRead.error) || first(anonRead).n === 0).toBe(true);
    expect(
      (await as(null, `select * from public.save_content($1, 2, $2)`, [space, {}])).error,
    ).toBeTruthy();
  });

  it('keeps photos private to the two members', async () => {
    const upload = await as(
      people.valencio,
      `insert into storage.objects (bucket_id, name, owner) values ('universe-media', $1, $2) returning name`,
      [`${space}/media-1`, people.valencio.id],
    );
    expect(upload.rows).toHaveLength(1);
    expect(
      first(await as(people.shenaya, `select count(*)::int as n from storage.objects`)).n,
    ).toBe(1);
    expect(
      first(await as(people.stranger, `select count(*)::int as n from storage.objects`)).n,
    ).toBe(0);
    const evil = await as(
      people.stranger,
      `insert into storage.objects (bucket_id, name, owner) values ('universe-media', $1, $2)`,
      [`${space}/evil`, people.stranger.id],
    );
    expect(evil.error).toBeTruthy();
    const odd = await as(
      people.valencio,
      `insert into storage.objects (bucket_id, name, owner) values ('universe-media', 'not-a-uuid/file', $1)`,
      [people.valencio.id],
    );
    expect(odd.error).toBeTruthy();
    expect(odd.error).not.toMatch(/invalid input syntax/);
    const bucket = (
      await db.query<{ public: boolean }>(
        `select public from storage.buckets where id = 'universe-media'`,
      )
    ).rows[0];
    expect(bucket?.public).toBe(false);
  });

  it('keeps earlier copies in the history, readable only by the two of us', async () => {
    const before = Number(
      first(await as(people.valencio, `select count(*)::int as n from public.space_history`)).n,
    );
    expect(before).toBeGreaterThan(0);
    const version = Number(
      first(await as(people.valencio, `select version from public.space_content`)).version,
    );
    // A big removal is always kept, even within the hour.
    const big = { letters: 'x'.repeat(5000) };
    await as(people.valencio, `select * from public.save_content($1, $2, $3)`, [
      space,
      version,
      big,
    ]);
    await as(people.valencio, `select * from public.save_content($1, $2, $3)`, [
      space,
      version + 1,
      { letters: '' },
    ]);
    const rows = (
      await as(people.shenaya, `select version, content from public.space_history order by id`)
    ).rows!;
    expect(rows.length).toBe(before + 1);
    expect((rows.at(-1)!.content as Row).letters).toBe(big.letters);
    expect(
      first(await as(people.stranger, `select count(*)::int as n from public.space_history`)).n,
    ).toBe(0);
    const tamper = await as(people.valencio, `delete from public.space_history`);
    expect(tamper.error).toBeTruthy();
  });

  it('thins the history out: everything recent, one a day, 90 days', async () => {
    await db.exec('reset role');
    await db.query(
      `insert into public.space_history (space_id, version, content, saved_at, kept_at)
       values ($1, 1, '{}', now(), date_trunc('day', now()) - interval '5 days' + interval '1 hour'),
              ($1, 2, '{}', now(), date_trunc('day', now()) - interval '5 days' + interval '3 hours'),
              ($1, 3, '{}', now(), now() - interval '120 days')`,
      [space],
    );
    // Make the next save keep a copy (and tidy up) right away.
    await db.query(`update public.space_history set kept_at = kept_at - interval '2 hours'
                    where kept_at > now() - interval '1 hour'`);
    const version = Number(
      first(await as(people.valencio, `select version from public.space_content`)).version,
    );
    await as(people.valencio, `select * from public.save_content($1, $2, $3)`, [
      space,
      version,
      { letters: 'tidy' },
    ]);
    const old = (
      await db.query<{ version: number }>(
        `select version from public.space_history
         where space_id = $1 and kept_at < now() - interval '2 days' order by kept_at`,
        [space],
      )
    ).rows.map((r) => Number(r.version));
    expect(old).toEqual([2]);
  });

  it('only lets the creator change the site texts; her saves keep his wording', async () => {
    const versionNow = async () =>
      Number(first(await as(people.valencio, `select version from public.space_content`)).version);
    const save = async (who: Person, content: Row) =>
      first(
        await as(who, `select * from public.save_content($1, $2, $3)`, [
          space,
          await versionNow(),
          content,
        ]),
      ).saved;
    const stored = async () =>
      first(await as(people.shenaya, `select content from public.space_content`)).content as Row;

    const his = [{ id: 'text-a', from: 'Mini Us', to: 'Mini Wij', at: '2026-10-24T10:00:00Z' }];
    expect(await save(people.valencio, { hello: 'his', texts: his })).toBe(true);
    // She saves something else with the texts changed, or left out: they stay his.
    const hacked = [{ id: 'text-a', from: 'Mini Us', to: 'Hacked', at: '2026-10-24T11:00:00Z' }];
    expect(await save(people.shenaya, { hello: 'hers', texts: hacked })).toBe(true);
    expect(await stored()).toEqual({ hello: 'hers', texts: his });
    expect(await save(people.shenaya, { hello: 'hers again' })).toBe(true);
    expect(await stored()).toEqual({ hello: 'hers again', texts: his });
    // He can still change them.
    expect(await save(people.valencio, { hello: 'his', texts: [] })).toBe(true);
    expect((await stored()).texts).toEqual([]);
  });
});
