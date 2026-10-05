-- Calendar availability uses pickup and return instants, not inclusive dates only.

drop function if exists public.product_occupying_ranges(bigint, date, date);

create or replace function public.product_occupying_ranges(
  p_product_id bigint,
  p_starts_on date,
  p_ends_on date
)
returns table (
  starts_on date,
  ends_on date,
  pickup_at timestamptz,
  return_at timestamptz,
  quantity integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    rr.starts_on,
    rr.ends_on,
    rr.pickup_at,
    rr.return_at,
    ri.quantity
  from public.rental_items ri
  join public.rental_requests rr on rr.id = ri.rental_id
  where ri.product_id = p_product_id
    and public.rental_occupies_inventory(rr.status)
    and rr.pickup_at < ((p_ends_on + 1)::timestamp at time zone 'Asia/Manila')
    and rr.return_at > (p_starts_on::timestamp at time zone 'Asia/Manila');
$$;

revoke all on function public.product_occupying_ranges(bigint, date, date) from public;
grant execute on function public.product_occupying_ranges(bigint, date, date) to anon, authenticated;

comment on function public.product_occupying_ranges(bigint, date, date) is
  'Returns occupying rental windows for one product. Calendar days stay bookable when a later pickup time is still free. Does not expose rental or customer identifiers.';
