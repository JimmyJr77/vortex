# Accounting overview

New Admin → **Accounting** is the facility-wide view of customer bills and payments. **Billing** remains the household workspace for operational actions. Accounting reports are read-only and use the existing PostgreSQL ledger; opening or exporting a report never contacts Stripe or collects money.

## Working with the report

- **Bills & line items** shows the person, household, class, description, posting date, billed value, payments applied, credits applied, and remaining open amount. Linked adjustments appear in the line detail and are included once in its current value.
- **Payments & refunds** shows actual dated household cash events, their method/status, and allocations. Open an entry to inspect the bill lines it paid and its refund history.
- Filter by an inclusive date range, person, class, free-text search, and bill/payment status. All dates is the default so older open bills stay visible. Sorting and pagination run on the server.
- The bill date basis is either **Bill date** (posting date) or **Payment date** (a receipt that paid the bill). A payment-date selection still shows the selected bill's current lifetime allocations and balance. Use the payments view to total cash received or refunded within a date range.
- Summary cards cover the complete filtered result, not just the displayed page. Export CSV uses the same filters and sorting. Exports larger than 10,000 rows require narrower filters; they are never silently truncated.
- Open a household from a report to use the existing account billing actions. Returning to Accounting refreshes current ledger values.

## Financial definitions

Each report line is a canonical charge, with direct and unambiguous linked corrections folded into it. An invoice header is a presentation of those charges, not another financial amount. Duplicate invoice versions therefore do not inflate the report. Archived members/classes and missing source records do not remove financial rows; unresolved descriptions remain visible.

**Payments applied** are settled receipt allocations minus allocation reversals. **Credits applied** are separate from cash. A bill's **open amount** is its remaining allocation requirement; it is not a household's net account balance. Unapplied household cash can coexist with an open bill until it is allocated. Retired/recalled ledger history remains visible without being offered as an open collection obligation.

Payments can cover multiple people and classes. A filtered payment report preserves the full household receipt and separately reports the amount allocated to the matching bills. It does not assign unapplied cash, or an unattributed household refund, to a particular child or class. Refund events are distinct from payments and only settled events contribute to cash totals.

The application currently uses USD. Date boundaries and timestamps follow the facility timezone. The schema has no authoritative bill due date, so this report does not invent overdue classifications. These are current operational receivables reports, not historical balance snapshots or a general ledger of payroll, business expenses, and bank accounts.

## Access and implementation

All `/api/admin/accounting/*` endpoints require canonical `billing.view` permission and the authenticated facility. Scope is anchored through the billing account's family, with descriptive relationships joined separately. There is no client-supplied facility override. Detail and CSV endpoints enforce the same boundary as list views.

The implementation lives in `backend/billing/accountingReport.js`, `backend/billing/accountingRoutes.js`, and `src/components/newAdmin/accounting/`, with the portal entry in `src/components/newAdmin/NewAdmin.tsx`. It adds no database migration or competing accounting tables.

Run the normal billing suite for unit/regression coverage. Real PostgreSQL accounting fixtures use the dedicated development database:

```sh
NEW_ADMIN_TEST_DATABASE_URL=postgresql://localhost/vortex_new_admin_dev \
  node --test backend/billing/__tests__/accountingReport.postgres.test.js

# With npm run new-admin:serve running:
node scripts/verify-accounting.mjs
```

The live API check uses the fictional `admin2` account and writes `docs/accounting-api-verification.json`.

## Verification — November 1, 2026

- Accounting unit/route/CSV tests: 6 passed. Independent PostgreSQL fixtures: 11 passed, zero skipped. These cover split payments, credits, refund reversals, historical and archived class attribution, tenant boundaries, inclusive DST dates, and the 10,000-row export limit. The PostgreSQL tests use temporary tables and rollback.
- Billing regression suite: 1,038 passed, 18 skipped, zero failures. Database-dependent tests were not enabled in that broad run; the accounting PostgreSQL tests were run separately. The final grouped-query optimization was rechecked with all 17 accounting tests.
- Live API verification: 10 checks passed against the isolated development database, with 162 bill lines and 101 payment/refund events. Measured JSON requests took 5.53–41.14 ms locally; these small fictional-data measurements are not a production capacity benchmark.
- Browser verification: filters, sorting, pagination, bill/payment histories, refunds, date validation, CSV completion, account drilldown, retained report filters, and responsive layouts passed. See `docs/accounting-ui-verification.json` for the observed examples.
- TypeScript project build, Vite production build, targeted frontend ESLint, and whitespace checks passed. The existing build still reports large unrelated chunks and outdated browser compatibility metadata.

The local app is running at `http://localhost:5173/`, using the isolated backend on port 3101. This feature has not been deployed to production. It requires no schema migration and makes no financial mutations.
