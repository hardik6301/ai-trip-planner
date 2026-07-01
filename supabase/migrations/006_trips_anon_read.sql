-- Trips table: allow anonymous public reads (RLS policy alone is not enough).
-- Without GRANT SELECT, the anon role cannot query trips even when
-- "Anyone can view trips publicly" RLS policy exists.

grant usage on schema public to anon, authenticated;

grant select on public.trips to anon, authenticated;
grant insert, update, delete on public.trips to authenticated;
