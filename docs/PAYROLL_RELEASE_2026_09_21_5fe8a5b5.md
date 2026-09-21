# Payroll release verification: 5fe8a5b5

Verified at 2026-09-21T22:30:40.199Z. The overall payroll/onboarding goal remains active and incomplete.

## Production deployment

- Application commit: `5fe8a5b5f8f795f577a1df9c8b165ca6708c54e3`, matching local `main` and `origin/main` at deployment.
- Vercel production deployment `dpl_7GFQGFsN7pDVvm7Frr9H3PLwJr2j` is READY and has the `vortexathletics.com` alias. The connector confirmed its exact commit.
- Render was still serving `28d0497a8542`. Deployed the exact tested commit through the signed-in dashboard under the user's existing publishing authorization.
- Render deployment `dep-daoqvb142hec73fr8um0` reported the service live. Public `/api/health` subsequently returned HTTP 200, status OK, release `5fe8a5b5f8f7`, database connected, secure payroll document storage ready, email configured, schema migration tracking present, and billing/access schema ready.
- Dashboard: https://dashboard.render.com/web/srv-d3vpuebipnbc739k9mv0/deploys/dep-daoqvb142hec73fr8um0

## Reported CORS failures

After the release became live, OPTIONS requests using origin `https://vortexathletics.com` and requested headers `authorization,content-type` returned HTTP 204, the exact allowed origin, and credentials enabled for all three reported endpoints:

| Endpoint | Requested method |
| --- | --- |
| `/api/admin/payroll/employees` | POST |
| `/api/admin/notifications` | GET |
| `/api/admin/billing/cancellation-requests?status=pending` | GET |

These checks do not create employees or establish that authenticated form submissions work. The retained machine-readable response is `/tmp/payroll-live-release-check.json`.

## Combined regression check

Ran all `backend/payroll/__tests__/retirementEmployer*.test.js` files together with `retirementContributionCalculation.test.js` on Node 22 against the isolated local PostgreSQL harness. Result: **29 passed, 0 failed, 0 skipped**, 3.47 seconds. Log: `/tmp/payroll-employer-release-validation.log`.

This is focused regression evidence, not a new full payroll suite result. Prior individual browser/API verification remains documented with each implementation increment.

## Limits and next implementation work

Render startup logs contained coaching-data migration warnings about missing source definitions. This was not a clean global migration audit. Public health confirms only the readiness fields above; it does not independently prove the contents of migration 826 or every payroll table. No real employee documents, invitations, payroll payments, provider writes, or QuickBooks writes were created for release verification.

Employer-funded payroll remains gated. The current ledger reserves employee deferrals only. Employer funding still needs source aggregation, dated partial-period allocation, compensation caps, annual true-up coverage, annual-limit reservations, statements, accounting, remittance, and provider exception handling. A complete real-hire production journey also remains unverified. Deployment does not remove these requirements.

Assumption: the previously granted authorization to publish all commits covers deploying this verified main-branch revision to the existing production services. No infrastructure plan, account permissions, or provider credentials were changed. The unrelated local `src/components/AdminAccess.tsx` edit was not included.
