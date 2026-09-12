# Federal remittance workflow

Admin > Payroll > Compliance contains **Federal remittance review**. It prepares a retained review from finalized payroll and recorded tax deposits. It does not yet transmit a tax payment.

## Current admin flow

1. Verify the employer filing identity, federal deposit schedule and applicable employer tax rates in employer setup.
2. Open Compliance and choose the tax year. The current instruction codec supports 2026.
3. Choose an outstanding Form 941 or FUTA obligation and a planned settlement date. The date must be a future eligible business day on or after covered payroll dates. A date after the obligation deadline is explicitly labeled late.
4. Preview the current balance and tax period, enter the review reference and confirm the facts.
5. Retain the review. The source fingerprint, encrypted bank instruction, actor and reference are immutable. Repeating an unchanged request with the same reference returns the same review.
6. Refresh obligations after payroll, identity or deposit changes. Old reviews remain in history and are marked as needing refresh when their facts no longer match.

Only the last four EIN digits are returned to the UI. Instructions are encrypted using the payroll document key with a facility- and review-specific context. The API does not expose a raw TXP addenda record, bank account details or full EIN.

## Instruction conventions

The [EFTPS Financial Institution Handbook, February 2026](https://download.eftps.gov/Financial_Institution_Handbook.pdf) specifies CCD+ tax records. The current codec uses:

- Form 941 deposit code `94105`, with the return quarter's ending month.
- FUTA deposit code `09405`, with the annual December return period even for quarterly deposits.
- A `YYMM01` tax-period field, distinct from the planned bank settlement date.
- Total-only tax amounts in integer cents; the amount-type field repeats the tax code. This avoids assigning unsupported component allocations to partially covered balances.
- A nine-digit taxpayer EIN in the tax addenda and the separate entry-identification field.
- The handbook's Treasury receiving account and routing values, retained only within encrypted instructions.

See [Treasury's EFTPS resources](https://fiscal.treasury.gov/payments-to-government/electronic-federal-tax-payment-system-eftps/resources) for enrollment and bank instructions. The future transmission contract must verify the bank's cutoff, enrollment requirements, required file fields and return handling.

## Remaining execution work

The [Modern Treasury payment-order API](https://docs.moderntreasury.com/platform/reference/create-payment-order) supports remittance information, but that alone has not established a verified mapping for every EFTPS-required bank-file field. Current code therefore does not submit a generic ACH payment as a tax deposit.

Execution still needs a verified provider contract and employer enrollment, funding/account verification, explicit payment authorization, durable submission claims and idempotency, uncertain-send recovery, bank and agency acknowledgments, returns, liability allocation, deposit receipts and accounting reconciliation. Scheduled automation must use those same controls. A retained review must never itself mark an obligation paid or dismiss a deposit deadline.

This limitation is recorded as assumption 318 in the implementation register. The overall hire-to-payroll goal remains open.

## Bank tax-field diagnostic

Open a current retained review's **Compare bank tax fields** panel and choose a bank-generated ACH sample containing one tax credit. The comparison checks the batch, entry and TXP fields against that review, including the separate entry-detail EIN. Mismatches identify the field without exposing its value. The upload is not retained. If payroll, identity or deposit facts changed, retain a refreshed review first.

This is a tax-field diagnostic, not a complete NACHA validator or proof of bank acceptance. It accepts only a credit-only CCD sample with one tax entry; balanced files and multiple entries need a separate supported validation path. It does not send funds or create a deposit receipt. Field layouts follow [Nacha's ACH file details](https://achdevguide.nacha.org/ach-file-details) and the Treasury handbook linked above.
