# API

All application APIs live under `/api`. Handlers validate input with Zod and authorize on the server. Public identifiers are `uuid` or `code`.

**Current phase:** health through reports, public discovery, admin payment methods, rental identity proof, the operations calendar, sales ledger, business settings, site maintenance, audit logs, and production readiness flags.

## Conventions

| Topic | Rule |
| --- | --- |
| Methods | GET read, POST create, PATCH update, DELETE only when explicitly designed |
| Auth | Session from Supabase cookies; never trust a role field from the client |
| Errors | `{ message, code }` — no stack traces or SQL |
| Dates | ISO-8601 request values; business rules in `Asia/Manila`. Rentals collect `pickupTime` (`HH:mm`). Return is the same clock time on the return date. |
| Money | Decimal amounts in PHP unless a future currency setting says otherwise |
| Idempotency | Required for payments, cron, and receipt issuance |

## Implemented

### `GET /api/health`

Liveness check used by local development and future uptime monitors.

**Response**

```json
{
  "status": "ok",
  "phase": 16,
  "timezone": "Asia/Manila",
  "currency": "PHP",
  "supabaseConfigured": false,
  "serviceRoleConfigured": false,
  "cronConfigured": false,
  "webhookConfigured": false,
  "resendConfigured": false,
  "ready": false,
  "timestamp": "2026-09-13T00:00:00.000Z",
  "requestId": "…"
}
```

