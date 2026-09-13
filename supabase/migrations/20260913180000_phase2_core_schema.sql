-- Phase 2: catalog, rentals, waivers, payments, finance, and platform tables.
-- Does not recreate public.profiles. Public APIs must expose uuid or code only.

create sequence if not exists public.rental_code_seq;
create sequence if not exists public.receipt_number_seq;

create or replace function public.current_profile_id()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.profiles
  where user_id = auth.uid();
$$;

create or replace function public.generate_rental_code()
returns text
language sql
as $$
  select 'LUM-'
    || to_char(timezone('Asia/Manila', now()), 'YYYYMMDD')
    || '-'
    || lpad(nextval('public.rental_code_seq')::text, 5, '0');
$$;

create or replace function public.generate_receipt_number()
returns text
language sql
as $$
  select 'RCP-'
    || to_char(timezone('Asia/Manila', now()), 'YYYYMMDD')
    || '-'
    || lpad(nextval('public.receipt_number_seq')::text, 5, '0');
$$;

create or replace function public.rental_occupies_inventory(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in (
    'pending',
    'awaiting_payment',
    'paid',
    'approved',
    'ready_for_pickup',
    'active',
    'overdue'
  );
$$;

create table if not exists public.product_categories (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint product_categories_uuid_unique unique (uuid),
  constraint product_categories_slug_unique unique (slug)
);

create table if not exists public.products (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  slug text not null,
  sku text not null,
  category_id bigint not null references public.product_categories (id),
  name text not null,
  description text not null default '',
  short_description text not null default '',
  daily_price numeric(12, 2) not null,
  weekly_price numeric(12, 2),
  monthly_price numeric(12, 2),
  deposit_amount numeric(12, 2) not null default 0,
  late_fee numeric(12, 2) not null default 0,
  replacement_value numeric(12, 2),
  quantity integer not null default 0,
  reserved_quantity integer not null default 0,
  rented_quantity integer not null default 0,
  damaged_quantity integer not null default 0,
  maintenance_quantity integer not null default 0,
  lost_quantity integer not null default 0,
  available_quantity integer generated always as (
    quantity
    - reserved_quantity
    - rented_quantity
    - damaged_quantity
    - maintenance_quantity
    - lost_quantity
  ) stored,
  status text not null default 'draft',
  condition text not null default 'good',
  specifications jsonb not null default '{}'::jsonb,
  included_accessories jsonb not null default '[]'::jsonb,
  rental_rules text,
  model_path text,
  is_featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint products_uuid_unique unique (uuid),
  constraint products_slug_unique unique (slug),
  constraint products_sku_unique unique (sku),
  constraint products_status_check check (status in ('draft', 'active', 'hidden', 'archived')),
  constraint products_prices_check check (
    daily_price >= 0
    and deposit_amount >= 0
    and late_fee >= 0
    and (weekly_price is null or weekly_price >= 0)
    and (monthly_price is null or monthly_price >= 0)
    and (replacement_value is null or replacement_value >= 0)
  ),
  constraint products_inventory_nonneg_check check (
    quantity >= 0
    and reserved_quantity >= 0
    and rented_quantity >= 0
    and damaged_quantity >= 0
    and maintenance_quantity >= 0
    and lost_quantity >= 0
  ),
  constraint products_inventory_sum_check check (
    reserved_quantity + rented_quantity + damaged_quantity + maintenance_quantity + lost_quantity <= quantity
  )
);

create table if not exists public.product_images (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  product_id bigint not null references public.products (id) on delete cascade,
  storage_path text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint product_images_uuid_unique unique (uuid)
);

create table if not exists public.equipment_assets (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  product_id bigint not null references public.products (id),
  asset_code text not null,
  serial_number text,
  condition text not null default 'good',
  status text not null default 'available',
  purchase_cost numeric(12, 2),
  purchase_date date,
  replacement_value numeric(12, 2),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint equipment_assets_uuid_unique unique (uuid),
  constraint equipment_assets_code_unique unique (asset_code),
  constraint equipment_assets_status_check check (
    status in ('available', 'reserved', 'rented', 'maintenance', 'damaged', 'lost', 'retired')
  )
);

create table if not exists public.rental_requests (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  code text not null default public.generate_rental_code(),
  customer_id bigint not null references public.profiles (id),
  status text not null default 'draft',
  starts_on date not null,
  ends_on date not null,
  subtotal numeric(12, 2) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  admin_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rental_requests_uuid_unique unique (uuid),
  constraint rental_requests_code_unique unique (code),
  constraint rental_requests_dates_check check (starts_on <= ends_on),
  constraint rental_requests_status_check check (
    status in (
      'draft',
      'pending',
      'awaiting_payment',
      'paid',
      'approved',
      'ready_for_pickup',
      'active',
      'returned',
      'completed',
      'cancelled',
      'rejected',
      'overdue'
    )
  ),
  constraint rental_requests_money_check check (
    subtotal >= 0
    and deposit_amount >= 0
    and discount_amount >= 0
    and tax_amount >= 0
    and total_amount >= 0
  )
);

create table if not exists public.rental_items (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  product_id bigint not null references public.products (id),
  quantity integer not null,
  daily_price numeric(12, 2) not null,
  line_total numeric(12, 2) not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint rental_items_uuid_unique unique (uuid),
  constraint rental_items_quantity_check check (quantity > 0),
  constraint rental_items_money_check check (daily_price >= 0 and line_total >= 0)
);

create table if not exists public.rental_asset_assignments (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  equipment_asset_id bigint not null references public.equipment_assets (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint rental_asset_assignments_uuid_unique unique (uuid),
  constraint rental_asset_assignments_unique unique (rental_id, equipment_asset_id)
);

create table if not exists public.rental_status_history (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by bigint references public.profiles (id),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint rental_status_history_uuid_unique unique (uuid)
);

create or replace function public.product_booked_quantity(
  p_product_id bigint,
  p_starts_on date,
  p_ends_on date
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(ri.quantity), 0)::integer
  from public.rental_items ri
  join public.rental_requests rr on rr.id = ri.rental_id
  where ri.product_id = p_product_id
    and public.rental_occupies_inventory(rr.status)
    and rr.starts_on <= p_ends_on
    and rr.ends_on >= p_starts_on;
$$;

create table if not exists public.waiver_versions (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  version text not null,
  title text not null,
  body text not null,
  is_current boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint waiver_versions_uuid_unique unique (uuid),
  constraint waiver_versions_version_unique unique (version)
);

create unique index if not exists waiver_versions_one_current_idx
  on public.waiver_versions (is_current)
  where is_current;

create table if not exists public.waiver_acceptances (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  waiver_version_id bigint not null references public.waiver_versions (id),
  rental_id bigint not null references public.rental_requests (id),
  customer_id bigint not null references public.profiles (id),
  signer_name text not null,
  signature_data text not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  ip_address inet,
  user_agent text,
  constraint waiver_acceptances_uuid_unique unique (uuid),
  constraint waiver_acceptances_rental_unique unique (rental_id)
);

create or replace function public.prevent_accepted_waiver_mutation()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.waiver_acceptances
    where waiver_version_id = old.id
  ) then
    raise exception 'accepted waiver versions are immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists waiver_versions_prevent_accepted_mutation on public.waiver_versions;
create trigger waiver_versions_prevent_accepted_mutation
before update or delete on public.waiver_versions
for each row
execute function public.prevent_accepted_waiver_mutation();

create table if not exists public.payment_transactions (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id),
  customer_id bigint not null references public.profiles (id),
  amount numeric(12, 2) not null,
  currency text not null default 'PHP',
  provider text not null,
  provider_transaction_id text,
  status text not null default 'pending',
  payment_method text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_transactions_uuid_unique unique (uuid),
  constraint payment_transactions_amount_check check (amount >= 0),
  constraint payment_transactions_status_check check (
    status in ('pending', 'processing', 'paid', 'failed', 'refunded', 'partially_refunded', 'cancelled')
  )
);

