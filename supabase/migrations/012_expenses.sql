-- Expense Tracker (Pro feature): per-trip expenses owned by users.
-- Run this in the Supabase SQL Editor before using /trip/[id]/expenses.

create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  category text not null,
  amount decimal(10,2) not null,
  note text,
  expense_date date default current_date,
  created_at timestamp with time zone default now()
);

alter table public.expenses enable row level security;

-- Owners can read/insert/update/delete only their own expense rows
drop policy if exists "Users can manage own expenses" on public.expenses;
create policy "Users can manage own expenses" on public.expenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.expenses to authenticated;

-- Speeds up the per-trip expense list
create index if not exists expenses_trip_id_idx on public.expenses (trip_id);
