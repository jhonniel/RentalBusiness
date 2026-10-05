# Supabase

Apply migrations in order, then seed only in development.

## Migrations

1. `20260913170000_profiles_and_rls.sql` — identity
2. `20260913180000_phase2_core_schema.sql` — catalog, rentals, finance, platform
3. `20260913180001_phase2_rls.sql` — row level security
4. `20260913180002_phase2_storage.sql` — storage buckets
5. Later phase files through `20260913300000_site_maintenance.sql` — availability, rental, waiver, payment, receipt, hardening, admin QR payment methods, availability calendar, privacy-policy acknowledgments, Terms & Conditions acknowledgments, Google OAuth profile names, existing-account policy versions, rental identity documents, and the public maintenance page

Development seed (never production):

```bash
# After migrations
psql "$DATABASE_URL" -f supabase/seed.sql
```

Or paste `supabase/seed.sql` into a development SQL editor.

## Auth configuration

1. Enable email confirmations for production.
2. Add redirect URLs:
   - `http://localhost:3000/confirm`
   - `{NUXT_PUBLIC_SITE_URL}/confirm`
3. Set the site URL to `NUXT_PUBLIC_SITE_URL`.
4. Enable the Google provider when ready. Authorized redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`. Keep Client ID and Client Secret in the Supabase dashboard only.

## Development admin

`supabase/seed.sql` (and `supabase/seed-admin.sql`) create a confirmed admin for local use only:

| Email | Password |
| --- | --- |
| `admin@jryrentals.local` | `JryAdmin!dev` |

Sign in at `/login`. The app checks `profiles.role` and opens the operations console for administrators. Never run this seed against production.

To promote a different account, use **Customers → Make admin** in the operations console. That calls `promote_profile_to_admin(uuid)` through the admin API. Do not `update` `role` from the client — `prevent_profile_privilege_escalation` blocks that unless the trusted function sets `app.allow_role_change`.

Apply `20261005100000_rental_waiver_invites.sql` before using **Continue form** or sending a guest waiver link. That table is service-role only and stores a token hash, never the raw token.

Apply `20261005110000_rental_pickup_return_times.sql` so rentals store pickup and return instants. Return is the same clock time as pickup on the return date.

Do not hard-code admin emails in the application.

## Availability

Use `public.product_booked_quantity(product_id, starts_on, ends_on)` for overlap-aware stock. Do not compare against `products.quantity` alone. Use `public.product_occupying_ranges` for calendar days that should be unselectable.
