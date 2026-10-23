-- Let an administrator delete a customer, commissioner, or another admin without losing
-- history. The profile row stays so rentals, payments, receipts, and audit logs keep their
-- links; it is marked deleted, hidden from admin lists, and the sign-in is banned.
-- Safe to re-run.

alter table public.profiles
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by bigint references public.profiles (id);

create index if not exists profiles_deleted_at_idx on public.profiles (deleted_at);

comment on column public.profiles.deleted_at is
  'Set when an administrator deletes the account. The row is kept for rental, payment, and audit history.';
