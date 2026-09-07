# Vortex Payroll Operations

This module is an evidence-first payroll operations system. It tracks employees, secure one-time onboarding invitations, employee self-service, schedules, daily time, pay periods, earnings and deductions, Maryland sick-leave accruals, calculation snapshots, pay statements, compliance tasks, reports, QuickBooks journal exports, export reconciliation, and an audit trail.

It is currently in **record-only mode**. It does not move money, file a tax return, make a tax deposit, submit a new-hire report, or treat an AI answer as approval.

## Owner workflow

### Before the first valid payroll

1. Obtain Maryland workers' compensation coverage.
2. Register the Maryland withholding/CRN and unemployment accounts.
3. Complete the late Maryland new-hire report and determine whether catch-up or corrected filings are required.
4. Have Maria complete Form W-4 and Maryland MW507; complete Form I-9 using acceptable documents she chooses.
5. Reconstruct actual January–July daily time from schedules, messages, access records, calendars, and employee attestation. Do not force hours to equal the transfers.
6. Have a payroll professional reconcile the $24,078 of owner-reported gross-wage intent, withholding, employer taxes, deposits, Forms 941, unemployment reporting, and pay statements.
7. Configure and independently test the current federal, Maryland, local, FUTA, and unemployment tax rules before enabling payroll approval.

### Each workday

- Publish or update shifts.
- Record clock-in and clock-out, unpaid breaks, and activity type.
- Resolve missed punches with an evidence note.
- Have the employee attest reconstructed time, then have an authorized admin approve it.

### Before each payday

- Review the entire seven-day workweek when a pay-period boundary divides a workweek.
- Resolve all unapproved time and overtime warnings.
- Add authorized earnings, reimbursements, deductions, garnishments, and leave transactions.
- Preview payroll; compare gross pay, employee taxes, employer taxes, deductions, and net pay to source records.
- Resolve every blocking warning. A saved draft is not an approved payroll.
- After professional review, approve the run, execute payment through an authorized banking/payroll channel, and record confirmation.
- Deliver a compliant pay statement and update the accounting record.

### Monthly and quarterly

- Reconcile payroll clearing, tax liabilities, cash, and QuickBooks to the payroll register.
- File/pay on the federal deposit schedule assigned from the IRS lookback rules.
- File Maryland withholding on the frequency assigned by the Comptroller.
- File federal Form 941 and Maryland unemployment wage/contribution reports when due.
- Review compliance source snapshots. Changed content is a review warning, never an automatic rule change.

### Year end

- Reconcile four quarters before preparing Forms W-2/W-3, Form 940, and Maryland Form MW508.
- Confirm employee identity and address through a secure process.
- Register and prepare for Maryland FAMLI withholding beginning in 2027.

## QuickBooks boundary

The Reports area creates a balanced journal CSV only for an approved or finalized payroll run. A bookkeeper must explicitly verify all account names before export:

- Payroll:Wages Expense
- Payroll:Employer Tax Expense
- Employee Reimbursements
- Payroll:Tax Liabilities
- Payroll:Other Deductions Payable
- Payroll Clearing

Each generated file gets a SHA-256 content fingerprint and an export-log record. The admin can later record the QuickBooks import reference and reconciliation status. The module does not connect to QuickBooks or post entries automatically. Direct posting requires a separately authorized Intuit OAuth application, company access, idempotency controls, account mapping, and an import/reconciliation test.

## AI boundary

Payroll AI receives a limited snapshot of payroll settings, non-sensitive employee status, compliance tasks, and recent runs. It may prioritize or explain warnings. It cannot edit data, invent hours, mark a task complete, calculate an unsupported withholding amount, approve payroll, move money, file forms, or replace a payroll professional.

Official-source checks are restricted to an allowlist of government hosts. The checker records a source-content hash and flags changes for human review; it does not silently update a tax rate, deadline, or rule. A daily scheduler also creates payday and due-task alerts and reviews a bounded set of due sources. AI is used only to summarize a detected source change when configured.

## Employee self-service security

- Admin invitations use a one-time, seven-day link; only a SHA-256 token hash is stored.
- Redemption creates a revocable 30-day employee session stored in the browser session only.
- Employee routes are separate from admin routes and scope every query to the authenticated employee and facility.
- Employees can clock in/out, attest their own closed time entries, review schedules and finalized pay statements, update limited profile fields, and see official onboarding materials.
- The module intentionally does not accept identity documents, Social Security numbers, immigration identifiers, or bank-account data in free-text fields.

## Current production blockers

- Maria's W-4, MW507, and I-9 are incomplete.
- Maryland withholding/CRN and unemployment registrations are missing.
- Workers' compensation is missing.
- The historical wage payments and daily/workweek time are unreconciled.
- Federal, Maryland, local, FUTA, and unemployment calculations are not fully configured and independently verified.
- Payment, tax-deposit, tax-filing, electronic pay-statement delivery, secure document storage, and direct QuickBooks credentials are not connected. Employee self-service authentication and in-portal finalized pay statements are implemented.

Do not remove the approval blockers merely to produce a net-pay number.

## Primary references seeded in the dashboard

- [IRS Publication 15 (2026)](https://www.irs.gov/publications/p15)
- [IRS Publication 15-T (2026)](https://www.irs.gov/publications/p15t)
- [U.S. Department of Labor time-record requirements](https://www.dol.gov/agencies/whd/fact-sheets/21-flsa-recordkeeping)
- [USCIS Form I-9](https://www.uscis.gov/i-9)
- [Maryland 2026 Employer Withholding Guide](https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/instructions/withholding/2026/withholding-guide.pdf)
- [Maryland employer unemployment setup](https://labor.maryland.gov/unemployment-insurance/employer-agent/new-employer-get-started.shtml)
- [Maryland sick and safe leave](https://labor.maryland.gov/paidleave/)
- [Maryland FAMLI contributions](https://paidleave.maryland.gov/employers/make-contributions/)
