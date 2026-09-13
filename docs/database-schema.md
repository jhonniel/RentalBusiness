# Database schema

**Status:** Phase 2 schema through Phase 17 rental identity proof live in `supabase/migrations/`, plus the availability calendar and privacy-policy acknowledgment columns. RLS, storage buckets, and the development seed are included.

Public identifiers are `uuid` or `code`. Internal `bigint` primary keys are never returned from public APIs or placed in URLs.

Default timezone for business dates: `Asia/Manila`. Timestamps are stored in UTC (`timestamptz`).

## Tables

### Identity

**users** — Supabase Auth identities (`auth.users`). Not owned by application migrations.

**profiles**

| Column | Type | Notes |
| --- | --- | --- |
| id | bigint | Internal PK |
| uuid | uuid | Public id, unique |
| user_id | uuid | FK → auth.users |
| role | text | `admin` \| `customer` |
| first_name | text | |
| last_name | text | |
| phone | text | |
| privacy_policy_version | text | Version string acknowledged at registration or later |
| privacy_accepted_at | timestamptz | |
| terms_version | text | Terms & Conditions version accepted |
| terms_accepted_at | timestamptz | |
| marketing_opt_in | boolean | Separate from privacy and terms |
| marketing_opted_at | timestamptz | |
| created_at / updated_at | timestamptz | |

**Relationship:** `users` 1 → 1 `profiles`

### Catalog

**product_categories**

- `id`, `uuid`, `slug` (unique), `name`, `description`, `sort_order`, `is_active`

**products**

- `id`, `uuid`, `slug` (unique, generated from `name`), `sku` (unique)
- `category_id` → product_categories
- `name`, `description`, `short_description`
- `daily_price`, `weekly_price`, `monthly_price`, `deposit_amount`, `late_fee`, `replacement_value`
- `quantity`, `status` (`draft` \| `active` \| `hidden` \| `archived`)
- `condition`, `specifications` (jsonb), `included_accessories` (jsonb), `rental_rules`
- `model_path` (optional 3D), `is_featured`
- `created_at`, `updated_at`

**product_images**

- `id`, `uuid`, `product_id`, `storage_path`, `alt`, `sort_order`
- `storage_path` is an object key in the public Supabase Storage `product-images` bucket (S3). Public APIs return the Storage URL, never a local file path.

**equipment_assets** (serialized units)

- `id`, `uuid`, `product_id`, `asset_code` (unique, e.g. `CAM-0001`)
- `serial_number`, `condition`, `status`
- statuses: `available` \| `reserved` \| `rented` \| `maintenance` \| `damaged` \| `lost` \| `retired`
- `purchase_cost`, `purchase_date`, `replacement_value`

**rental_asset_assignments**

- `rental_id` → rental_requests
- `equipment_asset_id` → equipment_assets
- Unique `(rental_id, equipment_asset_id)`

**Relationships**

- `products` 1 → many `product_images` (`ON DELETE CASCADE`)
- `products` 1 → many `equipment_assets`
- `products` 1 → many `rental_items` (no cascade — rental history stays)
- Admin product delete is blocked when `rental_items` or `rental_asset_assignments` exist. Otherwise unused assets and storage objects are removed, then the product row is deleted.
- `rental_requests` 1 → many `rental_asset_assignments`

### Rentals

**rental_requests**

- `id`, `uuid` (public rental number source), `code` (human-readable)
- `customer_id` → profiles
- `status` (see rental statuses below)
- `starts_on`, `ends_on` (date, business calendar)
- `subtotal`, `deposit_amount`, `discount_amount`, `tax_amount`, `total_amount`
- `notes`, `admin_notes`
- `created_at`, `updated_at`

**rental_items**

- `id`, `uuid`, `rental_id`, `product_id`
- `quantity`, `daily_price`, `line_total`

**rental_status_history**

- `id`, `rental_id`, `from_status`, `to_status`, `changed_by`, `note`, `created_at`

