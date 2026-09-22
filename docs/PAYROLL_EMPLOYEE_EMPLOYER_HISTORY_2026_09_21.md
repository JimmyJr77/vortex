# Employee employer-contribution history and regression checkpoint

The employee portal previously labeled the combined contribution as deducted from pay. It now shows the actual employee deduction, employer matching, employer nonelective funding, and combined contribution separately. Employer-only funding correctly shows a zero payroll deduction. Provider posting remains separately identified and unverified until current receipt evidence exists.

The employee API adds masked monetary categories only, preserving the existing combined amount field and employee-only compatibility. Delivery reconciliation now compares both employer categories against current payroll allocations, in addition to employee categories and total.

## Verification

- Full integrated employer backend suite: 1,059 passed, zero failures/skips, 726.519 seconds. `/tmp/payroll-integrated-employer-full-backend.log`. Started at application revision bfe9cb7f. Later recurring test file was outside the original shell glob; subsequent history code has focused validation below.
- Focused history, recurring payroll, public employer approval and receipt intake: 11 passed, zero failures/skips, 34.152 seconds. `/tmp/payroll-employee-employer-history-tests.log`.
- Employee browser flows: combined contributions, employer-only contributions, and legacy employee-only posting with automatic renewed review after receipt loss: 3 passed, 49.9 seconds. `/tmp/payroll-employee-employer-history-browser.log`.
- TypeScript and diff whitespace checks passed. Mobile screenshots show the separated amounts without horizontal overflow; combined screenshot visually inspected.

Assumptions: retained payroll obligations determine the category breakdown; combined provider posting is a separate aggregate receipt amount; employer contributions do not reduce employee net pay. Optional client fields support deployment compatibility with the earlier API. No real employee, payment, or provider journal was created in production. Deployment verification remains separate; the broader completion audit remains open.
