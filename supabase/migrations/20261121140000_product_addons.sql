-- Phase 18: paid product add-ons with simple stock and product linking.
-- Customers request linked bookable add-ons on a booking (Phase 19).
-- Paste into the Supabase SQL editor. Safe to re-run.

create table if not exists public.addons (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  name text not null,
  description text not null default '',
  unit_price numeric(12, 2) not null,
  quantity integer not null default 0,
  bookable boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint addons_uuid_unique unique (uuid),
  constraint addons_name_check check (char_length(name) between 1 and 120),
  constraint addons_description_check check (char_length(description) <= 1000),
  constraint addons_unit_price_check check (unit_price >= 0),
  constraint addons_quantity_check check (quantity >= 0),
  constraint addons_status_check check (status in ('active', 'archived'))
);

create index if not exists addons_status_bookable_idx
  on public.addons (status, bookable, name);

drop trigger if exists addons_set_updated_at on public.addons;
create trigger addons_set_updated_at
before update on public.addons
for each row execute function public.set_updated_at();

create table if not exists public.product_addon_links (
  product_id bigint not null references public.products (id) on delete cascade,
  addon_id bigint not null references public.addons (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (product_id, addon_id)
);

create index if not exists product_addon_links_addon_id_idx
  on public.product_addon_links (addon_id);

create table if not exists public.rental_addon_items (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  addon_id bigint not null references public.addons (id),
  quantity integer not null,
  unit_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint rental_addon_items_uuid_unique unique (uuid),
  constraint rental_addon_items_quantity_check check (quantity > 0),
  constraint rental_addon_items_unit_price_check check (unit_price >= 0),
  constraint rental_addon_items_line_total_check check (line_total >= 0),
  constraint rental_addon_items_rental_addon_unique unique (rental_id, addon_id)
);

create index if not exists rental_addon_items_addon_id_idx
  on public.rental_addon_items (addon_id);

create index if not exists rental_addon_items_rental_id_idx
  on public.rental_addon_items (rental_id);

-- Simple stock: held qty on open rentals (draft + inventory-occupying), not date-windowed.
create or replace function public.addon_held_quantity(p_addon_id bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(rai.quantity), 0)::integer
  from public.rental_addon_items rai
  join public.rental_requests rr on rr.id = rai.rental_id
  where rai.addon_id = p_addon_id
    and rr.status in (
      'draft',
      'pending',
      'awaiting_payment',
      'paid',
      'approved',
      'ready_for_pickup',
      'active',
      'overdue'
    );
$$;

create or replace function public.addon_available_quantity(p_addon_id bigint)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    0,
    (select a.quantity from public.addons a where a.id = p_addon_id) - public.addon_held_quantity(p_addon_id)
  );
$$;

-- Roll kit lines + add-on lines into rental subtotal/total. Deposit stays kit-only.
create or replace function public.sync_rental_request_totals(p_rental_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12, 2);
  v_deposit numeric(12, 2);
  v_discount numeric(12, 2);
  v_addon_total numeric(12, 2);
begin
  select
    coalesce(sum(ri.line_total), 0),
    coalesce(sum(round(p.deposit_amount * ri.quantity, 2)), 0)
  into v_subtotal, v_deposit
  from public.rental_items ri
  join public.products p on p.id = ri.product_id
  where ri.rental_id = p_rental_id;

  select coalesce(sum(rai.line_total), 0)
  into v_addon_total
  from public.rental_addon_items rai
  where rai.rental_id = p_rental_id;

  v_subtotal := coalesce(v_subtotal, 0) + coalesce(v_addon_total, 0);

  select coalesce(discount_amount, 0)
  into v_discount
  from public.rental_requests
  where id = p_rental_id;

  perform set_config('lumen.sync_rental_totals', 'on', true);

  update public.rental_requests
  set
    subtotal = v_subtotal,
    deposit_amount = v_deposit,
    total_amount = greatest(0, round(v_subtotal - v_discount, 2))
  where id = p_rental_id;
end;
$$;

create or replace function public.sync_rental_request_totals_from_addon_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_rental_request_totals(coalesce(new.rental_id, old.rental_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists rental_addon_items_sync_totals on public.rental_addon_items;
create trigger rental_addon_items_sync_totals
after insert or update or delete on public.rental_addon_items
for each row
execute function public.sync_rental_request_totals_from_addon_items();

alter table public.addons enable row level security;
alter table public.addons force row level security;
alter table public.product_addon_links enable row level security;
alter table public.product_addon_links force row level security;
alter table public.rental_addon_items enable row level security;
alter table public.rental_addon_items force row level security;

revoke all on public.addons from anon, authenticated, public;
revoke all on public.product_addon_links from anon, authenticated, public;
revoke all on public.rental_addon_items from anon, authenticated, public;

grant select on public.addons to anon, authenticated;
grant select, insert, update, delete on public.addons to authenticated;
grant select, insert, update, delete on public.addons to service_role;

grant select on public.product_addon_links to anon, authenticated;
grant select, insert, update, delete on public.product_addon_links to authenticated;
grant select, insert, update, delete on public.product_addon_links to service_role;

grant select, insert on public.rental_addon_items to authenticated;
grant select, insert, update, delete on public.rental_addon_items to service_role;

drop policy if exists addons_public_read on public.addons;
create policy addons_public_read
on public.addons for select
to anon, authenticated
using (status = 'active' or public.is_admin());

drop policy if exists addons_admin_write on public.addons;
create policy addons_admin_write
on public.addons for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists product_addon_links_public_read on public.product_addon_links;
create policy product_addon_links_public_read
on public.product_addon_links for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status in ('active', 'coming_soon', 'hidden')
  )
);

drop policy if exists product_addon_links_admin_write on public.product_addon_links;
create policy product_addon_links_admin_write
on public.product_addon_links for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists rental_addon_items_select_own on public.rental_addon_items;
create policy rental_addon_items_select_own
on public.rental_addon_items for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
  )
);

drop policy if exists rental_addon_items_insert_own on public.rental_addon_items;
create policy rental_addon_items_insert_own
on public.rental_addon_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
      and rr.status in ('draft', 'pending')
  )
);

drop policy if exists rental_addon_items_admin_write on public.rental_addon_items;
create policy rental_addon_items_admin_write
on public.rental_addon_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant execute on function public.addon_held_quantity(bigint) to anon, authenticated, service_role;
grant execute on function public.addon_available_quantity(bigint) to anon, authenticated, service_role;

comment on table public.addons is
  'Paid kit add-ons with simple stock. bookable=false or available=0 disables customer selection.';
comment on table public.product_addon_links is
  'Which add-ons a product may offer on booking.';
comment on table public.rental_addon_items is
  'Add-on lines requested on a rental. Prices are snapshotted at create time.';
