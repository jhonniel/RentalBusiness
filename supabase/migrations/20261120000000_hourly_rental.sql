-- Optional hourly rental for equipment an admin enables. Daily bookings stay
-- priced by the day. An hourly booking stores the hour count and is due back
-- that many hours after pickup. Safe to re-run.

alter table public.products
  add column if not exists hourly_enabled boolean not null default false,
  add column if not exists hourly_price numeric(12, 2);

alter table public.products drop constraint if exists products_hourly_price_check;
alter table public.products
  add constraint products_hourly_price_check
  check (hourly_price is null or hourly_price >= 0);

alter table public.products drop constraint if exists products_hourly_enabled_check;
alter table public.products
  add constraint products_hourly_enabled_check
  check (hourly_enabled = false or (hourly_price is not null and hourly_price > 0));

alter table public.rental_requests
  add column if not exists billing_unit text not null default 'day',
  add column if not exists billed_hours integer;

alter table public.rental_requests drop constraint if exists rental_requests_billing_unit_check;
alter table public.rental_requests
  add constraint rental_requests_billing_unit_check
  check (
    (billing_unit = 'day' and billed_hours is null)
    or (billing_unit = 'hour' and billed_hours between 1 and 24)
  );

alter table public.rental_items
  add column if not exists billing_unit text not null default 'day',
  add column if not exists billed_hours integer,
  add column if not exists hourly_price numeric(12, 2);

alter table public.rental_items drop constraint if exists rental_items_billing_unit_check;
alter table public.rental_items
  add constraint rental_items_billing_unit_check
  check (
    (billing_unit = 'day' and billed_hours is null and hourly_price is null)
    or (billing_unit = 'hour' and billed_hours between 1 and 24 and hourly_price is not null and hourly_price > 0)
  );

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
    new.billing_unit := 'hour';
    new.billed_hours := v_hours;
    new.hourly_price := v_product.hourly_price;
    new.daily_price := v_product.daily_price;
    new.line_total := round((v_product.hourly_price * v_hours * greatest(1, new.quantity))::numeric, 2);
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
