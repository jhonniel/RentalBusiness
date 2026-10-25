-- Admins can link a customer to a commissioner. New bookings for that customer, whether
-- the customer books online or an admin books for them, are recorded to that commissioner
-- so they earn the commission. Customers cannot change this: they only have update
-- grants on their name and phone. Safe to re-run.

alter table public.profiles
  add column if not exists assigned_commissioner_id bigint references public.profiles (id) on delete set null,
  add column if not exists assigned_commissioner_at timestamptz,
  add column if not exists assigned_commissioner_by bigint references public.profiles (id) on delete set null;

create index if not exists profiles_assigned_commissioner_idx
  on public.profiles (assigned_commissioner_id)
  where assigned_commissioner_id is not null;

comment on column public.profiles.assigned_commissioner_id is
  'Commissioner this customer is linked to. New bookings for the customer earn this commissioner a commission.';
