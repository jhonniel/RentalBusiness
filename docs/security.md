# Security

Security is enforced in the database and on the server. Frontend route guards are a convenience, not a control.

## Secrets

Never commit `.env`. Never send these values to the browser:

- `SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_PASS`
- `PAYMENT_PROVIDER_KEY`
- `PAYMENT_WEBHOOK_SECRET`
- `CRON_SECRET`

The browser may receive `NUXT_PUBLIC_SUPABASE_URL` and the anon / publishable key only.

## Authentication

- Supabase Auth: email/password, Google OAuth, verification, password reset
- Session cookies via `@nuxtjs/supabase` (`useSsrCookies`). Do not set `httpOnly` on those cookies; the browser client must persist them after Google and email sign-in so `/api/auth/me` can see the session
- API auth also accepts the session access token as `Authorization: Bearer`
- A missing profile fetch is not treated as “needs policies.” Only a loaded profile without Terms or Privacy versions goes to `/accept-policies`
- No access tokens in `localStorage`
- Named middleware (`auth`, `guest`, `admin`, `customer-home`) — not a global login wall, so the catalog stays public
- After sign-in, the server-loaded profile role chooses the account home. Administrators are sent to the operations console so they do not open `/admin` by hand. Customers stay on `/dashboard`.
- Google sign-in uses the same cookie session. New Google accounts without stored Terms/Privacy versions must accept them once. Accounts that already signed up are not sent back to that screen
- Auth forms use `method="post"` and `@submit.prevent` (do not use `UAuthForm`)

## Authorization

Roles live on `profiles.role` (`admin` | `customer`).

Admin pages require:

1. Authenticated session
2. Role loaded server-side
3. RLS policies that match that role

Clients cannot change rental status, payment status, or another user’s records.

## Row Level Security

RLS is enabled and forced on every application table.

Profile rules:

- Authenticated users can select their own row (`user_id = auth.uid()`)
- Admins can select all profiles via `public.is_admin()`
- Users may update only `first_name`, `last_name`, `phone`
- A trigger rejects changes to `role`, `user_id`, and `uuid`
- New users always receive `role = 'customer'` from a security-definer trigger
- Role promotion is a SQL insert of a new profile row, never an `update` of `role` and never a client field

Phase 2 additions:

- Public catalog read is limited to active products and categories
- Customers insert rentals only as `draft` or `pending` for their own profile
- Customers cannot write `payment_transactions`, `receipts`, `expenses`, `email_logs`, or `audit_logs`
- Accepted waiver versions cannot be updated or deleted
- `expense_occurrences` is unique on `(recurring_expense_id, occurs_on)` for idempotent cron
- Storage: public `product-images`, public `payment-qr-images`, private `private-documents` (path prefixed by `auth.uid()`)

Phase 3 additions:

- Catalog mutations require an authenticated admin session (`requireAdmin`) plus a 40/min rate limit
- Product delete (`DELETE /api/admin/products/[uuid]`) is rejected with 409 when `rental_items` or `rental_asset_assignments` exist so rental history is preserved. Unused images and assets are removed only when delete is allowed
- Product, category, image, and asset payloads are strict Zod schemas and reject internal `id`
- Product `slug` is derived from the product name on the server. Clients cannot send `slug`
- Public catalog mappers expose `uuid` / `sku` / `asset_code` only
- Admin mutations write `audit_logs` through `write_audit_log` without failing the save if audit insert fails

Phase 4 additions:

- Public catalog APIs use the anon/session client so RLS limits reads to active products and categories
- Public list queries reject `status` and internal `id`
- Public product payloads omit operational inventory counters
- Catalog GETs are rate-limited at 80 requests / minute / IP

Phase 5 additions:

- `GET /api/availability` uses the anon/session client and `product_booked_quantity` (security definer)
- Availability queries reject internal `id` and require `uuid` or `slug`
- Pages display API results only; overlap math stays in `utils/availability.ts` and SQL
- `GET /api/availability/calendar` uses security-definer `product_occupying_ranges` and returns dates only, never rental or customer identifiers
- `GET /api/admin/calendar` requires an admin session and returns rental `uuid`/`code` only, never database primary keys
- `GET /api/admin/sales` requires an admin session, reuses paid-sales report rules, and returns payment `uuid` plus rental `uuid`/`code` only
- `GET`/`PATCH /api/admin/settings` require an admin session. Clients cannot change `currency` or `timezone`. The payload uses `uuid` only
- `GET /api/admin/audit-logs` is admin-only and read-only. Payloads use log `uuid` and actor profile `uuid`. Secrets in stored JSON are redacted. Rows are never updated or deleted from this API

