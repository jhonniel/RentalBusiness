-- Keep a single quote_rental_line. A 7-argument overload plus an 8-argument
-- function with a default makes the item-price trigger ambiguous, so every
-- rental insert fails for customers and admins.

alter table public.products
  add column if not exists long_stay_less numeric(12, 2) not null default 0;

alter table public.products
  add column if not exists long_stay_min_days integer not null default 3;

drop function if exists public.quote_rental_line(numeric, numeric, numeric, numeric, integer, integer);
drop function if exists public.quote_rental_line(numeric, numeric, numeric, numeric, integer, integer, numeric);
drop function if exists public.quote_rental_line(numeric, numeric, numeric, numeric, integer, integer, numeric, integer);

create function public.quote_rental_line(
  p_daily numeric,
  p_weekly numeric,
  p_monthly numeric,
  p_deposit numeric,
  p_quantity integer,
  p_days integer,
  p_long_stay_less numeric,
  p_long_stay_min_days integer
)
returns table (
  daily_price numeric,
  line_total numeric,
  deposit_amount numeric
)
language plpgsql
immutable
as $$
declare
  v_quantity integer := greatest(1, trunc(p_quantity));
  v_days integer := greatest(1, trunc(p_days));
  v_min_days integer := greatest(1, coalesce(p_long_stay_min_days, 3));
  v_best numeric := p_daily * v_days;
  v_weeks integer;
  v_remainder integer;
  v_months integer;
  v_month_remainder integer;
  v_remainder_cost numeric;
  v_rent numeric;
  v_less numeric := 0;
begin
  if p_weekly is not null and v_days >= 7 then
    v_weeks := v_days / 7;
    v_remainder := v_days % 7;
    v_best := least(v_best, v_weeks * p_weekly + v_remainder * p_daily);
  end if;

  if p_monthly is not null and v_days >= 28 then
    v_months := v_days / 28;
    v_month_remainder := v_days % 28;
    if p_weekly is not null and v_month_remainder >= 7 then
      v_remainder_cost := (v_month_remainder / 7) * p_weekly
        + (v_month_remainder % 7) * p_daily;
    else
      v_remainder_cost := v_month_remainder * p_daily;
    end if;
    v_best := least(v_best, v_months * p_monthly + v_remainder_cost);
  end if;

  v_rent := round(v_best * v_quantity, 2);
  if v_days >= v_min_days then
    v_less := round(greatest(0, coalesce(p_long_stay_less, 0)) * v_days * v_quantity, 2);
  end if;

  daily_price := p_daily;
  line_total := greatest(0, v_rent - v_less);
  deposit_amount := round(p_deposit * v_quantity, 2);
  return next;
end;
$$;

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
