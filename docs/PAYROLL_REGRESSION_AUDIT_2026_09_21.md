# Payroll regression audit — September 21, 2026

Baseline source: `2b92550c`. Original onboarding/payroll goal remains active.

## Final worktree checkpoint

Both full runs have finished. The original real-clock baseline completed with **869 passes and 112 failures out of 981 tests**, with no skips or cancellations. All 838 recorded source inputs remained unchanged through completion. The failure inventory is retained in `PAYROLL_BACKEND_BASELINE_2026_09_21.json`.

The experimental frozen-clock comparison completed with **947 passes and 17 failures out of 964 tests**. Its archive omitted two frontend helpers, causing two file-level failures, and freezing time also interfered with elapsed-time tests. Its different test count and remaining failures mean it is diagnostic evidence, not a replacement full-suite result. No experimental clock configuration was applied to this worktree.

The bank recovery and carrier invoice revision fixes described below have now been applied to the actual worktree. Route inventory expectations include the current account-link/session routes, and rehire expectations reflect the retirement of the availability task. Reversal history assertions select the exact retained reversal identity.

The final real-clock worktree run passed **all 25 targeted tests**, with no failures, skips or cancellations, in 33.9 seconds (`/tmp/payroll-applied-fixes-sept21.log`). It covers the new deterministic ordering regressions, existing bank enrollment and carrier invoice workflows, route inventory, rehire review and existing-account linking. `git diff --check` also passed. The broader failed baseline has not been rerun after these changes; full goal completion remains unproven.

The sections below preserve the investigation history and earlier checkpoints. References to active sessions or unapplied candidate patches describe those earlier checkpoints and are superseded by this final worktree checkpoint. Publication and deployment require separate confirmation; passing local tests does not establish production rollout.

## Completed verification

- Single-preparer native hiring journey passed in 1.4 minutes.
- Two-preparer native hiring journey, including post-payroll amendment with new preparer certificates and retained historical employer evidence, passed in 1.8 minutes.
- Both use actual internal forms, signatures, review routes, activation, finalized payroll, statement, leave and synthetic QuickBooks transport. Log: `/tmp/payroll-assisted-sept21.log` (two passes, 3.2 minutes total).
- Public production health returned OK, connected database and document storage ready. Backend release `8429d4219cbe` differs from current main only in payroll test-harness files; no newer backend runtime change was missing.

## Full-suite investigation in progress

The serial payroll backend baseline is running against an isolated loopback PostgreSQL database with `max_locks_per_transaction=1024`. It has already reproduced multiple failures, so no green full-suite result is claimed. The baseline's 838 recorded JavaScript/migration hashes remained unchanged at the latest check.

A reproduced cluster comes from a dated benefits fixture: it signs authorization on the current day but expects employee deductions on a September 18 payment. Carrier accounting tests depend on those deductions. A separate archived source copy with an explicit September 13 application/database reference clock passed five previously affected benefits/withdrawal/carrier-accounting cases.

A separate two-date check then proved the business boundary through actual routes and unchanged signed evidence: September 13 authorization permits the September 18 deduction; September 21 authorization does not. Both permit the later September 30 payment's deduction. Both checks passed. Production deduction rules were not changed.

## Active verification handles and next action

- Baseline: exec session `50989`; log `/tmp/payroll-full-sept21.log`; input hashes `/tmp/payroll-full-sept21-inputs.json`.
- Candidate full comparison: exec session `2111`; log `/tmp/payroll-reference-suite-sept21.log`; candidate tree `/tmp/vortex-payroll-clock-candidate`.
- Candidate focused evidence: `/tmp/payroll-benefits-clock-candidate.log` (five passes) and `/tmp/payroll-benefits-boundary-candidate.log` (two date-boundary passes).

