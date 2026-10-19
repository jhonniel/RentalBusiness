-- Booking extensions. Each row records the previous and new return date and total
-- so the shop has an easy log of what an extension added. Rows are append-only.

create table if not exists public.rental_extensions (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  previous_ends_on date not null,
  ends_on date not null,
  previous_return_at timestamptz,
  return_at timestamptz not null,
  previous_total_amount numeric(12, 2) not null,
  total_amount numeric(12, 2) not null,
  added_amount numeric(12, 2) not null,
  note text,
  extended_by bigint references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint rental_extensions_uuid_unique unique (uuid),
  constraint rental_extensions_dates_check check (ends_on > previous_ends_on),
  constraint rental_extensions_amounts_check check (
    previous_total_amount >= 0
    and total_amount >= 0
  ),
  constraint rental_extensions_note_check check (note is null or char_length(note) <= 500)
);

create index if not exists rental_extensions_rental_id_idx
  on public.rental_extensions (rental_id, created_at desc);

alter table public.rental_extensions enable row level security;
alter table public.rental_extensions force row level security;

revoke all on public.rental_extensions from anon, authenticated, public;
grant select, insert on public.rental_extensions to authenticated;
grant select, insert on public.rental_extensions to service_role;

drop policy if exists rental_extensions_admin_select on public.rental_extensions;
create policy rental_extensions_admin_select
on public.rental_extensions for select
to authenticated
using (public.is_admin());

drop policy if exists rental_extensions_admin_insert on public.rental_extensions;
create policy rental_extensions_admin_insert
on public.rental_extensions for insert
to authenticated
with check (public.is_admin());

comment on table public.rental_extensions is
  'Append-only log of booking extensions: previous and new return date, previous and new total, and the amount added.';
