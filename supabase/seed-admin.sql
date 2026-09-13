-- Development admin only. Do not run against production.
-- Email: admin@jryrentals.local
-- Password: JryAdmin!dev

do $$
declare
  admin_id constant uuid := '11111111-1111-4111-8111-111111111111';
  admin_email constant text := 'admin@jryrentals.local';
  admin_password constant text := 'JryAdmin!dev';
  existing_id uuid;
begin
  select id into existing_id
  from auth.users
  where email = admin_email;

  if existing_id is null then
    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      admin_email,
      extensions.crypt(admin_password, extensions.gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"JRY","last_name":"Admin","privacy_policy_version":"JRY-PRIVACY-v1.0","terms_version":"JRY-TC-v1.0"}'::jsonb,
      timezone('utc', now()),
      timezone('utc', now()),
      '',
      '',
      '',
      ''
    );
    existing_id := admin_id;
  else
    update auth.users
    set
      encrypted_password = extensions.crypt(admin_password, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"first_name":"JRY","last_name":"Admin"}'::jsonb
    where id = existing_id;
  end if;

  if not exists (
    select 1
    from auth.identities
    where user_id = existing_id
      and provider = 'email'
  ) then
    insert into auth.identities (
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    values (
      existing_id,
      existing_id::text,
      jsonb_build_object(
        'sub', existing_id::text,
        'email', admin_email,
        'email_verified', true
      ),
      'email',
      timezone('utc', now()),
      timezone('utc', now()),
      timezone('utc', now())
    );
  end if;

  -- handle_new_user inserts role=customer. Role updates are blocked, so replace the row.
  if exists (
    select 1
    from public.profiles
    where user_id = existing_id
      and role = 'admin'
  ) then
    update public.profiles
    set
      first_name = coalesce(nullif(first_name, ''), 'JRY'),
      last_name = coalesce(nullif(last_name, ''), 'Admin'),
      privacy_policy_version = coalesce(privacy_policy_version, 'JRY-PRIVACY-v1.0'),
      terms_version = coalesce(terms_version, 'JRY-TC-v1.0')
    where user_id = existing_id;
  else
    delete from public.profiles
    where user_id = existing_id;

    insert into public.profiles (
      user_id,
      role,
      first_name,
      last_name,
      privacy_policy_version,
      terms_version
    )
    values (
      existing_id,
      'admin',
      'JRY',
      'Admin',
      'JRY-PRIVACY-v1.0',
      'JRY-TC-v1.0'
    );
  end if;
end
$$;
