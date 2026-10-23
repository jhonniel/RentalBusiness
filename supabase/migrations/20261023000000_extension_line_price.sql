-- Booking extensions are priced on the added days only, so the long-stay less applies
-- to an extension only when the extension itself is long enough. The item price trigger
-- used to re-price the whole rental period on every update, which undid that. Updates
-- made by the server with the service-role key now keep the server-computed price.
-- Customer writes and every insert are still priced by the trigger. Safe to re-run.

create or replace function public.apply_rental_item_catalog_prices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_rental public.rental_requests%rowtype;
  v_days integer;
  v_quote record;
begin
  if tg_op = 'UPDATE' and auth.role() = 'service_role' then
    return new;
  end if;

  select * into v_product
  from public.products
  where id = new.product_id;

  if not found then
    raise exception 'product not found';
  end if;

  select * into v_rental
  from public.rental_requests
  where id = new.rental_id;

  if not found then
    raise exception 'rental not found';
  end if;

  v_days := greatest(1, (v_rental.ends_on - v_rental.starts_on));
  select *
  into v_quote
  from public.quote_rental_line(
    v_product.daily_price,
    v_product.weekly_price,
    v_product.monthly_price,
    v_product.deposit_amount,
    new.quantity,
    v_days,
    v_product.long_stay_less,
    v_product.long_stay_min_days
  );

  new.daily_price := v_quote.daily_price;
  new.line_total := v_quote.line_total;
  return new;
end;
$$;
