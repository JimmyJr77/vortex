# Combined employer contribution delivery and accounting journey

The isolated employer payroll fixture now continues through public contribution preparation, authorization, allocation transfer, bank dispatch, provider receipt interpretation, employee outcome visibility, QuickBooks payroll sync and accounting settlement.

The test uses a local SSH/SFTP server with actual encrypted-file transport and synthetic bank/QuickBooks responses. It transfers the exact retained allocation once, simulates a lost bank response, and verifies concurrent retry produces one $24 bank instruction. The matching withdrawal reconciles at $24. Provider receipts first post $20, then the full $24, retaining $6 matching and $4 nonelective separately. Employee history reports the posting without exposing private provider batch identifiers.

Public QuickBooks sync creates a journal with $10 employer contribution expense and $24 retirement liability. Repeating sync does not repost. Settlement creates one $24 liability debit/bank credit journal under concurrent posting requests, and the aggregate contribution assessment reaches RECONCILED.

## Evidence and limits

The focused combined journey passed in 3.35 seconds (`/tmp/payroll-employer-delivery-accounting-tests.log`). The final run passed all five tests, zero failures or skips, in 7.81 seconds (`/tmp/payroll-employer-delivery-final-tests.log`), including the complete combined journey and existing settlement/assessment regression cases. Whitespace checks passed. These tests send no production invitations, payments, allocation files or accounting entries.

The fixture still constructs approved employer payroll internally because the public employer payroll approval producer remains incomplete. RECONCILED here proves the synthetic contribution delivery/accounting path after that fixture, not end-to-end public hiring/payroll approval or production provider acceptance. Production deployment remains unverified. The broader goal remains active.

Assumptions: separate bank funding and recordkeeper allocation files; provider receipts contain cumulative employee and employer categories; matching/nonelective funding uses the reviewed payroll schedule. Public employer approval, other funding schedules, exception breadth and final production verification remain outstanding. The unrelated AdminAccess edit is excluded.
