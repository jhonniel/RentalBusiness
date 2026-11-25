-- Restrict selected vouchers to first-time bookers (new customers by account email / rental history).
-- Paste into the Supabase SQL editor. Safe to re-run.

alter table public.vouchers
  add column if not exists first_time_only boolean not null default false;

comment on column public.vouchers.first_time_only is
  'When true, only customers with no prior booking history (same account email) may redeem this voucher.';
