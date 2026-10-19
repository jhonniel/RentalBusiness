-- Commissions are now recorded only when the booking is completed.
-- Void the unpaid commission expenses that were written earlier for bookings that are
-- not completed yet. The rows stay on file as void; a new commission expense is written
-- when the booking is marked done. Safe to re-run.

update public.expenses e
set status = 'void',
    notes = trim(both ' ' from coalesce(e.notes, '') || ' Voided: commissions are recorded when the booking is completed.')
from public.rental_requests rr
where e.rental_id = rr.id
  and e.category = 'commission'
  and e.status = 'pending'
  and rr.status <> 'completed';
