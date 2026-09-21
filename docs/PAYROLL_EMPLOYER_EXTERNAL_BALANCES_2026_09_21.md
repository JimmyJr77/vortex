# External employer contribution balances

Annual retirement source review now retains an optional, explicit employer-funding record with this plan's external matching contributions, external nonelective contributions, compensation under the employer-funding definition and a supporting evidence reference. The admin can enter these amounts, view them in immutable review history and copy them into a new draft. Missing evidence remains unreviewed; it does not become a zero balance.

The nested evidence participates in the canonical annual-source fingerprint. Existing records that omit it retain their original fingerprint. Same-plan ordinary employee deferrals plus both employer components must fit within the reviewed employer-group annual additions. Catch-up employee deferrals remain outside that inclusion check. Arithmetic uses integer cents and BigInt for the comparison, rejecting ambiguous or overflowing source values.

## Assumptions

- External employer compensation is distinct from external employee-deferral compensation. Neither is inferred from the other.
- All values exclude Vortex payroll. Matching and nonelective amounts identify this plan; aggregate annual additions may also include other related plans or other reportable additions.
- Employer balances are already included in external annual additions. They must not be added to that aggregate a second time during capacity calculation.
- A reviewed zero is entered explicitly. Omitting the new record, copying a legacy review or selecting unreviewed provides no employer-balance evidence for future employer execution.
- The existing employer/employee/plan scope, plan-revision binding, source revisions, exact request-key recovery, audit and append-only storage remain the retention mechanism. The new evidence does not itself determine eligibility or authorize funding.
- The backend advertises support for the nested field; the frontend only offers the new editor when support is present and refuses a structured save if that capability is unavailable. This avoids a new frontend silently losing fields on an old backend.

## Verification

Six unit tests passed across new employer annual inputs and existing annual capacity: canonical retention, fingerprint changes, absent-field compatibility, exact aggregate inclusion, catch-up exclusion, explicit zero, overflow, malformed evidence and invalid amounts. Log: `/tmp/payroll-employer-external-unit.log`. TypeScript compilation passed. The expanded built-app journey verifies actual API/database retention, lost-response retry, restored employer amounts and preserved drafts after a competing review; its final result is recorded below.

This adds the external evidence workflow required for employer funding. Internal/external annual aggregation, employer eligibility, ledger reservations, accounting and provider remittance still need integration. Employer-funded payroll remains gated, and the full onboarding/payroll goal remains active.

Final built-app result: 1/1 passed, 43.0 seconds including build/startup (`/tmp/payroll-employer-external-browser.log`). The journey retained $10,000 employer-formula compensation separately from $0 deferral-plan compensation, $350 matching and $150 nonelective within $500 annual additions. Exact retry retained one review; copying restored saved amounts and cleared confirmation. A competing review preserved the unfinished local draft. The mobile screenshot was inspected and the overflow assertion passed. Git whitespace checks passed. No real employee or provider action was performed.
