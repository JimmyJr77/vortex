# Employer eligibility applied to contribution periods

Employer eligibility reviews now state an explicit assessment start and end. The server-side period reader loads the latest scoped review and current plan/employment source itself. It rejects missing or stale reviews, reviews without an assessment start, unresolved contribution findings, periods outside the reviewed range and periods crossing an eligible entry date. Periods wholly before entry are ineligible; periods beginning on or after entry retain the reviewed component eligibility.

Matching and nonelective eligibility are now required, independent inputs to the internal employer contribution calculator. A participant may qualify for one component and not the other. An ineligible component creates no new obligation, while the existing prior-funding reconciliation still detects overfunding. Vesting percentages remain retained evidence and never multiply or reduce the employer contribution.

## Assumptions and remaining work

Assessment ranges are explicit administrative findings within the current employment cycle. They do not prove actual service conditions independently of the referenced review. Mid-period entry requires dated wage/deferral allocation, which is still unfinished; a whole-period approximation is not used. A period fingerprint binds the review identity, source, date range and separate findings. The caller must still bind that fingerprint to the wage, employer-balance and capacity sources before authorizing a contribution.

Legacy employer reviews without a start date remain readable but cannot establish period coverage. The administrator must record a new review with the applicable range. Employee deferral elections remain unchanged by employer eligibility revisions.

The broader execution work remains: source aggregation, partial-period wages, annual true-up source coverage, ledger reservations, payroll statements, accounting, remittance and provider exception handling. Employer-funded payroll remains gated and the full goal remains active.

## Verification

Fourteen tests passed across employer calculation, period resolution and real isolated eligibility APIs (`/tmp/payroll-employer-period-tests.log`, 2.21 seconds, no failures or skips). They cover independent component eligibility, zero vesting, assessed-range coverage, legacy/missing/stale sources, before/after/mid-period entry, unresolved findings, revision/period fingerprints and the existing review/election invariants. TypeScript and whitespace checks passed. Final browser verification is recorded below.

Final browser result: 1/1 passed in 12.7 seconds including build/startup (`/tmp/payroll-employer-period-final-browser.log`). The actual form retains both assessment dates, permits correction of invalid vesting and recovers a lost save without duplication. The final case removes the backend date-range capability and verifies that the review editor is withheld with an update explanation; older servers cannot silently discard the range through this UI. The 390-pixel screenshot was inspected and no page errors or horizontal overflow occurred. Final TypeScript compilation passed. No live employee, bank or provider operation was performed.
