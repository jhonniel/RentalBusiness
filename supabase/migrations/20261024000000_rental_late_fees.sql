-- Late fees for bookings that are not returned by the agreed return time.
-- The fee is worked out on the server from the return time and the chosen type.
-- A row is only stored once an admin changes the type, voids, pays, or the rental is
-- marked done. Admin-only; the server uses the service-role key. Safe to re-run.

create table if not exists public.rental_late_fees (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  fee_type text not null default 'schedule',
  custom_amount numeric(12, 2),
  stopped_at timestamptz,
  paid_amount numeric(12, 2),
  paid_at timestamptz,
  payment_id bigint references public.payment_transactions (id),
  voided_at timestamptz,
  voided_by bigint references public.profiles (id),
  void_reason text,
  updated_by bigint references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rental_late_fees_uuid_unique unique (uuid),
  constraint rental_late_fees_rental_unique unique (rental_id),
  constraint rental_late_fees_type_check check (fee_type in ('schedule', 'product', 'half_day', 'full_day', 'custom')),
  constraint rental_late_fees_custom_check check (custom_amount is null or custom_amount >= 0),
  constraint rental_late_fees_paid_check check (paid_amount is null or paid_amount >= 0),
  constraint rental_late_fees_void_reason_check check (void_reason is null or char_length(void_reason) <= 500)
);

alter table public.rental_late_fees enable row level security;
alter table public.rental_late_fees force row level security;

revoke all on public.rental_late_fees from anon, authenticated, public;
grant select on public.rental_late_fees to authenticated;
grant select, insert, update on public.rental_late_fees to service_role;

drop policy if exists rental_late_fees_admin_select on public.rental_late_fees;
create policy rental_late_fees_admin_select
on public.rental_late_fees for select
to authenticated
using (public.is_admin());

comment on table public.rental_late_fees is
  'Late fee settings per booking: type, custom amount, when the clock stopped, payment, and void details.';
