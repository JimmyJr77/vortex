# Native onboarding verification refresh — September 21, 2026

The previous publishing check verified commit publication, not completion of the full payroll objective. Current source was re-inspected on main before this verification.

## Reproduced evidence gaps

- The previous isolated PostgreSQL process was absent. The first attempt stopped with ECONNREFUSED before onboarding. A fresh loopback-only synthetic database was initialized with increased lock capacity; production data was not accessed.
- The original native journey completed activation, first payroll, and statement download, then correctly blocked rehire: its fixed September payroll fixture had drifted relative to the real separation date. The final period for that separation was not finalized.
- Pinning database business time alone exposed mismatched application-time OAuth expiry; invitation redemption also uses clock_timestamp(). The test now aligns application Date, database now()/clock_timestamp(), and browser Date to its explicit September 13 reference. Real timers still advance. Production clocks and expiry rules are unchanged.
- Current onboarding has 12 required steps: availability was removed by the current application and migration 817. The old rehire checks still expected 13. Current rendered and database behavior must be asserted explicitly.

## Added verification scope

A linked-account variation uses the same fresh invitation, native certificates, admin reviews, payroll, statement, leave and rehire journey. Only the external canonical credential response is synthetic; the signed identity is validated and linked by the actual payroll API. It verifies explicit confirmation, one retained employee/account link, returning access without a separate payroll password, and linked-account sign-in after rehire revokes prior sessions.

QuickBooks provider responses remain synthetic. This evidence does not prove real provider settlement, real agency acceptance, production employee identity checks, or complete coverage of every worker classification. The broader goal remains active.

## Final results

- Both complete native journeys passed serially in 4.0 minutes: ordinary payroll-password access and existing-account access. Each includes the second hiring cycle, two finalized payrolls for the same employee, two downloaded statements, $200 gross/$184.70 net per payroll, and two distinct synthetic QuickBooks journal requests. Log: `/tmp/payroll-native-current-final-sept21.log`.
- Screenshot review reproduced an actual defect: successful linked-account login left the old session-ended error visible. Successful profile loading now clears it; sign-out instructions also mention linked accounts. The final linked-account journey passed in 2.1 minutes with explicit no-alert/no-session-ended-message assertions after both initial and post-rehire login. Log: `/tmp/payroll-linked-login-fix-sept21.log`. Mobile screenshot inspected: `/tmp/payroll-native-linked-account.png`.
- Five serial backend tests passed with zero skips: account authorization/link ownership, session revocation races, historical clock isolation, and consistent business/expiry clocks. Log: `/tmp/payroll-clock-account-session-sept21.log`.
- TypeScript and whitespace checks passed. The full backend suite and assisted-preparer variants were not rerun in this checkpoint.

Assumptions: this dated scenario uses September 13, 2026 consistently across all three clocks; current onboarding requires 12 tasks; account linking persists across rehire while old payroll sessions are revoked; linked employees need no separate payroll password. The original broad goal remains incomplete until the outstanding worker variations, production/provider execution, and full regression gates are proven.
