import {test, expect} from '@playwright/test'

test('annual review exposes retirement payment evidence and clears it when sources disappear or refresh fails', async ({page}) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const identity = {revision: 1, issue: null, legalName: 'Synthetic Annual Employer', identifierLast4: '6789'}
  const report = {year: 2026, status: 'RECONCILED', pretaxDeferrals: '100.25', rothDeferrals: '50.99', hasEmployeeDeferrals: true, records: [
    {runId: '101', paymentDate: '2026-09-15', planId: 'standard', planName: 'Synthetic Standard Plan', ordinaryPretaxCents: 10025, ordinaryRothCents: 2000, catchUpPretaxCents: 0, catchUpRothCents: 3099},
  ]}
  const employee = {employeeId: 1, employeeNumber: 'ANNUAL-1', employeeName: 'Synthetic Participant', sourceStatus: 'READY_FOR_REVIEW', sourceFingerprint: 'a'.repeat(64), filingIdentity: identity, employeeIdentityReview: 'CONFIRMED', finalizedRunCount: 1, importedPaymentCount: 0, runIds: [101], wageInputs: {}, withholding: {}, reviewedQualifiedOvertime: '0.00', benefitContributions: [], benefitReportingNotice: 'Retained deductions', issues: [], compensationApplicabilityHistory: [], healthClassificationHistory: [], inputReviewHistory: [], w2ApprovalHistory: [], w2Draft: {status: 'REVIEW_REQUIRED', issues: ['Complete annual reviews'], boxes: null, fingerprint: null}}
  let mode = 'reconciled'
  await page.addInitScript(() => localStorage.setItem('adminToken', 'payroll-test-admin'))
  await page.route('**/api/admin/payroll/reports/year-end-preparation?year=2026', route => mode === 'error'
    ? route.fulfill({status: 503, json: {success: false, message: 'Synthetic annual refresh unavailable'}})
    : route.fulfill({json: {success: true, data: {year: 2026, employer: identity, employees: [{...employee, ...(mode === 'reconciled' ? {retirementContributions: report} : {})}], compensationCategories: {retirement: 'Retirement contributions or participation'}, healthCoverageReporting: {revision: 0, history: []}, remainingRequirements: ['Review compensation'], notice: 'Annual preparation'}}}))
  await page.setViewportSize({width: 390, height: 1000})
  await page.goto('/tests/support/payroll.html?year-end')
  const prepare = page.getByRole('button', {name: 'Prepare 2026 payroll inputs', exact: true})
  await prepare.click()
  const evidence = page.getByRole('region', {name: 'Annual retirement contribution evidence', exact: true})
  await expect(evidence).toContainText('2026 pretax employee deferrals: $100.25')
  await expect(evidence).toContainText('2026 Roth employee deferrals: $50.99')
  await expect(evidence).toContainText('External amounts used to review contribution limits are excluded.')
  await evidence.getByText('Review 1 retained payroll contribution records', {exact: true}).click()
  await expect(evidence).toContainText('Paid 2026-09-15 · Payroll 101')
  await expect(evidence).toContainText('Ordinary pretax: $100.25')
  await expect(evidence).toContainText('Ordinary Roth: $20.00')
  await expect(evidence).toContainText('Catch-up pretax: $0.00')
  await expect(evidence).toContainText('Catch-up Roth: $30.99')
  await evidence.screenshot({path: '/tmp/payroll-annual-retirement-evidence.png'})
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  mode = 'missing'
  await prepare.click()
  await expect(evidence).toContainText('No reconciled internal retirement contribution report is available.')
  await expect(evidence).not.toContainText('$100.25')
  mode = 'reconciled'
  await prepare.click()
  await expect(evidence).toContainText('$100.25')
  mode = 'error'
  await prepare.click()
  await expect(page.getByRole('alert')).toHaveText('Synthetic annual refresh unavailable')
  await expect(evidence).toHaveCount(0)
  expect(errors).toEqual([])
})
