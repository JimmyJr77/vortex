# Employer funding payroll-source reconciliation

The internal source reader accepts employer, employee, payroll and plan identifiers. It retrieves an approved or finalized 2026 run in that workplace and reconciles its employee snapshot, posted wage components, employee retirement deductions, immutable retirement ledger and original plan revision. Finalized runs also require the retained employee retirement statement to match. It returns raw wage categories, actual ordinary/catch-up deferrals, plan identity, run status and a source fingerprint, without exposing the underlying employee statement or raw calculation.

The reader is a dependency for employer funding integration. It is not yet called by a production employer-funding route, does not reserve contributions, and does not establish eligibility, compensation caps, external balances, actual employer obligations or available annual capacity. The employer-funded payroll execution guard remains active.

## Assumptions

- A caller must hold a repeatable-read transaction or the payroll approval lock for a consistent read across the source records.
- The original plan revision retained by payroll must remain canonical and match the original payroll fingerprint. Current plan edits do not silently rewrite historical evidence.
- Posted gross wages are reconciled as regular wages plus overtime plus other taxable wages. Paid leave is checked separately against the retained paid-leave amount.
- Already-verified retirement deduction items are removed only from the wage-classifier input. Retained employee deductions and the original calculation are never mutated.
- Salary-covered leave remains flagged explicitly. Its separate employer-compensation treatment must be resolved if the employer formula includes regular wages and paid leave differently.
- Unused PTO cashouts require their own retained cashout compensation assessment; they are not treated as leave taken or ordinary gross wages by this reader.
- These are raw inputs. Employer-specific compensation inclusion, annual compensation caps, employer eligibility, external amounts and prior employer funding must still be derived and reviewed before invoking employer calculations.

## Verification

The real isolated payroll fixture creates a run, reviews/approves it and finalizes it through the existing APIs. The source test verifies exact wages and deferrals, stable fingerprints on unchanged evidence, changed fingerprints for finalization or changed statement evidence, workplace/employee/run/plan isolation, and rejection of corrupted posted wages, deductions and employee retirement statements. Corruption probes are rolled back; the original fingerprint is recovered afterward.

The first integration attempt used a nonexistent per-employee gross-pay column. It failed before returning a source. The reader was corrected to reconcile the actual stored components and their sum; no rejection assertion was relaxed. A separate check rejects another payment year before reading 2026 plan evidence. Final results are recorded in `/tmp/payroll-employer-source-verified.log`; earlier diagnostic logs remain in `/tmp/payroll-employer-payroll-source.log` and `/tmp/payroll-employer-payroll-source-final.log`.

No production employee or financial action was performed. No UI changed in this step. Remaining integration includes employer-specific annual source and eligibility reviews, ledger reservations, payroll totals/statements, accounting, provider remittance/allocation and end-to-end verification. The full goal remains active.

Final verification passed: 10 tests, zero failures or skips, in 2.38 seconds across the source reader and employer calculation suites. Git whitespace checks passed.
