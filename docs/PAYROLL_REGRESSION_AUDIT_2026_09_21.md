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

## Production publication of ordering fixes

Commit `5c92ed3240d7bd536ef94e5b1e496e2ec880e683` was pushed to `main`. Render deployment `dep-daolahdbedkc73anm2rg` reported **Deploy succeeded | Live**. The public health endpoint returned `releaseCommit=5c92ed3240d7`, `status=OK`, `dbConnected=true`, and `payrollDocumentStorageReady=true`. Vercel deployment `dpl_9qpv8ccd3gfyMfeCZFJ8UoQq782k` reached READY for the same commit and includes the `vortexathletics.com` production alias.

The employee-creation OPTIONS preflight returned HTTP 204 with `Access-Control-Allow-Origin: https://vortexathletics.com`, credentials allowed, and authorization/content-type headers permitted. This verifies the public preflight, not a real employee creation or provider transaction.

## Subsequent check-document ordering investigation

The historical check-delivery fixture now explicitly scopes both JavaScript signing time and database time to September 13; the payment clock still advances independently through its existing scenarios. A deterministic tied-observation case reproduced a genuine closeout defect: a stopped-check recovery sharing the document-check timestamp was ignored and the route finalized payroll (HTTP 200 rather than the required 409). Log: `/tmp/payroll-check-closeout-red.log`.

The pending worktree fix records the latest provider-observation ID before each original/replacement document verification under the existing connection lock. A new additive migration uses this retained observation boundary instead of wall-clock comparisons in original/replacement delivery guards and original-check closeout readiness. Legacy document proofs without that boundary require fresh recovery or a new document proof when the latest observation is adverse. Retained document history remains immutable.

Four focused document/delivery cases passed, including tied and backwards timestamps (`/tmp/payroll-check-closeout-green.log`; four selected passes, 46 intentionally filtered cases). This subsequent fix is not included in deployed commit `5c92ed32`. The expanded check suite and migration reinitialization checks are running in `/tmp/payroll-check-order-suite.log` (exec session `31888`); their result must be inspected before publication.

Assumptions: observations within one check are ordered by their append-only IDs under the existing employer connection lock; historical signing fixtures must use an explicit historical clock; ambiguous legacy evidence should prompt recovery rather than permit payroll closeout. None of these checks initiates a live payment.

The expanded check/migration run finished with **52 passes, zero failures/skips/cancellations**, in 253.0 seconds. Subsequent direct database guard checks passed in three selected workflow cases (`/tmp/payroll-check-order-guards.log`, 47 unrelated cases filtered). Those checks attempt original and replacement handoffs with equal/backwards observation timestamps, with and without the new document boundary, and verify rejection by the database trigger. Each probe rolls back its synthetic records. Normal verified handoff and closeout still complete afterward. `git diff --check` passed.

## Replacement-chain and historical-fixture follow-up

The check-document fix was published as `b9137fa0a7362afefdd410437eb622d9692158bb`. Render deployment `dep-daolo3qjnfac73epbj00` reached Live; a fresh public health request returned that release, OK, connected database, and ready secure document storage. Vercel deployment `dpl_FNynGoSfJmzwv8VyuEv8zcWJNTCD` reached READY with the production alias. Two real-clock control tests (time-entry recovery and payroll-input concurrency) passed, confirming their frozen-clock comparison failures were artifacts (`/tmp/payroll-real-clock-control.log`).

Correcting identity-specific history assertions exposed a further runtime defect: repeated direct-deposit replacements could select a superseded payment cycle by timestamp and leave a fully reconciled return case OPEN. A deterministic backwards-timestamp regression reproduced the incorrect case and its reconciliation issues (`/tmp/payroll-replacement-chain-red.log`). The fix selects the active authorization through predecessor/successor relationships and the latest executed cycle through executed successors. Evidence aggregation uses review sequence order. It does not alter wages or initiate an additional payment.

Historical benefit/carrier and payment fixtures now explicitly select a signing/database clock using `testing/historicalHarness.js`. The helper mocks only Date within each test context; network IO and timer waits remain real, and independent payment/scheduler clocks retain their existing scenario values. Time-entry duration tests continue using the ordinary harness. Tests inspect the exact authorization/reversal identity rather than assuming the first row has that identity when timestamps tie.

Verification completed with no failures or skips:

- 31 direct-deposit dispatch, replacement, settlement, and retirement-return checks: `/tmp/payroll-replacement-chain-green.log`.
- 20 benefit coverage, withdrawal, carrier accounting/payment and premium recovery checks: `/tmp/payroll-benefits-historical-scoped.log`.
- 10 monthly benefit checks, including explicit September 13 and September 21 authorization boundaries: `/tmp/payroll-benefit-boundaries-retained.log`. The later signature does not permit a September 18 deduction; September 30 remains eligible. Preview leaves the retained signed evidence unchanged.

