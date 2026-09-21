# Employer contribution receipt reconciliation

Provider receipt contracts now support separate employer matching and nonelective columns alongside the employee contribution categories. Both employer columns and an explicit employer-category confirmation are required. The retained receipt contract must match the current allocation format; a format change invalidates the previous contract until reviewed again.

Reconciliation compares each category against the original allocation. A provider cannot move matching into nonelective contributions while preserving the overall total. Partial posting, unreported amounts, cumulative updates, regressions and explicitly reviewed full reversals include the employer amounts. Receipt evolution rejects missing employer categories or changes between employee-only and employer-inclusive evidence. Employee-only receipt contracts remain compatible.

## Verification

34 targeted tests passed, zero failures or skips, in 28.65 seconds using Node 22 and the isolated local payroll database. Evidence: `/tmp/payroll-employer-receipt-final-tests.log`. The run covered allocation receipts, all receipt contract/recovery suites, and allocation files.

New cases cover a $24 allocation ($14 employee, $6 matching, $4 nonelective), partial posting, category redistribution, same-timestamp conflicts, later regressions, reviewed reversals, missing confirmations and incompatible formats. Real contract API tests verify retention and concurrent idempotent retries. No actual provider delivery, payment, employee invitation or production hire was performed. No frontend changes were included.

## Assumptions and remaining work

Employer provider receipts report cumulative matching and nonelective amounts separately, with the same original file hash, participant identity and batch evidence required for employee contributions. This is a supported contract shape, not a claim that any provider has accepted it.

Employer remittance preparation remains gated until reviewed timing, payment authorization totals, delivery integration and the public contract UI support the complete flow. Public employer payroll approval also remains incomplete. These changes are not yet verified in production. The unrelated AdminAccess edit is excluded from this increment.
