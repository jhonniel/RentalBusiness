-- Hourly bookings use their own late fee. Daily bookings keep products.late_fee
-- and the waiver day schedule. Paste this in the Supabase SQL editor.

alter table public.products
  add column if not exists hourly_late_fee numeric(12, 2) not null default 0;

alter table public.products
  drop constraint if exists products_hourly_late_fee_check;

alter table public.products
  add constraint products_hourly_late_fee_check
  check (hourly_late_fee >= 0);

comment on column public.products.hourly_late_fee is
  'Peso amount charged for each hour an hourly booking is returned late. Daily bookings do not use it.';

alter table public.rental_late_fees
  drop constraint if exists rental_late_fees_type_check;

alter table public.rental_late_fees
  add constraint rental_late_fees_type_check
  check (fee_type in ('schedule', 'product', 'half_day', 'full_day', 'custom', 'hourly'));
