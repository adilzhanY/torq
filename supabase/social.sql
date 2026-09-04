-- Torq SOCIAL schema (PATH.md Phase 3). Run it the same way as schema.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Re-running is safe (IF NOT EXISTS / OR REPLACE / drop-then-create policy).
--
-- Deliberately separate from the private mirror tables in schema.sql: those
-- hold raw workout logs and never leave the owner. Here we publish only what
-- a friend is allowed to see, a handle, a display name, and a COMPUTED rank
-- snapshot. No sets, no dates, no bodyweight history.
--
-- Friends-first (locked decision): there is no "browse all users" surface.
-- Profiles are readable by you and your accepted friends only; finding
-- someone new goes through find_profile(), which needs the exact handle.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── profiles ───────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id      uuid        primary key references auth.users(id) on delete cascade,
  handle       citext      not null unique,
  display_name text        not null default '',
  -- Opt-in: until the user publishes, they cannot be found by handle.
  visible      boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint handle_format check (handle ~ '^[a-z0-9_]{3,20}$')
);

-- ── friendships ────────────────────────────────────────────────────────────
-- One row per relationship, direction preserved so we can show "wants to be
-- your friend" vs "request sent".
create table if not exists public.friendships (
  id         uuid        primary key default gen_random_uuid(),
  requester  uuid        not null references auth.users(id) on delete cascade,
  addressee  uuid        not null references auth.users(id) on delete cascade,
  status     text        not null default 'pending'
               check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_friendship check (requester <> addressee),
  constraint one_row_per_pair unique (requester, addressee)
);

create index if not exists friendships_requester_idx on public.friendships (requester, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee, status);

-- ── rank snapshots ─────────────────────────────────────────────────────────
-- The published half of the rank engine: overall points/tier plus the top
-- lifts, already computed on the device. Never raw workouts.
create table if not exists public.rank_snapshots (
  user_id       uuid        primary key references auth.users(id) on delete cascade,
  points        numeric     not null default 0,
  tier          text        not null default 'Rust',
  stage         smallint    not null default 1 check (stage between 1 and 4),
  -- [{ name, e1RM, unit, points, tier }], the top lifts, display-ready.
  lifts         jsonb       not null default '[]'::jsonb,
  bodyweight_kg numeric,
  sex           text        check (sex in ('male', 'female')),
  updated_at    timestamptz not null default now()
);

-- ── helpers ────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so the friendship check itself is not subject to the
-- policies it is used by (otherwise the profile policy would recurse).
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b)
        or (f.requester = b and f.addressee = a))
  );
$$;

create or replace function public.set_social_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before insert or update on public.profiles
  for each row execute function public.set_social_updated_at();

drop trigger if exists set_updated_at on public.friendships;
create trigger set_updated_at before insert or update on public.friendships
  for each row execute function public.set_social_updated_at();

drop trigger if exists set_updated_at on public.rank_snapshots;
create trigger set_updated_at before insert or update on public.rank_snapshots
  for each row execute function public.set_social_updated_at();

-- ── row level security ─────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.friendships    enable row level security;
alter table public.rank_snapshots enable row level security;

-- Profiles: yourself, your friends, and anyone who has a pending request
-- with you (so the request card can show a name instead of a uuid).
drop policy if exists "read own or friends" on public.profiles;
create policy "read own or friends" on public.profiles
  for select using (
    auth.uid() = user_id
    or public.are_friends(auth.uid(), user_id)
    or exists (
      select 1 from public.friendships f
      where f.status = 'pending'
        and ((f.requester = auth.uid() and f.addressee = profiles.user_id)
          or (f.addressee = auth.uid() and f.requester = profiles.user_id))
    )
  );

drop policy if exists "write own profile" on public.profiles;
create policy "write own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Friendships: you can see and delete any row you are part of, create rows
-- where YOU are the requester, and update rows addressed TO you (accept or
-- block). That split is what stops someone accepting on your behalf.
drop policy if exists "read own edges" on public.friendships;
create policy "read own edges" on public.friendships
  for select using (auth.uid() in (requester, addressee));

drop policy if exists "request as self" on public.friendships;
create policy "request as self" on public.friendships
  for insert with check (auth.uid() = requester and status = 'pending');

drop policy if exists "answer as addressee" on public.friendships;
create policy "answer as addressee" on public.friendships
  for update using (auth.uid() = addressee) with check (auth.uid() = addressee);
-- The row policy cannot pin the OTHER columns to their old values, so an
-- addressee could rewrite `requester` to any uuid and mint a friendship with
-- a stranger. Column-level grant: an update may touch `status` and nothing
-- else (2026-09-04 audit).
revoke update on public.friendships from anon, authenticated;
grant update (status) on public.friendships to authenticated;

