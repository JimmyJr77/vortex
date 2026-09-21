# Employer contributions through normal payroll approval

Regular payroll now applies employee deferrals and offers approval when the employer formula, dated eligibility, signed employee election, processing policies, prior payroll reservations and shared annual capacity are fully reviewed. The preview includes a nonblocking notice with the matching, nonelective and combined employer amounts. Employer funding remains separate from employee deductions and take-home pay.

A stable employer review record participates in the payroll fingerprint, including current plan/annual-source identities, eligibility, prior payroll evidence, compensation, formula obligations and remaining annual capacity. Draft creation and later review do not depend on the draft's initially unassigned run ID.

Approval retains employee deductions, recomputes employer funding from approved payroll, compares it with the reviewed amounts/sources, attaches the integrated employer snapshot and reserves employer capacity in the same locked database transaction. Failure rolls back the run transition and both reservations. Finalization recomputes current reviewed payroll while excluding that run's own reservations, avoiding double counting. Changed employment or eligibility blocks further processing.

## Verification

All 45 employer and regular-retirement tests passed with zero failures or skips in 14.39 seconds (`/tmp/payroll-employer-approval-verified-tests.log`). Whitespace checks passed.

The new public journey uses API calls for draft creation, review, approval and finalization, then public contribution-file preparation, authorization, local SFTP delivery, synthetic bank dispatch/recovery, partial/full receipts, QuickBooks payroll sync and settlement. It reaches RECONCILED. Unlike the earlier ledger fixture, it does not fabricate an approved payroll snapshot. Negative cases prove a changed eligibility review rejects a stale draft, an injected employer-ledger failure rolls back the employee ledger and leaves the run in REVIEW, changed employment prevents finalization, and unassigned external employer funding remains blocked. The injected database trigger is test-only and is removed before the successful approval.

The first finalization attempt exposed the old unapproved-only preview restriction. Approved-run revalidation was added for integrated employer runs. An older preview test was updated to expect the now-applied signed deduction and available approval, rather than unchanged net pay and a blanket block.

## Assumptions and unfinished scope

This supported path uses PER_PAYROLL funding, complete dated eligibility coverage, one applicable plan, and explicit zero external employer contributions awaiting payroll assignment. Existing internal prior employer payroll must have retained reservations. External compensation can still be reviewed for the annual cap, but nonzero externally funded matching/nonelective amounts require a future payroll-assignment workflow before approval. Annual true-up, other schedules, additional period/rehire/off-cycle exceptions and the broader onboarding/payroll completion audit remain outstanding.

All providers in the test are synthetic; no real payments, invitations or accounting entries were sent. This increment is not yet production-verified. The unrelated AdminAccess edit is excluded. The overall goal remains active.