`status` is liveness (`ok` when the process can answer). The boolean flags never include secret values. `ready` is true only when Supabase anon config, the service-role key, `CRON_SECRET`, `PAYMENT_WEBHOOK_SECRET`, and Gmail SMTP (`SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) are all non-empty and not placeholders. `resendConfigured` remains the health field name and is true when SMTP is configured.

### `POST /api/auth/register`

Creates an unconfirmed customer account and emails a confirmation link through Gmail SMTP. The handler uses the service-role `generateLink` API so Supabase Auth does not send its own message. The response never includes tokens, hashes, or the confirmation URL.

**Auth:** public  
**Body:** `{ firstName, lastName, email, password, termsAccepted: true, privacyAcknowledged: true, marketingOptIn? }`  
**Rate limit:** 8 requests / 15 minutes / IP

```json
{
  "email": "ana@example.com",
  "requiresConfirmation": true
}
```

### `POST /api/auth/resend-confirmation`

Sends another branded confirmation email through Gmail SMTP. The response is always `{ "sent": true }` so callers cannot probe whether an email is registered.

**Auth:** public  
**Body:** `{ email }`  
**Rate limit:** 8 requests / 15 minutes / IP, 5 / 15 minutes / email

### `GET /api/auth/me`

Returns the signed-in user's public profile. Role is read from `profiles`, not from the request.

**Auth:** required

```json
{
  "uuid": "…",
  "role": "customer",
  "firstName": "Ana",
  "lastName": "Reyes",
  "phone": null,
  "email": "ana@example.com",
  "emailVerified": false
}
```

### `PATCH /api/auth/profile`

Updates allowed profile fields. `role` is rejected by schema and by the database.

**Auth:** required  
**Body:** `{ firstName, lastName, phone? }`  
**Rate limit:** 20 requests / minute / user

### `POST /api/auth/change-password`

Lets the signed-in administrator change their own password. The server checks the current password, then updates Auth through the service-role client. The new password is never logged.

**Auth:** admin  
**Body:** `{ currentPassword, password, confirmPassword }`  
The same account page saves the administrator’s first and last name through `PATCH /api/auth/profile`. Email is not changed.  
**Rate limit:** 8 requests / 15 minutes / user

### Admin catalog

All catalog write routes require an admin session. Mutations are limited to 40 requests / minute / admin profile. Responses use `uuid`, `sku`, and `assetCode` — never database primary keys.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/categories` | All categories |
| POST | `/api/admin/categories` | Create category |
| PATCH | `/api/admin/categories/[uuid]` | Update category |
| GET | `/api/admin/products` | Search, status, category, pagination |
| POST | `/api/admin/products` | Create product |
| GET | `/api/admin/products/[uuid]` | Product with images |
| PATCH | `/api/admin/products/[uuid]` | Update product info and prices (name, descriptions, daily/weekly/monthly, deposit, late fee, hidden price fields, inventory, status) |
| POST | `/api/admin/products/[uuid]/archive` | Set status to `archived` |
| DELETE | `/api/admin/products/[uuid]` | Permanently delete a product with no rental or asset-assignment history. Returns 409 if history exists — archive instead. |
| POST | `/api/admin/products/[uuid]/images` | Multipart `file` (one or more) + `alt` (JPG/PNG/WebP/HEIC, 15 MB). Server compresses to JPEG before S3. Extra photos appear under the main image on the product page. |
| DELETE | `/api/admin/images/[uuid]` | Remove image and storage object |
| GET | `/api/admin/inventory` | Serialized assets. A unit whose product is out shows `rented` and that rental's return time. The stored asset status is unchanged. |
| POST | `/api/admin/products/[uuid]/assets` | Create asset |
| PATCH | `/api/admin/assets/[uuid]` | Update asset |
| GET | `/api/admin/products/[uuid]/blocked-dates` | Admin-blocked date ranges for one product |
| POST | `/api/admin/products/[uuid]/blocked-dates` | Block inclusive `startsOn`–`endsOn` (optional `reason`). Past dates, `coming_soon`, and other non-active kits are rejected. |
| DELETE | `/api/admin/blocked-dates/[uuid]` | Remove a blocked-date range |

**Product body:** name, categoryUuid, prices, `longStayLess` (peso per day, default 0), `longStayMinDays` (default 3), deposit, `hiddenPriceFields` (`daily` / `weekly` / `monthly` / `deposit` / `lateFee` / `replacementValue`), quantities, status (`draft` / `active` / `coming_soon` / `hidden` / `archived`), specifications, accessories, rental rules, featured flag. The public `slug` and unique `sku` are generated from `name` on the server. Extra fields such as `id`, `slug`, or `sku` are rejected. `coming_soon` kits appear in the public catalog with a Coming soon label and cannot be quoted, booked, or given blocked dates. Hidden price fields stay on the admin product and in quote math; the public catalog omits those amounts.

### Public catalog

Unauthenticated. Uses the anon Supabase client so RLS only returns active or coming-soon categories and products. Responses never include database primary keys or reserved/rented/damaged counters. Public catalog items include `comingSoon` instead of the internal status. Amounts listed in `hidden_price_fields` are returned as `null` and are not shown on the storefront.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/categories` | Active categories |
| GET | `/api/products` | Search, `categorySlug` or `categoryUuid`, `featured`, pagination |
| GET | `/api/products/[id]` | Active or coming-soon product by `uuid` or `slug` |

**Rate limit:** 80 requests / minute / IP

### `GET /api/availability`

Overlap-aware stock for one active product. Booked quantity comes from occupying rentals whose pickup/return window overlaps the requested window. Return is the same Asia/Manila clock time as pickup on `endsOn`. Capacity subtracts damaged, maintenance, and lost units. A second unit stays bookable on a day when only one of two units is already booked. `canFulfill` is false when the requested quantity is greater than the units still free, or when an admin-blocked range overlaps the requested dates.

**Query:** `productUuid` or `productSlug`, `startsOn`, `endsOn`, `pickupTime` (`HH:mm`, default `09:00`), `quantity` (default 1). `startsOn` must be today or later in Asia/Manila. A pickup time today must still be in the future.  
**Rate limit:** 80 requests / minute / IP

```json
{
  "product": { "uuid": "…", "slug": "sony-a7-iv", "name": "Sony A7 IV", "sku": "CAM-A7IV-001" },
  "startsOn": "2026-10-05",
  "endsOn": "2026-10-10",
  "pickupTime": "13:00",
  "pickupAt": "2026-10-05T05:00:00.000Z",
  "returnAt": "2026-10-10T05:00:00.000Z",
  "capacity": 5,
  "booked": 3,
  "available": 2,
  "requested": 3,
  "canFulfill": false
}
```

### `GET /api/availability/calendar`

Returns `unavailableDates`, `bookedDates`, `capacity`, and `occupyingWindows` for one active product. `draft` rentals hold the kit the same way as later open statuses. `bookedDates` are days that overlap any occupying rental window, including a return morning that still has later pickup slots. A day is listed in `unavailableDates` only when every remaining unit is already booked for every shop pickup time that day, or an admin blocked that day. Pickup-time controls disable a slot only when the overlapping bookings use every remaining unit. A kit due back at 2:00 PM can be booked again from 2:00 PM, not earlier that morning. Date pickers mark booked days with a dot and cross out fully closed days.

**Query:** `productUuid` or `productSlug`, `quantity` (default 1), optional `from` / `to` (default today through 180 days, max 366)  
**Rate limit:** 80 requests / minute / IP

The payload includes product `uuid` / `slug` / `name` / `sku`, the date list, and window instants only. It never includes rental or customer identifiers.

### Customer rentals

Authenticated. Customers read and create only their own rows. Totals come from `utils/pricing.ts`. Pending requests occupy inventory.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/rentals/quote` | Server quote + availability. Pickup date/time must be today or later in Asia/Manila. When the booking reaches the product `longStayMinDays`, the quote subtracts `longStayLess` times the days and quantity. A zero less turns it off. The deposit is unchanged. |
| POST | `/api/rentals` | Create `draft` only. `pending` is rejected. Pickup date/time must be today or later in Asia/Manila. Return is the same clock time on `endsOn`. Stock must still be free after `draft` and later open rentals, and the window must not overlap admin-blocked days. A return at 2:00 PM keeps every earlier shop pickup that day closed. |
| GET | `/api/rentals` | Own rentals, optional status, pagination |
| GET | `/api/rentals/[id]` | By `uuid` or `code` |
| POST | `/api/rentals/[id]/submit` | Own `draft` with a signed waiver and identity documents. Becomes `pending`, occupies inventory, and emails `contactmejry@gmail.com`. |
| POST | `/api/rentals/[id]/cancel` | Own `draft` or `pending` only |
| POST | `/api/rentals/[id]/identity` | Multipart `governmentId` and `selfie` (JPG/PNG/WebP/HEIC, 15 MB). The customer page captures both with the camera. Owner of a `draft`/`pending` rental with a signed waiver. Server compresses to JPEG before S3. |
| POST | `/api/rentals/[id]/voucher` | Apply an admin voucher code to an own `draft`, `pending`, or `awaiting_payment` rental. Discount is quoted on the server from the rental subtotal. One voucher per rental; a new code replaces the previous one. |
| DELETE | `/api/rentals/[id]/voucher` | Remove the applied voucher and restore the rental total to the subtotal. |

**Create body:** product uuid/slug, startsOn, endsOn, pickupTime (`HH:mm`), quantity, firstName, lastName, phone?, notes?, status? (`draft` default)  
**Rate limit:** 20 creates / minute / user; 20 submits / minute / user; 12 identity uploads / minute / user; 20 voucher apply/remove / minute / user

Rental payloads include `waiver` when the customer has signed (`uuid`, `signerName`, `signerEmail`, `signerPhone`, `acceptedAt`, `privacyPolicyVersion`, `termsVersion`, bound version). They include `identity.submittedAt` after ID documents are uploaded. They include `voucher` (`uuid`, `code`, `name`, `discountAmount`) when a code is applied, plus `discountAmount` on the rental. Rental items include the product `depositAmount`, `lateFee`, and `replacementValue` used on the waiver. They never include `id`, `ip_address`, `signature_data`, or storage paths. The signed waiver body fills `{{RENTAL_EQUIPMENT}}` with those amounts, and the rented equipment name is shown in bold. The drone, Starlink, and camera clauses appear only when this rental includes that equipment. The sections that remain are numbered in order, including the late-return cross-reference. Voucher discounts reduce the rental total (down payment), not the deposit hold.

### Waivers

Current terms are public. Acceptance requires a signed-in owner of a `draft` or `pending` rental. IP and user agent are stored on the server and written to the audit log.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/waivers/current` | Current published version |
| POST | `/api/waivers/accept` | Bind current version to a rental |
| GET | `/api/waivers/invites/[uuid]` | Public invite lookup. Requires `token`. Always returns the waiver text (`uuid`, `version`, `title`, `body`) plus `signed`, `canSign`, `signerName`, `identitySubmitted`, `canUploadIdentity`, and `contact` (first name, last name, email, phone, `emailLocked`). The rental includes `totalAmount` (rent), `depositAmount`, and `amountDue` (rent plus deposit). A placeholder walk-in address is returned as a blank email. `canSign` is true only while the invite is unused and the rental has no signed waiver. After sign, the same link stays open so the customer can review the agreement and photograph ID photos. Never returns `token_hash` or signed file URLs |
| POST | `/api/waivers/invites/[uuid]/schedule` | Guest changes pickup date, return date, and pickup time on an unsigned `draft` before signing. Body: `token`, `startsOn`, `endsOn`, `pickupTime`. Availability ignores this rental so it does not block itself. Past dates and a pickup time that has already passed are rejected. Audited |
| GET | `/api/waivers/invites/[uuid]/calendar` | Availability calendar for that draft, with this rental left out. Requires `token` |
| POST | `/api/waivers/invites/[uuid]/contact` | Guest saves first name, last name, email, and phone before signing. Body includes `token`. A placeholder walk-in address is replaced with the email they enter. An email that already has an account is rejected. A real email already on the booking is left unchanged |
| POST | `/api/waivers/invites/[uuid]/accept` | Guest accept. Body: `token`, `waiverVersionUuid`, `signerName`, PNG `signatureData`. Refuses to sign until name, email, phone, and identity photos are on file |
| POST | `/api/waivers/invites/[uuid]/identity` | Guest ID photos for a `draft` or `pending` rental, before or after the waiver is signed. The sign page captures them with the camera. Multipart `token`, `governmentId`, `selfie`. Photos are compressed. No session. Never returns storage paths |
| GET | `/api/admin/waivers` | All versions |
| POST | `/api/admin/waivers` | Publish a new current version |
| GET | `/api/admin/waivers/[uuid]/pdf` | Admin PDF of a published version. `download=1` attaches the file |
| GET | `/api/admin/rentals/[id]/waiver-pdf` | Admin PDF of the signed rental waiver, including signature. `download=1` attaches the file |
| PATCH | `/api/admin/rentals/[id]/continue` | Admin updates a booking (dates, pickup time, quantity, name, phone, notes) while it is `draft`, `pending`, `awaiting_payment`, `paid`, `approved`, `ready_for_pickup`, `active`, or `overdue`. The pickup date may already be in the past, so an admin can extend the return date. Requotes on the server and ignores this rental when checking availability. A signed `draft` becomes `pending` and holds those dates. A confirmed booking keeps its status, and the new dates stay held. An unpaid checkout amount is updated. When the booking is already paid, the paid payment amount is changed to the new rent plus deposit so Sales follows the new total. The previous amount and the change time are kept on the payment metadata and in the audit log. Audited |
| POST | `/api/admin/rentals/[id]/extend` | Extend an open booking to a later return date. Body: `endsOn`, optional `note`, optional `preview`. With `preview: true` it returns the server-priced `previousTotalAmount`, `totalAmount`, `addedAmount`, `returnAt`, and `canFulfill` without saving. Otherwise it requotes from the original pickup, checks availability without this rental, writes a `rental_extensions` row, updates the rental and an assigned commissioner's commission, updates the unpaid or paid payment amount so Sales follows the new rent, and adds a status-history note. Audited as `rental.extend` |
| GET | `/api/admin/rentals/[id]/extensions` | Extension log for one rental, newest first: previous and new return, previous and new rent, added amount, note, admin name, time. Never returns internal ids |
| PATCH | `/api/admin/rentals/[id]/commissioner` | Assign or clear a commissioner on those same open statuses, including a confirmed booking. Body: `commissionerUuid` or `""`. The status stays unchanged. A pending commission expense is recorded or voided. Audited |
| POST | `/api/admin/rentals/[id]/waiver-invite` | Admin sends a one-time `/waivers/sign/{uuid}?token=` link. Optional `email` override. Returns `{ uuid, expiresAt, sent, waiverUrl }`. Audited |
| POST | `/api/admin/rentals/[id]/waiver` | Admin records an in-person waiver signature on the continue form. Body: `waiverVersionUuid`, `signerName`, PNG `signatureData`. Same acknowledgments as the public sign page. Audited |
| DELETE | `/api/admin/rentals/[id]/waiver` | Admin sets a signed open rental back to unsigned so the customer or shop can agree and sign again. Previous signer name, time, and version are written to the audit log. The latest guest invite is reopened. Identity photos stay. Audited |
| POST | `/api/admin/rentals/[id]/identity` | Admin uploads `governmentId` and `selfie` for a `draft`/`pending` rental. Waiver is not required. Server compresses to JPEG before S3. |

**Accept body:** rental uuid or code, `waiverVersionUuid`, `signerName`, PNG data-URL `signatureData`. The sign page also requires acknowledgment checkboxes before submit, including that the down payment is not refundable once booked; those flags are UI-only and are not stored as separate columns. On a guest sign link, any missing first name, last name, email, and phone are entered first and saved on the customer profile. The waiver stamps email and phone from that profile. The bound `waiver_versions` row is the immutable snapshot. The server also stamps the current Privacy Policy (`JRY-PRIVACY-v1.0`) and Terms (`JRY-TC-v1.0`) versions on the acceptance and on the customer profile. A guest link photographs identity documents before the waiver is accepted when the shop has not uploaded them. A signed-in customer photographs them after accept, then submits the draft request before checkout. Administrators upload the same photos from the rental and do not use the camera.

An administrator can finish a customer draft on `/admin/rentals/[id]/continue`, change pickup date, return date, and pickup time (including a shop time that has already passed today), upload the government ID and selfie there, and have the customer agree and sign on that page. Saving before the waiver is signed keeps the rental a draft. Saving after the waiver is signed sets a `draft` to `pending` and holds those dates for that equipment. A confirmed booking (`pending`, `awaiting_payment`, `paid`, `approved`, `ready_for_pickup`, `active`, or `overdue`) can still be changed from the same form, including after its pickup date has passed, so the shop can extend the return date. Saving keeps that status and moves the date hold. A returned, completed, cancelled, or rejected rental cannot be changed. New bookings still cannot start in the past. The availability check ignores this rental so it does not block itself. Continue also auto-creates a guest `/waivers/sign/{uuid}?token=` link the shop can copy even after the waiver is signed. That public page always shows the Equipment Rental Agreement. Unsigned rentals require any missing name, email, and phone, and ID photos when the shop has not uploaded them, before the acknowledgments, signature pad, and I agree and sign button can be submitted. After it is signed, the form is locked and the customer can still photograph ID photos in the browser without an account. An administrator can change that signed status back to unsigned on an open rental (`draft` through `ready_for_pickup`) so they can agree and sign again; the previous signature is kept in the audit log, not in the rental. Continue also shows an admin-only View signed waiver button. Customers cannot open that signed PDF. The raw token is never stored; `rental_waiver_invites` keeps a sha256 hash only. Guest accept stamps the rental owner’s profile and marks the invite used.

**Create booking body:** productUuid, startsOn, endsOn, pickupTime, quantity, notes?, and optional customerUuid, firstName, lastName, phone, and email. Equipment and dates are enough. Today’s past shop times are allowed. The rental stays `draft` and is not attached to the admin. When no customer and no email are given, the server opens a placeholder customer; that address is never emailed or returned. The response includes `waiverUrl` for `/waivers/sign/{uuid}?token=`. ID photos are optional on this page; if both files are chosen they go to `POST /api/admin/rentals/[id]/identity`.  
**Continue body:** startsOn, endsOn, pickupTime, quantity, firstName, lastName, phone?, notes?, commissionerUuid? A commissioner uuid records that person on the rental and writes a pending commission expense from the equipment’s commission per day. A blank value clears the commissioner and voids that expense.  
**Admin quote:** `POST /api/admin/rentals/quote` uses the same window as continue and does not reject a pickup time that has already passed today. Optional `exceptRentalUuid` leaves that rental out of the hold check. Public `POST /api/rentals/quote` still requires a later pickup time and rejects `exceptRentalUuid`.  
**Invite body:** email?  
**Contact body:** token, firstName, lastName, email, phone.  
**Rate limit:** 80 reads / minute / IP; 20 accepts / minute / user; 40 invite reads / minute / IP; 40 invite calendars / minute / IP; 20 invite schedule updates / minute / IP; 20 invite accepts / minute / IP; 20 invite contact saves / minute / IP; 12 guest identity uploads / minute / IP; 20 admin invites / minute / admin; 20 admin in-person accepts / minute / admin; 20 admin waiver resets / minute / admin; 40 admin publishes / minute / admin; 20 PDF downloads / minute / admin

### Privacy Policy

The published policy is versioned (`JRY-PRIVACY-v1.0`) and public at `/privacy`. Registration requires a Privacy Policy acknowledgment that is stored separately from Terms acceptance, optional marketing consent, and the rental waiver.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/privacy/current` | Current version, dates, and body |

Account-level fields: `privacyPolicyVersion`, `privacyAcceptedAt`, `termsVersion`, `termsAcceptedAt`, `marketingOptIn` on `GET /api/auth/me` and `PATCH /api/auth/profile`. Clients cannot send role.  
**Rate limit:** 80 reads / minute / IP

### Terms & Conditions

The published Terms are versioned (`JRY-TC-v1.0`) and public at `/terms`. They govern the website and rental service and stay separate from the waiver and Privacy Policy. Cancellation follows the waiver: the down payment is not refundable once the rental is booked.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/terms/current` | Current version, dates, and body |

### Cookie Policy

The published Cookie Policy is versioned (`JRY-COOKIE-v1.0`) and public at `/cookies`. It describes essential session cookies used to sign in. Visitors see a consent notice until they accept the current version; that acknowledgment is stored only in the browser. Registration still requires Terms and Privacy, not a separate cookie checkbox.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/cookie-policy/current` | Current version, dates, and body |

**Rate limit:** 80 reads / minute / IP

Rental payloads include `payments` (`uuid`, amount, currency, provider, status, method, paidAt, checkoutUrl). They never include `id` or `provider_transaction_id`.

### Payments

Customers see active bank and QR methods from `GET /api/payment-methods` and send the rent plus the deposit. After the return time, an administrator marks the rental done and that deposit is removed from the paid amount so sales keep the rent. Server-created intents remain available for a future live adapter. Amount and currency come from the rental total (PHP). Clients cannot send `amount` or `status`. A signed waiver, submitted identity documents, and a shop-confirmed (`awaiting_payment`) request are required for customer checkout. An administrator can also `POST /api/admin/rentals/[id]/paid` after the waiver and identity are on file; that writes a paid shop payment and records the rental in sales. Customer payment status otherwise changes only from a verified webhook or a server-side provider retrieve.

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/payments/create` | Create or reuse an open intent |
| GET | `/api/payments/[id]` | Owner only |
| POST | `/api/payments/[id]/verify` | Provider retrieve, then apply |
| POST | `/api/payments/webhook` | HMAC `x-lumen-payment-signature` |
| POST | `/api/payments/sandbox/complete` | Sandbox checkout only |

**Create body:** rental uuid or code  
**Webhook body:** `{ provider, providerTransactionId, status, paymentMethod?, paidAt? }`  
**Signature:** `sha256=` + hex HMAC-SHA256 of the raw body with `PAYMENT_WEBHOOK_SECRET`  
**Rate limit:** 20 creates or verifies / minute / user; 60 webhooks / minute / IP

### Payment methods

Admins configure GCash, Maya, bank transfer, or similar methods and upload a QR image. Signed-in customers read only active methods. Images are stored in the public `payment-qr-images` bucket. Responses use `uuid` and `code` — never database primary keys.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/payment-methods` | All methods |
| POST | `/api/admin/payment-methods` | Create method |
| PATCH | `/api/admin/payment-methods/[uuid]` | Update method |
| POST | `/api/admin/payment-methods/[uuid]/qr` | Multipart `file` (JPG/PNG/WebP/HEIC, 15 MB). Server compresses to JPEG before S3 |
| DELETE | `/api/admin/payment-methods/[uuid]/qr` | Remove QR image and storage object |
| GET | `/api/payment-methods` | Active methods for signed-in customers |

**Method body:** name, optional code, accountName, accountNumber, instructions, sortOrder, isActive. Extra fields such as `id` are rejected.  
**Rate limit:** 40 admin writes / minute / admin; 80 customer reads / minute / user

Customers send the rental total to these bank or QR details. The methods do not confirm payment. Status still changes only from a verified webhook or a server-side provider retrieve.

Rental payloads include `receipts` (`uuid`, `receiptNumber`, `issuedAt`, snapshot). Snapshots never include internal ids.

### Receipts and email

Receipts are issued by the server when a payment is confirmed. Customers may read their own rows. Email sends use Gmail SMTP and are recorded in `email_logs` with a payload hash so the same confirmation or reminder is not sent twice.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/receipts/[id]` | By `uuid` or `RCP-` number |
| POST | `/api/admin/rentals/remind` | Admin pickup or return reminder |

**Remind body:** rental uuid or code, `type`: `pickup` \| `return`  
**Rate limit:** 20 reminder sends / minute / admin

Print view: `/receipts/[number]` (signed-in owner, blank layout).

### Admin operations

Admin session required. Role is loaded from `profiles`. Responses use `uuid` / `code` only.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/analytics` | KPIs, 14-day sales, status counts, top products, commissioner ranks from highest commission to lowest, recent expenses, active recurring expenses. Active Rentals includes `active` and `overdue` rows, plus paid, approved, and ready-for-pickup rows whose pickup time has started and whose return time has not. Commissioner ranks sum `commission_amount` by commissioner and leave out cancelled and rejected bookings. |
| GET | `/api/admin/calendar` | Rentals (including drafts) and admin-blocked dates overlapping a `YYYY-MM` month in Asia/Manila. Days use pickup/return windows so a return morning still shows as booked. |
| GET | `/api/admin/sales` | Paid payments in a date range; `format=csv` exports the same sales report |
| GET | `/api/admin/settings` | Business profile for receipts |
| PATCH | `/api/admin/settings` | Update name, contact, and policy copy. Currency and timezone stay PHP / Asia/Manila |
| GET | `/api/admin/maintenance` | Maintenance toggle, title, explanation, and images |
| PATCH | `/api/admin/maintenance` | Enable or disable the public maintenance page |
| POST | `/api/admin/maintenance/images` | Multipart `file` (one or more) + `alt` (JPG/PNG/WebP/HEIC, 15 MB). Server compresses to JPEG before S3 |
| DELETE | `/api/admin/maintenance/images/[uuid]` | Remove image and storage object |
| GET | `/api/admin/audit-logs` | Append-only audit trail. Search action/entity/public id. Paginated |
| GET | `/api/admin/rentals` | All rentals, search code, status, pagination |
| POST | `/api/admin/rentals` | Admin creates a `draft` with equipment and dates. Name, phone, email, and `customerUuid` are optional. A new email opens a customer account on the server; with no email the server opens a placeholder customer that is never emailed. The generated password is never returned. The response includes a one-time `waiverUrl`. The booking is attached to that customer, not the admin. Audited |
| GET | `/api/admin/rentals/[id]` | By uuid or code |
| POST | `/api/admin/rentals/quote` | Admin pricing for continue. Allows a pickup time that has already passed today. Optional `exceptRentalUuid` leaves that rental out of the availability check so it does not block itself. Other occupying windows still block `canFulfill` |
| DELETE | `/api/admin/rentals/[id]` | Permanently delete a rental by uuid or code. Removes items, payments, receipts, waiver, identity files, and status history. Admin only, audited |
| GET | `/api/admin/vouchers` | Search code/name, status, pagination |
| POST | `/api/admin/vouchers` | Create a percent or fixed discount code. Blank `code` is generated as `JRY-XXXXXX` |
| PATCH | `/api/admin/vouchers/[uuid]` | Update name, code, amounts, limits, dates, or status |
| PATCH | `/api/admin/rentals/[id]/continue` | Update a `draft`, confirmed, paid, approved, ready-for-pickup, active, or overdue booking. A past pickup date is allowed so the return date can be extended. Requotes dates, pickup time, and quantity, ignoring this rental in the availability check. Today’s past shop times are allowed. A signed `draft` becomes `pending`. Later statuses stay as they are, and the new dates stay held. Audited |
| POST | `/api/admin/rentals/[id]/waiver-invite` | Email or copy a one-time guest waiver link. Audited |
| POST | `/api/admin/rentals/[id]/waiver` | Record an in-person agree-and-sign on the continue form. Audited |
| POST | `/api/admin/rentals/[id]/identity` | Admin ID and selfie upload for `draft`/`pending`. No waiver required. Compressed JPEG on S3 |
| PATCH | `/api/admin/rentals/[id]/commissioner` | Assign or clear a commissioner on a `draft`, `pending`, `awaiting_payment`, `paid`, `approved`, or `ready_for_pickup` booking. A confirmed booking keeps its status. Body: `commissionerUuid` or `""`. Records or voids the commission expense. Audited |
| POST | `/api/admin/rentals/[id]/confirm` | `pending` → `awaiting_payment`, or `approved` when a voucher covers the full total. Dates stay reserved. Audited |
| POST | `/api/admin/rentals/[id]/cancel` | Admin cancels a `draft`, `pending`, `awaiting_payment`, `paid`, `approved`, or `ready_for_pickup` booking. Optional `reason`. Releases the dates, cancels any unpaid checkout, and voids an open commission. A paid payment is kept as `paid` with `nonRefundable` metadata, so the deposit and down payment stay in Sales and are not refunded. Active or overdue rentals cannot be cancelled. Audited |
| POST | `/api/admin/rentals/[id]/paid` | Admin records a shop payment (`cash`, `gcash`, `maya`, or `bank`) for the rent plus the deposit. Creates a paid `payment_transactions` row so the rental appears in sales. Moves `draft`/`pending`/`awaiting_payment` to `paid` after waiver and identity are on file. Audited |
| POST | `/api/admin/rentals/[id]/complete` | Admin marks a rental done after the return time. Status becomes `completed`. If the payment included the deposit, that deposit is subtracted from the paid amount so sales keep the rent. Audited |
| POST | `/api/admin/rentals/[id]/approve` | `paid` → `approved`, or `awaiting_payment` when a voucher covers the full total. Audited |
| GET | `/api/admin/customers` | Customer profiles, account email, phone, and rental counts. Email comes from the sign-in account and is admin-only |
| GET | `/api/admin/system-users` | Profiles with `role = admin`, including the sign-in email |
| GET | `/api/admin/commissioners` | Profiles with `role = commissioner`, including the sign-in email |
| GET | `/api/admin/commissions` | Commissions from completed bookings only: per-commissioner unclaimed and collected totals, the unclaimed list, and the collected list. Rental `uuid`/`code` and commissioner `uuid` only |
| POST | `/api/admin/commissions/[uuid]/collect` | Mark an unclaimed commission collected once the commissioner is paid. The commission expense becomes `paid`. Only allowed after the booking is completed. Audited as `commission.collect` |
| POST | `/api/admin/customers/[uuid]/promote` | Make a customer a system admin. Audited. Clients cannot send `role` |
| POST | `/api/admin/customers/[uuid]/commissioner` | Make a customer a commissioner. Audited. Clients cannot send `role` |
| GET | `/api/notifications` | Signed-in recipient |
| POST | `/api/notifications/[id]/read` | Mark own notification read |

Commissioner routes require `role = commissioner`. `GET /api/commissioner/products` lists active equipment and the admin-set commission per day. `POST /api/commissioner/rentals/quote` and `POST /api/commissioner/rentals` book one piece of equipment for a client. The rental is `pending`, recorded on that commissioner, and holds the dates. The response can include a one-time `waiverUrl`. `GET /api/commissioner/rentals` and `GET /api/commissioner/rentals/[id]` return only that commissioner's bookings. `POST .../cancel` releases the dates while the booking is still `pending` or `awaiting_payment`. Commissioners and customers cannot delete bookings; only `DELETE /api/admin/rentals/[id]` deletes one. The commission amount is kept on the rental, but the commission expense is written only when an admin marks the booking done. Admins see it on `/admin/commissioners` as unclaimed until they mark it collected.

Approve is allowed after payment is `paid`, or when a voucher brings the rental total to ₱0. The customer receives an in-app notification. Sales KPIs sum paid payment amounts in `Asia/Manila`. Inventory value is `quantity × replacement_value` for non-archived products.

**Voucher body:** name, code? (generated when blank), discountType (`percent` \| `fixed`), discountValue, maxRedemptions?, minSubtotal, startsOn?, endsOn?, status (`draft` \| `active` \| `disabled`). Percent values cannot exceed 100. Customers never list vouchers; they submit a code only.

### Site maintenance

Public `GET /api/maintenance` returns `{ enabled, title, message, images, products }` with public image URLs, product slugs, and `uuid` values — never storage paths or database ids. `products` is the three storefront kits (Starlink Mini, DJI Air 3, DJI Osmo 360). `POST /api/maintenance/chat` accepts `{ messages: [{ role, content }] }` and returns `{ reply }`. The last message must be from the visitor. If they name a kit — including JBL and other catalog names — and a date, tomorrow, the next day, or a number of days, or say they want to book that kit, the server checks live availability and PHP totals through the same rental quote path as booking. Public storefront pages render a bottom-right chat-support widget; the maintenance page keeps an in-page chat. When `GROQ_API_KEY` is set, the server uses Groq's free Llama model; otherwise it answers from JRY business knowledge. Paid OpenAI models are not used. When `enabled` is true, visitors are sent to `/maintenance` and other public storefront APIs return 503. Admin, auth, health, cron, Terms, Privacy, Cookie Policy, maintenance chat, payment webhook, and public waiver-invite routes stay available.

**Rate limit:** 20 setting writes / minute / admin; 40 image writes / minute / admin; 20 chat messages / minute / IP

### Expenses

Admin session required. Categories are the fixed list in `EXPENSE_CATEGORIES`. Responses use `uuid` only. Rows are voided, not deleted.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/expenses` | Search, category, status, pagination |
| POST | `/api/admin/expenses` | Create one-time expense |
| GET | `/api/admin/expenses/[id]` | By uuid |
| PATCH | `/api/admin/expenses/[id]` | Update pending or paid |
| POST | `/api/admin/expenses/[id]/void` | Soft-void, audited |
| GET | `/api/admin/recurring-expenses` | Templates |
| POST | `/api/admin/recurring-expenses` | Create template. The first bill is always the start date. That bill is recorded when the start date is today or earlier. |
| GET | `/api/admin/recurring-expenses/[id]` | Includes recent occurrences |
| PATCH | `/api/admin/recurring-expenses/[id]` | Update unless ended |
| POST | `/api/admin/recurring-expenses/[id]/pause` | `active` → `paused` |
| POST | `/api/admin/recurring-expenses/[id]/resume` | `paused` → `active` |
| POST | `/api/admin/recurring-expenses/[id]/end` | Ends the template |
| GET | `/api/admin/recurring-expenses/[id]/occurrences` | Posted dates |
| POST | `/api/admin/recurring-expenses/[id]/occurrences` | Post next due date |

`POST .../occurrences` creates a pending expense for `next_occurrence_on`, stores an occurrence (`unique(recurring_expense_id, occurs_on)`), and advances the next date. Repeating that date is idempotent. Creating a template records the start date when that day has arrived, without posting a later next bill early. The nightly cron job uses the same poster, records a skipped start date, and can catch up missed days.

**Rate limit:** 40 mutations / minute / admin

### Cron

No user session. Present `Authorization: Bearer $CRON_SECRET` or `x-cron-secret`. Vercel Cron sends the Bearer header. Jobs use the service-role client, are idempotent, and return counts only.

| Method | Path | Notes |
| --- | --- | --- |
| GET/POST | `/api/cron/daily` | Pings Supabase when 3 days have passed, expires unconfirmed requests, then runs recurring expenses, reminders, and overdue |
| GET/POST | `/api/cron/keep-alive` | Service-role ping so a paused-idle Supabase project stays awake |
| GET/POST | `/api/cron/expire-pending` | `pending` → `cancelled` when the shop has not confirmed within 24 hours |
| GET/POST | `/api/cron/recurring-expenses` | Post due recurring expenses |
| GET/POST | `/api/cron/reminders` | Pickup and return emails for tomorrow in Asia/Manila |
| GET/POST | `/api/cron/overdue` | `active` → `overdue` when `ends_on` is before today |

`vercel.json` schedules `/api/cron/daily` at `0 16 * * *` (midnight Asia/Manila) and `/api/cron/expire-pending` at `0 4 * * *` (noon Asia/Manila). Hobby only allows daily cron expressions. The daily job pings Supabase at most once every 3 days and stores `settings.supabase_keep_alive`. The single-job paths stay available for manual runs. Reminder emails reuse `(template, payload_hash)`. Occurrences reuse `(recurring_expense_id, occurs_on)`. Overdue only transitions `active` rentals. Unconfirmed requests are also expired when availability or a quote is checked.

### Reports

Admin session required. Dates are inclusive in `Asia/Manila`. Default range is the current month through today. Maximum range is 366 days. Responses use `uuid` / `code` only.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/admin/reports/[type]` | `sales`, `expenses`, `profit`, `rentals`, `inventory`, `utilization` |

**Query:** `startsOn`, `endsOn`, `format` (`json` default, `csv`)  
**Rate limit:** 20 CSV exports / minute / admin

Sales sum paid payments. A finished rental's deposit is no longer inside that paid amount. Expense totals skip `void`. Profit is sales minus those expenses. Rentals are rows whose dates overlap the range. Inventory is a live stock snapshot. Utilization is booked unit-days ÷ rentable capacity unit-days for occupying rentals. CSV exports are audited.

### Discovery

Public, unauthenticated. These are Nitro routes, not `/api` handlers.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/robots.txt` | Allows public catalog; disallows account, auth, admin, and `/api` paths. `Sitemap` uses `NUXT_PUBLIC_SITE_URL`. |
| GET | `/sitemap.xml` | Home, `/products`, `/about`, `/privacy`, `/terms`, `/cookies`. When Supabase is configured, also includes the first page of active product slugs. |

## Planned endpoints

None. Phase 17 is the last documented build phase.

## Authorization checklist (every protected route)

1. Require an authenticated session.
2. Load the profile role from the database, not from the request body.
3. Enforce ownership for customer resources.
4. Rely on RLS as a second line of defense.
5. Write an audit log for admin mutations.

## Cron

Vercel Cron will call `/api/cron/*` with a shared secret header. Jobs must be idempotent and logged. See [deployment.md](./deployment.md).