drop policy if exists "remove own edges" on public.friendships;
create policy "remove own edges" on public.friendships
  for delete using (auth.uid() in (requester, addressee));

-- Rank snapshots: yours to write, your friends' to read.
drop policy if exists "read own or friends" on public.rank_snapshots;
create policy "read own or friends" on public.rank_snapshots
  for select using (
    auth.uid() = user_id or public.are_friends(auth.uid(), user_id)
  );

drop policy if exists "write own snapshot" on public.rank_snapshots;
create policy "write own snapshot" on public.rank_snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- COLUMN-level grants on top of the row-level policy above, because RLS
-- alone cannot express "a friend may read this row but not these two
-- columns". `bodyweight_kg` and `sex` are inputs to the rank engine, not
-- published facts, and the policy above would happily hand them to any
-- accepted friend that asked for them.
--
-- Nothing ever needs to read them back: the device already knows its own
-- bodyweight from Settings, and publishRankFromData only re-reads
-- (tier, lifts) to diff the feed. So SELECT is revoked for everyone,
-- including the owner, while INSERT and UPDATE keep the full column set.
revoke select on public.rank_snapshots from anon, authenticated;
grant select (user_id, points, tier, stage, lifts, updated_at)
  on public.rank_snapshots to authenticated;
grant insert, update, delete on public.rank_snapshots to authenticated;