Assumptions: replacement lineage, rather than timestamps or UUID sort order, identifies the active cycle; dated fixture signatures must precede their expected deductions unless the test explicitly exercises later authorization. Live-provider settlement is still unproven. The full backend and browser suites still require completion; these 61 passes do not replace a new full-suite result.

## Carrier review release and current broad verification

The `7199a0c4` backend snapshot finished with **952 passes and 39 failures out of 991**, with zero skips or cancellations, in 3,044.4 seconds. Its full result remains in `/tmp/payroll-full-7199a0c4.log`; the extracted failure inventory is `/tmp/payroll-baseline-7199a0c4-result.json`. That run is terminal, not an active baseline.

Commit `aa6f7010e87230258c35743667e5093817fc70ed` fixes carrier return-review selection using the unsuperseded review chain and exact current return-event set. Migration 824 applies the same predecessor rule to the database guard and adds its predecessor index. A regression uses backwards review timestamps and verifies stale-predecessor rejection before and after migration reinitialization. Historical backend fixtures now explicitly select their signing/database clock; retirement reconciliation assertions select the intended retained identity. Production clocks, authorization requirements and provider execution rules are unchanged.

Final scoped evidence comprises 25 carrier checks (`/tmp/payroll-carrier-order-final.log`), eight receipt checks (`/tmp/payroll-retirement-receipt-clock.log`), 20 passing dated-workflow checks from `/tmp/payroll-dated-workflow-scoped.log`, and one corrected reconciliation check (`/tmp/payroll-retirement-reconciliation-identity.log`). These are **54 passing checks across separate runs**, not a single clean broad run; the initial failing attempts remain retained.

Publication is verified: GitHub `main` resolves to the full `aa6f7010` hash. Public backend health on September 21 returned `releaseCommit=aa6f7010e872`, `status=OK`, `dbConnected=true`, and `payrollDocumentStorageReady=true`. Vercel deployment `dpl_9dpGmDz89kAJpBASYH7PdbrZNCKY` is READY for the exact commit, targets production, and includes `vortexathletics.com`. `npx tsc -b` passed (`/tmp/payroll-types-aa6f7010.log`).

Two broad runs are active at this checkpoint; neither has a final passing result:

- Backend: execution 60181, `/tmp/payroll-full-aa6f7010.log`, immutable source archive `/tmp/vortex-payroll-baseline-aa6f7010`, serial Node tests with the isolated localhost database. The last inspected output reached test 190 with no failure markers.
- Browser: execution 23854, `/tmp/payroll-browser-aa6f7010.log`, 207 payroll scenarios with one worker against the current worktree and isolated localhost schemas. The first nine completed without a failure before scenario ten started. No runtime or test source has changed during this run.

An additional in-app browser check confirms that `/employee/payroll` renders invitation guidance, payroll login, and linked Vortex-account login. This entry check is not evidence of a completed authenticated journey. Existing full native-journey evidence remains described separately.

Assumptions retained for review: review predecessor relationships determine the current review even if clocks regress; clearance must cover the complete current return-event set; historical test signatures use explicit dates; automated regression providers use synthetic data and responses. Full green backend/browser results, complete category coverage, and actual external provider/agency acceptance remain unproven. The overall onboarding/payroll goal remains active.

### Browser date failures isolated without changing the baseline

The continuing browser baseline reproduced dated-fixture failures in benefit withdrawal, carrier contribution/remittance preparation, and check issuance. Their September 18 payroll precedes the September 21 authorization signature. The check UI correctly shows $184.70 instead of the fixture's expected $59.70 because the $125 deduction is not eligible. Existing backend boundary tests explicitly assert that a later signature cannot authorize that earlier deduction; the production date rule must remain intact.

A separate candidate at `/tmp/payroll-browser-clock-candidate` supplies an opt-in Playwright fixture with September 13 application/browser time and a schema-scoped database clock. It restores the application's Date after each test and leaves timer scheduling real. Both benefit-withdrawal browser scenarios passed unchanged business assertions in 8.4 seconds (`/tmp/payroll-browser-clock-withdrawal.log`), covering withdrawal, renewed signature, no second collection for an already-paid month, and blocking the next month. The mobile withdrawal screenshot was visually inspected. This is candidate-only evidence, not a fix applied to the running baseline.

Seven carrier browser checks using the same candidate are running as execution 14710 (`/tmp/payroll-browser-clock-carrier.log`). The alternate-delivery scenario has passed; the long carrier-contributions scenario is still active. Retain all candidate results and integrate only after inspecting final results and the immutable broad baseline. The current source-input hashes, recorded during the run before any runtime/test edits, are `/tmp/payroll-aa6f7010-running-inputs.json` (2,678 files).

