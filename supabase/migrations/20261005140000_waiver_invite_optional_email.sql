-- Admins can create a copyable sign link without emailing the customer.

alter table public.rental_waiver_invites
  alter column email drop not null;

comment on column public.rental_waiver_invites.email is
  'Optional recipient when the shop emails the link. Null when the admin only copies it.';
