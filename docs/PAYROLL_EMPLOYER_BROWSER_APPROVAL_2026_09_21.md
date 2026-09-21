# Employer payroll approval in the browser

The browser verification found that nonblocking employer funding notices were not rendered in the payroll calculation preview. A dedicated employer funding section now shows matching, nonelective and total employer amounts in both the preview and saved run review. It explains that employer funding does not reduce employee take-home pay and distinguishes amounts awaiting approval from reserved amounts.

The admin browser journey now previews $6 matching and $4 nonelective, saves the draft, sends it to review, approves it and finalizes payroll. Database assertions verify the employer ledger, the $10 employer statement amount, the $14 employee retirement deduction and the separate monthly benefit deduction. The existing employee-only browser journey also passes.

Two browser tests passed in 15.7 seconds (`/tmp/payroll-employer-approval-browser-verified.log`). TypeScript checks passed (`/tmp/payroll-employer-review-types.log`); whitespace checks passed. The mobile employer funding screenshot `/tmp/payroll-employer-funding-preview-mobile.png` was inspected and is readable. No browser page errors were reported.

The first browser run exposed the missing display. The next run completed finalization but revealed a fixture clock mismatch that dated the benefit election after payroll. The historical browser harness now accepts an explicit reference date while preserving its existing default; the employer case uses September 16 consistently for application, browser and database clocks. The final passing run retains the original benefit-deduction assertion.

The full payroll backend regression remains active in `/tmp/payroll-integrated-employer-full-backend.log`; no final full-suite result is claimed here. Production verification and the broader exception/compliance completion work remain outstanding. No real payments, invitations or accounting entries were sent. The unrelated AdminAccess edit is excluded.
