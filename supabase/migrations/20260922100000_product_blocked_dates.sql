-- Admin-blocked product dates. Public calendar reads go through a security-definer
-- function so callers never see product_id or admin notes.

create table if not exists public.product_blocked_dates (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  product_id bigint not null references public.products (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint product_blocked_dates_uuid_unique unique (uuid),
  constraint product_blocked_dates_dates_check check (starts_on <= ends_on),
  constraint product_blocked_dates_reason_check check (reason is null or char_length(reason) <= 200)
);

create index if not exists product_blocked_dates_product_range_idx
  on public.product_blocked_dates (product_id, starts_on, ends_on);

drop trigger if exists product_blocked_dates_set_updated_at on public.product_blocked_dates;
create trigger product_blocked_dates_set_updated_at
before update on public.product_blocked_dates
for each row execute function public.set_updated_at();

create or replace function public.product_blocked_ranges(
  p_product_id bigint,
  p_starts_on date,
  p_ends_on date
)
returns table (
  starts_on date,
  ends_on date
)
language sql
stable
security definer
set search_path = public
as $$
  select pbd.starts_on, pbd.ends_on
  from public.product_blocked_dates pbd
  where pbd.product_id = p_product_id
    and pbd.starts_on <= p_ends_on
    and pbd.ends_on >= p_starts_on;
$$;

revoke all on function public.product_blocked_ranges(bigint, date, date) from public;
grant execute on function public.product_blocked_ranges(bigint, date, date) to anon, authenticated;

comment on function public.product_blocked_ranges(bigint, date, date) is
  'Returns admin-blocked date ranges for one product. Used to disable calendar days. Does not expose product_id, reason, or other identifiers.';

alter table public.product_blocked_dates enable row level security;
alter table public.product_blocked_dates force row level security;

revoke all on public.product_blocked_dates from anon, authenticated, public;
grant select, insert, update, delete on public.product_blocked_dates to authenticated;
grant select, insert, update, delete on public.product_blocked_dates to service_role;

drop policy if exists product_blocked_dates_admin_all on public.product_blocked_dates;
create policy product_blocked_dates_admin_all
on public.product_blocked_dates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
