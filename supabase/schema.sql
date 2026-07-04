-- Torq cloud sync schema (mirror-table pattern, adapted from grit).
-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Every table is a generic mirror of a local collection:
--   user_id    the owner (auth.users); rows are private per user via RLS
--   id         the original row id from the app (text)
--   data       the full row as JSON (keeps nested fields: entries, sets…)
--   updated_at last change time, for last-write-wins delta sync
--   deleted    a tombstone flag so deletes propagate across devices
--
-- Tables:
--   exercises     the movement library
--   routines      reusable workout templates
--   workouts      finished workout sessions
--   measurements  body measurement points
--   settings      singleton user settings
--   active        the in-progress workout session (singleton)
--
-- Re-running is safe (IF NOT EXISTS / OR REPLACE).

create extension if not exists "pgcrypto";

-- The server owns updated_at: this trigger stamps it on every insert AND update
-- so delta sync is immune to client clock skew (clients no longer decide the
-- row version — Postgres does, monotonically, via now()).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at := now();
  return new;
end;
$fn$;

do $$
declare
  t text;
  tables text[] := array[
    'exercises', 'routines', 'workouts', 'measurements', 'settings', 'active'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      create table if not exists public.%I (
        user_id    uuid        not null references auth.users(id) on delete cascade,
        id         text        not null,
        data       jsonb       not null default '{}'::jsonb,
        updated_at timestamptz not null default now(),
        deleted    boolean     not null default false,
        primary key (user_id, id)
      );
    $f$, t);

    -- Fast "what changed for me since X" queries.
    execute format(
      'create index if not exists %I on public.%I (user_id, updated_at);',
      t || '_user_updated_idx', t
    );

    -- Lock every table to its owner.
    execute format('alter table public.%I enable row level security;', t);

    -- (Re)create the owner-only policy.
    execute format('drop policy if exists "own rows" on public.%I;', t);
    execute format($p$
      create policy "own rows" on public.%I
        for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id);
    $p$, t);

    -- Server-authoritative updated_at (skew-proof delta sync).
    execute format('drop trigger if exists set_updated_at on public.%I;', t);
    execute format(
      'create trigger set_updated_at before insert or update on public.%I
         for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;
