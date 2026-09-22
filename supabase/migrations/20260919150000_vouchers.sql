create table if not exists public.vouchers (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  code text not null,
  name text not null,
  discount_type text not null,
  discount_value numeric(12, 2) not null,
  max_redemptions integer,
  redeemed_count integer not null default 0,
  min_subtotal numeric(12, 2) not null default 0,
  starts_on date,
  ends_on date,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint vouchers_uuid_unique unique (uuid),
  constraint vouchers_code_unique unique (code),
  constraint vouchers_discount_type_check check (discount_type in ('percent', 'fixed')),
  constraint vouchers_status_check check (status in ('draft', 'active', 'disabled')),
  constraint vouchers_discount_value_check check (discount_value > 0),
  constraint vouchers_percent_check check (discount_type <> 'percent' or discount_value <= 100),
  constraint vouchers_max_redemptions_check check (max_redemptions is null or max_redemptions > 0),
  constraint vouchers_min_subtotal_check check (min_subtotal >= 0),
  constraint vouchers_dates_check check (starts_on is null or ends_on is null or starts_on <= ends_on)
);

create table if not exists public.voucher_redemptions (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  voucher_id bigint not null references public.vouchers (id),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  customer_id bigint not null references public.profiles (id),
  code text not null,
  name text not null,
  discount_amount numeric(12, 2) not null,
  redeemed_at timestamptz not null default timezone('utc', now()),
  constraint voucher_redemptions_uuid_unique unique (uuid),
  constraint voucher_redemptions_rental_unique unique (rental_id),
  constraint voucher_redemptions_discount_check check (discount_amount >= 0)
);

create index if not exists vouchers_status_idx on public.vouchers (status, ends_on);
create index if not exists voucher_redemptions_voucher_id_idx on public.voucher_redemptions (voucher_id);

drop trigger if exists vouchers_set_updated_at on public.vouchers;
create trigger vouchers_set_updated_at
before update on public.vouchers
for each row execute function public.set_updated_at();

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
begin
  select
    coalesce(sum(ri.line_total), 0),
    coalesce(sum(round(p.deposit_amount * ri.quantity, 2)), 0)
  into v_subtotal, v_deposit
  from public.rental_items ri
  join public.products p on p.id = ri.product_id
  where ri.rental_id = p_rental_id;

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

alter table public.vouchers enable row level security;
alter table public.vouchers force row level security;
alter table public.voucher_redemptions enable row level security;
alter table public.voucher_redemptions force row level security;

revoke all on public.vouchers from anon, authenticated, public;
revoke all on public.voucher_redemptions from anon, authenticated, public;

grant select, insert, update on public.vouchers to authenticated;
grant select on public.voucher_redemptions to authenticated;
grant select, insert, update, delete on public.vouchers to service_role;
grant select, insert, update, delete on public.voucher_redemptions to service_role;

drop policy if exists vouchers_admin_all on public.vouchers;
create policy vouchers_admin_all
on public.vouchers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists voucher_redemptions_select_own_or_admin on public.voucher_redemptions;
create policy voucher_redemptions_select_own_or_admin
on public.voucher_redemptions for select
to authenticated
using (customer_id = public.current_profile_id() or public.is_admin());
