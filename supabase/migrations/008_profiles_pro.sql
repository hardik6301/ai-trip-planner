-- Pro subscription fields on profiles (Razorpay)

alter table public.profiles
  add column if not exists is_pro boolean not null default false,
  add column if not exists pro_since timestamptz,
  add column if not exists subscription_id text;
