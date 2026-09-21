# Independent employer retirement eligibility

Admin payroll now has an employer retirement eligibility form under the selected participant retirement plan. Matching and nonelective findings have separate eligibility status, entry date and vested percentage, with an assessment-through date and evidence reference. The new API and migration 826 retain an immutable, employer-scoped revision history, separate from deferral eligibility and signed employee elections.

The source fingerprint binds the plan revision and employer formula, current onboarding cycle, hire date, employment status, termination date and retained employment periods. Changed sources mark earlier employer reviews stale. Reviewed employer contribution types must agree with the formula; unconfirmed findings have no entry date or vesting percentage. Eligible dates cannot precede the current hire/plan start or exceed the assessment date. Future assessment dates are rejected. Zero vesting is a valid explicit finding and does not reduce the employer obligation.

The API serializes reviews under the employer settings lock, retains exact request recovery, rejects stale competing revisions and audits each retained review atomically. Database constraints enforce scoped employee/plan/source identities and sequential revisions; updates and deletes are rejected. Existing employee eligibility/election records are untouched. A declined employee election does not prevent an independently reviewed nonelective employer finding.

## Assumptions and limits

- The administrator reviews actual plan service, entry and vesting requirements. No eligibility or vested percentage is inferred from an employee contribution election.
- Findings are assessed through a specific date. A later payroll or annual true-up must require evidence covering its relevant period; this review is not perpetual authorization.
- The source captures employment identity and periods, not automatic legal interpretation of service-hour, last-day or vesting clauses. Referenced external service evidence remains the administrator's responsibility. Applying those conditions to each funding period is still part of integration.
- Employer eligibility revisions must not force an employee to re-sign an unchanged deferral election. A genuine plan/deferral eligibility change continues to use the existing employee source rules.
- Matching and nonelective statuses are ELIGIBLE, NOT_ELIGIBLE or REVIEW_REQUIRED when that component applies. NOT_APPLICABLE is reserved for a component absent from the formula.
- Rejected validation can be corrected in the form. Uncertain saves retain the exact request for recovery before a different review is submitted.

## Verification

Two backend tests passed (`/tmp/payroll-employer-eligibility.log`, 2.6 seconds), including input/date/vesting validation, exact retry and changed-request conflict, cross-workplace denial, concurrent review conflict, append-only storage, stale employment evidence and matching audit counts. The integration fixture signs an actual synthetic DECLINE election and verifies the entire employee retirement response remains unchanged after employer reviews.

The built-app browser journey passed (1/1, 13.1 seconds including build/startup; `/tmp/payroll-employer-eligibility-browser.log`). It uses real isolated routes/database, corrects rejected 101% vesting to reviewed 0%, recovers a lost save response, retains one CURRENT review and leaves deferral-eligibility history untouched. The 390-pixel screenshot was inspected, with no horizontal overflow or page errors. TypeScript and whitespace checks passed.

No production employee or financial operation was performed. This is an internal review workflow, not activated employer funding. Period-specific source aggregation, ledger reservations, payroll statements/totals, accounting, provider remittance and exception handling remain unfinished. The full onboarding/payroll goal remains active.
