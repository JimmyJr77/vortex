# Employer contribution annual-reporting candidate

Status: tested in `/tmp/vortex-payroll-employer-yearend`, not applied to main or deployed. The current 222-case browser baseline is still active (exec session 41355, `/tmp/payroll-browser-current-full.log`). It began at `9b2262c4`; 3,593 source hashes in `/tmp/payroll-browser-current-source-hashes.json` remain unchanged at this checkpoint. Preserve that run; do not restart merely because a long case has not emitted output.

## Confirmed issue and correction

Annual reporting currently omits employer matching/nonelective amounts and only guards against incorrectly excluding employee deferrals. An employee declining deductions can therefore have retained employer funding without a reporting guard against a contradictory no-participation decision.

The candidate verifies employer ledger/snapshot consistency, adds exact employer obligations to annual and per-payroll evidence, requires participation review before a W-2 draft can omit retirement participation, and rejects a contradictory NOT_APPLICABLE decision through the public review API. Reviewed employer-only participation checks Box 13 without inventing employee deferral codes. Combined funding preserves employee-only D/AA amounts. The admin annual evidence panel separates employer obligations from deferrals and explains that accrued payroll obligations do not establish provider posting.

Source: [IRS 2026 W-2/W-3 instructions](https://www.irs.gov/instructions/iw2w3), Box 13 decision chart, consulted September 21. Employer contributions can establish retirement-plan participation even when the employee declines deductions. The correction requires explicit review of allocation/participation evidence; it does not equate a payroll reservation with actual recordkeeper credit or automatically attest participation.

## Evidence

- Both new candidate cases failed against unchanged code because employer contribution evidence was absent: `/tmp/payroll-employer-yearend-red.log`.
- Final candidate backend regression: 29 passed, zero failures/skips, 44.535 seconds. `/tmp/payroll-employer-yearend-candidate-final-tests.log`. Includes public review rejection/recovery, annual mapping, normal/bonus/PTO deferrals, ledger and year-end preparation.
- Expanded real-API W-2 approval tests: 2 passed, zero failures/skips, 7.158 seconds (`/tmp/payroll-employer-yearend-candidate-w2-approval.log`). Both employer-only and combined cases complete health/input review, W-2 approval and encrypted six-page packet download. Omitted or category-redistributed employer evidence makes the annual source unreconciled, invalidates the retained W-2 approval, and blocks another approval. Restoration recovers exact reporting; voided runs leave annual totals while their employer ledger remains retained. Production code is unchanged from the 29-test candidate regression; only these test assertions were added.
- Candidate browser annual evidence display/refresh: 1 passed, 8.7 seconds including build. `/tmp/payroll-employer-yearend-candidate-browser.log`. Mobile rendering inspected; no page errors or overflow.
- Candidate `tsc -b` passed: `/tmp/payroll-employer-yearend-candidate-types.log`.
- Patch: `/tmp/payroll-employer-yearend-candidate.patch`, SHA-256 `8cf7f06c7f2af67888290f1d8c97712d634e11e8ac51db85dcc5bc87d308004e`; `git apply --check` passes. Six candidate input hashes: `/tmp/payroll-employer-yearend-candidate-source.json`.
- An intermediate public test lacked a synthetic document-encryption key and correctly received 503; the test setup was corrected, without weakening storage requirements.

Next: retain the existing full-browser process until terminal, verify its source hashes and investigate failures; then apply the candidate patch, verify in the real worktree, publish and deploy. No live payment, hire or filing was generated. The overall goal remains incomplete.
