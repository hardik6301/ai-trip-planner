-- Profile preferences: currency + newsletter opt-in

alter table public.profiles
  add column if not exists currency text not null default 'INR',
  add column if not exists newsletter_opt_in boolean not null default true;

grant select, insert, update on public.profiles to authenticated;
