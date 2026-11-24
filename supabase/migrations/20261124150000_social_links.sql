-- Linktree-style social buttons for the public /links page and QR printout.
-- Anyone can read active links; only admins can add, edit, hide, reorder, or delete them.
-- Seeds Facebook and Instagram the first time. Safe to re-run.

create table if not exists public.social_links (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  label text not null,
  url text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint social_links_uuid_unique unique (uuid),
  constraint social_links_url_unique unique (url),
  constraint social_links_label_check check (char_length(label) between 1 and 80),
  constraint social_links_url_check check (
    char_length(url) between 8 and 500
    and url ~* '^https?://'
  )
);

create index if not exists social_links_active_sort_idx
  on public.social_links (is_active, sort_order, created_at);

drop trigger if exists social_links_set_updated_at on public.social_links;
create trigger social_links_set_updated_at
before update on public.social_links
for each row execute function public.set_updated_at();

alter table public.social_links enable row level security;
alter table public.social_links force row level security;

revoke all on public.social_links from anon, authenticated, public;
grant select on public.social_links to anon, authenticated;
grant insert, update, delete on public.social_links to authenticated;
grant select, insert, update, delete on public.social_links to service_role;

drop policy if exists social_links_public_read on public.social_links;
create policy social_links_public_read
on public.social_links for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists social_links_admin_write on public.social_links;
create policy social_links_admin_write
on public.social_links for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.social_links (label, url, sort_order)
select seed.label, seed.url, seed.sort_order
from (values
  ('Facebook', 'https://www.facebook.com/jryrentals/', 10),
  ('Instagram', 'https://www.instagram.com/jryrentals', 20)
) as seed (label, url, sort_order)
where not exists (select 1 from public.social_links);

comment on table public.social_links is
  'Buttons on the public /links page. The admin QR code points at that page. Hidden links stay for admins only.';
