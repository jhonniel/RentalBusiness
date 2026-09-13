-- Phase 16: admin-configurable payment methods with QR images.

create table if not exists public.payment_methods (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  code text not null,
  name text not null,
  account_name text,
  account_number text,
  instructions text,
  qr_storage_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_methods_uuid_unique unique (uuid),
  constraint payment_methods_code_unique unique (code)
);

create index if not exists payment_methods_active_sort_idx
  on public.payment_methods (is_active, sort_order, name);

drop trigger if exists payment_methods_set_updated_at on public.payment_methods;
create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row execute function public.set_updated_at();

alter table public.payment_methods enable row level security;
alter table public.payment_methods force row level security;

revoke all on public.payment_methods from anon, authenticated, public;
grant select on public.payment_methods to authenticated;
grant insert, update, delete on public.payment_methods to authenticated;

drop policy if exists payment_methods_select_active_or_admin on public.payment_methods;
create policy payment_methods_select_active_or_admin
on public.payment_methods for select
to authenticated
using (is_active = true or public.is_admin());

drop policy if exists payment_methods_admin_write on public.payment_methods;
create policy payment_methods_admin_write
on public.payment_methods for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('payment-qr-images', 'payment-qr-images', true)
on conflict (id) do nothing;

drop policy if exists payment_qr_images_public_read on storage.objects;
create policy payment_qr_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'payment-qr-images');

drop policy if exists payment_qr_images_admin_write on storage.objects;
create policy payment_qr_images_admin_write
on storage.objects
for all
to authenticated
using (bucket_id = 'payment-qr-images' and public.is_admin())
with check (bucket_id = 'payment-qr-images' and public.is_admin());
