-- Phase 7: customers can re-read versions they signed, and current can rotate
-- after a version has acceptances (title/body/version stay immutable).

create or replace function public.prevent_accepted_waiver_mutation()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1
    from public.waiver_acceptances
    where waiver_version_id = old.id
  ) then
    if tg_op = 'DELETE' then
      raise exception 'accepted waiver versions are immutable';
    end if;

    if new.version is distinct from old.version
      or new.title is distinct from old.title
      or new.body is distinct from old.body
      or new.uuid is distinct from old.uuid
    then
      raise exception 'accepted waiver versions are immutable';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop policy if exists waiver_versions_select_accepted on public.waiver_versions;
create policy waiver_versions_select_accepted
on public.waiver_versions for select
to authenticated
using (
  exists (
    select 1
    from public.waiver_acceptances wa
    where wa.waiver_version_id = waiver_versions.id
      and wa.customer_id = public.current_profile_id()
  )
);
