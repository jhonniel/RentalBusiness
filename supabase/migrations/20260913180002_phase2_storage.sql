-- Phase 2 storage buckets. Requires Supabase Storage.

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('private-documents', 'private-documents', false)
on conflict (id) do nothing;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'product-images');

drop policy if exists product_images_admin_write on storage.objects;
create policy product_images_admin_write
on storage.objects
for all
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists private_documents_own_or_admin_read on storage.objects;
create policy private_documents_own_or_admin_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-documents'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);

drop policy if exists private_documents_own_or_admin_write on storage.objects;
create policy private_documents_own_or_admin_write
on storage.objects
for all
to authenticated
using (
  bucket_id = 'private-documents'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
)
with check (
  bucket_id = 'private-documents'
  and (
    public.is_admin()
    or split_part(name, '/', 1) = auth.uid()::text
  )
);
