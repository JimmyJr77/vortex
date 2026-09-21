# Employer retirement contributions on pay statements

Retained retirement statement summaries now include matching and nonelective amounts from integrated employer calculations, without private source references or review evidence. Employer contribution rows are separate from earnings, employee deductions, taxes and the net-pay sum. The PDF places them in an informational section after net pay and states that they are not deductions or confirmation of a retirement-account deposit.

Statement generation rejects preview/unintegrated employer calculations, missing matching employee plan evidence, inconsistent amounts and duplicate plan identities. Finalization checks the exact employer reservation ledger before retaining employee statements. Existing employee-only statement summaries keep their original shape.

## Verification

Nine backend tests passed, zero failures/skips, in 4.88 seconds (`/tmp/payroll-employer-statement-final-tests.log`). Coverage includes statement summary/amount validation, unchanged net pay, omission of private references, actual employee PDF download and download audit, employee retirement finalization, employer ledger and retained payroll sources.

The employer ledger fixture explicitly simulates the pending integrated producer in the isolated database. It retains a finalized statement and downloads it through the employee-authenticated route. This does not prove that public employer payroll approval is enabled.

Generated `/tmp/payroll-employer-retirement-statement.pdf` and rendered both pages with Poppler. Both page images were inspected: readable amount columns, no clipping or overlaps, separate employer section and correct page numbering. The sample shows $673.50 net pay plus informational $30 matching / $20 nonelective employer contributions. Rendering completed despite local Fontconfig cache warnings. Whitespace checks passed. No production documents or employee records were created.

## Remaining work

Employer payroll approval remains gated pending remittance allocations, external current-payroll funding reconciliation, complete producer integration and end-to-end verification. These statement amounts describe retained contributions, not provider acceptance, payment or vesting. Deployment of this increment is not yet verified. Existing-account onboarding, schedules, time, leave, compliance and provider exception coverage remain part of the original full goal.