create unique index if not exists payment_transactions_provider_txn_idx
  on public.payment_transactions (provider, provider_transaction_id)
  where provider_transaction_id is not null;

create table if not exists public.receipts (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  receipt_number text not null default public.generate_receipt_number(),
  rental_id bigint not null references public.rental_requests (id),
  payment_id bigint not null references public.payment_transactions (id),
  snapshot jsonb not null,
  issued_at timestamptz not null default timezone('utc', now()),
  constraint receipts_uuid_unique unique (uuid),
  constraint receipts_number_unique unique (receipt_number)
);

create table if not exists public.expenses (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  amount numeric(12, 2) not null,
  vendor text,
  reference text,
  status text not null default 'pending',
  notes text,
  incurred_on date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint expenses_uuid_unique unique (uuid),
  constraint expenses_amount_check check (amount >= 0),
  constraint expenses_category_check check (
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
      'other'
    )
  ),
  constraint expenses_status_check check (status in ('pending', 'paid', 'void'))
);

create table if not exists public.recurring_expenses (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  name text not null,
  category text not null,
  amount numeric(12, 2) not null,
  frequency text not null,
  interval_count integer not null default 1,
  anchor_day integer,
  start_on date not null,
  end_on date,
  next_occurrence_on date not null,
  vendor text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint recurring_expenses_uuid_unique unique (uuid),
  constraint recurring_expenses_amount_check check (amount >= 0),
  constraint recurring_expenses_interval_check check (interval_count > 0),
  constraint recurring_expenses_dates_check check (end_on is null or end_on >= start_on),
  constraint recurring_expenses_frequency_check check (
    frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')
  ),
  constraint recurring_expenses_category_check check (
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
      'other'
    )
  ),
  constraint recurring_expenses_status_check check (status in ('active', 'paused', 'ended'))
);

