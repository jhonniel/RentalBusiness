-- Registered Devices: permanent public QR codes, bag/Wi‑Fi details, assignment history.
-- Extends equipment_assets + rental_asset_assignments. Paste into Supabase SQL editor. Safe to re-run.

alter table public.equipment_assets
  add column if not exists public_code text,
  add column if not exists label text,
  add column if not exists bag_pin text,
  add column if not exists wifi_name text,
  add column if not exists wifi_password text,
  add column if not exists bag_contents jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_assets_public_code_unique'
      and conrelid = 'public.equipment_assets'::regclass
  ) then
    alter table public.equipment_assets
      add constraint equipment_assets_public_code_unique unique (public_code);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_assets_public_code_check'
      and conrelid = 'public.equipment_assets'::regclass
  ) then
    alter table public.equipment_assets
      add constraint equipment_assets_public_code_check
      check (
        public_code is null
        or (
          char_length(public_code) between 12 and 40
          and public_code ~* '^jry-dev-[a-z0-9]+$'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'equipment_assets_bag_contents_check'
      and conrelid = 'public.equipment_assets'::regclass
  ) then
    alter table public.equipment_assets
      add constraint equipment_assets_bag_contents_check
      check (jsonb_typeof(bag_contents) = 'array');
  end if;
end $$;

create or replace function public.generate_device_public_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  body text := '';
  i integer;
begin
  for i in 1..10 loop
    body := body || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return 'jry-dev-' || body;
end;
$$;

create or replace function public.equipment_assets_ensure_public_code()
returns trigger
language plpgsql
as $$
declare
  candidate text;
  attempts integer := 0;
begin
  if new.public_code is not null and btrim(new.public_code) <> '' then
    new.public_code := lower(btrim(new.public_code));
    return new;
  end if;

  loop
    candidate := public.generate_device_public_code();
    exit when not exists (
      select 1 from public.equipment_assets where public_code = candidate
    );
    attempts := attempts + 1;
    if attempts > 20 then
      raise exception 'Could not allocate a unique device public_code';
    end if;
  end loop;

  new.public_code := candidate;
  return new;
end;
$$;

drop trigger if exists equipment_assets_ensure_public_code on public.equipment_assets;
create trigger equipment_assets_ensure_public_code
before insert or update of public_code on public.equipment_assets
for each row execute function public.equipment_assets_ensure_public_code();

update public.equipment_assets
set public_code = public.generate_device_public_code()
where public_code is null;

alter table public.equipment_assets
  alter column public_code set not null;

create index if not exists equipment_assets_public_code_idx
  on public.equipment_assets (public_code);

alter table public.rental_asset_assignments
  add column if not exists assigned_at timestamptz not null default timezone('utc', now()),
  add column if not exists released_at timestamptz;

update public.rental_asset_assignments
set assigned_at = coalesce(assigned_at, created_at)
where assigned_at is null;

create unique index if not exists rental_asset_assignments_active_asset_uidx
  on public.rental_asset_assignments (equipment_asset_id)
  where released_at is null;

create index if not exists rental_asset_assignments_rental_idx
  on public.rental_asset_assignments (rental_id);

create index if not exists rental_asset_assignments_asset_idx
  on public.rental_asset_assignments (equipment_asset_id);

comment on column public.equipment_assets.public_code is
  'Permanent public QR token for /devices/[code]. Regenerate only when rotating the code.';
comment on column public.equipment_assets.bag_contents is
  'Per-device bag contents JSON string array. Empty falls back to product included_accessories on the public page.';
comment on column public.rental_asset_assignments.released_at is
  'Null while the device is assigned. Set when admin releases or rental ends.';