The check candidate also required two fixture corrections. Its teardown now measures the 500 ms idle interval with `performance.now()` so a fixed calendar clock cannot prevent cleanup. Its synthetic provider selects the uniquely identified current replacement authorization rather than an arbitrary row under tied creation timestamps. The first failed candidate runs remain in `/tmp/payroll-browser-clock-check.log` and `/tmp/payroll-browser-clock-check-final.log`. After both corrections, REVIEW, DELIVERY and STOP_CLOSEOUT_RETRY_RENEW passed (three passes, 26.1 seconds, `/tmp/payroll-browser-clock-check-identity.log`). The mobile check review was inspected and shows the expected $59.70 net pay. The remaining 13 variants are running as execution 11148 (`/tmp/payroll-browser-clock-check-remaining.log`); those results are still pending. These edits remain in the separate candidate tree.

At this later observation the original backend execution 60181 reached test 576 without a failure marker, while browser execution 23854 reached scenario 82 of 207 and is already non-green. Both remain active; do not restart them because of elapsed time or intermediate failures.

## Full backend gate passed; browser corrections awaiting integration

The `aa6f7010` backend run is now **terminal and green: 992 tests, 992 passes, zero failures/skips/cancellations**, in 1,272,714.811333 ms. Execution 60181 exited zero. The durable result is `PAYROLL_BACKEND_VERIFICATION_2026_09_21.json`; it records the log hash and comparison of 2,622 archived backend/utility files with the unchanged current worktree. No full backend rerun is needed solely for the subsequent browser-test-only corrections.

The separate browser candidate now has **31 final passing scenarios across separate runs**:

- Two benefit withdrawal scenarios: `/tmp/payroll-browser-clock-withdrawal.log`.
- All 16 check variants: three in `/tmp/payroll-browser-clock-check-identity.log` and the remaining 13 in `/tmp/payroll-browser-clock-check-remaining.log` (2.1 minutes). Execution 11148 exited zero.
- All seven carrier variants: `/tmp/payroll-browser-clock-carrier.log`, 9.3 minutes, including the 8.7-minute contribution/accounting/automatic-recovery journey. Execution 14710 exited zero.
- Employee retirement receipt refresh and final-pay/rehire review: the two passing cases in `/tmp/payroll-browser-clock-retirement.log`. Its third case initially failed; that non-green run is retained.
- Retirement bank return visibility: `/tmp/payroll-browser-clock-return-final.log`, one pass, 35.2 seconds. The earlier failure trace shows a lost Vite connection followed by reload to Home during its assertion. A diagnostic rerun confirmed retained RETURNED/BANK_CREDIT_POSTED evidence and passed; the final candidate replaces diagnostics with explicit assertions and also passes. No application behavior was changed for this transient browser-server interruption.
- Three monthly-benefit scenarios: `/tmp/payroll-browser-clock-monthly.log`, three passes, 15.4 seconds.

The 13-file patch `/tmp/payroll-browser-clock-verified.patch` passes `git apply --check` and contains only those verified test/helper corrections. It is not yet applied. It uses explicit historical fixture dates, monotonic teardown timing, exact retained replacement identity, and the current 12-step onboarding count. The broad browser run still uses untouched original sources; the 2,678 recorded runtime/test hashes were rechecked with no changes.

Browser execution 23854 remains active and non-green, most recently at scenario 130 of 207. Newly observed payment-dispatch failures show the same missing historical $125 contribution; all five dispatch variants are being checked separately as execution 35577 (`/tmp/payroll-browser-clock-dispatch.log`). Hourly and salary rehire assertions still expect 13 tasks; the corrected 12-task UI and persisted-database assertions are being checked as execution 84619 (`/tmp/payroll-browser-clock-rehire.log`). These two new candidates are not yet included in the verified patch. Finish the baseline, inspect its remaining failures, then integrate validated corrections and verify the resulting browser suite. Live provider/agency acceptance and full goal completion remain unproven.

The two additional candidate runs are now terminal and green: all five payment-dispatch variants passed in 27.7 seconds, and both hourly/salary rehire variants passed in 17.3 seconds. Executions 35577 and 84619 exited zero. The verified patch has been refreshed to include them: **15 files supporting 38 final passing browser scenarios across the recorded runs**, still unapplied while browser baseline execution 23854 remains active. The earlier 13-file/31-case checkpoint is superseded by this result.

### Original reported inputs and production preflight recheck

