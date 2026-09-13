-- Existing accounts signed up before Terms/Privacy versions were stored.
-- Stamp the current published versions so returning users are not sent to /accept-policies.
-- New Google accounts still start without versions and must accept once.

update public.profiles
set
  privacy_policy_version = coalesce(privacy_policy_version, 'JRY-PRIVACY-v1.0'),
  privacy_accepted_at = case
    when privacy_policy_version is null then timezone('utc', now())
    else privacy_accepted_at
  end,
  terms_version = coalesce(terms_version, 'JRY-TC-v1.0'),
  terms_accepted_at = case
    when terms_version is null then timezone('utc', now())
    else terms_accepted_at
  end
where privacy_policy_version is null
   or terms_version is null;
