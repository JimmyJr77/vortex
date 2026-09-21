# Employer contribution timing evidence

Timing reviews can now retain explicit evidence that matching and nonelective contributions follow the reviewed payroll deposit schedule. The optional employerFunding object requires schedule WITH_PAYROLL, confirmation, and a separate reference. Existing employee-only timing reviews do not imply this confirmation.

Positive employer remittance sources require this evidence and return EMPLOYER_TIMING_REVIEW_REQUIRED when it is absent. Reviewed employer timing is included in source fingerprints. Suspended or stale plan reviews remain invalid. The allocation file timing check also recognizes the new review-required status.

Automatic timing alerts now assess employer contributions as well as employee deductions, including selecting a plan with positive employer reservations when employee deductions are zero. The query evaluates employer requirements per payroll/plan so multiple employees do not produce conflicting plan assessments.

## Verification

Nine tests passed with no failures or skips in 5.36 seconds, covering timing reviews, employer ledger integration and allocation files. Evidence: `/tmp/payroll-employer-timing-final-tests.log`. Tests verify exact retained employer evidence and retry behavior, missing-review alerts, source fingerprint changes, clearing the alert after review, suspension, and existing holiday/cutoff behavior. The new API fixture initially lacked its historical date, encryption and synthetic provider configuration; those fixture issues were corrected before the passing run.

The employer ledger fixture has both employee and employer contributions; it does not establish a complete employer-only public payroll journey. No live provider transactions were performed.

## Assumptions and limits

The supported employer schedule is funding with each payroll under independently reviewed plan/provider evidence. This does not assert that employee withholding deadlines are legal employer contribution deadlines. Annual true-up and other schedules still require implementation. Payment authorization totals and combined delivery must be connected before removing the existing employer remittance gates. This increment is not production-verified, and the overall goal remains incomplete.

## Admin setup follow-through

The contribution timing form now offers an explicit employer schedule confirmation with a required separate evidence reference. Saved review history shows whether the employer schedule was reviewed and retains the evidence after reload. Editing the form clears the final review confirmation; an uncertain response retries the original retained request.

The browser flow passed (one test, 1.2 minutes), covering lost-response retry without duplicate retention, exact employer evidence in the database, reload persistence, refreshed dates and suspension. No page errors or provider payment posts occurred. The mobile screenshot `/tmp/payroll-retirement-timing-mobile.png` was inspected and is readable. Browser log: `/tmp/payroll-employer-timing-browser.log`. TypeScript build checks also passed (`/tmp/payroll-employer-timing-types.log`). The existing Playwright browser harness was used; agent-browser was not available on PATH. The unrelated AdminAccess edit is excluded.
