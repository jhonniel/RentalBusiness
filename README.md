# JRY Rentals — Equipment booking platform

Production rental management and online booking platform for cameras, drones, Starlink units, and production equipment.

**Stack:** Nuxt 3 · Vue 3 · TypeScript · Nuxt UI · Tailwind CSS · Supabase · Vercel · Gmail SMTP

**Current phase:** 16 — payment methods. Apply all `supabase/migrations` files, then `supabase/seed.sql` in development only. Set `CRON_SECRET` before invoking `/api/cron/*`. `GET /api/health` reports `ready` only when production secrets are present.

## Documentation

- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [API](docs/api.md)
- [Security](docs/security.md)
- [Deployment](docs/deployment.md)
- [Phases](docs/phases.md)

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin shell: [http://localhost:3000/admin](http://localhost:3000/admin).

Replace placeholder Supabase values in `.env`, apply every migration in `supabase/migrations/`, then run `supabase/seed.sql` in development. Promote an admin with the SQL in `supabase/README.md`.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
```
