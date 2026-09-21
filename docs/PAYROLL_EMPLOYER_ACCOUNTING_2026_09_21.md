# Employer retirement accounting

Employer matching and nonelective reservations now produce separate balanced expense debits and retirement-payable credits. Employee deductions, other deductions and payroll clearing remain unchanged. Direct QuickBooks sync, CSV export and original-journal settlement verification check exact retained employer ledger evidence, including detecting a snapshot that omits a reservation.

QuickBooks mapping includes an optional employer retirement expense account. Provider verification requires an active USD-compatible Expense account separate from the existing mappings. Older clients preserve an existing optional mapping when they omit it; explicit clearing removes it. CSV mapping stores a separate employer expense account name through migration 828. Both choices appear in Reports & QuickBooks. Employer contributions cannot be exported without the separate mapping.

## Verification

17 backend tests passed, zero failed/skipped, in 7.52 seconds (`/tmp/payroll-employer-accounting-final-tests.log`). Tests cover balanced employer expense/liability entries without reducing net pay, rejected preview or inconsistent calculations, retained-ledger matching, omitted contributions, provider mapping type/currency/activity validation, old-client preservation and clearing, and actual API CSV rejection/success. Existing retirement settlement tests passed alongside the changes.

One browser test passed in 13.0 seconds including build/startup (`/tmp/payroll-employer-accounting-browser.log`). It saves both direct-sync account IDs and both CSV account names using the actual local APIs with synthetic QuickBooks responses. Mobile screenshot `/tmp/payroll-retirement-accounting-mobile.png` was inspected; no page errors or horizontal overflow occurred. TypeScript build checks and whitespace checks passed. React review found no new hooks, subscriptions or request loops; new fields reuse the existing controlled, labeled form controls.

## Remaining boundary and assumptions

Employer-funded payroll approval is still gated. The test fixture explicitly simulates the pending integrated producer; this work does not enable public employer payroll approval. Statements, remittance allocations, external current-payroll funding reconciliation and final producer integration remain necessary. A balanced journal is not evidence of a paid contribution. Matching and nonelective liabilities share the reviewed retirement-payable account, with separate descriptions; employer costs have their own expense account. No real provider writes, employee records or payments were created. Deployment of migrations 827/828 and these code changes is not yet verified.
