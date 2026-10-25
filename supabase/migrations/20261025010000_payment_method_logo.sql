-- Admins can upload a logo for each payment method (for example the GCash or bank logo).
-- Logos are stored in the existing public payment-qr-images bucket under the method uuid.
-- Safe to re-run.

alter table public.payment_methods
  add column if not exists logo_storage_path text;

comment on column public.payment_methods.logo_storage_path is
  'Storage path of the payment method logo in the payment-qr-images bucket.';
