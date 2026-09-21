# Recurring employer payroll verification

Two isolated API journeys now cover a second payroll after the first finalized employer payroll: combined employee/employer contributions, and employer-only nonelective funding after a signed employee decline.

Both cases use ordinary draft, review, approval and finalization. The tests verify prior payroll evidence is included, annual capacity is reserved exactly once, the monthly benefit deduction is not repeated, and a voided approval releases its active capacity without deleting the employer ledger history. A replacement run can then approve and finalize the correct amounts. Finalized remittance sources include employer-only contributions even when employee deductions are zero, and automatic timing alerts select both outstanding finalized payrolls.

The combined case moves annual additions from $24 to $48, back to $24 on void, and to $48 on replacement. The employer-only case moves from $4 to $8, back to $4 on void, and to $8 on replacement. Both passed, zero failures or skips, in 6.27 seconds (`/tmp/payroll-employer-second-payroll-verified.log`). Whitespace checks passed.

This new file was added after the separately running full-suite command expanded its test-file list. Its result is therefore separate from `/tmp/payroll-integrated-employer-full-backend.log`, which remains active. No new backend application behavior was changed in this increment; the reusable synthetic setup now accepts a signed decline option.

Assumptions remain reviewed PER_PAYROLL employer funding, complete dated eligibility, sufficient capacity and no external employer funding awaiting assignment. This is not annual true-up, automatic enrollment, or every rehire/off-cycle case. Production acceptance and the broader goal remain incomplete. No production employee or provider transaction was created; the unrelated AdminAccess edit is excluded.
