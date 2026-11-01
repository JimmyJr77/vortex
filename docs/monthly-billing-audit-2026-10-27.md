# Monthly billing audit — updated November 1, 2026

**November 1 remediation update — before the scheduled payment run**

The account review now covers 70 billing accounts. Eight accounts were repaired, Nkaa's November payment was verified, and four accounts still require payment setup or membership resolution and retain explicit billing alerts and account-history notes. The annual fee's September 1, 2026 end date was left unchanged, as instructed. No customer payment or refund was initiated during these repairs.

The billing fixes are **merged and deployed** as commit `3b04174d9b33821ed5ad65339afa7e6eb353e15f`: [billing readiness PR #21](https://github.com/JimmyJr77/vortex/pull/21). The [billing cron deployment](https://dashboard.render.com/cron/crn-d9fcjktaeets73bogiqg/deploys/dep-dbjd40u417fc73aq1igg) and [backend deployment](https://dashboard.render.com/web/srv-d3vpuebipnbc739k9mv0/deploys/dep-dbjd4cc9v7es739osci0) succeeded. At **01:48 EDT / 05:48 UTC**, the live backend reported the expected release, status OK, database connectivity, and ready billing/access schemas. The final read-only check reconfirmed the annual-fee end date, saved account alerts, and cleared Haralson checkout hold. The scheduled run remains **07:15 UTC / 02:15 EST on November 1**. Payment success is not yet observed; this update records readiness before that run.

| Account | Completed repair or verification | Expected November action / remaining limitation |
| --- | --- | --- |
| Keeton 10909 | Applied the effective cancellation and retired the unpaid $100 provisional charge. | No November tuition collection. |
| Reynolds 10932 | Restored $150 November tuition, replaced the stale migration audit, and verified household collection activation. | $235 due: $150 tuition plus the already-existing $85 annual fee. Athlete membership remains pending until payment. No new fee was created. |
| Aginam 10946 | Restored the missing $150 initial tuition for November 2–30 from the enrollment pricing preview. Membership is already paid. | $150 eligible for November billing. |
| Haralson 10936 | Confirmed the original $85 payment and approved full waiver; restored settled payment status while preserving its valid reallocation to tuition. Completed-checkout hold is cleared. | $190 November tuition. No replacement $85 membership charge. The release prevents the next checkout replay from incorrectly re-blocking the account. |
| Andoseh 10934 | Reassigned the two $127.50 November charges to the confirmed replacement enrollments. Verified both prior refunds. | $255 November tuition. Existing payment, refund, and invoice history is preserved. |
| Jackson 10914 | Honored October 31 cancellations, retained payment reversal history, retired the cancelled November class with an audited offset, and corrected remaining discounts. | $225 November tuition: $90 plus $135. This is the Jackson account for family 68. |
| Williams 10947 | Found during the expanded review. Replaced a stale migration audit and verified household collection activation. | $150 November tuition. Earlier $300 payment covers September and October only. |
| Nkaa 10933 | Stripe confirms the $300 payment already covered October and November. Current balance is zero. | Do not collect November again. Saved default Link connection is closed; customer must replace it before a future unpaid bill. Warning saved. |
| Markowitz 10920 | Per owner instruction, restored Nina in Typhoons (Adult), Monday 19:00–20:30, starting November 1. Created signup 186, monthly subscription 2442, and $150 November tuition charge 586. Existing membership is valid through September 4, 2027. | $300 total due: $150 November plus the preserved $150 October manual bill. No saved payment method; alert and account note updated. No payment or email sent. |
| Seres 10923 | $100 November tuition is posted; account is explicitly flagged. | Automatic collection remains disabled: no Stripe customer/saved method and no active athlete membership. Total balance is $285, including $185 earlier balance. Customer setup and membership resolution required. |
| Frazier 10941 | $100 November tuition is posted; account is explicitly flagged. | Automatic collection remains disabled: no Stripe customer/saved method and no active athlete membership. Customer setup and membership resolution required. |
| Bussell 10938 | Confirmed a saved card is now present; prepared the exact $100 first-month tuition calculation and saved the account hold. | $100 initial tuition remains unposted and collection is guarded. Athlete has no active membership, and the expired annual fee configuration must remain unchanged. Membership resolution is required. |

**Readiness and code corrections**

The post-repair November tuition review has only three unresolved accounts: Seres, Frazier, and Bussell. Markowitz's requested enrollment was also restored; its missing payment method remains a separate collection exception. The membership review checked 47 athletes with positive November tuition, including Nina after the enrollment repair; only those three plus Reynolds lack active membership. Reynolds already has a valid unpaid annual bill to collect. A saved method is evidence of setup, not a guarantee of bank approval.

The release preserves historical bills during future preparation, honors scheduled service endings, reports blocked invoice creation, and persists account holds separately from operational failures. It also recognizes proven, fully waived checkout payments that were legitimately reallocated, preventing a replay from incorrectly turning settled money back into pending money. Missing payment methods and enrollment migration-review requirements remain visible account holds in the recovery stage. Unknown failures still fail the job.

Readiness totals now share canonical billing's period selection. The previous summary omitted Aginam's November 2 start even though its actual charge passed validation. The repair changes reporting, not the amount charged. Final review: **$7,583.75 expected November tuition; $7,483.75 posted**. Bussell's held $100 is the remaining posting shortfall. These are tuition totals, not the predicted bank collection total. The saved-method review covered all 35 households with positive November tuition: 31 have eligible methods; Seres, Frazier, and Markowitz lack setup, and Nkaa's closed method is unnecessary for its already-paid November bill. No competing Stripe subscriptions/schedules or completed-checkout payment gaps were found. Among the 35 November tuition households, 29 have a positive balance, verified ledger, enabled collection, and an eligible saved method; this does not guarantee that their banks will approve payment.

**November 1–6 expected versus observed**

| Date | Scheduled behavior at 02:15 EST | Observed status at this pre-run review |
| --- | --- | --- |
| November 1 | Reconcile existing money first; apply lifecycle changes; validate November bills; attempt eligible unpaid household invoices. Account holds remain isolated. | Repairs, deployment, and live health verification completed at 01:48 EDT; scheduled run has not yet occurred. |
| November 2 | Reconciliation and ledger maintenance; no regular monthly collection attempt. | Future scheduled run. |
| November 3 | Reconciliation and ledger maintenance; no regular monthly collection attempt. | Future scheduled run. |
| November 4 | Initial attempt where none occurred, or an eligible retry after one confirmed failed attempt. Closed methods, hard declines, and uncertain outcomes remain guarded. | Future scheduled run. |
| November 5 | Reconciliation and December provisional posting; no regular November or December monthly collection. | Future scheduled run. |
| November 6 | Reconciliation and refresh December provisional bills; no separate automatic late-fee or suspension step was found in this job. | Future scheduled run. |

Customer-initiated checkout and authorized administrative payment activity can occur outside these monthly windows. This forecast does not claim such activity is prohibited.

**Evidence and validation**

Private before/after snapshots, per-account repair results, Stripe read confirmations, activation audits, annotation records, and final deployment proof are in `outputs/monthly-billing-remediation-2026-11-01/`. No private account data or repair scripts are included in the release PR. Repairs are also recorded in production account history.

The release's targeted suites passed 200 unit tests and 39 PostgreSQL regression tests. The migration fixture passed both disposable database checks. Hosted launch checks passed 1,095 tests (14 environment-gated skips), and the complete backend suite passed 3,294 tests (590 environment-gated skips). Both local and hosted browser suites passed all 75 enabled tests (250 existing opt-in skips), and the production build passed. [Final hosted CI](https://github.com/JimmyJr77/vortex/actions/runs/41277356882) succeeded with no failed tests. The staging-only backend integration step was not enabled in this environment. Both Render deployments and live health verification succeeded. The CI build now precedes tests of built entry pages. Browser fixtures follow the current member directory, refunds, and screen labels, and Vite selects its React environment consistently. CI test files now run sequentially to avoid CPU contention in timing assertions; the local SFTP fixture disables Nagle buffering to avoid Linux loopback delays, retaining the existing deadlines. Earlier local full-suite failures were traced to outdated webhook mocks and sandbox-denied local SFTP server binding; corrected webhook tests passed 9/9, and the permitted transport rerun passed 13/13.

This release covers the monthly billing fixes and their verification. The separate registration-route changes documented in `docs/registration-billing-audit-2026-10-27.md` remain local and were not included in this deployment.

**All households with November tuition or an older unpaid balance**

The other 35 reviewed billing accounts have no November tuition and no positive balance. The table below contains every account with November tuition or money currently due. These are verified ledger balances before the scheduled run, not successful payments. The 29 households with positive balances, verified November ledgers, enabled collection, and eligible methods total **$7,299.75**. Bank declines or a later account change can alter actual collection. Total balance includes earlier bills, existing annual fees, and credits; it is not always equal to November tuition.

| Household / account | November tuition | Total balance | Readiness / action |
| --- | ---: | ---: | --- |
| Lee Family 10891 | $150.00 | $150.00 | Ledger verified; enabled collection and eligible saved method. |
| Matthews Family 10892 | $100.00 | $100.00 | Ledger verified; enabled collection and eligible saved method. |
| Harris Family 10893 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Johnson  Family 10894 | $150.00 | $0.00 | No unpaid balance; no additional collection expected. |
| Barnett Family 10895 | $213.75 | $288.75 | Ledger verified; enabled collection and eligible saved method. |
| Armstrong Family 10897 | $150.00 | $150.00 | Ledger verified; enabled collection and eligible saved method. |
| Wynn Family 10898 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Hatch Family 10902 | $150.00 | $150.00 | Ledger verified; enabled collection and eligible saved method. |
| Roberts Family 10903 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Ortiz Family 10905 | $255.00 | $330.00 | Ledger verified; enabled collection and eligible saved method. |
| Nepal Family 10906 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Caballero Family 10910 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Mills Family 10913 | $360.00 | $360.00 | Ledger verified; enabled collection and eligible saved method. |
| Jackson Family 10914 | $225.00 | $225.00 | Ledger verified; enabled collection and eligible saved method. |
| Moore Carrington Family 10915 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Bryant  Family 10917 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Beaudreault Family 10918 | $450.00 | $450.00 | Ledger verified; enabled collection and eligible saved method. |
| Clarke Family 10919 | $360.00 | $441.00 | Ledger verified; enabled collection and eligible saved method. |
| Markowitz Family 10920 | $150.00 | $300.00 | Enrollment restored as requested; payment method needed. |
| Perez Family 10921 | $225.00 | $225.00 | Ledger verified; enabled collection and eligible saved method. |
| Upchurch Family 10922 | $255.00 | $330.00 | Ledger verified; enabled collection and eligible saved method. |
| Seres Family 10923 | $100.00 | $285.00 | Hold: collection disabled; payment method and membership needed. |
| Onodje Family 10925 | $150.00 | $150.00 | Ledger verified; enabled collection and eligible saved method. |
| Wells Family 10926 | $450.00 | $450.00 | Ledger verified; enabled collection and eligible saved method. |
| Jackson Family 10928 | $255.00 | $330.00 | Ledger verified; enabled collection and eligible saved method. |
| Reynolds Family 10932 | $150.00 | $235.00 | Ready; balance includes existing $85 membership bill. |
| Nkaa Family 10933 | $150.00 | $0.00 | November already paid; replace closed Link for future bills. |
| Andoseh Family 10934 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Haralson Family 10936 | $190.00 | $190.00 | Ledger verified; enabled collection and eligible saved method. |
| Bussell Family 10938 | $100.00 | $0.00 | Hold: membership unresolved; $100 tuition remains unposted. |
| Frazier Family 10941 | $100.00 | $100.00 | Hold: collection disabled; payment method and membership needed. |
| li Family 10943 | $255.00 | $255.00 | Ledger verified; enabled collection and eligible saved method. |
| Byrd Family 10944 | $150.00 | $150.00 | Ledger verified; enabled collection and eligible saved method. |
| Aginam Family 10946 | $150.00 | $150.00 | Ledger verified; enabled collection and eligible saved method. |
| Williams Family 10947 | $150.00 | $150.00 | Ledger verified; enabled collection and eligible saved method. |

---

**Original October 27 audit — historical findings retained below**

**Assessment: November billing is not ready to be treated as reliable without remediation.** The schedule is configured, but production has account exclusions, payment-method problems, and ledger conflicts. The full daily billing job has failed on every scheduled run from October 2 through October 27. Successful reconciliation records alone conceal the downstream recurring-stage failures.

This report separates observed October 1–6 activity from the upcoming November 1–6 forecast. All dates below use America/New_York. Evidence was collected October 27 at approximately 03:20–03:35 EDT from production PostgreSQL in enforced read-only mode, Stripe read APIs, deployed Render configuration/logs, and repository code. No production charges, refunds, data corrections, configuration changes, or deployments were performed.

**Deployed schedule and behavior**

Render runs `npm run billing:daily` at 07:15 UTC daily. That was 03:15 EDT in October; after the November 1 daylight-saving transition it will be **02:15 EST** for November 1–6. Production cron is deployed at commit `80a77d58f4d7b13975310084fcb25993e3cd650d` with household invoices, automatic activation, and collection cutover enabled; Stripe subscription creation is disabled and class subscriptions use household billing. The earlier registration changes in this workspace remain undeployed.

The daily command runs reconciliation first, then recurring billing. Recurring billing applies lifecycle changes, checks charges, allocates payments, and collects only in permitted windows. A nonzero reconciliation process exit prevents the collection stage; individual recurring account failures are quarantined and can make the overall job fail after other accounts have been processed. A failed job therefore does not prove that no work occurred.

| Day | Expected under current deployed policy; November forecast | Observed October activity |
| --- | --- | --- |
| 1 | Reconcile, apply effective cancellations/pauses, post/check November charges and eligible annual renewals, apply available payments/credits, then attempt eligible household invoices. Existing paid invoices must not be collected again. | 22 household invoices totaling $5,716.88 were created late evening, 22:58–23:38 EDT. 21 paid that date, totaling $5,461.88. Roberts' $255 invoice failed and was paid October 17. Timing does not establish that the morning scheduled job produced these invoices. The full scheduled job was successful on October 1. |
| 2 | Daily reconciliation and ledger maintenance; no regular monthly collection attempt. | Two invoices were created after midnight: Matthews $200 and Jackson account 10914 $400. Both were subsequently voided as covered/duplicate. No successful household invoice payments that day. Full daily job failed. |
| 3 | Daily reconciliation and maintenance; no regular monthly collection attempt. | No new household invoices or successful household invoice payments. Full daily job failed. |
| 4 | Retry eligible invoices with one confirmed failed attempt, or make an initial attempt if no prior attempt was made. Hard declines and unknown payment outcomes remain guarded. | No new household invoices or successful household invoice payments. No fourth-day retry was recorded for Roberts; the invoice retained one automatic attempt. The failed daily job and available records do not establish the exact reason that retry was absent. |
| 5 | Reconcile November and begin posting **December provisional charges**, without collecting December tuition. No regular November collection attempt. | 51 November provisional charge rows were posted, totaling $5,823.75 at audit time. Two October-labeled invoices incorrectly contained November tuition: Moore Carrington $255 failed; Andoseh $255 was collected early. Full daily job failed. |
| 6 | Continue November reconciliation and refresh December provisional charges. No regular monthly collection, automatic late-fee step, or sixth-day suspension step was found in this job. | Seven more November charge rows were posted, totaling $785. No new household invoices or successful household invoice payments. Moore Carrington's premature invoice was voided. Andoseh received two successful $127.50 refunds, returning the entire $255 early charge. Full daily job failed. |

The October 5 collection-window defect was addressed in deployed October 6 changes. Current code restricts regular automatic collection to days 1 and 4. This fixes that historical timing defect, but does not repair the remaining account data conflicts. Customer-initiated payments, administrative payments, new enrollment checkout, and refund activity can occur outside the monthly collection windows; the table is not a claim that all financial activity stops on other days.

**What the latest production run actually did**

October 27's run started at 03:15:34 EDT. Reconciliation completed at 03:17:32 with status `succeeded`, two mismatches/two durable-owner failures, 33 canonical collector accounts checked, and no collector drift. Recurring billing then quarantined seven accounts: Hatch 10902, Udechukwu 10907, Keeton 10909, Mills 10913, Perez 10921, Andoseh 10934, and Haralson 10936. Each reported `target_month_recurring_charge_parity_failed`. The run reported zero subscriptions processed, zero charges posted, and zero household invoices created in its recurring summary, then exited with status 1 at approximately 03:24:51. Other preparation work can precede that summary, including the Aginam subscription mapping created during this run.

The seven current failures are not an exact prediction of November's failures. Read-only November comparisons pass for Hatch, Udechukwu, Mills, and Perez. Their October comparisons involve ended/replaced enrollments, prorated charges, or historical discounts compared against current enrollment pricing. These are reconciliation inconsistencies, not sufficient evidence to rewrite settled October charges. Haralson's November tuition comparison passes but its separate paid-checkout guard remains a blocker. Keeton may resolve through the November cancellation lifecycle, as described below.

**November tuition readiness**

Across 69 billing accounts, expected November tuition is **$7,713.75**, with **$7,413.75 posted**. The net $300 shortfall consists of $400 missing tuition offset by an extra $100 cancellation-related provisional charge. These are tuition ledger totals, not a predicted bank collection amount: arrears, annual fees, credits, and existing payments can change the amount actually due.

| Account | November tuition expected / posted | Finding and required action |
| --- | --- | --- |
| Reynolds 10932 | $150 / $0 | Collection is disabled despite a saved payment method. Existing migration state is skipped by automatic activation. Resolve the missing charge and collection eligibility; the daily job will not simply activate it. |
| Bussell 10938 | $100 / $0 | Enrollment starts November 1, but the subscription's next bill date is December 1 and initial November tuition is missing. Collection is disabled and no Stripe customer exists. Restore first-month billing and establish the intended collection arrangement. |
| Aginam 10946 | $150 / $0 | Enrollment starts November 2. Today's automatic mapping repair created a subscription whose next bill date is December 1, leaving November's initial tuition missing. Membership was paid and a valid saved method exists, but collection is disabled. Mapping repair alone does not recover the initial tuition. |
| Seres 10923 | $100 / $100 | Tuition exists, but automatic collection is disabled and no Stripe customer exists. Confirm intentional manual billing or complete collection setup. |
| Frazier 10941 | $100 / $100 | Same automatic-collection exclusion and missing Stripe customer. A posted ledger charge is not evidence that payment will be collected. |
| Andoseh 10934 | $255 / $255 | Correct total is linked to cancelled subscriptions 402/403 instead of current 1375/1377. Existing paid-invoice history prevents automatic rewriting. Repair allocation/source ownership while preserving the confirmed $255 refund history; do not duplicate the tuition. |
| Keeton 10909 | $0 / $100 | Cancellation is effective November 1; an unpaid provisional $100 November charge remains. Lifecycle cancellation followed by mutable-charge reconciliation is expected to remove it at rollover, provided it remains unreserved/unpaid. Verify removal before collection; this read-only audit did not execute that repair. |
| Nkaa 10933 | $150 / $150 | The saved Link payment method is explicitly classified `link_account_closed`. Obtain a usable replacement; retrying the closed account is not a remedy. |
| Haralson 10936 | $190 / $190 | A completed $85 membership checkout has no matching owner payment/application. The household invoice guard blocks collection to avoid charging already-paid money again. Reconcile the existing checkout funds; do not charge another $85 membership fee. |

The turnover checker identifies the first seven account exceptions. Payment-method and completed-checkout checks independently add Nkaa and Haralson. The remaining 31 of 32 inspected saved defaults passed structural readiness checks; that does not guarantee bank approval. No active/nonterminal Stripe subscriptions or active/not-started subscription schedules were found, reducing the risk of a competing legacy monthly collector. The active subscription snapshot contained no annual renewals due through November 30; existing annual-fee balances are a separate concern.

**Additional code and operational inconsistencies**

- The invoice builder returns `blocked: 'paid_checkout_owner_payment_gap'` for cases such as Haralson. The recurring caller handles selected `skipped` results but fails to propagate this `blocked` result. A controlled in-memory execution reproduced a zero-invoice result without a reported block on both days 1 and 4. Operational summaries can therefore underreport a real collection blocker.
- Repairing a missing recurring subscription does not necessarily create the enrollment's unpaid first-month charge. Aginam demonstrates this gap; Bussell has a similar first-month/next-bill-date mismatch.
- Reconciliation records showing `succeeded` do not certify end-to-end billing. Monitor the full process exit and account results. Render shows 26 consecutive failed daily runs, October 2–27.
- Historical/current pricing comparisons can quarantine accounts after swaps, cancellation, proration, or discount changes. Repair that comparison without replacing valid historical charges with today's full-month prices.
- The fifth is a posting date for the following month, not its collection date. Andoseh's paid Stripe invoice remains marked paid even after refund; interpreting invoice status alone would miss that all money was returned.

**Required before November 1**

1. Repair Andoseh's source/allocation conflict and Haralson's paid-checkout fulfillment using existing payment/refund evidence.
2. Restore the missing $400 in November tuition and resolve collection eligibility for Reynolds, Bussell, and Aginam. Establish whether Seres and Frazier are intentionally manual or should be enabled for automatic collection.
3. Replace Nkaa's closed payment method and verify Keeton's $100 provisional charge is removed before collection.
4. Correct blocked-result reporting and the historical-pricing reconciliation issue, then verify a successful full daily run and rerun the November readiness review.
5. On November 1, reconcile actual Stripe results to invoice/payment/application records; on November 4, check eligible retries individually. On November 5–6, verify December postings occur without December collection.

These are remediation requirements, not completed changes. The audit did not trigger payments or mutate production to make the forecast pass.

**Validation and evidence**

The targeted recurring-billing and household-invoice test suites passed **111 tests**, with no skips. An in-memory policy trace exercised days 1–6 for new invoices, a prior failed attempt, already-paid invoices, and blocked paid checkouts. These checks establish the code's intended control flow, not live payment success. Production state was read during an active cron run, so the report explicitly distinguishes the earlier readiness snapshot from the subscription mapping created during that run.

- [Production Render cron and events](https://dashboard.render.com/cron/crn-d9fcjktaeets73bogiqg)
- [October 27 production run logs](https://dashboard.render.com/cron/crn-d9fcjktaeets73bogiqg/logs?r=2026-10-27%4007%3A14%3A34%7E2026-10-27%4007%3A25%3A51)
- Code: `backend/render.yaml`, `backend/billing/runDailyBilling.js`, `backend/scheduling/runRecurringCharges.js`, `backend/scheduling/generateRecurringCharges.js`, `backend/billing/householdMonthlyInvoice.js`, and `backend/billing/paidCheckoutCollectionGuard.js`.
- Local evidence directory: `outputs/monthly-billing-audit-2026-10-27/`. `database.json` records observed billing history; `readiness.json` records the November turnover check; `parity.json` compares current/future charge ownership; `stripe.json` verifies invoices and competing collectors; `method-readiness.json` checks saved methods; `details.json` records invoice lines and the paid-checkout gap; `refunds.json` verifies the two successful refunds; `policy-trace.json` records the isolated day-by-day code execution. These files contain private billing information and should remain internal.
