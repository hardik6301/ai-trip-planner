-- Travora: RLS policies for the trips table
-- Run in Supabase Dashboard → SQL Editor if save/delete fails with permission errors

alter table public.trips enable row level security;

drop policy if exists "Users can insert own trips" on public.trips;
create policy "Users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can view own trips" on public.trips;
create policy "Users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

drop policy if exists "Anyone can view trips publicly" on public.trips;
create policy "Anyone can view trips publicly"
  on public.trips for select
  using (true);

drop policy if exists "Users can delete own trips" on public.trips;
create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);