-- ── find_profile ───────────────────────────────────────────────────────────
-- The ONLY way to discover someone you are not already connected to, and it
-- needs the exact handle: no listing, no prefix search, no enumeration.
-- SECURITY DEFINER because the profiles policy above deliberately hides
-- strangers.
create or replace function public.find_profile(p_handle text)
returns table (user_id uuid, handle citext, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.handle, p.display_name
  from public.profiles p
  where p.visible
    and p.handle = lower(trim(p_handle))::citext
    and p.user_id <> auth.uid()
  limit 1;
$$;

revoke all on function public.find_profile(text) from public;
grant execute on function public.find_profile(text) to authenticated;

-- handle_taken: lets the profile setup screen say "taken" without exposing
-- who owns it.
create or replace function public.handle_taken(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.handle = lower(trim(p_handle))::citext
      and p.user_id <> auth.uid()
  );
$$;

revoke all on function public.handle_taken(text) from public;
grant execute on function public.handle_taken(text) to authenticated;

-- ── rank events (the friends' rank-up feed) ────────────────────────────────
-- Appended 2026-08-08. Re-running this whole file is safe, so just paste it
-- again to add these.
--
-- One row per TIER CHANGE, written by the device when it publishes a
-- snapshot and notices the stored tier differs. Points tick constantly;
-- tiers do not, which is exactly why they make a feed worth reading.
create table if not exists public.rank_events (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  -- 'overall' = the whole ladder moved; 'lift' = one movement moved.
  kind       text        not null check (kind in ('overall', 'lift')),
  -- Null for 'overall'; the movement's name for 'lift'.
  lift_name  text,
  from_tier  text        not null,
  to_tier    text        not null,
  points     numeric     not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists rank_events_user_created_idx
  on public.rank_events (user_id, created_at desc);

alter table public.rank_events enable row level security;

-- Same friend scoping as the snapshots: yours plus your friends'.
drop policy if exists "read own or friends" on public.rank_events;
create policy "read own or friends" on public.rank_events
  for select using (
    auth.uid() = user_id or public.are_friends(auth.uid(), user_id)
  );

-- Write your own only. No update policy at all: an event is a fact about a
-- moment, so it can be created and deleted but never rewritten.
drop policy if exists "write own events" on public.rank_events;
create policy "write own events" on public.rank_events
  for insert with check (auth.uid() = user_id);

drop policy if exists "delete own events" on public.rank_events;
create policy "delete own events" on public.rank_events
  for delete using (auth.uid() = user_id);

-- ── search_profiles (appended 2026-08-08) ─────────────────────────────────
-- Adilzhan asked for real friend SEARCH: exact-handle-only discovery means
-- you must know someone's handle character-for-character, which is a wall
-- for a social feature.
--
-- The privacy tradeoff, stated plainly: prefix search over opted-in
-- profiles is inherently more enumerable than exact match. It is bounded on
-- purpose, minimum 2 characters, at most 20 rows, `visible` profiles only,
-- and it returns nothing but handle + display name (never a rank, never an
-- id you could not already reach). Opting in stays a deliberate act: a user
-- who never publishes a profile is unfindable by any query here.
create or replace function public.search_profiles(p_query text)
returns table (user_id uuid, handle citext, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select lower(trim(p_query)) as term)
  select p.user_id, p.handle, p.display_name
  from public.profiles p, q
  where p.visible
    and length(q.term) >= 2
    and p.user_id <> auth.uid()
    and (p.handle::text ilike q.term || '%'
      or p.handle::text ilike '%' || q.term || '%'
      or lower(p.display_name) like '%' || q.term || '%')
  -- Prefix matches first: someone typing "adi" most likely wants @adilzhan,
  -- not @radiohead.
  order by
    (case when p.handle::text ilike q.term || '%' then 0
          when lower(p.display_name) like q.term || '%' then 1
          else 2 end),
    length(p.handle),
    p.handle
  limit 20;
$$;

revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;

-- Keeps the ILIKE search off a sequential scan as the table grows.
create extension if not exists "pg_trgm";
create index if not exists profiles_handle_trgm_idx
  on public.profiles using gin ((handle::text) gin_trgm_ops);
create index if not exists profiles_name_trgm_idx
  on public.profiles using gin (lower(display_name) gin_trgm_ops);

-- ── delete_my_account (appended 2026-08-08) ───────────────────────────────
-- Google Play REQUIRES any app offering account creation to offer in-app
-- account deletion, so this is a launch blocker rather than a nicety.
--
-- SECURITY DEFINER because it must reach auth.users, which no client role
-- can touch. It deletes only auth.uid()'s own rows, there is no parameter
-- to point it at somebody else, which is the property that makes granting
-- it to `authenticated` safe.
--
-- Every mirror table and social table cascades from auth.users, so removing
-- the user removes the lot; the explicit deletes below are belt-and-braces
-- for anything added later without a cascade.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  delete from public.rank_events   where user_id = me;
  delete from public.rank_snapshots where user_id = me;
  delete from public.friendships   where requester = me or addressee = me;
  delete from public.profiles      where user_id = me;

  delete from public.exercises     where user_id = me;
  delete from public.routines      where user_id = me;
  delete from public.workouts      where user_id = me;
  delete from public.measurements  where user_id = me;
  delete from public.settings      where user_id = me;
  delete from public.active        where user_id = me;

  -- Storage has NO foreign key to auth.users, so the avatar does not
  -- cascade with everything else. Without this the picture outlives the
  -- account in a public bucket, which would make the deletion promise in
  -- docs/launch/PRIVACY.md a lie.
  delete from storage.objects
   where bucket_id = 'avatars'
     and (storage.foldername(name))[1] = me::text;

  -- Last: removing the auth row invalidates the caller's own JWT.
  delete from auth.users where id = me;
end;
$fn$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ── The Arena: opt-in global leaderboards (PATH.md Phase 4) ───────────────
-- Appended 2026-08-08.
--
-- The Liftoff lesson, restated: an anonymous global board is the easiest
-- thing in the app to poison, so this is built to be UNTRUSTWORTHY BY
-- DEFAULT and to say so:
--   * appearing is a SEPARATE opt-in (`arena`), not implied by having a
--     public profile, friends-first stays the default;
--   * every published snapshot has already passed the client-side
--     plausibility cap (src/lib/plausibility.ts), which drops anything over
--     the world record for the lifter's class;
--   * `verified` marks a lifter whose numbers a human has checked. Nothing
--     sets it yet (video verification is a later feature), but the column
--     exists so the board can be filtered to verified-only from day one
--     rather than retrofitting trust later.
-- Identity exposed is exactly what search already exposes: a handle and a
-- display name. No bodyweight, no logs, no user ids.
alter table public.profiles
  add column if not exists arena boolean not null default false;
alter table public.profiles
  add column if not exists verified boolean not null default false;

/**
 * Top of the board. `p_lift` is null for the overall ranking, or a lift
 * name to rank a single movement out of the snapshot's stored top-5.
 */
create or replace function public.arena_top(
  p_lift text default null,
  p_verified_only boolean default false,
  p_limit int default 50
)
returns table (
  rank_no bigint,
  handle citext,
  display_name text,
  verified boolean,
  points numeric,
  tier text,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      pr.handle,
      pr.display_name,
      pr.verified,
      pr.user_id,
      case
        when p_lift is null then s.points
        else (
          -- Per-lift board: pull the matching entry out of the snapshot's
          -- stored lifts. Case-insensitive, since catalog names vary.
          select max((l->>'points')::numeric)
          from jsonb_array_elements(s.lifts) l
          where lower(l->>'name') = lower(p_lift)
        )
      end as points,
      case
        when p_lift is null then s.tier
        else (
          select (l->>'tier')
          from jsonb_array_elements(s.lifts) l
          where lower(l->>'name') = lower(p_lift)
          order by (l->>'points')::numeric desc
          limit 1
        )
      end as tier
    from public.rank_snapshots s
    join public.profiles pr on pr.user_id = s.user_id
    where pr.arena
      and (not p_verified_only or pr.verified)
  )
  select
    row_number() over (order by e.points desc, e.handle) as rank_no,
    e.handle,
    e.display_name,
    e.verified,
    round(e.points, 1) as points,
    e.tier,
    e.user_id = auth.uid() as is_me
  from eligible e
  where e.points is not null and e.points > 0
  order by e.points desc, e.handle
  limit least(greatest(p_limit, 1), 200);
$$;

revoke all on function public.arena_top(text, boolean, int) from public;
grant execute on function public.arena_top(text, boolean, int) to authenticated;

/** Where the caller sits, so someone outside the top N still sees a number. */
create or replace function public.arena_my_rank(p_lift text default null)
returns table (rank_no bigint, total bigint, points numeric)
language sql
stable
security definer
set search_path = public
as $$
  with eligible as (
    select
      s.user_id,
      case
        when p_lift is null then s.points
        else (
          select max((l->>'points')::numeric)
          from jsonb_array_elements(s.lifts) l
          where lower(l->>'name') = lower(p_lift)
        )
      end as points
    from public.rank_snapshots s
    join public.profiles pr on pr.user_id = s.user_id
    where pr.arena
  ),
  ranked as (
    select user_id, points, row_number() over (order by points desc) as rank_no
    from eligible
    where points is not null and points > 0
  )
  select r.rank_no, (select count(*) from ranked), round(r.points, 1)
  from ranked r
  where r.user_id = auth.uid();
$$;

revoke all on function public.arena_my_rank(text) from public;
grant execute on function public.arena_my_rank(text) to authenticated;

-- ── push tokens (appended 2026-08-08) ─────────────────────────────────────
-- One row per DEVICE, not per user: people have a phone and a tablet, and a
-- friend request should reach both.
--
-- `token` is the primary key so re-registering the same device updates it
-- rather than accumulating duplicates that would each get a copy.
create table if not exists public.push_tokens (
  token      text        primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  platform   text        not null default 'android',
  created_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Own rows only. Nobody may read anyone else's tokens: a leaked token lets a
-- third party push arbitrary notifications to that device.
drop policy if exists "own tokens" on public.push_tokens;
create policy "own tokens" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── profile pictures (appended 2026-08-09) ────────────────────────────────
-- The avatar itself lives in Storage; the profile row only carries the URL,
-- so reading a friend's picture needs no extra permission beyond the
-- profiles policies that already exist.
alter table public.profiles add column if not exists avatar_url text;

-- Public bucket: an avatar is shown next to a handle that is already public,
-- and a signed URL would expire in the middle of a friends list.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- Writes are folder-scoped to the owner: the client uploads to
-- "<user_id>/avatar.jpg", and the first path segment must be the caller.
-- Without this, any signed-in user could overwrite anyone's picture.
-- Readable by SIGNED-IN users only. The original policy had no role
-- restriction, so anyone holding the publishable key (which ships inside
-- every APK, by design) could LIST the bucket and pull down every user's
-- photo, including users who never claimed a handle. Scoping to
-- `authenticated` closes the enumeration hole.
--
-- CAVEAT, and it is not fixed by this policy: the bucket is still
-- `public = true`, so an object whose exact path is known is served by the
-- public endpoint without consulting RLS at all. Paths are
-- "<user_id>/avatar.jpg" and search_profiles hands out user_id, so a
-- signed-in user can still fetch any visible profile's picture directly.
-- Closing that needs public = false plus signed URLs in src/lib/avatar.ts.
drop policy if exists "avatars are readable" on storage.objects;
create policy "avatars are readable" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists "write own avatar" on storage.objects;
create policy "write own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "update own avatar" on storage.objects;
create policy "update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "delete own avatar" on storage.objects;
create policy "delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── handle availability on the SIGN-UP screen (appended 2026-08-09) ────────
-- The register form asks for a username before an account exists, so the
-- check has to be callable while still anonymous. This is the same fact
-- every sign-up form on the internet leaks ("that name is taken") and it
-- exposes nothing else: no owner, no id, no profile.
--
-- handle_taken compares against auth.uid(), which is null for anon, the
-- "and p.user_id <> auth.uid()" clause would then drop every row, so it is
-- rewritten here to only exclude the caller when there IS one.
create or replace function public.handle_taken(p_handle text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.handle = lower(trim(p_handle))::citext
      and (auth.uid() is null or p.user_id <> auth.uid())
  );
$$;

revoke all on function public.handle_taken(text) from public;
grant execute on function public.handle_taken(text) to authenticated, anon;
