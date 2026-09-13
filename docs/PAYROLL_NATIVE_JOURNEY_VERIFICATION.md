# Native onboarding-to-payroll verification gap

The full goal is not complete. This audit distinguishes implemented native form workflows from evidence that one fresh hire can complete them together and proceed through payroll. Source review baseline: commit `3e48fa02`; payroll code is held unchanged during the full serial backend run logged at `/tmp/payroll-full-after-everify.log`.

## What the existing tests prove

`tests/e2e/payroll-complete-journey.spec.ts` creates a hire and exercises invitation/sign-in, checklist review, schedules and payroll against the isolated APIs. Its form loop (lines 66–78 at this baseline) uploads a synthetic PDF header for W-4 and supplies `BROWSER-TEST-RECEIPT` for state withholding and employee I-9. Its admin loop (lines 101–123) uses generic completion for those tasks and employer I-9 review. This remains evidence for the external-certificate/checklist branch, not the native signer chain.

The current `OnboardingWorkspace.tsx` still exposes that generic branch before native submission. Native submission IDs then switch the task to internal-certificate behavior. Therefore a passing legacy journey does not exercise native-form readiness, signature provenance, employer examination, or tax-election application across the complete hire.

The focused W-4, MW507 and employee I-9 browser tests start from `monthlyBenefitsFixture`, with a fixture-created employee and injected employee session. Employer/preparer/copy/signing tests start from retained employee-form fixtures. These tests substantiate their particular boundaries; their fixtures do not prove fresh invitation redemption through all native forms and the first payroll in the same employee record.

## Required integrated journey

| Boundary | Evidence required before claiming completion | Existing evidence and remaining gap |
| --- | --- | --- |
| Fresh hire and access | Create the employee through admin UI; issue/redeem a test invitation; establish a returning employee session without injecting a pre-created session. | Broad legacy journey covers access. Combine it with the native forms. Real invitation delivery remains a separate rollout check. |
| Hiring context and personal details | Employee completes profile; admin records offer/participation context; stored hire/context dates and revisions match the current person. | Separate profile/context checks exist. Preserve these through the integrated native flow. |
| Native W-4 | Employee saves/resumes, reads every required page, signs; admin reviews/applies the exact signed election; retained PDF/hash and effective election agree. | `payroll-w4-signing.spec.ts` covers ordinary/exempt focused cases. Integrate at least the ordinary case before first payroll; retain other branches as separate required cases. |
| Native Maryland certificate | Employee completes the applicable MW507 case, reviews/signs; admin application produces the intended effective state/local election. | `payroll-mw507-signing.spec.ts` covers several signer cases. Unsupported certificate application must remain explicitly unresolved, not substituted by a provider receipt. |
| Employee I-9 | Offer context, employee choices, every page review and actual signature persist; no provider receipt replaces the native submission. | `payroll-i9-draft.spec.ts` and backend signer checks cover this individually. Connect to the same fresh hire. |
| Preparers where applicable | Each preparer uses their own access and certificate; employee/admin review uses the current complete roster. | `payroll-i9-preparer.spec.ts` is focused evidence. Add an assisted journey variation; the unassisted path does not prove this branch. |
| Employer I-9 | Admin saves/reopens draft/findings, reviews chosen document copies and every packet page, records examination and signs; signature/copy links remain current. | Employer draft/review/copy/signing tests cover these boundaries. Connect them to native employee submission and subsequent activation. |
| E-Verify where applicable | Retain actual case evidence, keep interim cases actionable, resolve authorized closure with evidence, preserve history and avoid automatic earned-pay withholding. | Focused browser/backend coverage exists for authorized closure and unresolved correction. Government submission, notices/referrals and other dispositions remain unfinished. |
| Remaining hiring readiness | Payment destination/election, benefits, wage/handbook acknowledgments, new-hire reporting, training and first-shift reviews all reference the current terms and evidence. | Legacy journey and focused features provide partial coverage. Revalidate readiness after native forms; no direct database completion or hidden test-only override. |
| Scheduling and time | Admin schedules; employee sees/acknowledges applicable terms, records work; admin approves correct paid minutes and any leave treatment. | Existing schedule/time tests remain relevant. Connect the first approved work to this hire and current pay election. |
| First payroll and statement | Build/review/authorize payroll from the native elections and approved work; verify calculations independently, payment evidence/closeout and employee statement download. | Legacy integrated payroll and focused settlement/tax checks exist. No fresh all-native hire-to-statement proof yet. |
| QuickBooks and reporting | Verify the corresponding supported journal/export and retained reconciliation evidence with exact payroll amounts. | Focused synthetic accounting coverage is separate. Live provider acceptance remains unverified. |
| Return and correction | Reload/re-sign where required; changed evidence reopens readiness; prior signatures/results remain historical; repeated requests do not duplicate side effects. | Focused tests cover many retries/amendments. Verify the integrated person's lifecycle too. |

## Execution rules and limits

- Finish the currently running backend suite before starting another database/browser suite. Preserve its process handle and report its actual terminal result, including skips and failures.
- Use the isolated database and provider doubles. Do not send real invitations, government submissions, payments or journals as test setup.
- Keep native-generated PDFs and current signatures in the integrated flow; do not use generic completion to make native readiness pass.
- Treat each unsupported arrangement or unresolved provider/lifecycle path as unfinished. A passing representative Maryland hire does not prove every new-hire branch or production readiness.
- Keep the broader schedule, time, leave, benefits, retirement, payment, compliance and accounting gaps in the main completion audit. This document adds a missing proof obligation; it does not replace or narrow the goal.
