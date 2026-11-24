-- Optional Lucide icon key per Social Media button (e.g. facebook, instagram, calendar).
-- Paste into the Supabase SQL editor. Safe to re-run.

alter table public.social_links
  add column if not exists icon text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'social_links_icon_check'
      and conrelid = 'public.social_links'::regclass
  ) then
    alter table public.social_links
      add constraint social_links_icon_check
      check (
        icon is null
        or (
          char_length(icon) between 2 and 40
          and icon ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
        )
      );
  end if;
end $$;

comment on column public.social_links.icon is
  'Optional Lucide icon key without the i-lucide- prefix (e.g. facebook). Null means no icon.';

-- Best-effort seed icons for common starter rows.
update public.social_links
set icon = 'facebook'
where icon is null
  and (
    lower(label) like '%facebook%'
    or url ilike '%facebook.com%'
  );

update public.social_links
set icon = 'instagram'
where icon is null
  and (
    lower(label) like '%instagram%'
    or url ilike '%instagram.com%'
  );
