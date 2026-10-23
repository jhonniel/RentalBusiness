-- Let an administrator cancel the latest booking extension. The log row stays on file
-- and is marked cancelled with who cancelled it and why. Safe to re-run.

alter table public.rental_extensions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by bigint references public.profiles (id),
  add column if not exists cancel_reason text;

alter table public.rental_extensions drop constraint if exists rental_extensions_cancel_reason_check;
alter table public.rental_extensions
  add constraint rental_extensions_cancel_reason_check check (cancel_reason is null or char_length(cancel_reason) <= 500);

grant update (cancelled_at, cancelled_by, cancel_reason) on public.rental_extensions to service_role;
