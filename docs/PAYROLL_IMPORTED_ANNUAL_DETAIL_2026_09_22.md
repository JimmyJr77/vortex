# Imported annual payroll detail — implementation evidence

The isolated imported-history candidate now distinguishes uncapped employment wage opening balances from annual reporting wages. An imported gross/total-tax/net record is insufficient to split employee withholding or establish qualified overtime.

Reviewed sources on September 22, 2026:

- [IRS 2026 W-2/W-3 instructions](https://www.irs.gov/instructions/iw2w3): separate wage and withholding boxes; Social Security reporting uses its annual wage limit, while Medicare wages are separately retained.
- [IRS qualified-overtime questions and answers](https://www.irs.gov/newsroom/questions-and-answers-about-the-new-deduction-for-qualified-overtime-compensation): separate employer reporting applies beginning in 2026. The reviewed FLSA premium is not total overtime compensation.
- [IRS Additional Medicare questions and answers](https://www.irs.gov/businesses/small-businesses-self-employed/questions-and-answers-for-the-additional-medicare-tax): W-2 box 6 includes regular and Additional Medicare tax withheld.

## Assumptions and retained boundaries

1. The imported payment belongs to the same employee and employer, and its original register supports each independently entered amount.
2. Current imported payment entry remains wage-only: gross less total employee withholding equals net. Imported benefits, reimbursements, other deductions and unusual compensation need additional retained components before support can expand.
3. Reported Social Security wages are distinct from uncapped Social Security opening balances. Reported Medicare wages use the reviewed Medicare opening basis. Reporting amounts are retained from records, not guessed from tax rates or net pay.
4. Every annual amount, including zero, is explicit. Withholding components must sum exactly to the original payment's retained employee-tax total.
5. Qualified overtime requires a separate retained review; ordinary overtime pay is not automatically a qualified premium. No employee-level deduction limit is applied to the employer's reported premium.
6. Annual review can be added in a later immutable wage-review revision. Older opening-balance reviews may support prospective payroll but remain incomplete for annual reporting.
7. Review IDs and source fingerprints participate in annual preparation evidence. Unresolved, changed or contradictory imported/native history invalidates current annual preparation.
8. Existing annual identity, compensation applicability, benefit, overtime and form-approval gates remain required. Capturing imported detail does not itself approve or file a W-2.
9. This stage uses the existing 2026 Maryland reporting workflow. Other states/years and unsupported payment categories remain part of the full goal.

The implementation remains isolated at `/tmp/vortex-payroll-opening-history`; migration 833 and this follow-up are not live. Final verification evidence is recorded separately after its active checks complete. Quarterly/agency reconciliation, reconciliation exports, a complete imported-to-W-2 approval/furnishing journey, broader regressions and integration remain required.

## Reporting follow-up

Reviewed imported amounts now feed payment-date-filtered wage-basis reports and employee CSV exports. Imported withholding stays in explicitly separate columns from native taxes. The review ID and source fingerprint are retained in the export. Pool-based reporting reads use repeatable-read snapshots; a tested concurrent update preserves the active report and makes the next read stale.

Optional employer Social Security, Medicare, FUTA and Maryland unemployment entries require explicit zeroes, amounts and an original-register reference. Tax reconciliation and federal deposit deadlines use those actual employer amounts, without assuming they equal employee withholding. [IRS Form 941 instructions](https://www.irs.gov/instructions/i941) distinguish employer and employee shares; Additional Medicare remains an employee-only component. The broader rules for credits, adjustments and unusual compensation still require separate implementation.

The latest focused run passed 26 backend checks and two mobile browser cases. An imported receipt initially matches retained payment/review evidence; another review revision changes that evidence. Source comparison canonicalizes JSON object key order. Mobile entry, rejected amount recovery, exact retry, report totals and the Compliance inclusion notice passed. TypeScript and scoped lint passed; the mobile wage view was inspected.

Remaining: form-specific reported wage reconciliation (the receipt workflow still uses gross control totals), tax-liability and agency exports, dependent remittance/calendar coverage, expanded payment components and broad integration/regression. The candidate remains isolated and unpublished.
