-- Hourly line totals are rounded as numeric. The earlier function called
-- round() on a floating-point amount, so an hourly request could not be saved.
-- Safe to re-run.

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
  v_hours integer;
  v_min_hours integer;
  v_rent numeric;
  v_less numeric;
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

  if v_rental.billing_unit = 'hour' then
    if v_product.hourly_enabled is not true or v_product.hourly_price is null or v_product.hourly_price <= 0 then
      raise exception 'hourly rental is not enabled for this equipment';
    end if;

    v_hours := least(24, greatest(1, coalesce(v_rental.billed_hours, 0)));
    v_min_hours := least(24, greatest(1, coalesce(v_product.hourly_less_min_hours, 1)));
    new.billing_unit := 'hour';
    new.billed_hours := v_hours;
    new.hourly_price := v_product.hourly_price;
    new.daily_price := v_product.daily_price;
    v_rent := round((v_product.hourly_price * v_hours * greatest(1, new.quantity))::numeric, 2);
    v_less := 0;
    if v_hours >= v_min_hours then
      if v_product.hourly_discount = 'per_hour' then
        v_less := round((greatest(0, coalesce(v_product.hourly_less, 0)) * v_hours * greatest(1, new.quantity))::numeric, 2);
      elsif v_product.hourly_discount = 'hours' then
        v_less := round((
          v_product.hourly_price
          * least(v_hours, greatest(0, coalesce(v_product.hourly_less_hours, 0)))
          * greatest(1, new.quantity)
        )::numeric, 2);
      end if;
    end if;
    if v_less > v_rent then
      v_less := v_rent;
    end if;
    new.line_total := round(v_rent - v_less, 2);
    return new;
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

  new.billing_unit := 'day';
  new.billed_hours := null;
  new.hourly_price := null;
  new.daily_price := v_quote.daily_price;
  new.line_total := v_quote.line_total;
  return new;
end;
$$;
