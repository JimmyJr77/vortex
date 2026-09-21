# Employer contribution reservations

Migration 827 adds an append-only employer contribution ledger with separate matching and nonelective cents, one entry per payroll/employee/plan, exact approved snapshot binding, workplace scope and retained employee-deferral prerequisites. Payroll initialization and the isolated harness both apply the migration.

The internal retention service locks employer settings and payroll, reloads current retained plan/annual sources, reconciles approved wages and employee deferrals, checks dated employer eligibility, and recalculates the formula against remaining annual capacity. It rejects unresolved calculations, changed evidence, duplicate employee/plan entries and prior payroll lacking employer reservations. Exact retries reuse the retained entry. The database independently rejects preview/unintegrated records, changed contribution amounts, missing approved snapshots and updates/deletes.

Annual employee-deferral calculations now include approved/finalized employer reservations in annual additions. Employer amounts do not increase employee deferrals or compensation. Voided runs stop consuming capacity while their immutable entries remain retained; exclusion of a recalculated run applies to both employee and employer reservations.

## Scope and assumptions

This is the internal reservation boundary, not activation of employer-funded payroll. The regular payroll producer still blocks employer plans. The internal service is not an API route and is not yet called by production approval; statements, employer expense/liability accounting and remittance integration remain necessary before that gate can be removed.

The first internal reservation covers PER_PAYROLL regular payroll only. Its prior matching/nonelective reservation for that exact payroll is zero; an existing internal reservation is reused rather than offset and inserted again. This does not establish that an external payment was never made against that payroll. External current-payroll funding and corrections need explicit reconciliation before activation. Annual true-up and off-cycle reservations are rejected. Existing external annual additions already include externally reported employer funding and are not counted twice.

## Verification

53 backend tests passed, zero failed or skipped, in 9.05 seconds. Log: `/tmp/payroll-employer-ledger-regression.log`. Includes employer preview/source/calculation tests, annual capacity, employee contributions, regular retirement payroll and both ledgers.

The new database test uses real onboarding APIs, signed employee elections and the payroll engine, then explicitly simulates the pending approved employer producer inside the isolated fixture. It verifies $14 employee deferrals, $6 matching and $4 nonelective reservations; shared annual additions of $24; $200 compensation counted once; rejection of preview/unintegrated and altered-source evidence; idempotent and concurrent retries; run exclusion; workplace isolation; append-only SQL guards; and zero active annual usage after void with preserved ledger history. It does not claim that the public employer approval flow is enabled. No production employee, contribution, remittance or accounting entry was created. No frontend changes or browser run were part of this increment.
