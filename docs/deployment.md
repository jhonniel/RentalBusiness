# Deployment

The application deploys to **Vercel** as a Nuxt 3 / Nitro app. Data, auth, and storage run on **Supabase**. Email uses **Gmail SMTP**.

## Environments

| Name | Purpose |
| --- | --- |
| Local | `.env` on the developer machine |
| Preview | Vercel preview deployments |
| Production | Vercel production + production Supabase project |

Never point a local or preview app at production service-role keys unless that is an explicit, temporary operations task.

## Required environment variables

Copy `.env.example`. Set these in the Vercel project settings:

**Public**

- `NUXT_PUBLIC_SITE_URL`
- `NUXT_PUBLIC_SUPABASE_URL`
- `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `NUXT_PUBLIC_SUPABASE_KEY` (same value; used by `@nuxtjs/supabase`)

**Server only**

- `SUPABASE_SERVICE_ROLE_KEY` / `NUXT_SUPABASE_SERVICE_ROLE_KEY`
- `SMTP_HOST` / `SMTP_PORT` (defaults: `smtp.gmail.com`, `587`)
- `SMTP_USER` / `NUXT_SMTP_USER`
- `SMTP_PASS` / `NUXT_SMTP_PASS` (Gmail App Password)
- `SMTP_FROM` / `NUXT_SMTP_FROM`
- `PAYMENT_PROVIDER_KEY` / `NUXT_PAYMENT_PROVIDER_KEY`
- `PAYMENT_WEBHOOK_SECRET` / `NUXT_PAYMENT_WEBHOOK_SECRET`
- `CRON_SECRET` / `NUXT_CRON_SECRET`
- `GROQ_API_KEY` / `NUXT_GROQ_API_KEY` (optional free Groq key; maintenance chat uses business knowledge without it)
- `GROQ_BASE_URL` / `GROQ_MODEL` (optional; defaults to Groq `llama-3.1-8b-instant`)

## Local

```bash
cp .env.example .env
npm install
npm run dev
```

Replace placeholder Supabase values before using authentication. Apply every file in `supabase/migrations/` in timestamp order. Run `supabase/seed.sql` only in development.

## Vercel

1. Import the Git repository.
2. Framework preset: Nuxt.
3. Node.js 20.19+ or 22.12+.
4. Add environment variables for preview and production.
5. Deploy.

`vercel.json` sets security headers and two daily cron paths (`/api/cron/daily` and `/api/cron/expire-pending`). Hobby rejects hourly cron expressions. Vercel auto-detects Nuxt 3.

Terms, Privacy, and Cookie Policy text live in `supabase/terms-jry-v1.txt`, `supabase/privacy-jry-v1.txt`, and `supabase/cookies-jry-v1.txt`. Nitro bundles those files from an absolute project path so `/api/terms/current`, `/api/privacy/current`, and `/api/cookie-policy/current` work on Vercel. Do not rely on `process.cwd()` at runtime.

Add every required variable in **Project → Settings → Environment Variables** for Production and Preview, then redeploy. `GET /api/health` reports `ready: false` until Supabase, service-role, cron, webhook, and SMTP values are present. Missing `NUXT_PUBLIC_SUPABASE_URL` / `NUXT_PUBLIC_SUPABASE_KEY` makes `@nuxtjs/supabase` throw on every SSR refresh (`Your project's URL and Key are required`). The app now boots with a rejected placeholder so the storefront still renders; catalog and sign-in stay unavailable until the real keys are set.

## Supabase

Apply all files in `supabase/migrations/` in order. Development seed: `supabase/seed.sql`.

Product photos, payment QR images, and maintenance images are uploaded through admin APIs into Supabase Storage (S3). Do not commit catalog photos to `public/`. Serve them from the public `product-images`, `payment-qr-images`, and `maintenance-images` buckets.

Add these Auth redirect URLs:

- `http://localhost:3000/confirm`
- `{NUXT_PUBLIC_SITE_URL}/confirm`

### Google sign-in

