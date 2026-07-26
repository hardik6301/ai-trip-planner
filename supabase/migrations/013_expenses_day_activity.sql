-- Link expenses to itinerary day / activity slots (Phase 2).
-- Run in Supabase SQL Editor after 012_expenses.sql.

alter table public.expenses
  add column if not exists day_number integer,
  add column if not exists activity_key text,
  add column if not exists activity_label text;

comment on column public.expenses.day_number is 'Itinerary day number (1-based); null = unassigned';
comment on column public.expenses.activity_key is 'morning | afternoon | evening | null for whole day';
comment on column public.expenses.activity_label is 'Cached activity title for display';

create index if not exists expenses_trip_day_idx
  on public.expenses (trip_id, day_number);