Poll the existing handles before any restart. Preserve the baseline's source inputs while it runs. Once terminal, compare failure families and verify source hashes, then decide on a scoped reference-clock fixture design. Do not apply a global production clock change or remove the later-authorization gate to obtain passing tests. The current candidate is experimental and is not published.

Remaining completion evidence includes a green full regression, the wider browser suite, and production/provider/agency execution. Local synthetic provider responses do not establish live settlement or filing acceptance.

## Confirmed recovery defect and prepared fix

The frozen-clock comparison exposed bank recovery choosing an older operation by UUID when creation timestamps tie. A deterministic regression using the ordinary real-time harness reproduced this independently: synthetic operations share a creation timestamp and have UUIDs deliberately opposite to their lifecycle order. Unchanged production code stays UNCERTAIN after recovering a lost verification response, instead of recovering AWAITING_AMOUNTS. Evidence: `/tmp/payroll-bank-order-red-final.log`.

A separate candidate orders operations by COUNTERPARTY, ACCOUNT, START, COMPLETE, then attempt number. Scheduled recovery preserves unresolved-prerequisite priority, then uses the same lifecycle/attempt ordering. Both manual and scheduled tied-timestamp cases pass, including recovery of the second completion attempt, no duplicate provider writes, and no automatic wage-destination linkage. All 14 focused enrollment tests passed without skips in `/tmp/payroll-bank-order-verified.log`. An initial draft fixture incorrectly returned an undefined lookup item and was corrected before the deterministic reproduction. The scheduled test also now respects the existing daily recheck interval for verified accounts; that production interval was not changed.

Prepared patch: `/tmp/payroll-bank-recovery-order.patch` (passes `git apply --check`). Candidate source: `/tmp/vortex-payroll-order-candidate`. It changes `bankEnrollmentProgress.js`, `bankEnrollmentRecoveryScheduler.js`, and adds `bankEnrollmentRecoveryOrder.test.js`. It has not yet been applied or published, to preserve the full running baseline and reference comparison. Once those runs are terminal, apply the reviewed patch, rerun the focused enrollment checks in the real worktree, and include the fix in the next full verification baseline. Do not describe this candidate as deployed.

## Confirmed invoice-revision defect and prepared fix

The carrier invoice list inferred supersession from timestamp/UUID presentation order. Deterministic real-clock database fixtures reproduced three incorrect results: equal timestamps, a regressed timestamp on the higher revision, and a newer revision moved to another coverage month. All three originally marked the older invoice as not superseded. Evidence: `/tmp/payroll-invoice-order-red.log`.

The separate candidate now derives supersession from a higher revision of the same facility/carrier/invoice identity across all coverage months. Revision also breaks presentation timestamp ties. The three regressions and the existing immutable invoice workflow passed (four tests, `/tmp/payroll-invoice-order-green.log`). Current/source-fingerprint checks and mutation protections remain intact.

Ten related invoice, contribution-matching and premium-posting/recovery tests subsequently passed under equal reference timestamps (`/tmp/payroll-invoice-reference-final.log`). The preceding nine-pass/one-failure experiment exposed an assertion selecting the first reversal instead of the exact renewed reversal ID; the final test now asserts the intended retained identity. Production reversal selection/dispatch rules were not changed.

Prepared patch: `/tmp/payroll-carrier-revision-order.patch`; source candidate remains `/tmp/vortex-payroll-order-candidate`. The patch changes `benefitCarrierInvoice.js`, adds `carrierInvoiceRevisionOrder.test.js`, and corrects identity-specific assertions in `carrierPremiumPosting.test.js`. Both this and the bank-recovery patch pass a combined `git apply --check`. Neither is applied or deployed yet. Candidate-only environment-driven clock configuration in that temporary tree is experimental and intentionally excluded from both patches.

At the latest checkpoint both original full runs are still active; the baseline's recorded 838 inputs remain unchanged. Continue polling sessions `50989` and `2111`, then apply and verify the two scoped patches after those runs finish. A full green result remains unproven.
