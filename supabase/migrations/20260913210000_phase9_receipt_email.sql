-- Phase 9: one receipt per payment, and idempotent email sends.

create unique index if not exists receipts_payment_id_unique
  on public.receipts (payment_id);

create unique index if not exists email_logs_template_hash_idx
  on public.email_logs (template, payload_hash)
  where payload_hash is not null;
