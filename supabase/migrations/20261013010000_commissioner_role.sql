-- Commissioner role, per-equipment daily commission, and commission expenses.
-- A commissioner booking stays on the calendar until an admin or that commissioner cancels or deletes it.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'customer', 'commissioner'));

alter table public.products
  add column if not exists commission_per_day numeric(12, 2) not null default 0;

alter table public.products drop constraint if exists products_commission_per_day_check;
alter table public.products
  add constraint products_commission_per_day_check check (commission_per_day >= 0);

alter table public.rental_requests
  add column if not exists commissioner_id bigint references public.profiles (id),
  add column if not exists commission_per_day numeric(12, 2) not null default 0,
  add column if not exists commission_amount numeric(12, 2) not null default 0;

alter table public.rental_requests drop constraint if exists rental_requests_commission_check;
alter table public.rental_requests
  add constraint rental_requests_commission_check check (
    commission_per_day >= 0
    and commission_amount >= 0
  );

create index if not exists rental_requests_commissioner_id_idx
  on public.rental_requests (commissioner_id);

alter table public.expenses
  add column if not exists rental_id bigint references public.rental_requests (id) on delete set null;

create index if not exists expenses_rental_id_idx on public.expenses (rental_id);

alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.expenses
  add constraint expenses_category_check check (
    category in (
      'internet',
      'electricity',
      'maintenance',
      'repairs',
      'software',
      'subscription',
      'marketing',
      'transportation',
      'staff',
      'insurance',
      'equipment',
      'office',
      'commission',
      'other'
    )
  );

alter table public.recurring_expenses drop constraint if exists recurring_expenses_category_check;
alter table public.recurring_expenses
  add constraint recurring_expenses_category_check check (
    category in (
      'internet',
      'electricity',
      'maintenance',
      'repairs',
      'software',
      'subscription',
      'marketing',
      'transportation',
      'staff',
      'insurance',
      'equipment',
      'office',
      'commission',
      'other'
    )
  );

create or replace function public.promote_profile_to_commissioner(p_profile_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized';
  end if;

  select role into target_role
  from public.profiles
  where uuid = p_profile_uuid
  for update;

  if target_role is null then
    raise exception 'profile not found';
  end if;

  if target_role is distinct from 'customer' then
    raise exception 'only a customer can become a commissioner';
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles
  set role = 'commissioner'
  where uuid = p_profile_uuid;
end;
$$;

revoke all on function public.promote_profile_to_commissioner(uuid) from public;
revoke all on function public.promote_profile_to_commissioner(uuid) from anon, authenticated;
grant execute on function public.promote_profile_to_commissioner(uuid) to service_role;

comment on function public.promote_profile_to_commissioner(uuid) is
  'Promotes a customer profile to commissioner. Callable only with the service-role key after requireAdmin. Does not accept a role from the client.';

comment on column public.products.commission_per_day is
  'Peso amount a commissioner earns per day for each unit booked. The shop records the total as an expense.';
