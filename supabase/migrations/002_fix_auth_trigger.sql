-- Travora: fix auth trigger permissions and remove broken triggers
-- Run this AFTER 001_profiles.sql if you still get "Database error saving new user"
-- Supabase Dashboard → SQL Editor → Run

-- ─── 1. Remove ALL custom triggers on auth.users (fixes broken leftover triggers) ─

do $$
declare
  trigger_record record;
begin
  for trigger_record in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users', trigger_record.tgname);
  end loop;
end $$;

-- ─── 2. Recreate profiles table safely ───────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- ─── 3. RLS policies ─────────────────────────────────────────────────────────

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Allow the auth admin role to insert profiles via the signup trigger
drop policy if exists "Auth admin can insert profiles" on public.profiles;
create policy "Auth admin can insert profiles"
  on public.profiles for insert
  to supabase_auth_admin
  with check (true);

-- ─── 4. Trigger function with SECURITY DEFINER ───────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email,
    avatar_url = excluded.avatar_url,
    updated_at = now();

  return new;
exception
  when others then
    raise log 'handle_new_user error: %', sqlerrm;
    return new;
end;
$$;

-- ─── 5. Grants so the auth system can write profiles ─────────────────────────

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on public.profiles to postgres, service_role;
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;

-- ─── 6. Attach trigger ───────────────────────────────────────────────────────

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
