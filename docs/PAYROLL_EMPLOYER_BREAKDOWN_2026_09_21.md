# Admin contribution breakdown

The finalized retirement source view now distinguishes employee deductions, employer matching, employer nonelective funding and the combined participant total. A combined $24 contribution is no longer labeled as $24 withheld from the employee. Legacy employee-only sources retain their existing withholding display.

The new browser fixture creates the employer plan, dated eligibility, annual evidence, signed deferral election and processing review through APIs, then creates, approves and finalizes regular payroll. The browser verifies $14 employee, $6 matching, $4 nonelective and $24 combined, with no horizontal overflow or page errors. One browser test passed in 16.8 seconds (`/tmp/payroll-employer-breakdown-browser.log`). TypeScript checks passed (`/tmp/payroll-employer-breakdown-types.log`). The mobile screenshot `/tmp/payroll-employer-contribution-breakdown-mobile.png` was inspected and is readable. Whitespace checks passed.

A full payroll backend run was also started against the isolated database with two concurrent test files. It is still running at this documentation point; no full-suite success is claimed. Its log is `/tmp/payroll-integrated-employer-full-backend.log`. The run tests the integrated employer backend at bfe9cb7f; this display increment changes no backend application behavior.

Production deployment remains unverified, and the overall goal is incomplete. No real employee, payment, invitation or provider journal was created. The unrelated AdminAccess edit is excluded.
