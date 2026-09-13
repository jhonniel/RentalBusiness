-- Google OAuth users store given_name / family_name / full_name instead of first_name / last_name.
-- Keep email/password metadata keys working. Do not overwrite existing profiles.

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
  first_name text;
  last_name text;
  full_name text;
begin
  marketing := lower(coalesce(new.raw_user_meta_data ->> 'marketing_opt_in', 'false')) = 'true';
  policy_version := nullif(trim(coalesce(new.raw_user_meta_data ->> 'privacy_policy_version', '')), '');
  terms_version := nullif(trim(coalesce(new.raw_user_meta_data ->> 'terms_version', '')), '');
  full_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    ''
  )), '');
  first_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'given_name',
    split_part(coalesce(full_name, ''), ' ', 1),
    ''
  )), '');
  last_name := nullif(trim(coalesce(
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'family_name',
    nullif(btrim(substr(coalesce(full_name, ''), strpos(coalesce(full_name, '') || ' ', ' '))), ''),
    ''
  )), '');

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
    coalesce(first_name, ''),
    coalesce(last_name, ''),
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
