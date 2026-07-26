-- Expense Tracker collab: trip editors can log spend; all collaborators see trip totals.
-- Extends existing public.expenses (user_id ≈ created_by). Do NOT create a second table.
-- Depends on: 012_expenses, 015_fix_rls_recursion (is_trip_owner / is_trip_editor).

-- Optional alias column for clarity (kept in sync with user_id)
alter table public.expenses
  add column if not exists created_by uuid references public.profiles(id) on delete cascade;

update public.expenses
set created_by = user_id
where created_by is null and user_id is not null;

-- Replace single-owner-only policy with collaborator-aware policies
drop policy if exists "Users can manage own expenses" on public.expenses;
drop policy if exists "Collaborators can view trip expenses" on public.expenses;
drop policy if exists "Collaborators can insert own expenses" on public.expenses;
drop policy if exists "Users can update own expenses" on public.expenses;
drop policy if exists "Users can delete own expenses" on public.expenses;

-- Everyone on the trip (owner/editor) can read all logged expenses for the Trip Spend bar
create policy "Collaborators can view trip expenses"
  on public.expenses for select
  using (
    auth.uid() = user_id
    or public.is_trip_owner(trip_id)
    or public.is_trip_editor(trip_id)
  );

-- Owner or editor may insert rows attributed to themselves
create policy "Collaborators can insert own expenses"
  on public.expenses for insert
  with check (
    auth.uid() = user_id
    and (created_by is null or created_by = auth.uid())
    and (
      public.is_trip_owner(trip_id)
      or public.is_trip_editor(trip_id)
    )
  );

create policy "Users can update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Author or trip owner can delete
create policy "Users can delete own expenses"
  on public.expenses for delete
  using (
    auth.uid() = user_id
    or public.is_trip_owner(trip_id)
  );
