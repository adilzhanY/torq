-- Torq SOCIAL schema (PATH.md Phase 3). Run it the same way as schema.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Re-running is safe (IF NOT EXISTS / OR REPLACE / drop-then-create policy).
--
-- Deliberately separate from the private mirror tables in schema.sql: those
-- hold raw workout logs and never leave the owner. Here we publish only what
-- a friend is allowed to see — a handle, a display name, and a COMPUTED rank
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
  -- [{ name, e1RM, unit, points, tier }] — the top lifts, display-ready.
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