create table if not exists public.expense_occurrences (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  recurring_expense_id bigint not null references public.recurring_expenses (id) on delete cascade,
  expense_id bigint references public.expenses (id),
  occurs_on date not null,
  generated_at timestamptz not null default timezone('utc', now()),
  constraint expense_occurrences_uuid_unique unique (uuid),
  constraint expense_occurrences_unique unique (recurring_expense_id, occurs_on)
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  recipient_id bigint not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint notifications_uuid_unique unique (uuid)
);

create table if not exists public.email_logs (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  to_email text not null,
  template text not null,
  provider_id text,
  status text not null default 'queued',
  payload_hash text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint email_logs_uuid_unique unique (uuid),
  constraint email_logs_status_check check (status in ('queued', 'sent', 'failed'))
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  actor_id bigint references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text not null,
  previous_value jsonb,
  new_value jsonb,
  ip_address inet,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_logs_uuid_unique unique (uuid)
);

create table if not exists public.settings (
  id bigint generated always as identity primary key,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint settings_key_unique unique (key)
);

create table if not exists public.business_profiles (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  name text not null,
  logo_path text,
  email text,
  phone text,
  address text,
  currency text not null default 'PHP',
  timezone text not null default 'Asia/Manila',
  late_fee_policy text,
  deposit_rules text,
  cancellation_rules text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint business_profiles_uuid_unique unique (uuid),
  constraint business_profiles_singleton check (id = 1)
);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_status_featured_idx on public.products (status, is_featured);
create index if not exists product_images_product_id_idx on public.product_images (product_id);
create index if not exists equipment_assets_product_id_idx on public.equipment_assets (product_id);
create index if not exists equipment_assets_status_idx on public.equipment_assets (status);
create index if not exists rental_requests_customer_id_idx on public.rental_requests (customer_id);
create index if not exists rental_requests_status_dates_idx on public.rental_requests (status, starts_on, ends_on);
create index if not exists rental_items_product_id_idx on public.rental_items (product_id, rental_id);
create index if not exists rental_status_history_rental_id_idx on public.rental_status_history (rental_id, created_at);
create index if not exists waiver_acceptances_customer_id_idx on public.waiver_acceptances (customer_id);
create index if not exists payment_transactions_rental_id_idx on public.payment_transactions (rental_id);
create index if not exists payment_transactions_customer_id_idx on public.payment_transactions (customer_id);
create index if not exists receipts_rental_id_idx on public.receipts (rental_id);
create index if not exists expenses_incurred_on_idx on public.expenses (incurred_on);
create index if not exists notifications_recipient_id_idx on public.notifications (recipient_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at
before update on public.product_categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists equipment_assets_set_updated_at on public.equipment_assets;
create trigger equipment_assets_set_updated_at
before update on public.equipment_assets
for each row execute function public.set_updated_at();

drop trigger if exists rental_requests_set_updated_at on public.rental_requests;
create trigger rental_requests_set_updated_at
before update on public.rental_requests
for each row execute function public.set_updated_at();

drop trigger if exists payment_transactions_set_updated_at on public.payment_transactions;
create trigger payment_transactions_set_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

drop trigger if exists recurring_expenses_set_updated_at on public.recurring_expenses;
create trigger recurring_expenses_set_updated_at
before update on public.recurring_expenses
for each row execute function public.set_updated_at();

drop trigger if exists settings_set_updated_at on public.settings;
create trigger settings_set_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

drop trigger if exists business_profiles_set_updated_at on public.business_profiles;
create trigger business_profiles_set_updated_at
before update on public.business_profiles
for each row execute function public.set_updated_at();

create or replace function public.write_audit_log(
  p_action text,
  p_entity text,
  p_entity_id text,
  p_previous jsonb default null,
  p_new jsonb default null,
  p_ip inet default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_uuid uuid;
begin
  insert into public.audit_logs (
    actor_id,
    action,
    entity,
    entity_id,
    previous_value,
    new_value,
    ip_address,
    metadata
  )
  values (
    public.current_profile_id(),
    p_action,
    p_entity,
    p_entity_id,
    p_previous,
    p_new,
    p_ip,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning uuid into inserted_uuid;

  return inserted_uuid;
end;
$$;

comment on function public.product_booked_quantity(bigint, date, date) is
  'Overlap-aware booked units. Inclusive dates. Does not use total inventory alone.';
comment on column public.products.uuid is 'Public identifier. Never expose id.';
comment on column public.rental_requests.code is 'Public rental number.';
comment on column public.receipts.receipt_number is 'Public receipt number.';
