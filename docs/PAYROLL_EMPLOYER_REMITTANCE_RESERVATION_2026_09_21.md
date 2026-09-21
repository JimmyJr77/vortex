# Combined contribution payment reservations

Migration 829 updates the database authorization guard to reserve the exact sum of employee deferrals and retained employer matching/nonelective contributions. It preserves current finalized-payroll, facility, plan, destination, allocation format, timing and duplicate-reservation checks.

Positive employer funding additionally requires reviewed employer timing, both employer allocation columns and a current matching receipt contract. Retained participant allocations must match payroll identities, employee categories, totals, employer ledger identities and employer categories. Missing, duplicated or extra participants cannot satisfy the reservation. The employer settings lock continues to serialize competing authorizations.

## Verification

Ten targeted tests passed with zero failures or skips in 7.48 seconds. Evidence: `/tmp/payroll-employer-reservation-final-tests.log`. The isolated employer payroll fixture reserves $24 ($14 employee, $6 matching, $4 nonelective), rejects $14 and $24.01 totals, missing receipt review, altered employee/employer categories, missing participants and duplicated participants. Two concurrent valid inserts produce exactly one reservation. Existing employee authorization, cancellation, timing and receipt-contract regression cases passed. Whitespace checks passed.

The employer test intentionally exercises the database boundary directly using synthetic non-deliverable bytes. It does not establish a public employer payment or provider delivery journey. No external payments were posted. Migration 829 is registered in production initialization and the isolated test harness; it has not been verified on Render.

## Remaining work and assumptions

Employer amounts are additional plan funding and do not reduce employee take-home pay. Reservations cover one exact finalized payroll/plan, with both employer categories reported separately. The public employer file/remittance gates remain pending the complete combined preparation/delivery integration and UI contract controls. Those gates must be replaced with current-contract verification before this becomes an end-to-end public workflow. The broader payroll goal remains incomplete; the unrelated AdminAccess edit is excluded.
