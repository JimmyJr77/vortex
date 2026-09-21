# Employer eligibility for a mid-period new hire

The employer preview previously required an eligibility assessment beginning at the payroll period start. The eligibility intake correctly forbids assessments before the current hire date. Together these rules made a valid mid-period new hire impossible to review: a September 9 hire in the September 1–15 payroll could neither submit nor satisfy the requested September 1 coverage.

The payroll-specific eligibility resolver now narrows the assessment start to the actual hire date when retained employment history and the engine's dated compensation segments prove one complete current employment cycle. The original payroll dates remain in the response, and the eligibility evidence retains the narrowed coverage and employment-period ID. The coverage is included in its fingerprint. The standalone generic period resolver still requires exactly the period its caller supplies.

## Assumptions and boundaries

- Only pre-employment days are removed. A contribution entry date inside actual employment still requires dated wage/deferral allocation; it is not moved back to the hire date.
- The employment history must identify exactly one overlapping period beginning on the current hire date, with no termination before the payroll end. Complete engine compensation segments must cover hire date through payroll end without gaps, overlaps, wrong employee/cycle identity, or unresolved source issues.
- An older employment cycle ending before the payroll period does not prevent this new-hire path. Multiple overlapping cycles, rehire earnings in the same period, and a new hire who also terminates before period end need separate allocation work.
- Bonus, correction, prior-cycle leave, leave-payout or settlement evidence does not receive automatic narrowed coverage. Those earnings require their own dated allocation. This avoids applying a new-hire review to earlier earned compensation.
- This change resolves eligibility coverage only. Contributions, reservations, statements, accounting and remittance still need completion. No employer-funded payroll has been enabled or authorized by this change.

## Verification

**9 tests passed, 0 failed, 0 skipped**, 5.73 seconds (`/tmp/payroll-employer-new-hire-final-tests.log`). The real isolated API case creates a September 9 hire and September 1–15 payroll, confirms the intake rejects a pre-hire assessment, retains a valid September 9–15 review, and verifies payroll resolves nonelective eligibility with the full $200 of actual compensation. Changing the entry date to September 12 restores the dated-allocation review requirement. Approval remains blocked for unfinished funding integration.

Pure coverage tests exercise rate-segment boundaries, older closed employment, overlapping rehire cycles, missing/gapped/duplicated/wrong-cycle compensation segments, bonus/correction/settlement evidence, malformed hire dates and prior-year hires. Existing eligibility preview, regular payroll and candidate discovery tests also passed. The shared monthly fixture now accepts a hire date while preserving its old default. Whitespace checks passed. No new UI control was added, and no production employee or provider operation was performed. Render deployment is not yet verified.
