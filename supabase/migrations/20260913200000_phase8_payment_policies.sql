-- Phase 8: one open payment per rental, and customers may cancel
-- unpaid awaiting_payment requests. Payment writes stay on the service role.

create unique index if not exists payment_transactions_one_open_idx
  on public.payment_transactions (rental_id)
  where status in ('pending', 'processing');

drop policy if exists rental_requests_cancel_own on public.rental_requests;
create policy rental_requests_cancel_own
on public.rental_requests for update
to authenticated
using (
  customer_id = public.current_profile_id()
  and status in ('draft', 'pending', 'awaiting_payment')
)
with check (
  customer_id = public.current_profile_id()
  and status = 'cancelled'
);
