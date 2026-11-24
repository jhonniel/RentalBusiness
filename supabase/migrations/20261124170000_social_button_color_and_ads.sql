-- Per-button colors on social_links, plus promo ads (image carousel / voucher) below the buttons.
-- Public bucket social-ad-images. Paste into the Supabase SQL editor. Safe to re-run.

alter table public.social_links
  add column if not exists button_color text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_links_button_color_check'
      and conrelid = 'public.social_links'::regclass
  ) then
    alter table public.social_links
      add constraint social_links_button_color_check
      check (button_color is null or button_color ~* '^#[0-9A-Fa-f]{6}$');
  end if;
end $$;

comment on column public.social_links.button_color is
  'Optional per-button hex color. Null uses the page default button color.';

create table if not exists public.social_ads (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  title text not null default '',
  subtitle text,
  image_storage_path text,
  link_url text,
  voucher_id bigint references public.vouchers (id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint social_ads_uuid_unique unique (uuid),
  constraint social_ads_title_check check (char_length(title) <= 120),
  constraint social_ads_subtitle_check check (subtitle is null or char_length(subtitle) <= 240),
  constraint social_ads_link_url_check check (
    link_url is null
    or (
      char_length(link_url) between 8 and 500
      and link_url ~* '^https?://'
    )
  ),
  constraint social_ads_content_check check (
    is_active = false
    or image_storage_path is not null
    or voucher_id is not null
  )
);

create index if not exists social_ads_active_sort_idx
  on public.social_ads (is_active, sort_order, created_at);

create index if not exists social_ads_voucher_idx
  on public.social_ads (voucher_id)
  where voucher_id is not null;

drop trigger if exists social_ads_set_updated_at on public.social_ads;
create trigger social_ads_set_updated_at
before update on public.social_ads
for each row execute function public.set_updated_at();

alter table public.social_ads enable row level security;
alter table public.social_ads force row level security;

revoke all on public.social_ads from anon, authenticated, public;
grant select on public.social_ads to anon, authenticated;
grant insert, update, delete on public.social_ads to authenticated;
grant select, insert, update, delete on public.social_ads to service_role;

drop policy if exists social_ads_public_read on public.social_ads;
create policy social_ads_public_read
on public.social_ads for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists social_ads_admin_write on public.social_ads;
create policy social_ads_admin_write
on public.social_ads for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('social-ad-images', 'social-ad-images', true)
on conflict (id) do nothing;

drop policy if exists social_ad_images_public_read on storage.objects;
create policy social_ad_images_public_read
on storage.objects
for select
to public
using (bucket_id = 'social-ad-images');

drop policy if exists social_ad_images_admin_write on storage.objects;
create policy social_ad_images_admin_write
on storage.objects
for all
to authenticated
using (bucket_id = 'social-ad-images' and public.is_admin())
with check (bucket_id = 'social-ad-images' and public.is_admin());

comment on table public.social_ads is
  'Promo slides under the Social Media links page buttons. Image and/or linked voucher. Hidden rows stay for admins only.';
