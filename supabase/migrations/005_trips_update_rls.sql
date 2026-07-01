-- Allow trip owners to update their saved itineraries (e.g. after day regeneration)

drop policy if exists "Users can update own trips" on public.trips;
create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
