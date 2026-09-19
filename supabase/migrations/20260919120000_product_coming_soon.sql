-- Allow admins to publish a kit as coming soon. It appears in the public
-- catalog with a label and cannot be booked until the status is active.

alter table public.products
  drop constraint if exists products_status_check;

alter table public.products
  add constraint products_status_check
  check (status in ('draft', 'active', 'coming_soon', 'hidden', 'archived'));

drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products for select
to anon, authenticated
using (status in ('active', 'coming_soon') or public.is_admin());

drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read
on public.product_images for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status in ('active', 'coming_soon')
  )
);
