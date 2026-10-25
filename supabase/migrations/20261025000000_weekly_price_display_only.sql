-- Weekly and monthly prices are shown on the catalog only. Rent is the daily price for
-- every day, then the long-stay less per day when the booking is long enough. The weekly
-- and monthly arguments stay so the item-price trigger keeps the same call. Existing
-- bookings keep the price they were saved with. Safe to re-run.

create or replace function public.quote_rental_line(
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
  v_rent numeric;
  v_less numeric := 0;
begin
  v_rent := round(p_daily * v_days * v_quantity, 2);
  if v_days >= v_min_days then
    v_less := round(greatest(0, coalesce(p_long_stay_less, 0)) * v_days * v_quantity, 2);
  end if;

  daily_price := p_daily;
  line_total := greatest(0, v_rent - v_less);
  deposit_amount := round(p_deposit * v_quantity, 2);
  return next;
end;
$$;
