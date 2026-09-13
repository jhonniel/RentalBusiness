-- Phase 2 RLS. Customers never read other customers' operational data.
-- Payment and rental status writes are not granted to customers.

alter table public.product_categories enable row level security;
alter table public.product_categories force row level security;
alter table public.products enable row level security;
alter table public.products force row level security;
alter table public.product_images enable row level security;
alter table public.product_images force row level security;
alter table public.equipment_assets enable row level security;
alter table public.equipment_assets force row level security;
alter table public.rental_requests enable row level security;
alter table public.rental_requests force row level security;
alter table public.rental_items enable row level security;
alter table public.rental_items force row level security;
alter table public.rental_asset_assignments enable row level security;
alter table public.rental_asset_assignments force row level security;
alter table public.rental_status_history enable row level security;
alter table public.rental_status_history force row level security;
alter table public.waiver_versions enable row level security;
alter table public.waiver_versions force row level security;
alter table public.waiver_acceptances enable row level security;
alter table public.waiver_acceptances force row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_transactions force row level security;
alter table public.receipts enable row level security;
alter table public.receipts force row level security;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;
alter table public.recurring_expenses enable row level security;
alter table public.recurring_expenses force row level security;
alter table public.expense_occurrences enable row level security;
alter table public.expense_occurrences force row level security;
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
alter table public.email_logs enable row level security;
alter table public.email_logs force row level security;
alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;
alter table public.settings enable row level security;
alter table public.settings force row level security;
alter table public.business_profiles enable row level security;
alter table public.business_profiles force row level security;

revoke all on public.product_categories from anon, authenticated, public;
revoke all on public.products from anon, authenticated, public;
revoke all on public.product_images from anon, authenticated, public;
revoke all on public.equipment_assets from anon, authenticated, public;
revoke all on public.rental_requests from anon, authenticated, public;
revoke all on public.rental_items from anon, authenticated, public;
revoke all on public.rental_asset_assignments from anon, authenticated, public;
revoke all on public.rental_status_history from anon, authenticated, public;
revoke all on public.waiver_versions from anon, authenticated, public;
revoke all on public.waiver_acceptances from anon, authenticated, public;
revoke all on public.payment_transactions from anon, authenticated, public;
revoke all on public.receipts from anon, authenticated, public;
revoke all on public.expenses from anon, authenticated, public;
revoke all on public.recurring_expenses from anon, authenticated, public;
revoke all on public.expense_occurrences from anon, authenticated, public;
revoke all on public.notifications from anon, authenticated, public;
revoke all on public.email_logs from anon, authenticated, public;
revoke all on public.audit_logs from anon, authenticated, public;
revoke all on public.settings from anon, authenticated, public;
revoke all on public.business_profiles from anon, authenticated, public;

grant select on public.product_categories to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.product_images to anon, authenticated;
grant select on public.waiver_versions to anon, authenticated;
grant select on public.business_profiles to anon, authenticated;

grant select, insert, update on public.rental_requests to authenticated;
grant select, insert on public.rental_items to authenticated;
grant select on public.rental_asset_assignments to authenticated;
grant select on public.rental_status_history to authenticated;
grant select, insert on public.waiver_acceptances to authenticated;
grant select on public.payment_transactions to authenticated;
grant select on public.receipts to authenticated;
grant select, update on public.notifications to authenticated;

grant select, insert, update, delete on public.product_categories to authenticated;
grant insert, update, delete on public.products to authenticated;
grant insert, update, delete on public.product_images to authenticated;
grant select, insert, update, delete on public.equipment_assets to authenticated;
grant insert, update, delete on public.rental_asset_assignments to authenticated;
grant insert on public.rental_status_history to authenticated;
grant insert, update on public.waiver_versions to authenticated;
grant select, insert, update, delete on public.expenses to authenticated;
grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant select, insert, update, delete on public.expense_occurrences to authenticated;
grant insert on public.notifications to authenticated;
grant select on public.email_logs to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update on public.settings to authenticated;
grant insert, update on public.business_profiles to authenticated;

create policy product_categories_public_read
on public.product_categories for select
to anon, authenticated
using (is_active = true or public.is_admin());

create policy product_categories_admin_write
on public.product_categories for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy products_public_read
on public.products for select
to anon, authenticated
using (status = 'active' or public.is_admin());

create policy products_admin_write
on public.products for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy product_images_public_read
on public.product_images for select
to anon, authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.products p
    where p.id = product_id
      and p.status = 'active'
  )
);

create policy product_images_admin_write
on public.product_images for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy equipment_assets_admin_all
on public.equipment_assets for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy rental_requests_select_own
on public.rental_requests for select
to authenticated
using (customer_id = public.current_profile_id() or public.is_admin());

create policy rental_requests_insert_own
on public.rental_requests for insert
to authenticated
with check (
  customer_id = public.current_profile_id()
  and status in ('draft', 'pending')
);

create policy rental_requests_update_own_open
on public.rental_requests for update
to authenticated
using (
  customer_id = public.current_profile_id()
  and status in ('draft', 'pending')
)
with check (
  customer_id = public.current_profile_id()
  and status in ('draft', 'pending')
);

create policy rental_requests_admin_update
on public.rental_requests for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy rental_items_select_own
on public.rental_items for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
  )
);

create policy rental_items_insert_own
on public.rental_items for insert
to authenticated
with check (
  exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
      and rr.status in ('draft', 'pending')
  )
);

create policy rental_items_admin_write
on public.rental_items for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy rental_asset_assignments_select_own
on public.rental_asset_assignments for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
  )
);

create policy rental_asset_assignments_admin_write
on public.rental_asset_assignments for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy rental_status_history_select_own
on public.rental_status_history for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
  )
);

create policy rental_status_history_admin_insert
on public.rental_status_history for insert
to authenticated
with check (public.is_admin());

create policy waiver_versions_public_read
on public.waiver_versions for select
to anon, authenticated
using (is_current = true or public.is_admin());

create policy waiver_versions_admin_write
on public.waiver_versions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy waiver_acceptances_select_own
on public.waiver_acceptances for select
to authenticated
using (customer_id = public.current_profile_id() or public.is_admin());

create policy waiver_acceptances_insert_own
on public.waiver_acceptances for insert
to authenticated
with check (
  customer_id = public.current_profile_id()
  and exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
  )
);

create policy payment_transactions_select_own
on public.payment_transactions for select
to authenticated
using (customer_id = public.current_profile_id() or public.is_admin());

create policy receipts_select_own
on public.receipts for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.rental_requests rr
    where rr.id = rental_id
      and rr.customer_id = public.current_profile_id()
  )
);

create policy expenses_admin_all
on public.expenses for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy recurring_expenses_admin_all
on public.recurring_expenses for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy expense_occurrences_admin_all
on public.expense_occurrences for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy notifications_select_own
on public.notifications for select
to authenticated
using (recipient_id = public.current_profile_id() or public.is_admin());

create policy notifications_update_own
on public.notifications for update
to authenticated
using (recipient_id = public.current_profile_id())
with check (recipient_id = public.current_profile_id());

create policy notifications_admin_insert
on public.notifications for insert
to authenticated
with check (public.is_admin());

create policy email_logs_admin_select
on public.email_logs for select
to authenticated
using (public.is_admin());

create policy audit_logs_admin_select
on public.audit_logs for select
to authenticated
using (public.is_admin());

create policy settings_public_read
on public.settings for select
to authenticated
using (true);

create policy settings_admin_write
on public.settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy business_profiles_public_read
on public.business_profiles for select
to anon, authenticated
using (true);

create policy business_profiles_admin_write
on public.business_profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