**rental_identity_verifications**

- `id`, `uuid`, `rental_id` (unique), `customer_id`
- `government_id_path`, `selfie_path` (private-documents paths, never returned to the browser)
- `submitted_at`

**Relationship:** `rental_requests` 1 → 0..1 `rental_identity_verifications`

**product_booked_quantity(product_id, starts_on, ends_on)**

- SQL function, not a table. Inclusive date overlap. Counts only statuses returned by `rental_occupies_inventory`.
- Anon and authenticated may `execute` it (Phase 5). The function is security definer so callers do not read other customers' rental rows.
- Application availability is `quantity - damaged - maintenance - lost - booked`. Do not use `available_quantity` alone.

**product_occupying_ranges(product_id, starts_on, ends_on)**

- Returns occupying `starts_on`, `ends_on`, and `quantity` for calendar blocking.
- Same overlap and occupying-status rules as `product_booked_quantity`.
- Does not return rental, customer, or other identifiers.

Rental statuses: `draft`, `pending`, `awaiting_payment`, `paid`, `approved`, `ready_for_pickup`, `active`, `returned`, `completed`, `cancelled`, `rejected`, `overdue`.

Status changes are server-side only. Clients cannot write status columns. Customers may create `draft` or `pending` and cancel `draft`, `pending`, or unpaid `awaiting_payment` (Phase 6 and 8). Payment confirmation moves `awaiting_payment` → `paid`.

### Waivers

**waiver_versions**

- `id`, `uuid`, `version` (unique), `title`, `body`, `is_current`, `published_at`
- Historical rows keep `title`, `body`, `version`, and `uuid` immutable after acceptance. `is_current` may change so a newer version can be published.

**waiver_acceptances**

- `id`, `uuid`, `waiver_version_id`, `rental_id`, `customer_id`
- `signer_name`, `signer_email`, `signer_phone`, `signature_data`, `accepted_at`, `ip_address`, `user_agent`
- `privacy_policy_version` — the Privacy Policy version acknowledged with that rental
- `terms_version` — the Terms & Conditions version accepted with that rental
- Public APIs omit `id`, `signature_data`, `ip_address`, and `user_agent`. Those columns stay on the row for audit.

**Relationships**

- `rental_requests` 1 → 1 `waiver_acceptances` (for a completed flow)
- `waiver_versions` 1 → many `waiver_acceptances`

### Payments and receipts

**payment_methods**

- `id`, `uuid`, `code` (unique), `name`
- `account_name`, `account_number`, `instructions`
- `qr_storage_path` in the public `payment-qr-images` bucket
- `sort_order`, `is_active`
- Authenticated customers may select active rows. Writes are admin-only.

**payment_transactions**

- `id`, `uuid`, `rental_id`, `customer_id`
- `amount`, `currency` (default `PHP`)
- `provider`, `provider_transaction_id`
- `status`: `pending` \| `processing` \| `paid` \| `failed` \| `refunded` \| `partially_refunded` \| `cancelled`
- `payment_method`, `paid_at`, `metadata` (jsonb)
- `created_at`
- Unique open payment per rental: at most one row in `pending` or `processing`

Never trust client-reported payment status. Inserts and updates are server-only (service role). Customers may select their own rows.

**receipts**

- `id`, `uuid`, `receipt_number` (unique), `rental_id`, `payment_id`
- `snapshot` (jsonb of line items and totals at issue time)
- `issued_at`
- Unique `payment_id` so a paid payment issues exactly one receipt

### Finance

**expenses**

- `id`, `uuid`, `name`, `category`, `description`, `amount`
- `vendor`, `reference`, `status`, `notes`, `incurred_on`

Expense categories: `internet`, `electricity`, `maintenance`, `repairs`, `software`, `subscription`, `marketing`, `transportation`, `staff`, `insurance`, `equipment`, `office`, `other`.

