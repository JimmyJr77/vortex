# Employer compensation source and annual allocation

The internal employer compensation service now loads the latest scoped plan and annual evidence, enumerates the employee's approved/finalized 2026 payroll, and passes every non-reimbursement payroll through the retained payroll/ledger/statement reconciler. Request-body wage, plan, annual-balance and calculated-amount overrides are not accepted. Missing retirement evidence in any included payroll requires reconciliation.

The reducer applies the employer formula's compensation categories independently of the employee deferral definition. It adds the explicitly reviewed external employer compensation balance and allocates the annual compensation cap in payment-date/run-ID order. Exact numeric ID ordering avoids lexicographic and floating-point errors. It retains raw and capped amounts, original source fingerprints, current plan/annual fingerprints, and allocation policy. The outer service also binds the current revision IDs.

## Rules and assumptions

- This implementation covers the retained 2026 standard 401(k) model. The compensation limit is $360,000, checked against the [IRS contribution limits page](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contribution-limits). Employer matching uses compensation subject to the cap even when the employee's reviewed deferral policy permits continued deferrals; see [IRS matching and compensation guidance](https://www.irs.gov/retirement-plans/401k-plans-deferrals-and-matching-when-compensation-exceeds-the-annual-limit).
- External employer compensation excludes application payroll, as required by the annual evidence workflow. It is not inferred from external employee-deferral compensation. Missing employer facts are unresolved, not zero.
- Salary-covered leave needs a dated allocation when the employer formula treats regular wages and paid leave differently. Identical category treatment is unambiguous.
- A changed plan fingerprint across retained payroll requires explicit reconciliation. This service does not retroactively apply new plan terms to old payroll.
- A target earlier than another approved/finalized payroll is rejected because applying the cap could displace a later allocation. Backdated amendment/reallocation support remains unfinished.
- The caller must use repeatable-read for previews or the employer settings lock for writes. Eligibility, annual true-up period coverage, unused PTO treatment, and provider authorization remain separate requirements. Capped compensation is not a participant eligibility decision.

## Verification and remaining integration

Focused tests cover different employer/employee compensation definitions, external balances, cap boundaries, exact ordering, ambiguous salary leave, duplicate/mixed/stale/malformed sources, unknown balances, overflow and source fingerprint changes. Actual isolated database tests cover the existing payroll source reconciler and the new service's refusal of employee-only plans and cross-workplace access, including forged request overrides. The complete new service's successful employer-funded path is not yet proven against an operational payroll producer because that producer remains gated.

No UI or production execution path calls this new source service yet. It must be composed with employer eligibility, prior employer balances and annual-additions capacity, then attached to approval reservations, statements, accounting and remittance. The payroll execution safeguard remains in place. No real employee or provider operations occurred.

Final focused result: **19 passed, 0 failed, 0 skipped**, 2.45 seconds, including a composition case that passes capped compensation into the exact employer contribution calculator. Log: `/tmp/payroll-employer-compensation-validation.log`. Whitespace checks passed. No browser test was needed for this backend-only internal increment.
