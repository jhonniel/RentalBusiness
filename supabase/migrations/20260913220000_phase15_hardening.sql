-- Phase 15: customers cannot change rental money, item prices, or signed-waiver
-- metadata through the anon/authenticated client. Pricing math matches
-- utils/pricing.ts (daily / weekly / monthly, inclusive days).

create or replace function public.quote_rental_line(
  p_daily numeric,
  p_weekly numeric,
  p_monthly numeric,
  p_deposit numeric,
  p_quantity integer,
  p_days integer
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
  v_best numeric := p_daily * v_days;
  v_weeks integer;
  v_remainder integer;
  v_months integer;
  v_month_remainder integer;
  v_remainder_cost numeric;
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

  daily_price := p_daily;
  line_total := round(v_best * v_quantity, 2);
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

  v_days := greatest(1, (v_rental.ends_on - v_rental.starts_on) + 1);
  select *
  into v_quote
  from public.quote_rental_line(
    v_product.daily_price,
    v_product.weekly_price,
    v_product.monthly_price,
    v_product.deposit_amount,
    new.quantity,
    v_days
  );

  new.daily_price := v_quote.daily_price;
  new.line_total := v_quote.line_total;
  return new;
end;
$$;

create or replace function public.sync_rental_request_totals(p_rental_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12, 2);
  v_deposit numeric(12, 2);
begin
  select
    coalesce(sum(ri.line_total), 0),
    coalesce(sum(round(p.deposit_amount * ri.quantity, 2)), 0)
  into v_subtotal, v_deposit
  from public.rental_items ri
  join public.products p on p.id = ri.product_id
  where ri.rental_id = p_rental_id;

  perform set_config('lumen.sync_rental_totals', 'on', true);

  update public.rental_requests
  set
    subtotal = v_subtotal,
    deposit_amount = v_deposit,
    total_amount = v_subtotal
  where id = p_rental_id;
end;
$$;

create or replace function public.sync_rental_request_totals_from_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_rental_request_totals(
    case when tg_op = 'DELETE' then old.rental_id else new.rental_id end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.freeze_customer_rental_money()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('lumen.sync_rental_totals', true), '') = 'on' then
    return new;
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  new.starts_on := old.starts_on;
  new.ends_on := old.ends_on;
  new.subtotal := old.subtotal;
  new.deposit_amount := old.deposit_amount;
  new.discount_amount := old.discount_amount;
  new.tax_amount := old.tax_amount;
  new.total_amount := old.total_amount;
  new.customer_id := old.customer_id;
  new.uuid := old.uuid;
  new.code := old.code;
  new.admin_notes := old.admin_notes;
  return new;
end;
$$;

drop trigger if exists rental_items_apply_catalog_prices on public.rental_items;
create trigger rental_items_apply_catalog_prices
before insert or update of product_id, quantity, daily_price, line_total
on public.rental_items
for each row
execute function public.apply_rental_item_catalog_prices();

drop trigger if exists rental_items_sync_request_totals on public.rental_items;
create trigger rental_items_sync_request_totals
after insert or update of product_id, quantity, daily_price, line_total or delete
on public.rental_items
for each row
execute function public.sync_rental_request_totals_from_items();

drop trigger if exists rental_requests_freeze_customer_money on public.rental_requests;
create trigger rental_requests_freeze_customer_money
before update on public.rental_requests
for each row
execute function public.freeze_customer_rental_money();

revoke update on public.rental_requests from authenticated;
grant update (status) on public.rental_requests to authenticated;

drop policy if exists rental_requests_update_own_open on public.rental_requests;
create policy rental_requests_update_own_open
on public.rental_requests for update
to authenticated
using (
  customer_id = public.current_profile_id()
  and status in ('draft', 'pending')
)
with check (
  customer_id = public.current_profile_id()
  and status in ('draft', 'pending')
);

drop policy if exists rental_status_history_insert_own on public.rental_status_history;
create policy rental_status_history_insert_own
on public.rental_status_history for insert
to authenticated
with check (
  to_status in ('draft', 'pending', 'cancelled')
  and exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
      and (
        (to_status in ('draft', 'pending') and rr.status in ('draft', 'pending'))
        or (to_status = 'cancelled' and rr.status = 'cancelled')
      )
  )
);

drop policy if exists waiver_acceptances_insert_own on public.waiver_acceptances;
create policy waiver_acceptances_insert_own
on public.waiver_acceptances for insert
to authenticated
with check (
  customer_id = public.current_profile_id()
  and exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
      and rr.status in ('draft', 'pending')
  )
  and exists (
    select 1
    from public.waiver_versions wv
    where wv.id = waiver_version_id
      and wv.is_current = true
  )
);

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

drop policy if exists settings_public_read on public.settings;
create policy settings_admin_select
on public.settings for select
to authenticated
using (public.is_admin());
