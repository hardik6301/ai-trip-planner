-- Ensure Pro columns exist on profiles (safe to re-run)

alter table public.profiles
  add column if not exists is_pro boolean not null default false,
  add column if not exists pro_since timestamptz,
  add column if not exists subscription_id text;

-- Some older schemas may be missing updated_at
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

grant select, insert, update on public.profiles to authenticated;
