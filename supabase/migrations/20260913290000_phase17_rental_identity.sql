-- Phase 17: rental identity proof (government ID + selfie with ID)
-- and renter snapshot fields on the signed waiver.
-- Public APIs must expose uuid only. Storage paths stay on the server.

alter table public.waiver_acceptances
  add column if not exists signer_email text,
  add column if not exists signer_phone text;

comment on column public.waiver_acceptances.signer_email is 'Email copied from the account at acceptance. Not a public identifier.';
comment on column public.waiver_acceptances.signer_phone is 'Phone copied from the account at acceptance.';

create table if not exists public.rental_identity_verifications (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  customer_id bigint not null references public.profiles (id),
  government_id_path text not null,
  selfie_path text not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rental_identity_verifications_uuid_unique unique (uuid),
  constraint rental_identity_verifications_rental_unique unique (rental_id)
);

comment on table public.rental_identity_verifications is 'Government ID and selfie-with-ID proof for a rental. Never expose storage paths or internal ids.';
comment on column public.rental_identity_verifications.uuid is 'Public identifier. Never expose id.';
comment on column public.rental_identity_verifications.government_id_path is 'private-documents object path. Server-only.';
comment on column public.rental_identity_verifications.selfie_path is 'private-documents object path. Server-only.';

create index if not exists rental_identity_verifications_customer_id_idx
  on public.rental_identity_verifications (customer_id);

drop trigger if exists rental_identity_verifications_set_updated_at on public.rental_identity_verifications;
create trigger rental_identity_verifications_set_updated_at
before update on public.rental_identity_verifications
for each row
execute function public.set_updated_at();

alter table public.rental_identity_verifications enable row level security;
alter table public.rental_identity_verifications force row level security;

revoke all on public.rental_identity_verifications from anon, authenticated, public;
grant select, insert, update on public.rental_identity_verifications to authenticated;

drop policy if exists rental_identity_select_own_or_admin on public.rental_identity_verifications;
create policy rental_identity_select_own_or_admin
on public.rental_identity_verifications
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.rental_requests r
    join public.profiles p on p.id = r.customer_id
    where r.id = rental_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists rental_identity_insert_own on public.rental_identity_verifications;
create policy rental_identity_insert_own
on public.rental_identity_verifications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.rental_requests r
    join public.profiles p on p.id = r.customer_id
    where r.id = rental_id
      and r.status in ('draft', 'pending')
      and p.user_id = auth.uid()
      and customer_id = p.id
  )
);

drop policy if exists rental_identity_update_own on public.rental_identity_verifications;
create policy rental_identity_update_own
on public.rental_identity_verifications
for update
to authenticated
using (
  exists (
    select 1
    from public.rental_requests r
    join public.profiles p on p.id = r.customer_id
    where r.id = rental_id
      and r.status in ('draft', 'pending')
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.rental_requests r
    join public.profiles p on p.id = r.customer_id
    where r.id = rental_id
      and r.status in ('draft', 'pending')
      and p.user_id = auth.uid()
      and customer_id = p.id
  )
);
