-- Enforce unique button destinations if social_links was created without the constraint.

do $$
begin
  if to_regclass('public.social_links') is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_links_url_unique'
      and conrelid = 'public.social_links'::regclass
  ) then
    alter table public.social_links
      add constraint social_links_url_unique unique (url);
  end if;
end $$;
