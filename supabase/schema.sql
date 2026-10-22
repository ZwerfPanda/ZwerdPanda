-- ============================================================================
-- Our Little Universe — shared, private space for two people
--
-- Run this once in your Supabase project:
--   Dashboard → SQL Editor → New query → paste this whole file → Run.
-- It is safe to run again (everything is created "if not exists" or replaced).
--
-- How it works
--   * A "space" is our shared universe. It has at most two members.
--   * The first person creates the space and invites the other by email.
--     The invite is accepted automatically when that email signs in.
--   * All words live in one JSON document per space (space_content) with a
--     version number, so two phones editing at once never overwrite each other.
--   * Photos/clips live in a private storage bucket, in a folder per space.
--   * Row-level security: only members can read anything. Every change goes
--     through the functions below, which check membership themselves.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Tables

create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our Little Universe',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table if not exists public.space_invites (
  space_id uuid not null references public.spaces (id) on delete cascade,
  email text not null check (email = lower(email)),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (space_id, email)
);

create table if not exists public.space_content (
  space_id uuid primary key references public.spaces (id) on delete cascade,
  content jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;
alter table public.space_content enable row level security;

-- Nobody writes to these tables directly; the functions below do it.
revoke all on public.spaces, public.space_members, public.space_invites, public.space_content from anon;
revoke insert, update, delete on public.spaces, public.space_members, public.space_invites, public.space_content from authenticated;
grant select on public.spaces, public.space_members, public.space_invites, public.space_content to authenticated;

-- --------------------------------------------------------------- Helpers

-- Is the signed-in person a member of this space?
create or replace function public.is_member(p_space uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space and user_id = auth.uid()
  );
$$;

-- Same check for storage paths, which arrive as text (never cast blindly).
create or replace function public.is_member_text(p_space text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id::text = p_space and user_id = auth.uid()
  );
$$;

-- The signed-in person's email, but only once it has been confirmed.
create or replace function public.confirmed_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;

-- ------------------------------------------------------------ Read rules

drop policy if exists "members read their space" on public.spaces;
create policy "members read their space" on public.spaces
  for select to authenticated using (public.is_member(id));

drop policy if exists "members read members" on public.space_members;
create policy "members read members" on public.space_members
  for select to authenticated using (public.is_member(space_id));

drop policy if exists "members read invites" on public.space_invites;
create policy "members read invites" on public.space_invites
  for select to authenticated using (public.is_member(space_id));

drop policy if exists "members read content" on public.space_content;
create policy "members read content" on public.space_content
  for select to authenticated using (public.is_member(space_id));

-- ------------------------------------------------------------- Functions

-- Create our shared universe (once) and invite the other person.
create or replace function public.create_space(p_partner_email text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.confirmed_email();
  v_space uuid;
  v_partner text := lower(trim(coalesce(p_partner_email, '')));
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = '28000';
  end if;
  if v_email is null then
    raise exception 'Please confirm your email address first.' using errcode = '28000';
  end if;
  if exists (select 1 from public.space_members where user_id = v_uid) then
    raise exception 'You are already part of a shared universe.' using errcode = 'P0001';
  end if;
  if v_partner = v_email then
    raise exception 'Invite the other person, not yourself.' using errcode = 'P0001';
  end if;

  insert into public.spaces (created_by) values (v_uid) returning id into v_space;
  insert into public.space_members (space_id, user_id, email) values (v_space, v_uid, v_email);
  if v_partner <> '' then
    insert into public.space_invites (space_id, email, invited_by) values (v_space, v_partner, v_uid);
  end if;
  return v_space;
end;
$$;

-- Change who is invited (e.g. a typo in the email). Members only, max two people.
create or replace function public.invite_to_space(p_space uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.is_member(p_space) then
    raise exception 'Not part of this universe.' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'That email address looks incomplete.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.space_members where space_id = p_space) >= 2 then
    raise exception 'This universe already belongs to two people.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.space_members where space_id = p_space and email = v_email) then
    raise exception 'That person is already here.' using errcode = 'P0001';
  end if;
  delete from public.space_invites where space_id = p_space;
  insert into public.space_invites (space_id, email, invited_by) values (p_space, v_email, auth.uid());
end;
$$;

-- Returns the space this person belongs to, joining it first if they were invited.
create or replace function public.join_invited_space()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.confirmed_email();
  v_space uuid;
begin
  if v_uid is null then
    raise exception 'Please sign in first.' using errcode = '28000';
  end if;

  select space_id into v_space from public.space_members where user_id = v_uid limit 1;
  if v_space is not null then
    return v_space;
  end if;
  if v_email is null then
    return null;
  end if;

  select i.space_id into v_space
  from public.space_invites i
  where i.email = v_email
  order by i.created_at
  limit 1;
  if v_space is null then
    return null;
  end if;

  if (select count(*) from public.space_members where space_id = v_space) >= 2 then
    raise exception 'This universe already belongs to two people.' using errcode = 'P0001';
  end if;

  insert into public.space_members (space_id, user_id, email) values (v_space, v_uid, v_email)
  on conflict do nothing;
  delete from public.space_invites where space_id = v_space and email = v_email;
  return v_space;
end;
$$;

-- Save the shared content, but only if nobody else saved in between.
-- p_expected_version = 0 creates the first copy.
-- Returns saved = false plus the current copy when someone else was faster,
-- so the app can merge both sets of changes and try again.
create or replace function public.save_content(p_space uuid, p_expected_version bigint, p_content jsonb)
returns table (saved boolean, new_version bigint, current_content jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.space_content%rowtype;
begin
  if not public.is_member(p_space) then
    raise exception 'Not part of this universe.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_content) <> 'object' then
    raise exception 'Content must be a JSON object.' using errcode = '22023';
  end if;
  if octet_length(p_content::text) > 8000000 then
    raise exception 'Content is too large.' using errcode = '54000';
  end if;

  select * into v_row from public.space_content where space_id = p_space for update;

  if not found then
    if p_expected_version <> 0 then
      return query select false, 0::bigint, null::jsonb;
      return;
    end if;
    insert into public.space_content (space_id, content, version, updated_by)
    values (p_space, p_content, 1, auth.uid());
    return query select true, 1::bigint, null::jsonb;
    return;
  end if;

  if v_row.version <> p_expected_version then
    return query select false, v_row.version, v_row.content;
    return;
  end if;

  update public.space_content
  set content = p_content, version = v_row.version + 1, updated_at = now(), updated_by = auth.uid()
  where space_id = p_space;
  return query select true, v_row.version + 1, null::jsonb;
end;
$$;

revoke execute on function public.create_space(text) from public, anon;
revoke execute on function public.invite_to_space(uuid, text) from public, anon;
revoke execute on function public.join_invited_space() from public, anon;
revoke execute on function public.save_content(uuid, bigint, jsonb) from public, anon;
grant execute on function public.create_space(text) to authenticated;
grant execute on function public.invite_to_space(uuid, text) to authenticated;
grant execute on function public.join_invited_space() to authenticated;
grant execute on function public.save_content(uuid, bigint, jsonb) to authenticated;

-- ------------------------------------------------- Live updates (Realtime)

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.space_content;
  end if;
exception
  when duplicate_object then null;
end;
$$;

-- --------------------------------------------------- Private photo storage

insert into storage.buckets (id, name, public, file_size_limit)
values ('universe-media', 'universe-media', false, 62914560)
on conflict (id) do nothing;

drop policy if exists "universe members read media" on storage.objects;
create policy "universe members read media" on storage.objects
  for select to authenticated
  using (bucket_id = 'universe-media' and public.is_member_text((storage.foldername(name))[1]));

drop policy if exists "universe members add media" on storage.objects;
create policy "universe members add media" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'universe-media' and public.is_member_text((storage.foldername(name))[1]));

drop policy if exists "universe members replace media" on storage.objects;
create policy "universe members replace media" on storage.objects
  for update to authenticated
  using (bucket_id = 'universe-media' and public.is_member_text((storage.foldername(name))[1]))
  with check (bucket_id = 'universe-media' and public.is_member_text((storage.foldername(name))[1]));

drop policy if exists "universe members remove media" on storage.objects;
create policy "universe members remove media" on storage.objects
  for delete to authenticated
  using (bucket_id = 'universe-media' and public.is_member_text((storage.foldername(name))[1]));