Enable the Google provider in Supabase Authentication. Create an OAuth client in Google Cloud (Web application) and set:

- Authorized JavaScript origins: `http://localhost:3000` and `{NUXT_PUBLIC_SITE_URL}`
- Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`

Paste the Google Client ID and Client Secret into the Supabase Google provider. Do not put those secrets in Nuxt or the browser. The app sends users to Google, then back to `/confirm` on the current origin.

Google sign-in also needs these dashboard values or the button will fail even when the app is correct:

1. Supabase → Authentication → Providers → Google: enabled, with the Google Client ID and Client Secret.
2. Supabase → Authentication → URL Configuration → Redirect URLs:
   - `http://localhost:3000/confirm`
   - `https://jryrentals.vercel.app/confirm`
   - any custom domain `/confirm`
3. Google Cloud OAuth client (Web application):
   - Authorized JavaScript origins: `http://localhost:3000` and `https://jryrentals.vercel.app`
   - Authorized redirect URI: `https://msmlarhbkhtkuripjpvl.supabase.co/auth/v1/callback`

`/confirm` is client-only so the Google PKCE code is exchanged in the browser, not during SSR.

Apply migrations with the Supabase CLI or SQL editor against the matching project. Do not edit production schemas by hand. Do not seed production.

## Gmail SMTP

Use a Google account with 2-Step Verification and an [App Password](https://myaccount.google.com/apppasswords). Do not store the normal Gmail password.

Phase 9 sends receipt confirmations and admin-triggered pickup/return reminders through `smtp.gmail.com`. `SMTP_FROM` should match `SMTP_USER` (or a Gmail Send mail as alias). Failed sends are stored on `email_logs` and do not undo a paid payment or issued receipt.

Signup confirmation mail is sent by the Nuxt API through the same Gmail SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). The server creates the Auth user with `generateLink` and sends a JRY-branded “Confirm my account” message. Do not rely on Supabase Auth to deliver that email.

Password-reset mail is still sent by Supabase Auth. In the Supabase dashboard, set Custom SMTP to the same Gmail host, port 587, user, and App Password if you want those messages to use Gmail too. Keep `http://localhost:3000/confirm` and `{NUXT_PUBLIC_SITE_URL}/confirm` in the Auth redirect allow list.

## Payments

The webhook URL is `{NUXT_PUBLIC_SITE_URL}/api/payments/webhook`. Send `x-lumen-payment-signature: sha256=<hmac-hex>` over the raw JSON body.

Customers pay by sending the rental total to the active bank or QR methods published in Admin → Payments. Those details come from `/api/payment-methods`. Do not send customers to `/payments/sandbox`. Set `PAYMENT_WEBHOOK_SECRET` before calling the webhook. `PAYMENT_PROVIDER` and `PAYMENT_PROVIDER_KEY` stay available for a future live adapter.

## Cron

`vercel.json` schedules two paths (Hobby limit):

- `/api/cron/daily` at `0 16 * * *` (midnight `Asia/Manila`, UTC+8) — keep Supabase awake every 3 days, expire unconfirmed requests, recurring expenses, reminders, overdue
- `/api/cron/expire-pending` at `0 4 * * *` (noon `Asia/Manila`) — `pending` requests older than 24 hours become `cancelled`

The individual `/api/cron/*` paths stay available for manual runs.

Vercel sends `Authorization: Bearer $CRON_SECRET`. Local or manual runs may use the same header or `x-cron-secret`. Missing or placeholder secrets return 503. Wrong secrets return 401. Jobs are idempotent and use the service-role client.

## Health

`GET /api/health` should return `status: ok` after each deploy. Treat `ready: true` as the production readiness check: Supabase, service-role, cron, webhook, and Gmail SMTP secrets must be set and must not contain `placeholder`. The `resendConfigured` flag is true when SMTP user, password, and from-address are set.

Vercel also sends HSTS and the shared security headers. The Nitro app adds CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and `Permissions-Policy` on every response.

## Checks before promoting a phase

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
```
