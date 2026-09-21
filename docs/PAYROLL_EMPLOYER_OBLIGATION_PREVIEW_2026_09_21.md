# Employer formula obligations in payroll preview

Payroll now applies the retained employer formula after compensation and eligibility are reviewed. The obligation preview uses the same exact tier and rounding implementation as the complete employer calculation. It displays matching and nonelective obligations separately without deducting employee pay, making a ledger reservation or authorizing remittance.

The formula stage is now separated from prior-funding offsets and annual-additions reconciliation. This distinction permits a known nonelective obligation to be displayed while employee deferrals are still unavailable for matching. Unknown matching is represented by null, including tier amounts and the combined total; it is never presented as zero. A reviewed ineligible matching component or a nonelective-only formula does not require deferrals. Deferral amounts remain null in that case, explicitly marked NOT_REQUIRED. A known zero is distinct and has a different fingerprint.

## Assumptions and remaining work

- The current pre-approval producer supplies reviewed compensation and employer eligibility. It does not yet calculate actual employee deferrals for employer-funded plans. Eligible matching therefore remains unresolved in that path; the shared formula function supports actual ordinary/catch-up amounts when those are available.
- Catch-up evidence is needed for matching only when the retained formula includes it. Missing ordinary deferrals still leave eligible matching unresolved.
- An obligation is the formula amount before prior contributions and annual-additions reconciliation. It is not the amount authorized to fund. Both reviews remain explicitly required, alongside approval reservations and payroll integration.
- Vesting does not reduce the obligation. Ineligible components produce zero obligation based on the reviewed eligibility finding.
- Annual true-up scope and off-cycle earning-period eligibility remain unresolved in the preview producer. No formula obligation is shown when eligibility is unresolved.
- The overall goal still requires actual employee-deferral composition for employer-funded plans, prior employer funding, annual-additions reservations, statements, accounting, remittance and exception handling. Render deployment of this increment is not yet verified.

## Verification

**22 backend tests passed, 0 failed, 0 skipped**, 3.89 seconds (`/tmp/payroll-employer-obligation-final-tests.log`). They cover known/unknown/unused deferral evidence, catch-up applicability, partial matching with known nonelective obligation, exact existing calculations, normal payroll, compensation sources, and a mid-period new hire with zero vesting. Actual API previews show a $4 nonelective obligation on $200 compensation, retain matching as unknown when matching eligibility is added, and remove the obligation preview when period eligibility becomes unresolved.

Compared the complete calculator at the parent commit against the refactored implementation across 180 compensation, deferral, prior-funding and capacity combinations. Complete output objects, including fingerprints, matched exactly. This protects existing retained calculation evidence from an incidental refactor change.

**1 mobile browser test passed**, 12.8 seconds including build/startup (`/tmp/payroll-employer-obligation-browser.log`). The real payroll page transitions from missing eligibility guidance to a reviewed $2 nonelective obligation on $100 of capped compensation, with no reserved contribution. The fixture uses a scoped historical database clock and a Date-only test clock after the assessed period; its authorizations precede payment. No page errors or horizontal overflow occurred at 390px. Screenshot `/tmp/payroll-employer-compensation-preview-mobile.png` was inspected. Whitespace checks passed. No real employee, invitation or financial/provider operation occurred.
