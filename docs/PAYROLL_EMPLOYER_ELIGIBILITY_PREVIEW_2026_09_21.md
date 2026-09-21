# Employer eligibility bound to the payroll preview

The normal employer compensation preview now loads the saved pay period and the hiring administrator's latest employer eligibility review. Its period dates are read from the workplace's pay-period record, rather than accepted as request overrides. When refreshing an existing draft/review run, the requested period must also belong to that run.

For regular per-payroll formulas, the response retains the matching and nonelective eligibility findings independently, including entry dates and vesting evidence. The source fingerprint binds the compensation source, pay-period identity and date range, run kind, and eligibility review. A replacement review changes the fingerprint even if its findings are unchanged. Vesting does not reduce the compensation basis.

Missing, stale, insufficiently dated or unresolved reviews return actionable `REVIEW_REQUIRED` guidance alongside the available compensation preview. Entry inside the pay period still requires dated allocation. Database/programming errors are not converted to review findings. The ordinary payroll warning displays the reviewed component findings or the required corrective step.

## Assumptions and remaining work

- The hiring administrator's retained assessment is authoritative for the stated range; this does not independently infer eligibility from service hours or plan conditions.
- A regular pay period is the eligibility coverage unit only for a per-payroll formula. Annual true-ups require their full annual scope. Off-cycle payments need their actual earning-period assessment; the regular period is not silently substituted.
- `requiresEmployerEligibilityReview: false` means this pay-period review was resolved, not that a contribution is authorized. `requiresContributionCalculation`, `requiresApprovalReservation`, and `requiresPayrollIntegration` remain true.
- Employee deferrals, prior employer contributions, annual-additions capacity, approval reservations, statements, accounting and remittance are still required before employer funding can execute. This change has not yet been deployed and verified on Render.

## Verification

The isolated API test covers reviewed nonelective eligibility with zero vesting and no employee deferral election, missing reviews, insufficient assessment coverage, entry inside a period, renewed review fingerprints, stale employment sources, a mismatched run/period, off-cycle scope, and annual true-up scope. Payroll remains unapprovable and compensation remains unchanged by vesting. The initial fixture date preceded its claimed completed assessment; the future-assessment safeguard correctly rejected it. The fixture clock was moved after the completed period, without changing that production safeguard.

Final backend result: **17 passed, 0 failed, 0 skipped**, 6.87 seconds, including employer compensation, period resolution, regular payroll and off-cycle bonus (`/tmp/payroll-employer-eligibility-preview-final-tests.log`). Final browser verification is recorded below. No real employee or financial/provider operation occurred.

Final browser result: **1 passed**, 12.0 seconds including build/startup (`/tmp/payroll-employer-eligibility-preview-browser.log`). The actual 390px payroll preview showed both capped compensation and the missing eligibility action, with no page errors or horizontal overflow. Screenshot `/tmp/payroll-employer-compensation-preview-mobile.png` was inspected. Whitespace checks passed.
