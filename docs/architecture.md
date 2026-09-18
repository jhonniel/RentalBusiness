# Architecture

JRY Rentals is a production rental management and booking platform.

**Current phase:** 17 — rental identity proof.

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | Nuxt 3, Vue 3, TypeScript | SSR where useful, typed pages |
| UI | Nuxt UI 3 + Tailwind CSS v4 | Lucide icons via Iconify. UI 4 requires Nuxt 4, so Phase 0 stays on UI 3. |
| Utilities | VueUse, Zod | Client and server validation |
| Backend data | Supabase (PostgreSQL, Auth, Storage, RLS) | Identity, catalog, rentals, finance, and platform tables are migrated. Admin catalog APIs write through repositories. Product photos, payment QR images, maintenance images, and other uploaded files live in Supabase Storage (S3). |
| Server API | Nuxt server routes / Nitro | Secure operations, webhooks, cron |
| Email | Gmail SMTP | Signup confirmation, receipt, and reminder templates. Signup confirmations are sent by the API, not by Supabase Auth. Sends are logged in `email_logs`. |
| Payments | Provider-agnostic module (`server/services/payments`) plus admin QR methods | Sandbox adapter in Phase 8. Webhooks verify HMAC before any status change. Admins upload QR images in Phase 16. |
| Hosting | Vercel | Cron at 16:00 UTC (midnight Asia/Manila) |

React is not used.

## Directory map

```text
assets/css/            Design tokens and global styles
components/            Presentational Vue components
composables/           Vue composition helpers
docs/                  Living architecture documentation
layouts/               Public, admin, auth, and blank shells
pages/                 File-based routes
plugins/               App-wide plugins (server error logging)
public/                Static files
server/api/            HTTP controllers
server/middleware/     Request context
server/plugins/        Nitro hooks
server/services/       Business logic
server/repositories/   Data access
server/utils/          Server-only helpers (HMAC, cron secret match, email hashes)
supabase/              Migrations and seeds
tests/                 Automated tests
types/                 Shared TypeScript contracts
utils/                 Isomorphic helpers (pricing, dates, errors)
```

## Request flow

Protected business operations follow:

`Route / API handler → Service or Action → Repository → Supabase / PostgreSQL`

- Controllers stay thin and coordinate validation, auth, and responses.
- Services own business rules (availability, pricing, rental transitions, waiver acceptance, payments, receipts, analytics, expenses, scheduled jobs, reports). A rental is created as `draft` only when those dates still have free stock after occupying rentals (`pending` and later). Moving it to `pending` requires a signed waiver and identity documents and is the step that occupies inventory. That submit also emails `contactmejry@gmail.com`. KPI math lives in `utils/analytics.ts`. Recurring dates live in `utils/expense.ts`. Cron due-date rules live in `utils/cron.ts`. Report totals and CSV live in `utils/report.ts`. Payment HMAC, cron secret matching, and email payload hashes live in `server/utils` so Node `crypto` never enters the browser bundle. Payment, receipt, and cron writes use the service-role client because customers cannot insert those rows.
- Repositories own queries. They never expose internal primary keys in public payloads.
- Vue components do not call Supabase service-role APIs or contain pricing/availability rules.

## Runtime boundaries

**Browser**

- Public Supabase URL and anon key only
- Session cookies managed by `@nuxtjs/supabase`
- No service-role key, SMTP password, payment secrets, or cron secrets

**Server**

- Service-role client (`getSupabaseAdminClient`) for privileged work
- Admin catalog writes (product info and prices) after `requireAdmin`
- Payment webhooks, email sends, cron jobs
- Structured JSON logs with redacted secrets

## Layouts

| Layout | Use |
| --- | --- |
| `default` | Public marketing and catalog |
| `admin` | Operations console (desktop sidebar, mobile drawer) |
| `auth` | Sign-in, register, password reset |
| `blank` | Isolated flows such as print receipts and the public maintenance page |

After sign-in, the app loads `profiles.role` from `GET /api/auth/me` and sends the account to its home: administrators open the operations console, customers open `/dashboard`. The header Account control uses the same home. Administrators who open `/dashboard` are redirected. Admin pages still use the `admin` middleware, which allows access only when the database role is `admin`. Do not trust a role value from the client.

When an administrator enables maintenance, visitors are sent to `/maintenance` and public storefront APIs return 503. The maintenance page shows the message plus up to three catalog kit images. Admins can still sign in and use `/admin`. Auth, health, cron, and payment webhook routes stay available.

## Design system

- Brand: JRY Rentals logo, charcoal and accent blue (`lumen` token scale)
- Neutral: Tailwind `stone`
- Type: Geist
- Currency display: PHP (`en-PH`)
- Business timezone: `Asia/Manila`
- Motion is short and disabled under `prefers-reduced-motion`
- Public catalog listing uses short SWR (`/products`). Product detail pages are not cached so admin price and info updates show immediately. Admin and account routes send `cache-control: private, no-store`
- Default Open Graph image is `/og.png`. Account, auth, and admin paths are `noindex, nofollow`
- `/robots.txt` and `/sitemap.xml` list public URLs only (home, catalog, about, privacy, terms, and active product slugs when Supabase is connected)
- Public pages include Open Graph, Twitter, canonical, and JSON-LD (`LocalBusiness`, `WebSite`, `HowTo`, `CollectionPage`, `AboutPage`, product `Offer`)
- Responses set `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, and a restrictive CSP. Vercel also sends HSTS.

## Error handling

- `AppError` carries a user-safe message, HTTP status, and stable code.
- `toClientError` strips stack traces and database details.
- Server logs use `server/utils/logger.ts` and never print secrets.
- `error.vue` renders friendly 404 and 5xx pages.

## Environment

See `.env.example`. Nuxt maps `NUXT_*` variables onto `runtimeConfig`. Public keys use `NUXT_PUBLIC_*`.

## Related documents

- [Database schema](./database-schema.md)
- [API](./api.md)
- [Security](./security.md)
- [Deployment](./deployment.md)
- [Phases](./phases.md)
