-- Site-wide maintenance page: admin toggle, explanation, and public images.

create table if not exists public.site_maintenance (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  is_enabled boolean not null default false,
  title text not null default 'We''ll be right back',
  message text not null default 'We''re performing maintenance on the website. Please check back soon.',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint site_maintenance_uuid_unique unique (uuid),
  constraint site_maintenance_singleton check (id = 1)
);

create table if not exists public.maintenance_images (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  storage_path text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint maintenance_images_uuid_unique unique (uuid)
);

create index if not exists maintenance_images_sort_idx
on public.maintenance_images (sort_order, created_at);

drop trigger if exists site_maintenance_set_updated_at on public.site_maintenance;
create trigger site_maintenance_set_updated_at
before update on public.site_maintenance
for each row execute function public.set_updated_at();

insert into public.site_maintenance (title, message)
select
  'We''ll be right back',
  'We''re performing maintenance on the website. Please check back soon.'
where not exists (select 1 from public.site_maintenance);

alter table public.site_maintenance enable row level security;
alter table public.site_maintenance force row level security;
alter table public.maintenance_images enable row level security;
alter table public.maintenance_images force row level security;

revoke all on public.site_maintenance from anon, authenticated, public;
revoke all on public.maintenance_images from anon, authenticated, public;

grant select on public.site_maintenance to anon, authenticated;
grant insert, update on public.site_maintenance to authenticated;
grant select on public.maintenance_images to anon, authenticated;
grant insert, update, delete on public.maintenance_images to authenticated;

drop policy if exists site_maintenance_public_read on public.site_maintenance;
create policy site_maintenance_public_read
on public.site_maintenance for select
to anon, authenticated
using (true);

drop policy if exists site_maintenance_admin_write on public.site_maintenance;
create policy site_maintenance_admin_write
on public.site_maintenance for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists maintenance_images_public_read on public.maintenance_images;
create policy maintenance_images_public_read
on public.maintenance_images for select
to anon, authenticated
using (true);

drop policy if exists maintenance_images_admin_write on public.maintenance_images;
create policy maintenance_images_admin_write
on public.maintenance_images for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('maintenance-images', 'maintenance-images', true)
on conflict (id) do nothing;

drop policy if exists maintenance_images_objects_public_read on storage.objects;
create policy maintenance_images_objects_public_read
on storage.objects
for select
to public
using (bucket_id = 'maintenance-images');

drop policy if exists maintenance_images_objects_admin_write on storage.objects;
create policy maintenance_images_objects_admin_write
on storage.objects
for all
to authenticated
using (bucket_id = 'maintenance-images' and public.is_admin())
with check (bucket_id = 'maintenance-images' and public.is_admin());
