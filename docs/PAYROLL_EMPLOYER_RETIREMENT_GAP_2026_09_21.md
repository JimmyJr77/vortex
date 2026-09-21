# Employer retirement funding: verified execution gap

## Finding and immediate correction

Plan setup retains MATCH, NONELECTIVE, MATCH_AND_NONELECTIVE and UNRESOLVED employer contribution terms as text. The employee contribution calculator previously accepted these plans and returned only employee deferrals. A new regression reproduced that omission on the original implementation (four existing tests passed; the new assertion failed because no exception was thrown).

The calculator now rejects employer-funded or unresolved plans until their funding is integrated. Processing review GET exposes the execution issue; a new REVIEWED approval is rejected, while suspension remains available. The admin page displays the issue before the review controls. The guard also covers signed DECLINE elections: declining employee deferrals does not establish that no employer contribution is owed. Existing explicit NONE plans retain their behavior. Already-retained processing review history is preserved; the calculator checks plan terms again during execution.

This is an omission-prevention fix, not completed employer-contribution support. It can block payroll for affected plans that previously produced incomplete employee-only calculations. The system must not recommend changing actual employer terms to NONE to bypass it.

## Required implementation still open

1. Add structured, reviewed employer formulas alongside retained plan evidence: matching tiers, nonelective rate, compensation definition, effective period, eligibility, catch-up matching treatment, true-up basis and vesting. Preserve legacy fingerprints when the new evidence is absent.
2. Compute employer amounts from actual eligible payroll and employee deferrals. Model per-pay versus annual true-up explicitly; do not infer a formula from free text or silently truncate an employer obligation when a limit is reached.
3. Extend retirementInternalBalances and immutable run ledger validation to reserve employer annual additions with ordinary employee deferrals. Catch-up amounts need distinct treatment. Concurrency and cancellation/reapproval must reconcile retained reservations.
4. Add employer expense/liability accounting and employee-facing contribution statements without deducting employer amounts from employee net pay. Reconcile QuickBooks mappings and retained journal evidence.
5. Extend remittance preview, funding totals, allocation delivery, receipts, returns and replacement flows with separate employer contribution types. Current allocation and statement records are employee-deferral-only.
6. Verify no-deferral participants, combined match/nonelective contributions, cap crossings, catch-up, compensation changes, leave cashouts, termination/rehire, lost responses, concurrent payroll approvals, corrections and annual reporting. Remove the execution guard only once the complete path retains and reconciles employer amounts.

## Sources and assumptions

IRS guidance distinguishes employer matching and nonelective contributions and includes employer amounts in combined annual additions. The 2026 annual-additions dollar ceiling is $72,000 and annual compensation ceiling is $360,000; the applicable compensation limit and plan terms still need to be evaluated. No new tax formula is implemented by this patch.

- https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-401k-and-profit-sharing-plan-contribution-limits
- https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions
- https://www.irs.gov/retirement-plans/401k-plans-deferrals-and-matching-when-compensation-exceeds-the-annual-limit

Assumption: textual plan review is insufficient evidence of implemented payroll, accounting or provider behavior. Unknown employer funding is not zero. Suspension remains an allowed administrative action. The broader payroll goal remains active.

## Verification

- 10/10 contribution, plan-input and processing-review unit tests passed: `/tmp/payroll-employer-omission-unit.log`.
- 2/2 isolated backend tests passed, including all four employer-funding states, rejected approvals retaining no review, allowed suspension and unaffected NONE processing: `/tmp/payroll-employer-processing-api-final.log`.
- An initial API fixture expected HTTP 201 for plan creation; the established endpoint returns 200. The fixture was corrected; runtime semantics were unchanged.
- 2/2 built-app browser journeys passed in 14.4 seconds including build/startup: `/tmp/payroll-employer-processing-browser.log`. Tests exercised real isolated API/database routes, review retry, draft preservation, visible employer-funding issue and suspension.
- TypeScript and whitespace checks passed. The 390-pixel screenshot was inspected; no horizontal overflow or page errors occurred: `/tmp/payroll-employer-processing-mobile.png`.
- No production financial operation or real employee record was created. Deployment is not established by these local tests.
