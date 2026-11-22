-- Phase 21: reference image per add-on (icon in lists, modal for full view).
-- Public bucket addon-images. Paste into the Supabase SQL editor. Safe to re-run.

alter table public.addons
  add column if not exists image_storage_path text;

comment on column public.addons.image_storage_path is
  'Storage path of the add-on reference image in the addon-images bucket.';

insert into storage.buckets (id, name, public)
values ('addon-images', 'addon-images', true)
on conflict (id) do nothing;

drop policy if exists addon_images_public_read on storage.objects;
create policy addon_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'addon-images');

drop policy if exists addon_images_admin_write on storage.objects;
create policy addon_images_admin_write
on storage.objects
for all
to authenticated
using (bucket_id = 'addon-images' and public.is_admin())
with check (bucket_id = 'addon-images' and public.is_admin());
