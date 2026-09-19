alter table public.products
  add column if not exists hidden_price_fields text[] not null default '{}';

alter table public.products
  drop constraint if exists products_hidden_price_fields_check;

alter table public.products
  add constraint products_hidden_price_fields_check
  check (
    hidden_price_fields <@ array[
      'daily',
      'weekly',
      'monthly',
      'deposit',
      'late_fee',
      'replacement_value'
    ]::text[]
  );