Phase 6 additions:

- Rental create/list/detail/cancel require a signed-in session; RLS keeps rows to `current_profile_id()`
- Customers may insert only `draft` or `pending`, and may cancel those statuses
- Quotes and totals are computed on the server; clients cannot send `totalAmount` or `status: approved`
- Failed draft inserts can be deleted by the owner so incomplete rentals are not left behind

Phase 7 additions:

- Customers accept only the current published waiver, bound 1:1 to a rental they own
- Clients cannot send `id`, `ipAddress`, or `userAgent`; the server records IP, user agent, and an audit log
- Accepted versions cannot change `title`, `body`, `version`, or `uuid`; `is_current` may rotate so a newer version can be published
- Customers may re-read versions they signed after a newer current version is published
- Signature payloads are PNG data URLs with a size cap; accept is limited to 20/min/user

Privacy Policy additions:

- Privacy acknowledgment is separate from Terms acceptance, optional marketing consent, and the rental waiver
- The current Privacy Policy and Terms versions are stored on the profile and again on each waiver acceptance
- Customers may update marketing preference and acknowledge the current policy or Terms; they cannot change `role`, `user_id`, or `uuid`

Phase 8 additions:

- Customers cannot insert or update `payment_transactions`; the server uses the service-role client
- Create/verify require a signed-in owner; webhook has no session and rejects unsigned or tampered bodies
- Clients cannot send `amount` or `status`; amount is the rental total in PHP
- One open (`pending`/`processing`) payment per rental
- Paid payments cannot transition to `failed`
- Customers may cancel `awaiting_payment` only when no paid payment exists; open intents are cancelled with the rental

Phase 9 additions:

- Customers cannot insert receipts or email logs; issuance and sends use the service-role client
- One receipt per payment; email sends are idempotent on `(template, payload_hash)`
- Receipt snapshots omit internal ids
- Reminder sends require an admin session
- `SMTP_PASS` stays on the server; missing SMTP credentials log a failed send and do not roll back the receipt

Phase 10 additions:

- Analytics, admin rental, and customer lists require an admin session
- Approve is server-side only from `paid` to `approved` and writes an audit log
- Notifications are readable and markable only by the recipient
- KPI and ranking math stays in `utils/analytics.ts`; pages display API results
- Public payloads omit profile and rental internal ids

Phase 11 additions:

- Expense and recurring-expense APIs require an admin session
- Customers still have no select or write on `expenses`, `recurring_expenses`, or `expense_occurrences`
- Expenses are voided, not deleted; ended templates cannot be reopened
- Occurrence posting is idempotent on `(recurring_expense_id, occurs_on)`
- Clients cannot send internal ids; public payloads use `uuid` only
- Date math stays in `utils/expense.ts`; pages display API results

Phase 12 additions:

- `/api/cron/*` requires `CRON_SECRET` and never trusts a browser session
- Due-date and reminder rules stay in `utils/cron.ts`
- Failed items in a job do not abort the rest of the run

Phase 13 additions:

- Report APIs require an admin session
- CSV export is rate-limited and written to the audit log
- Report math stays in `utils/report.ts`; pages display API results
- Public report payloads and CSV files omit internal ids

Phase 15 additions:

- Customers may UPDATE only `rental_requests.status` and `notifications.read_at`
- Item `daily_price` / `line_total` are overwritten from catalog prices (`quote_rental_line`)
- Parent rental totals are synced from items; customers cannot keep a forged `total_amount`
- Waiver accept requires the current published version and an open `draft`/`pending` rental
- Customer status-history inserts are limited to `draft`, `pending`, and `cancelled`
- `settings` is admin-select only
- Placeholder webhook/cron/service-role secrets are rejected
- Session cookies are `httpOnly`, `SameSite=Lax`, and `Secure` in production
- API and account routes send `cache-control: private, no-store`
- In-memory rate limits are best-effort on Vercel (per isolate). Sign-in throttling stays with Supabase Auth.

Phase 17 additions:

- `rental_identity_verifications` is forced RLS; customers insert/update only their own open rentals
- Government ID and selfie files live in `private-documents` under `{auth.uid()}/rentals/{rentalUuid}/`
- Public APIs never return storage paths. Admins receive short-lived signed URLs
- Payment create requires a signed waiver and submitted identity documents
- Waiver email and phone are copied from the server-loaded profile

