-- Versioned Terms & Conditions acknowledgments on accounts and signed rentals.
-- Do not overwrite a published Terms body in place; publish a new version string.

alter table public.profiles
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

alter table public.waiver_acceptances
  add column if not exists terms_version text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  marketing boolean;
  policy_version text;
  terms_version text;
begin
  marketing := lower(coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')) = 'true';
  policy_version := nullif(trim(coalesce(new.raw_user_meta_data ->> 'privacy_policy_version', '')), '');
  terms_version := nullif(trim(coalesce(new.raw_user_meta_data ->> 'terms_version', '')), '');

  insert into public.profiles (
    user_id,
    role,
    first_name,
    last_name,
    privacy_policy_version,
    privacy_accepted_at,
    terms_version,
    terms_accepted_at,
    marketing_opt_in,
    marketing_opted_at
  )
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    policy_version,
    case when policy_version is not null then timezone('utc', now()) else null end,
    terms_version,
    case when terms_version is not null then timezone('utc', now()) else null end,
    marketing,
    case when marketing then timezone('utc', now()) else null end
  );
  return new;
end;
$$;

revoke all on public.profiles from anon, authenticated, public;
grant select on public.profiles to authenticated;
grant update (
  first_name,
  last_name,
  phone,
  privacy_policy_version,
  privacy_accepted_at,
  terms_version,
  terms_accepted_at,
  marketing_opt_in,
  marketing_opted_at,
  updated_at
) on public.profiles to authenticated;

comment on column public.profiles.terms_version is 'Terms & Conditions version the customer accepted. Do not expose internal ids.';
comment on column public.waiver_acceptances.terms_version is 'Terms & Conditions version accepted with the rental waiver.';
