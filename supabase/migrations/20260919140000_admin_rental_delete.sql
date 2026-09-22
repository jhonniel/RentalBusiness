alter table public.waiver_acceptances
  drop constraint if exists waiver_acceptances_rental_id_fkey;

alter table public.waiver_acceptances
  add constraint waiver_acceptances_rental_id_fkey
  foreign key (rental_id) references public.rental_requests (id) on delete cascade;

alter table public.receipts
  drop constraint if exists receipts_rental_id_fkey;

alter table public.receipts
  add constraint receipts_rental_id_fkey
  foreign key (rental_id) references public.rental_requests (id) on delete cascade;

alter table public.receipts
  drop constraint if exists receipts_payment_id_fkey;

alter table public.receipts
  add constraint receipts_payment_id_fkey
  foreign key (payment_id) references public.payment_transactions (id) on delete cascade;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_rental_id_fkey;

alter table public.payment_transactions
  add constraint payment_transactions_rental_id_fkey
  foreign key (rental_id) references public.rental_requests (id) on delete cascade;

grant delete on public.rental_items to authenticated;
grant delete on public.rental_status_history to authenticated;
grant delete on public.waiver_acceptances to authenticated;
grant delete on public.payment_transactions to authenticated;
grant delete on public.receipts to authenticated;
grant delete on public.rental_identity_verifications to authenticated;

drop policy if exists rental_requests_admin_delete on public.rental_requests;
create policy rental_requests_admin_delete
on public.rental_requests for delete
to authenticated
using (public.is_admin());

drop policy if exists rental_status_history_admin_delete on public.rental_status_history;
create policy rental_status_history_admin_delete
on public.rental_status_history for delete
to authenticated
using (public.is_admin());

drop policy if exists waiver_acceptances_admin_delete on public.waiver_acceptances;
create policy waiver_acceptances_admin_delete
on public.waiver_acceptances for delete
to authenticated
using (public.is_admin());

drop policy if exists payment_transactions_admin_delete on public.payment_transactions;
create policy payment_transactions_admin_delete
on public.payment_transactions for delete
to authenticated
using (public.is_admin());

drop policy if exists receipts_admin_delete on public.receipts;
create policy receipts_admin_delete
on public.receipts for delete
to authenticated
using (public.is_admin());

drop policy if exists rental_identity_admin_delete on public.rental_identity_verifications;
create policy rental_identity_admin_delete
on public.rental_identity_verifications for delete
to authenticated
using (public.is_admin());
