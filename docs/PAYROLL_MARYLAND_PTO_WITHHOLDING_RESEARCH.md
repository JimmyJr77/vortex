# Maryland standalone PTO withholding: implementation evidence

Reviewed September 12, 2026. Native Maryland withholding for a separate unused-PTO payout remains unfinished.

The [2026 Maryland Employer Withholding Guide](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf), section 3, includes vacation allowances in taxable wages. Section 4 directs calculation using the applicable payroll-period percentage schedule, exemptions and local rate. Its flat-rate entries are specifically labeled for annual bonus distributions. Those entries alone do not establish the method for separate unused-PTO cashouts.

[Tax-General section 10-908(a)](https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-908.pdf) directs employers to the Comptroller's withholding tables/schedules. [COMAR 03.04.01.01](https://regs.maryland.gov/us/md/exec/comar/03.04.01.01) governs certificates and withholding obligations; the reviewed text did not resolve the separate-PTO payroll-period calculation choice. [IRS Publication 15, section 7](https://www.irs.gov/publications/p15) classifies unused vacation paid in addition to regular wages as supplemental wages for federal withholding. That federal rule does not independently establish Maryland's method.

Current implementation retains a professional Maryland amount bound to the exact payout, elections, federal calculation, retirement proposal and payment history. It now also binds independently reconciled Maryland history: prior state wages, state tax withheld, source fingerprints, and reconciliation issues. Source snapshots stay server-side. A change to prior state withholding or its evidence invalidates the retained PTO review, including when federal amounts are unchanged.

Next implementation requirements:

- Establish the applicable Maryland method and payroll-period treatment for a separate unused-leave payment, including prior payments in that period and additional withholding elections. Do not assume that the annual-bonus flat rate applies.
- Implement complete state wage/withholding allocation for current, earlier, imported and corrected payments. Federal supplemental classifications alone are insufficient.
- Support applicable local rates, exemptions, cross-year and post-employment treatments with explicit source evidence.
- Connect the approved method to internal calculation, retained method/source evidence, draft and approval revalidation, employee statements and state reporting; verify repeated payments and changed evidence end to end.

The source reconciliation added here is a prerequisite and an improvement to existing review validity. It is not a claim that native Maryland PTO withholding is complete or that production tax calculations have been accepted.

## Additional source finding during the broad regression

The Comptroller's [income-tax rates and withholding guidance](https://services.marylandcomptroller.gov/taxes/en/maryland-income-tax-rates-and-brackets?id=kb_article_view&sysparm_article=KB0010014), under Percentage Method, explicitly directs employers to the jurisdiction table's bottom rate for a lump sum distribution or annual bonus. Its [2026 3.20% local percentage table](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm320.pdf), printed page 39, gives 9.70%. This is broader wording than the PDF heading alone and changes the next implementation step: design native lump-sum handling from this guidance rather than assuming that only an annual bonus can use the listed rate.

Implementation inference to retain explicitly: a separately reserved, verified unused-vacation cashout paid as one lump sum can be classified under this lump-sum guidance. That does not classify ordinary paid leave, installments or other compensation automatically. The guidance does not independently settle every exemption, additional-withholding or locality-selection exception.

Next concrete implementation after the current regression finishes:

1. Add a versioned lump-sum calculator with exact integer-cent rounding, official source identifiers, tax year and verified applicable local table. Preserve independently verified Maryland taxable wages after supported deferrals; do not subtract the regular-period standard deduction or personal exemptions again in the flat-rate calculation.
2. Bind the supported classification and current elections to the payout's retained source evidence. Route unsupported/exempt/additional-withholding cases to explicit reviewed treatment until their rules are implemented; never substitute a different locality silently.
3. Preserve existing explicitly reviewed state amounts and historical approvals. Show the selected method, taxable basis, rate, state amount and remaining review issues in the PTO form and payroll review. Retain the method with the statement and revalidate before approval/finalization.
4. Test rounding boundaries, changed elections and sources, negative net pay, repeated payments, supported deferrals and excluded post-employment deferrals, both federal methods, historical reviewed amounts, employee statements and state reporting. Extend applicable local tables and special-election support as part of the full goal.

No calculator or runtime input was changed during the broad regression. This source finding narrows the method uncertainty; native PTO integration and the broader exceptions are still unfinished.

The isolated calculator and two standalone tests are prepared at checkpoint 470. They are deliberately unconnected while the broad regression uses its original input graph. Integration and full exception coverage remain pending.

## Verified local-rate mapping for the isolated calculator

The [Comptroller's 2026 jurisdiction links](https://services.marylandcomptroller.gov/taxes/en/maryland-income-tax-rates-and-brackets?id=kb_article_view&sysparm_article=KB0010014) select the following published tables. These are table assignments for an already verified local rate; county/income-tier selection remains separate.

| Actual local rate | Withholding table | Lump-sum rate |
| --- | --- | --- |
| 2.25% | [PM225](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm225.pdf) | 8.75% |
| 2.40% | [PM240](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm240.pdf) | 8.90% |
| 2.65% | [PM265](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm265.pdf) | 9.15% |
| 2.70, 2.74, 2.75% | [PM275](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm275.pdf) | 9.25% |
| 2.94, 2.95, 2.96% | [PM300](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm300.pdf) | 9.50% |
| 3.03% | [PM305](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm305.pdf) | 9.55% |
| 3.06% | [PM310](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm310.pdf) | 9.60% |
| 3.20% | [PM320](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm320.pdf) | 9.70% |
| 3.30% | [PM330](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/pm330.pdf) | 9.80% |

Checkpoint 471 extends the isolated calculator across these mappings. Three standalone tests passed. The calculator remains unconnected during the broad regression, and exceptional elections, locality selection and payroll integration remain open.