The non-payroll-prefixed `tests/e2e/onboarding-inputs.spec.ts` was run separately against the same source and passed (one test, 1.6 seconds; `/tmp/payroll-onboarding-inputs-aa6.log`). It verifies typing/pasting phone digits, punctuation and a US country code, dash deletion, and the separate existing-account confirmation action. Login/link responses in this component test are synthetic; actual ownership and facility checks are covered by the backend suite, not inferred from this UI mock.

Live OPTIONS requests on September 21 at 18:27 UTC returned HTTP 204 for employee creation (`/api/admin/payroll/employees`), admin notifications, and pending billing cancellation requests. All three explicitly allowed origin `https://vortexathletics.com`, credentials, Authorization/Content-Type, and their required POST/GET methods. This is evidence for the original preflight failure only; no production employee or real financial transaction was created. The broad browser execution 23854 was re-polled and remains active, most recently at scenario 135 of 207.

The additional retirement-assessment browser failure was also caused by mismatched receipt/signing dates. Its explicit historical candidate passed, including automatic reopening after a returned bank payment while retaining participant posting evidence (`/tmp/payroll-browser-clock-assessment.log`, one pass, 35.3 seconds; execution 22411 exited zero). The verified, unapplied patch now contains **16 files covering 39 final passing browser scenarios**. The separate unchanged phone/account-link component test is additional evidence, not included in that patch count. Baseline execution 23854 remains active, most recently at scenario 141 of 207.

### Remaining historical browser cases and unchanged controls

Further date-aligned candidates passed: participant reversal/replacement (`/tmp/payroll-browser-clock-participant.log`, one pass, 1.8 minutes), receipt intake with retry/regression history (`/tmp/payroll-browser-clock-intake.log`, one pass, 35.6 seconds), and Maryland signing plus regular retirement payroll (`/tmp/payroll-browser-clock-withholding.log`, two passes, 11.1 seconds). The prepared patch now has **20 files covering 43 final passing browser scenarios across separate runs**. Its exact SHA-256 and candidate file hashes are retained in `/tmp/payroll-browser-clock-verified.json`; it remains unapplied and passes `git apply --check`.

The failure inventory also identified a citizen I-9 receipt timeout and a payment-destination timeout outside the dated-fixture corrections. Both I-9 receipt variants and the payment-destination scenario passed unchanged in a separate control run (`/tmp/payroll-browser-aa6-controls.log`, three passes, 46.6 seconds). No product fix, assertion change or timeout increase was made for them. Retain the original non-green result; these reruns do not retroactively make it green or establish the cause of its timeouts.

Only baseline browser execution 23854 remains active at this checkpoint, most recently scenario 181 of 207. Candidate and control executions 57616, 43660, 56853 and 52200 are terminal with exit zero. The backend remains fully green at 992/992. The operating-assumptions document now starts with a concise current implementation review list and clearly labels its older checkpoint narrative as historical.

## Browser baseline terminal and corrections integrated

Execution 23854 finished with **162 passed, 45 failed, 207 total**, in 39.8 minutes. The exact failures and log hash are retained in `PAYROLL_BROWSER_BASELINE_2026_09_21.json`. All four native full journeys passed: unassisted, single-preparer, multiple-preparer and linked-account. They exercised activation, finalized payroll and statements; unassisted and linked-account also completed a second hiring/payroll cycle. Retained evidence includes synthetic accounting assertions, not real provider transactions. Original browser artifacts were moved intact to `/tmp/payroll-browser-aa6-baseline-results`; the repository's tracked test-result marker was restored. All 2,678 original input hashes still matched before applying corrections.

The tested fixture patch has now been applied. Year-end setup additionally keeps only initial authorization historical, then restores actual application/database/browser clocks for elapsed-time delivery checks and refreshes its synthetic employee session for that later phase. Initial fixed-clock and expired-session candidate failures remain recorded in `/tmp/payroll-browser-clock-year-end.log` and `/tmp/payroll-browser-clock-year-end-final.log`. Both final manual/provider year-end cases passed in 1.6 minutes (`/tmp/payroll-browser-clock-year-end-session.log`).

Two final baseline failures were corrected directly after the baseline stopped: salaried onboarding now clicks the named checklist's summary instead of matching both navigation and checklist text; saved-journal testing uses an explicitly dated benefit authorization. Both passed in the real worktree (`/tmp/payroll-browser-final-corrections-owned-server.log`, two passes, 14.5 seconds). The first attempt could not connect because the completed baseline had closed its server; that result is retained separately in `/tmp/payroll-browser-final-corrections.log`.

In total, the integrated test/helper corrections have **47 final passing scoped browser checks across separate runs**, plus three unchanged I-9/payment-destination control checks and the separate phone/account-link check. Backend and application source are unchanged, so the full 992-pass backend result remains applicable. A fresh integrated serial 207-scenario browser run is required before claiming the broad browser gate green. No real payment, journal, document signature or agency submission was made.
