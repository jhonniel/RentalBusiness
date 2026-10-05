-- Pickup and return instants. Return is the same clock time as pickup
-- on the last rental day. Existing rows keep full inclusive-day occupancy.

alter table public.rental_requests
  add column if not exists pickup_at timestamptz,
  add column if not exists return_at timestamptz;

update public.rental_requests
set
  pickup_at = (starts_on::timestamp at time zone 'Asia/Manila'),
  return_at = ((ends_on + 1)::timestamp at time zone 'Asia/Manila')
where pickup_at is null or return_at is null;

alter table public.rental_requests
  alter column pickup_at set not null,
  alter column return_at set not null;

alter table public.rental_requests
  drop constraint if exists rental_requests_pickup_return_check;

alter table public.rental_requests
  add constraint rental_requests_pickup_return_check check (pickup_at < return_at);

create index if not exists rental_requests_pickup_return_idx
  on public.rental_requests (pickup_at, return_at);

create or replace function public.product_booked_window(
  p_product_id bigint,
  p_pickup_at timestamptz,
  p_return_at timestamptz
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(ri.quantity), 0)::integer
  from public.rental_items ri
  join public.rental_requests rr on rr.id = ri.rental_id
  where ri.product_id = p_product_id
    and public.rental_occupies_inventory(rr.status)
    and rr.pickup_at < p_return_at
    and rr.return_at > p_pickup_at;
$$;

create or replace function public.product_booked_quantity(
  p_product_id bigint,
  p_starts_on date,
  p_ends_on date
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.product_booked_window(
    p_product_id,
    p_starts_on::timestamp at time zone 'Asia/Manila',
    (p_ends_on + 1)::timestamp at time zone 'Asia/Manila'
  );
$$;

revoke all on function public.product_booked_window(bigint, timestamptz, timestamptz) from public;
grant execute on function public.product_booked_window(bigint, timestamptz, timestamptz) to anon, authenticated;

comment on column public.rental_requests.pickup_at is
  'Pickup instant in UTC. Public forms collect Asia/Manila clock time.';
comment on column public.rental_requests.return_at is
  'Return instant in UTC. Always the pickup clock time on the return date.';
comment on function public.product_booked_window(bigint, timestamptz, timestamptz) is
  'Counts occupying quantity overlapping a pickup/return window. Half-open: a return at 1pm frees the kit at 1pm.';
