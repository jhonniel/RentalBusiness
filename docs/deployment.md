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

`vercel.json` sets security headers and one daily cron path (`/api/cron/daily`). Vercel auto-detects Nuxt 3.

Terms and Privacy text live in `supabase/terms-jry-v1.txt` and `supabase/privacy-jry-v1.txt`. Nitro bundles those files as server assets so `/api/terms/current` and `/api/privacy/current` work on Vercel. Do not read them from `process.cwd()` at runtime.

Add every required variable in **Project → Settings → Environment Variables** for Production and Preview, then redeploy. `GET /api/health` reports `ready: false` until Supabase, service-role, cron, webhook, and SMTP values are present. Missing `NUXT_PUBLIC_SUPABASE_URL` / `NUXT_PUBLIC_SUPABASE_KEY` makes `@nuxtjs/supabase` throw on every SSR refresh (`Your project's URL and Key are required`). The app now boots with a rejected placeholder so the storefront still renders; catalog and sign-in stay unavailable until the real keys are set.

## Supabase

Apply all files in `supabase/migrations/` in order. Development seed: `supabase/seed.sql`.

Product photos and payment QR images are uploaded through admin APIs into Supabase Storage (S3). Do not commit catalog photos to `public/`. Serve them from the public `product-images` and `payment-qr-images` buckets.

Add these Auth redirect URLs:

- `http://localhost:3000/confirm`
- `{NUXT_PUBLIC_SITE_URL}/confirm`

### Google sign-in

Enable the Google provider in Supabase Authentication. Create an OAuth client in Google Cloud (Web application) and set:

- Authorized JavaScript origins: `http://localhost:3000` and `{NUXT_PUBLIC_SITE_URL}`
- Authorized redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`

Paste the Google Client ID and Client Secret into the Supabase Google provider. Do not put those secrets in Nuxt or the browser. The app only calls `signInWithOAuth({ provider: 'google' })` with the public site URL as `redirectTo`.

Apply migrations with the Supabase CLI or SQL editor against the matching project. Do not edit production schemas by hand. Do not seed production.

## Gmail SMTP

Use a Google account with 2-Step Verification and an [App Password](https://myaccount.google.com/apppasswords). Do not store the normal Gmail password.

Phase 9 sends receipt confirmations and admin-triggered pickup/return reminders through `smtp.gmail.com`. `SMTP_FROM` should match `SMTP_USER` (or a Gmail Send mail as alias). Failed sends are stored on `email_logs` and do not undo a paid payment or issued receipt.

Signup confirmation mail is sent by the Nuxt API through the same Gmail SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`). The server creates the Auth user with `generateLink` and sends a JRY-branded “Confirm my account” message. Do not rely on Supabase Auth to deliver that email.

Password-reset mail is still sent by Supabase Auth. In the Supabase dashboard, set Custom SMTP to the same Gmail host, port 587, user, and App Password if you want those messages to use Gmail too. Keep `http://localhost:3000/confirm` and `{NUXT_PUBLIC_SITE_URL}/confirm` in the Auth redirect allow list.

## Payments

The webhook URL is `{NUXT_PUBLIC_SITE_URL}/api/payments/webhook`. Send `x-lumen-payment-signature: sha256=<hmac-hex>` over the raw JSON body.

Phase 8 uses the `sandbox` provider by default (`PAYMENT_PROVIDER=sandbox`). Hosted checkout is `/payments/sandbox`. Set `PAYMENT_WEBHOOK_SECRET` before calling the webhook. `PAYMENT_PROVIDER_KEY` is reserved for a future live adapter.

## Cron

`vercel.json` schedules one path at `0 16 * * *` (midnight `Asia/Manila`, UTC+8):

- `/api/cron/daily` — recurring expenses, pickup/return reminders, then overdue detection

The three individual `/api/cron/*` paths stay available for manual runs. A Hobby project can register at most two cron jobs; three separate daily entries made the production deploy fail before a build started.

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
