-- Trusted admin promotion. Clients still cannot change role; only this
-- security-definer function may, and only through the service-role API.

create or replace function public.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and coalesce(current_setting('app.allow_role_change', true), '') is distinct from 'on' then
    raise exception 'role cannot be changed';
  end if;

  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed';
  end if;

  if new.uuid is distinct from old.uuid then
    raise exception 'uuid cannot be changed';
  end if;

  return new;
end;
$$;

create or replace function public.promote_profile_to_admin(p_profile_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_role text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'not authorized';
  end if;

  select role into target_role
  from public.profiles
  where uuid = p_profile_uuid
  for update;

  if target_role is null then
    raise exception 'profile not found';
  end if;

  if target_role is distinct from 'customer' then
    raise exception 'only a customer can become an admin';
  end if;

  perform set_config('app.allow_role_change', 'on', true);

  update public.profiles
  set role = 'admin'
  where uuid = p_profile_uuid;
end;
$$;

revoke all on function public.promote_profile_to_admin(uuid) from public;
revoke all on function public.promote_profile_to_admin(uuid) from anon, authenticated;
grant execute on function public.promote_profile_to_admin(uuid) to service_role;

comment on function public.promote_profile_to_admin(uuid) is
  'Promotes a customer profile to admin. Callable only with the service-role key after requireAdmin. Does not accept a role from the client.';
