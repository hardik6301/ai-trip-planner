-- Trip collaboration v1 (additive, non-breaking)
-- - itinerary_version for optimistic concurrency
-- - edit_token for share-link-with-edit-token invites (revocable)
-- - trip_members for editors (view share stays /trip/[id] UUID)
-- Run in Supabase SQL Editor after prior migrations.

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

-- Members can read their own row; trip owners can read all members of their trips
drop policy if exists "Users can view own trip memberships" on public.trip_members;
create policy "Users can view own trip memberships"
  on public.trip_members for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.user_id = auth.uid()
    )
  );

-- Inserts for invite redemption are done via service role in the API.
-- Owners may also insert editor rows manually if needed.
drop policy if exists "Owners can manage trip members" on public.trip_members;
create policy "Owners can manage trip members"
  on public.trip_members for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = trip_members.trip_id
        and t.user_id = auth.uid()
    )
  );

-- ─── widen trip UPDATE for editors (keep owner user_id path) ─────────────────
drop policy if exists "Users can update own trips" on public.trips;
drop policy if exists "Owners and editors can update trips" on public.trips;
create policy "Owners and editors can update trips"
  on public.trips for update
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = trips.id
        and m.user_id = auth.uid()
        and m.role in ('editor', 'owner')
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = trips.id
        and m.user_id = auth.uid()
        and m.role in ('editor', 'owner')
    )
  );

-- Members can SELECT trips they belong to (public read already exists; this helps RLS clarity)
drop policy if exists "Members can view trips" on public.trips;
create policy "Members can view trips"
  on public.trips for select
  using (
    exists (
      select 1 from public.trip_members m
      where m.trip_id = trips.id
        and m.user_id = auth.uid()
    )
  );
