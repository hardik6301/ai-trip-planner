-- Trip collaboration v1 (additive, non-breaking)
-- - itinerary_version for optimistic concurrency
-- - edit_token for share-link-with-edit-token invites (revocable)
-- - trip_members for editors (view share stays /trip/[id] UUID)
-- Run in Supabase SQL Editor after prior migrations.
--
-- NOTE: If you already ran an older 014 and My Trips returns 42P17,
-- also run 015_fix_rls_recursion.sql (this file is safe to re-run).

-- ─── trips columns ───────────────────────────────────────────────────────────
alter table public.trips
  add column if not exists itinerary_version integer not null default 1;

alter table public.trips
  add column if not exists edit_token text;

alter table public.trips
  add column if not exists edit_token_created_at timestamptz;

create unique index if not exists trips_edit_token_uidx
  on public.trips (edit_token)
  where edit_token is not null;

-- ─── trip_members ────────────────────────────────────────────────────────────
create table if not exists public.trip_members (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz default now(),
  unique (trip_id, user_id)
);

create index if not exists trip_members_user_id_idx on public.trip_members (user_id);
create index if not exists trip_members_trip_id_idx on public.trip_members (trip_id);

alter table public.trip_members enable row level security;

grant select, insert, update, delete on public.trip_members to authenticated;

-- SECURITY DEFINER helpers — avoid trips ↔ trip_members RLS recursion (42P17)
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    where t.id = p_trip_id
      and t.user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_editor(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members m
    where m.trip_id = p_trip_id
      and m.user_id = auth.uid()
      and m.role in ('editor', 'owner')
  );
$$;

revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.is_trip_editor(uuid) from public;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.is_trip_editor(uuid) to authenticated;

drop policy if exists "Users can view own trip memberships" on public.trip_members;
create policy "Users can view own trip memberships"
  on public.trip_members for select
  using (
    auth.uid() = user_id
    or public.is_trip_owner(trip_id)
  );

drop policy if exists "Owners can manage trip members" on public.trip_members;
create policy "Owners can manage trip members"
  on public.trip_members for all
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

-- Widen trip UPDATE for owners + editors
drop policy if exists "Users can update own trips" on public.trips;
drop policy if exists "Owners and editors can update trips" on public.trips;
create policy "Owners and editors can update trips"
  on public.trips for update
  using (
    auth.uid() = user_id
    or public.is_trip_editor(id)
  )
  with check (
    auth.uid() = user_id
    or public.is_trip_editor(id)
  );

-- Do NOT add a trips SELECT policy that queries trip_members —
-- "Anyone can view trips publicly" already covers SELECT and a members
-- SELECT policy caused infinite recursion (42P17) with trip_members policies.
drop policy if exists "Members can view trips" on public.trips;
