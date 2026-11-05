# New Admin development and transition

## Start locally

Prerequisites: Node.js 20+, PostgreSQL on loopback, and installed root/backend dependencies (`npm ci` and `npm ci --prefix backend`). Your local PostgreSQL role must be able to create a database. The default role is your OS username. To use another local role, set `NEW_ADMIN_DATABASE_URL`, for example `postgresql://postgres:your-local-password@127.0.0.1:5432/vortex_new_admin_dev`.

From the repository root:

```sh
npm run new-admin:setup
npm run new-admin:serve
# In a second terminal:
npm run new-admin:ui
```

Open [the local application](http://localhost:5173), use the normal login with **admin2 / adminadmin**, and select **New Admin** in the portal dropdown. The isolated backend uses port 3101; the frontend command explicitly selects it. Existing Admin stays available in the same dropdown.

Setup is idempotent. It creates `vortex_new_admin_dev`, applies the administrative schema profile, and seeds 120 fictional households, 360 members, 24 classes, 240 enrollments, and 180 leads. Billing includes paid, unpaid, partial, failed, credit, and refunded examples. All payment/refund records are labeled simulated and have no live Stripe references. `admin2` uses bcrypt and canonical database roles; the seeded facility explicitly designates it as its local owner. Fictional household logins use `newadmin_parent_001` through `newadmin_parent_120` and the same development password.

The tools require development mode and explicit seed opt-in (provided by these npm commands). They reject remote hosts, non-dedicated database names, URL connection overrides, and enabled/live Stripe configuration. They never load repository `.env` credentials as their database target. The backend launcher clears saved service environment values, disables Stripe, email, and scheduled background jobs, and binds the isolated server to loopback. Do not copy this account, password, or launcher configuration into a deployed environment.

The administrative migration profile includes shared coaching foundation schema but excludes unrelated coaching exercise-research migrations. The existing general `--all` path currently fails on a fresh database at historical migration 566; this profile does not mark omitted migrations as applied and is **not a production deploy plan**. New Admin and existing administrative business workflows use the normal application server, routes, permissions, and ledger.

## Reset

Stop the local backend, then run:

```sh
npm run new-admin:reset
```

This explicitly recreates only the dedicated `vortex_new_admin_dev[_suffix]` database, removing its fictional data and any practice changes. It refuses remote/non-dedicated targets and does not forcibly terminate database sessions. Recreating the database avoids PostgreSQL's lock limit when dropping the application's many related schemas. To preserve practice data, use `pg_dump` before reset. Re-running `setup` preserves IDs and existing practice edits.

## Tests and measurements

```sh
npm run test:new-admin
NEW_ADMIN_TEST_DATABASE_URL=postgresql://localhost/vortex_new_admin_dev npm run test:new-admin
NEW_ADMIN_TEST_DATABASE_URL=postgresql://localhost/vortex_new_admin_dev \
  node --test backend/billing/__tests__/stripeCustomerProjection.postgres.test.js
npm run test:backend:billing
npm run new-admin:benchmark
```

The PostgreSQL tests use synthetic fixtures and remove their own data; use the dedicated local database. The browser benchmark is `scripts/new-admin-browser-benchmark.mjs`; its fixed-response baseline/after JSON files explicitly distinguish simulated transport from backend latency. See `new-admin-verification.md` for measured results and exact validation scope.

## Rehearse ownership migration

First review `new-admin-architecture.md` and `new-admin-stripe.md`. Migration 841 adds ownership and conversion metadata without rewriting identities; migration 840 adds a display-only processor projection. Existing canonical billing migration commands remain authoritative for any ledger adoption.

The ownership CLI deliberately supports loopback rehearsal databases only and never loads ambient production credentials:

```sh
export NEW_ADMIN_DATABASE_URL=postgresql://localhost/vortex_new_admin_dev
node backend/newAdmin/migrate.mjs --snapshot=/tmp/new-admin-before.json
node backend/newAdmin/migrate.mjs --facility=1
# After reviewing the dry-run IDs, apply the explicit mapping:
node backend/newAdmin/migrate.mjs --facility=1 --apply
node backend/newAdmin/migrate.mjs --snapshot=/tmp/new-admin-after.json
node backend/newAdmin/migrate.mjs --compare=/tmp/new-admin-before.json,/tmp/new-admin-after.json
```

With multiple facilities, supply reviewed `--lead-ids=1,2,3`; bulk inferred assignment is rejected. Unowned inquiries remain quarantined. Configure the existing public site's intended facility with `--public-facility=1` (dry run), then the same command plus `--apply`. This explicit ingress mapping is separate from historical backfill. The local seed sets its known fictional facility mapping. In a multi-site production deployment, resolve the source-to-facility map before enabling collection; never guess the first facility.

Apply returns a batch UUID. `--rollback=BATCH_UUID` restores only unconverted rows whose ownership and modification timestamp still match the batch. Concurrently edited or converted records are retained and listed for review. Conversion uses a separate authoritative `converted_member_id`; legacy `registrations.member_id` is an inferred analytics link and must not be used as conversion evidence.

Snapshots compare record counts, relationship/status/reference fingerprints, and account/currency financial sums. They intentionally exclude the new ownership metadata from invariant comparisons. Keep snapshots private: they can contain record IDs and account totals. Any differences caused by ongoing business writes must be reconciled against those writes; do not overwrite them to force equality.

## Production transition checklist

- Back up the target database and rehearse restoring it in a nonproduction environment.
- Review migration 840/841 and the target's current canonical identity/billing readiness. Use the existing release deployment migration command; the local profile is not a deploy command.
- Review unresolved relationship anomalies and explicit historical/public lead ownership mappings. Preserve all existing IDs, enrollment statuses, financial history, and Stripe references.
- Rehearse the exact production schema and representative sanitized records; compare snapshots and representative accounts before/after.
- Verify Stripe signing secrets and subscribed customer/payment-method events; run test-mode reconciliation and monitor projection/webhook failures.
- Validate scoped staff permissions, family/account changes, enrollment/price/cancellation/refund workflows, and measured latency at realistic production scale.
- Obtain explicit production deployment/cutover authorization. Roll back the UI to Admin while retaining additive schema and financial history if acceptance fails.
- Retire old Admin only after an agreed observation period and closure of remaining workflow/tenant findings.

No production deployment, live charge, hosted data mutation, destructive production migration, or production cutover is part of the completed local rehearsal.
