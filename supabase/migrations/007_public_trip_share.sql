-- REQUIRED for shared / incognito trip links to work.
-- Run once in Supabase Dashboard → SQL Editor.
--
-- Symptom: logged-in owner sees trip in My Trips but /trip/[id] shows
-- "Trip not found" in incognito (anon queries return zero rows).

-- 1. Table grants (anon must be allowed to attempt SELECT; RLS filters rows)
grant usage on schema public to anon, authenticated;
grant select on public.trips to anon, authenticated;
grant insert, update, delete on public.trips to authenticated;

-- 2. Public read policy — without this, anon sees no rows even with GRANT
drop policy if exists "Anyone can view trips publicly" on public.trips;
create policy "Anyone can view trips publicly"
  on public.trips
  for select
  to anon, authenticated
  using (true);
