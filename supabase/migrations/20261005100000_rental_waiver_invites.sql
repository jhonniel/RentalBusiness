-- Admin-sent waiver sign links. The raw token never lives in the database.
-- Public pages look up by uuid and compare a sha256 hash.

create table if not exists public.rental_waiver_invites (
  id bigint generated always as identity primary key,
  uuid uuid not null default gen_random_uuid(),
  rental_id bigint not null references public.rental_requests (id) on delete cascade,
  token_hash text not null,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by bigint references public.profiles (id),
  created_at timestamptz not null default timezone('utc', now()),
  constraint rental_waiver_invites_uuid_unique unique (uuid),
  constraint rental_waiver_invites_token_hash_unique unique (token_hash),
  constraint rental_waiver_invites_email_check check (char_length(email) <= 254),
  constraint rental_waiver_invites_hash_check check (char_length(token_hash) = 64)
);

create index if not exists rental_waiver_invites_rental_idx
  on public.rental_waiver_invites (rental_id, created_at desc);

alter table public.rental_waiver_invites enable row level security;
alter table public.rental_waiver_invites force row level security;

revoke all on public.rental_waiver_invites from anon, authenticated, public;
grant select, insert, update, delete on public.rental_waiver_invites to service_role;

comment on table public.rental_waiver_invites is
  'One-time waiver sign links created by an administrator. Tokens are stored as sha256 hashes only.';
