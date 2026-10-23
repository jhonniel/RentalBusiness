-- Let an administrator edit a booking extension: the note on any active entry, and the
-- return date and amount on the latest one. Previous values go to the audit log.
-- Safe to re-run.

alter table public.rental_extensions
  add column if not exists edited_at timestamptz,
  add column if not exists edited_by bigint references public.profiles (id);

grant update (ends_on, return_at, total_amount, added_amount, note, edited_at, edited_by)
  on public.rental_extensions to service_role;
