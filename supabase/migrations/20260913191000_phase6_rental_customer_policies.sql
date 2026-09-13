-- Phase 6: customers may delete their own drafts if item insert fails,
-- cancel open requests, and write status history for rentals they own.

grant delete on public.rental_requests to authenticated;

create policy rental_requests_delete_own_draft
on public.rental_requests for delete
to authenticated
using (
  customer_id = public.current_profile_id()
  and status = 'draft'
);

create policy rental_requests_cancel_own
on public.rental_requests for update
to authenticated
using (
  customer_id = public.current_profile_id()
  and status in ('draft', 'pending')
)
with check (
  customer_id = public.current_profile_id()
  and status = 'cancelled'
);

create policy rental_status_history_insert_own
on public.rental_status_history for insert
to authenticated
with check (
  exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
  )
);