Phase 16 additions:

- `payment_methods` is forced RLS; customers may select active rows only
- Admin create/update/QR upload require `requireAdmin` plus a 40/min rate limit
- QR uploads reject non-image types and files larger than 5 MB
- Payment method payloads are strict Zod schemas and reject internal `id`
- QR images are public objects; they never change payment or rental status

Customers may:

- Read and update allowed fields on their own profile
- Read their own rentals, payments, receipts, waivers, notifications, and active payment methods
- Create rental requests for themselves

Customers must not:

- Read other users, rentals, or payments
- Modify payments or rental status
- Read expenses, analytics, audit logs, or settings writes

Admins may access operations data through policies that check `profiles.role = 'admin'`. After that server check, catalog writes (product info and prices) use the service-role client so the save still works when the browser session cookie is missing. Privileged jobs use the service-role client on the server only. Customers never write catalog prices.

## Payments

- Payment status is accepted only from the provider webhook or a server-side verification call.
- Webhook signatures are verified (`x-lumen-payment-signature`) in `server/utils/payment-signature.ts` before any state change.
- The payment module is provider-agnostic. Phase 8 ships a `sandbox` adapter selected by `PAYMENT_PROVIDER` (default `sandbox`).
- `PAYMENT_PROVIDER_KEY` and `PAYMENT_WEBHOOK_SECRET` stay on the server.
- Admin payment methods and QR uploads require `requireAdmin`. Customers may read only active methods. QR files live in the public `payment-qr-images` bucket. These methods never confirm payment status.

## Cron

- Cron routes reject requests that do not present `CRON_SECRET` (`Authorization: Bearer` or `x-cron-secret`)
- Vercel schedules only `/api/cron/daily` so Hobby stays within the two-cron limit
- Compare uses a length-checked timing-safe match in `server/utils/cron-secret.ts`; query-string secrets are not accepted
- Recurring expense posting is idempotent on `(recurring_expense_id, occurs_on)`
- Reminder emails are idempotent on `(template, payload_hash)`
- Overdue detection only moves `active` → `overdue` and writes status history plus a customer notification
- Cron uses the service-role client on the server; `CRON_SECRET` never goes to the browser

## Storage

Private buckets for waivers, receipts, and customer documents. Catalog photos and payment QR images are stored in public Supabase Storage buckets (`product-images`, `payment-qr-images`) on S3. Private files are served through signed URLs. Pages never write image bytes to the local disk.

## Logging and audit

- Structured server logs with redacted secret-like keys
- Audit log for admin actions: actor, action, entity, previous/new values, timestamp, IP when appropriate
- Email sends recorded in `email_logs`
- Signup confirmation links are generated on the server and emailed over Gmail SMTP. Tokens and `token_hash` values are never returned to the browser in the register or resend response.

## Search engines

- Public catalog pages allow indexing (`index, follow`)
- Auth, account, receipt, payment, and admin paths set `noindex, nofollow`
- `/robots.txt` disallows the same private prefixes
- `/sitemap.xml` lists only public catalog and legal URLs and never includes `uuid` or database ids

## Error disclosure

Users see friendly messages. APIs return `{ message, code }` only. Stack traces stay on the server.

## Production checklist

- [x] No secrets in git (`.env` ignored; only public Supabase values are in `runtimeConfig.public`)
- [x] RLS enabled and forced on every application table; Phase 15 freezes customer money and item prices
- [x] Admin authorization verified on API (`requireAdmin`) and UI (`admin` middleware)
- [x] Zod validation on every mutating endpoint
- [x] Payment webhook signature verified; placeholder webhook secrets return 503
- [x] Cron secret verified with a timing-safe compare; query-string secrets are not read
- [x] Rate limiting on auth profile/me, payments, catalog, rentals, identity uploads, waivers, privacy policy, terms, and notifications (in-memory / per isolate)
- [x] Session cookies: `httpOnly`, `SameSite=Lax`, `Secure` in production
- [x] Storage policies reviewed (`product-images` and `payment-qr-images` public read, `private-documents` owner/admin)
- [x] Audit logging on admin mutations
- [x] `npm audit` reviewed (`@nuxt/ui@3.3.7` reports GHSA-gj2h-2fpw-fhv9; do not use `UAuthForm`/`UForm` without an explicit POST method)
- [x] Health readiness flags and production env warning; live Vercel/Supabase/Gmail SMTP values are still an operations step before go-live
