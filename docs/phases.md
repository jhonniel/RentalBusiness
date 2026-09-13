# Phases

Build one phase at a time. The app must stay runnable after every phase. Do not start the next phase until the current one has no critical errors and the operator says to proceed.

## Phase 0 — Architecture (completed)

Project structure, documentation, environment, Supabase connection config, design system, public/admin/auth layouts, error handling, logging.

**Exit criteria:** typecheck, lint, tests, and `npm run dev` succeed. Met on 13 Sep 2026.

See the Phase 0 report in the project README and the conversation that completed this phase.

## Phase 1 — Authentication (completed)

Registration, login, logout, email verification, password reset, profile, admin role, `profiles` RLS.

Wait for: `Proceed to Phase 2`

## Phase 2 — Database (completed)

Normalized schema, FKs, indexes, constraints, RLS, policies, functions, development seed.

Wait for: `Proceed to Phase 3`

## Phase 3 — Product management (completed)

Admin product CRUD, categories, images, pricing, inventory, equipment assets.

Wait for: `Proceed to Phase 4`

## Phase 4 — Public catalog (completed)

Landing page, catalog, product details, search, filters.

Wait for: `Proceed to Phase 5`

## Phase 5 — Availability engine (completed)

Overlap-aware availability. Tests for overlapping bookings, multi-unit stock, same-day rentals, cancellations, maintenance.

Wait for: `Proceed to Phase 6`

## Phase 6 — Rental flow (completed)

Dates, quantity, summary, customer details, rental creation, status `draft` / `pending`.

Wait for: `Proceed to Phase 7`

## Phase 7 — Waiver (completed)

Versioned waivers, digital acceptance, signature, audit trail. Current published text is `JRY-WAIVER-v1.0` (Equipment Rental Agreement & Liability Waiver). Older signed copies stay bound to the version accepted at the time.

Wait for: `Proceed to Phase 8`

## Phase 8 — Payment (completed)

Provider-agnostic transactions, server verification, webhooks, statuses.

Wait for: `Proceed to Phase 9`

## Phase 9 — Receipts + email (completed)

Branded templates, receipts, confirmation and reminder emails.

Wait for: `Proceed to Phase 10`

## Phase 10 — Admin dashboard (completed)

KPIs, charts, sales, rentals, customers, most-rented products.

Wait for: `Proceed to Phase 11`

## Phase 11 — Expenses (completed)

One-time and recurring expenses, categories, occurrences.

Wait for: `Proceed to Phase 12`

## Phase 12 — Cron automation (completed)

Recurring expense generation, reminders, overdue detection. Idempotent and secret-protected.

Wait for: `Proceed to Phase 13`

## Phase 13 — Reporting (completed)

Sales, expense, profit, rental, inventory, utilization reports. CSV export.

Wait for: `Proceed to Phase 14`

## Phase 14 — Polish (completed)

Motion, loading/empty/error states, mobile, accessibility, SEO, performance.

Wait for: `Proceed to Phase 15`

## Phase 15 — Production hardening (completed)

Full security, RLS, payment, cron, env, Vercel, Supabase, and Gmail SMTP review. All tests green.

Wait for: `Proceed to Phase 16`

## Phase 16 — Payment methods (completed)

Admin-configurable payment methods with QR image upload. Customers see active methods on checkout. Provider checkout and webhook confirmation stay unchanged.

Current published Privacy Policy is `JRY-PRIVACY-v1.0` (RA 10173-oriented). Current Terms & Conditions are `JRY-TC-v1.0`. Registration and Google finish-setup open Terms and Privacy in a modal; agreement is recorded only from I agree in that modal. Public `/terms` and `/privacy` pages stay for footer and SEO. Profile and waiver keep Terms, privacy acknowledgment, marketing opt-in, and the rental waiver as separate records.

Wait for: `Proceed to Phase 17`

## Phase 17 — Rental identity proof (completed)

Customers sign the waiver with name, email, and phone filled from their account. They then upload a government ID and a selfie holding that ID before payment. Files stay in `private-documents`. Admins review signed URLs on the rental. Payment is blocked until both the waiver and identity documents are present.

## Phase report template

After each phase:

```text
PHASE COMPLETED
Implemented:
Database changes:
API changes:
Security changes:
Tests:
Known issues:
Next phase:
```
