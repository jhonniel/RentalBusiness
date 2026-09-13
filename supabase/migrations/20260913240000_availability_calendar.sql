-- Occupying rental ranges for calendar pickers. No customer or rental identifiers.

create or replace function public.product_occupying_ranges(
  p_product_id bigint,
  p_starts_on date,
  p_ends_on date
)
returns table (
  starts_on date,
  ends_on date,
  quantity integer
)
language sql
stable
security definer
set search_path = public
as $$
  select rr.starts_on, rr.ends_on, ri.quantity
  from public.rental_items ri
  join public.rental_requests rr on rr.id = ri.rental_id
  where ri.product_id = p_product_id
    and public.rental_occupies_inventory(rr.status)
    and rr.starts_on <= p_ends_on
    and rr.ends_on >= p_starts_on;
$$;

revoke all on function public.product_occupying_ranges(bigint, date, date) from public;
grant execute on function public.product_occupying_ranges(bigint, date, date) to anon, authenticated;

comment on function public.product_occupying_ranges(bigint, date, date) is
  'Returns occupying rental date ranges and quantities for one product. Used to disable booked calendar days. Does not expose rental or customer identifiers.';
