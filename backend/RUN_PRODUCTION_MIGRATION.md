# Production Migration Runbook (Render)

## 1) Preconditions

- Confirm latest code is deployed to backend service.
- Ensure `DATABASE_URL` is set.
- Ensure `backend/run-migration.js` includes migration ledger support (`schema_migrations`).
- Take a database backup/snapshot before applying migrations.

## 2) Run Migrations (Preferred)

Use Render Shell in the deployed backend service:

```bash
cd backend
npm run migrate:all
```

To run a single file:

```bash
cd backend
npm run migrate 010_launch_payment_reconciliation.sql
```

## 3) Post-Run Verification

Run these checks in psql:

```sql
SELECT filename, applied_at
FROM schema_migrations
ORDER BY applied_at DESC
LIMIT 20;

SELECT status, dbConnected, "schemaMigrationsTracked"
FROM (
  SELECT
    'use /api/health in app logs' AS status,
    true AS dbConnected,
    true AS "schemaMigrationsTracked"
) t;
```

Then hit backend health endpoint:

```bash
curl https://<your-backend-domain>/api/health
```

Expect:
- `status: "OK"`
- `dbConnected: true`
- `schemaMigrationsTracked: true`

## 4) Rollback Guidance

- If migration fails before commit, nothing is applied.
- If a migration has committed and caused issues:
  - deploy previous backend version
  - restore database snapshot
  - create a forward-fix migration before retrying production

## 5) Security Notes

- Do **not** expose migration endpoints publicly.
- Keep `ENABLE_MIGRATION_ENDPOINT=false` in production.
- Never rely on temporary API migration paths for normal releases.

