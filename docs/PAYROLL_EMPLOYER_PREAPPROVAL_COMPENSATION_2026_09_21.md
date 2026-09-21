# Employer compensation before payroll approval

The normal payroll preview now calls the employer compensation source for employer-funded plans before attempting employee retirement deductions. This resolves the earlier dependency on an already-approved current run. It uses the existing engine's employee wages under the payroll caller's transaction; request-body wage, plan and annual-balance overrides are not used. No signed employee deferral election is required to preview employer compensation.

Existing approved/finalized payroll still comes from the retained payroll/ledger/statement reconciler. The current engine calculation is a separate `ENGINE_PAYROLL_INPUTS` / `PREVIEW` record. It cannot be substituted into the posted-record collection, and a proposed record is marked in the returned allocation. A new run sorts after retained runs paid on the same date. Existing draft/review runs use their actual numeric ID and must belong to the employee/workplace with the matching payment date. Approved, finalized and void runs cannot enter through this new pre-approval boundary.

The payroll response includes `employerCompensationPreview` with the capped amount, source and revision fingerprints, and `requiresApprovalReservation: true`. The existing warning display shows that amount and states that employer funding is not ready for approval and nothing has been reserved. Current payroll wages, withholding and take-home pay remain unchanged by this preview.

## Assumptions and remaining work

- The engine-owned employee preview is passed internally, before retirement deductions; no new endpoint accepts caller-supplied wage objects. Blocking engine warnings still prevent compensation classification.
- Unknown external balances, differing historical plan fingerprints, ambiguous salary leave, missing prior payroll evidence and backdated capacity displacement still require reconciliation.
- This is compensation evidence only. Matching/nonelective eligibility, actual employee deferrals, prior employer funding, annual-additions capacity and annual true-up coverage must still be composed to calculate an executable contribution.
- Employer funding remains blocked until approval reservations, statements, accounting, remittance and exception handling are integrated. The preview does not authorize a provider operation or prove a complete production payroll journey.

This supersedes the earlier statement in `PAYROLL_EMPLOYER_COMPENSATION_2026_09_21.md` that no production execution path calls the compensation module: the regular/off-cycle-bonus preview producer now calls its new pre-approval entry point. The retained approved-payroll source entry point remains separate. This implementation has not yet been deployed and verified on Render.

## Verification

Final backend regression: **25 passed, 0 failed, 0 skipped**, 16.19 seconds, covering preview source/cap cases, payroll candidate discovery, retained source reconciliation, regular payroll, bonuses and PTO (`/tmp/payroll-employer-preview-final-validation.log`). The real isolated API case verifies successful employer compensation with no employee election, ignored request-body overrides, unchanged net pay, no ledger reservation, draft/review refresh, rejected approval, mismatched payment date, missing/cross-workplace employee or run, blocking engine warnings, and a void run.

Mobile browser: **1 passed**, 14.1 seconds including build/startup (`/tmp/payroll-employer-compensation-preview-browser.log`). The actual payroll page displayed $100 of capped compensation from $200 of synthetic engine wages, with no reserved contribution. No page errors or horizontal overflow occurred at 390px. Screenshot `/tmp/payroll-employer-compensation-preview-mobile.png` was inspected. The build reported existing chunk-size and browser-database age warnings. Whitespace checks passed. No real employee, invitation, payment or provider record was created.
