# Staging Deployment Guide

## Purpose

Keep a pre-production environment that mirrors production behavior for:

- migration rehearsal
- billing/waiver/account workflow validation
- regression checks before release

## Recommended Setup

- Create a separate Render backend service: `vortex-backend-staging`
- Create a separate Render Postgres database: `vortex-db-staging`
- Configure staging env vars independently from production:
  - `NODE_ENV=production`
  - `DATABASE_URL=<staging-db-url>`
  - `JWT_SECRET=<staging-secret>`
  - `FRONTEND_URL=<staging-frontend-url>`
  - `PAYMENTS_PROVIDER=external`
  - `STRIPE_ENABLED=false`
  - `ENABLE_MIGRATION_ENDPOINT=false`

## Deploy Process

1. Deploy branch to staging backend.
2. Run migrations on staging (one command, works on fresh or existing DBs):
   ```bash
   cd backend
   DATABASE_URL='<external-or-internal-postgres-url>' npm run migrate:all
   ```
   Notes:
   - Render/external Postgres URLs auto-enable SSL (or set `NODE_ENV=production`).
   - Fresh databases get legacy stub tables + runtime schema compatibility automatically.
   - Re-running is safe; applied files are tracked in `schema_migrations`.
3. Verify:
   - `GET /api/health` returns `status=OK`
   - critical flows: login, member family ops, billing statements, waiver signing, coach roster

## Release Gate

A release is ready for production only if staging passes:

- migration run + rollback plan reviewed
- launch smoke checks
- manual business workflow rehearsal
