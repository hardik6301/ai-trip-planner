-- Fix PostgREST 42P17 infinite recursion between trips ↔ trip_members RLS.
-- Cause: trips SELECT "Members can view trips" queried trip_members, while
-- trip_members SELECT/ALL policies queried trips → recursion on every trips GET.
--
-- Run this NOW in Supabase SQL Editor to restore My Trips.

-- ─── Helper functions (SECURITY DEFINER bypasses RLS — breaks the cycle) ─────
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

-- ─── Drop recursive / redundant policies ─────────────────────────────────────
drop policy if exists "Members can view trips" on public.trips;
-- Public read policy already allows SELECT for everyone; membership SELECT not needed.

drop policy if exists "Users can view own trip memberships" on public.trip_members;
drop policy if exists "Owners can manage trip members" on public.trip_members;
drop policy if exists "Owners and editors can update trips" on public.trips;

-- ─── trip_members policies (no direct trips subquery) ────────────────────────
create policy "Users can view own trip memberships"
  on public.trip_members for select
  using (
    auth.uid() = user_id
    or public.is_trip_owner(trip_id)
  );

create policy "Owners can manage trip members"
  on public.trip_members for all
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

-- ─── trips UPDATE for owners + editors (no recursive SELECT policy) ──────────
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