**recurring_expenses**

- `id`, `uuid`, `name`, `category`, `amount`
- `frequency`: `daily` \| `weekly` \| `monthly` \| `quarterly` \| `yearly` \| `custom`
- `interval_count`, `anchor_day` (e.g. 15th)
- `start_on`, `end_on`, `next_occurrence_on`, `vendor`, `status`

**expense_occurrences**

- `id`, `uuid`, `recurring_expense_id`, `expense_id` (nullable until posted)
- `occurs_on`, `generated_at`
- Unique (`recurring_expense_id`, `occurs_on`) for idempotency

**Relationship:** `recurring_expenses` 1 → many `expense_occurrences`

### Platform

**notifications**

- `id`, `uuid`, `recipient_id`, `type`, `title`, `body`, `read_at`, `metadata`

**email_logs**

- `id`, `uuid`, `to_email`, `template`, `provider_id`, `status`, `payload_hash`, `sent_at`
- Unique `(template, payload_hash)` when a hash is present so the same receipt or reminder is not sent twice. Signup confirmation uses template `auth.signup.confirm` and a hash of `email:token`, so a resend can go out with a new link.

**audit_logs**

- `id`, `uuid`, `actor_id`, `action`, `entity`, `entity_id`
- `previous_value` (jsonb), `new_value` (jsonb)
- `ip_address`, `metadata`, `created_at`
- Append-only. Admins list rows through `GET /api/admin/audit-logs`. Public APIs never return `id` or `actor_id`.

**settings** / **business_profiles**

- Business name, logo path, contact, address
- `currency` default `PHP`
- `timezone` default `Asia/Manila`
- Late fees, deposit rules, cancellation rules, email settings

## Inventory quantities

Product-level rollups (derived, not blindly trusted from the client):

- `total_quantity`
- `available_quantity` (generated from quantity minus reserved/rented/damaged/maintenance/lost; date-aware stock uses `product_booked_quantity`)
- `reserved_quantity`
- `rented_quantity`
- `damaged_quantity`
- `maintenance_quantity`
- `lost_quantity`

Serialized products also track per-asset status.

## Indexes (planned)

- Unique: `profiles.uuid`, `products.slug`, `products.sku`, `rental_requests.code`, `receipts.receipt_number`, `payment_methods.uuid`, `payment_methods.code`
- `rental_requests (status, starts_on, ends_on)`
- `rental_items (product_id, rental_id)`
- `payment_transactions (provider, provider_transaction_id)`
- `expense_occurrences (recurring_expense_id, occurs_on)`

## RLS summary

Enabled on every application table. Details live in [security.md](./security.md). Customers read only their own rows. Admins use role-checked policies plus server-side service-role operations for privileged writes.

Phase 15: `quote_rental_line` and item triggers copy catalog prices onto `rental_items` and sync parent totals. Customers may update only `rental_requests.status` and `notifications.read_at`. `settings` is admin-select.

Phase 16: `payment_methods` stores admin QR payment options. Authenticated customers may select active rows. Writes are admin-only. QR files live in the public `payment-qr-images` bucket.

Phase 17: `rental_identity_verifications` stores government ID and selfie-with-ID paths in `private-documents`. Customers write only their own open rentals. Public APIs never return storage paths.

## Seed data

`supabase/seed.sql` is development-only. It inserts categories, featured products, serialized assets, the current waiver version (`JRY-WAIVER-v1.0`, copied from `supabase/waiver-jry-v1.txt`), business settings, a Starlink recurring expense, and a sample maintenance expense. The current Privacy Policy text is `supabase/privacy-jry-v1.txt` (`JRY-PRIVACY-v1.0`). The current Terms & Conditions text is `supabase/terms-jry-v1.txt` (`JRY-TC-v1.0`).

It also creates a development Auth user `admin@jryrentals.local` / `JryAdmin!dev` and sets that profile to `admin`. Never run the seed against production.
