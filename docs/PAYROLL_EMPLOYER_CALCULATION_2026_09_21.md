# Employer retirement calculation component

The internal calculation module now computes tiered matching and nonelective obligations from the exact retained plan formula. It distinguishes the full obligation, prior same-type funding, remaining funding required, overfunding and annual-capacity excess. The existing employer-funded payroll execution guard remains active. No production route, payroll approval, ledger reservation, bank request or provider allocation is authorized by this calculation component.

## Calculation assumptions

- The caller supplies explicit nonnegative integer cents derived from retained employer-scoped evidence. Unknown values are rejected, not converted to zero. The source fingerprint must bind the applicable employee, period, eligibility review, payroll and earlier employer funding.
- Eligible compensation must already reflect the employer-specific compensation definition and applicable compensation cap. Remaining annual-additions capacity must already account for ordinary employee contributions, other employer contributions, related plans and retained reservations. This module does not independently retrieve or verify those records.
- For PER_PAYROLL, the basis covers one payroll and any prior employer funding for that payroll. For ANNUAL_TRUE_UP, it covers the entire reviewed annual period and prior funding for that period. Source assembly must enforce these scopes and reject inconsistent plan revisions. A formula period label alone does not establish scope.
- Matching band ceilings remain exact fractions of cents during calculation. Matching is rounded half-up once at the total; integer cents are attributed to bands using largest remainders, with equal remainders allocated to the earlier band. Nonelective amounts are rounded half-up independently. This explicit implementation policy still needs inclusion in the processing review before activation.
- Matching considers actual ordinary deferrals plus catch-up only when plan terms include catch-up. Nonelective funding can remain due when employee deferrals are zero. Vesting does not reduce the employer obligation.
- Prior matching funding offsets only matching; prior nonelective funding offsets only nonelective. Overfunding requires reconciliation rather than negative funding or a cross-type offset.
- Insufficient annual-additions capacity preserves the full obligation and its excess, and returns no proposed executable funding. It does not silently short an employer promise or change the employee election.

## Verification

16 tests passed across employer calculation, employer formula and existing employee contribution calculation, with no skips (`/tmp/payroll-employer-calculation.log`). The eight new cases cover tier boundaries, catch-up inclusion/exclusion, no-deferral nonelective participation, annual true-up, already-funded periods, cross-type overfunding, exact/exceeded annual capacity, one-cent band boundaries, reconciled tier allocation, source/fingerprint changes, missing/invalid source amounts and arithmetic overflow. The fractional-cent check also exercises all integer compensation amounts from zero through 101 cents for a two-band full match. Whitespace checks passed.

This is verified calculation logic, not verified payroll integration. Next required work is server-derived employer compensation/eligibility source assembly, immutable employer ledger reservations and source revalidation, payroll totals and statements, accounting, remittance and allocation types, returns/corrections and representative complete browser journeys. The broad onboarding/payroll goal remains active.
