import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateWeeklyOvertime,
  buildEmployeePreview,
  calculateWorkedMinutes,
  calculateMarylandSickAccrualMinutes,
  generateSemimonthlyPeriods,
} from '../payrollEngine.js'

test('worked minutes subtract unpaid breaks exactly', () => {
  assert.equal(calculateWorkedMinutes('2026-08-03T20:00:00Z', '2026-08-04T01:00:00Z', 30), 270)
})

test('weekly overtime crosses the 40-hour boundary', () => {
  const entries = [
    ...[3, 4, 5, 6, 7].map((day, index) => ({ id: index + 1, clockIn: `2026-08-${String(day).padStart(2, '0')}T13:00:00Z`, clockOut: `2026-08-${String(day).padStart(2, '0')}T21:00:00Z`, unpaidBreakMinutes: 0 })),
    { id: 6, clockIn: '2026-08-08T13:00:00Z', clockOut: '2026-08-08T15:00:00Z', unpaidBreakMinutes: 0 },
  ]
  const result = allocateWeeklyOvertime(entries)
  assert.equal(result.slice(0, 5).reduce((sum, item) => sum + item.regularMinutes, 0), 2400)
  assert.equal(result[5].regularMinutes, 0)
  assert.equal(result[5].overtimeMinutes, 120)
})

test('preview calculates regular, overtime, and FICA in integer cents while withholding stays blocked', () => {
  const preview = buildEmployeePreview({
    employee: { id: 7, payType: 'HOURLY', hourlyRateCents: 2500, w4Status: 'MISSING', stateWithholdingStatus: 'MISSING' },
    entries: [
      { clockIn: '2026-08-03T00:00:00Z', clockOut: '2026-08-04T16:00:00Z', unpaidBreakMinutes: 0, status: 'APPROVED' },
      { clockIn: '2026-08-05T00:00:00Z', clockOut: '2026-08-05T05:00:00Z', unpaidBreakMinutes: 0, status: 'APPROVED' },
    ],
  })
  assert.equal(preview.regularMinutes, 2400)
  assert.equal(preview.overtimeMinutes, 300)
  assert.equal(preview.grossPayCents, 118750)
  assert.equal(preview.socialSecurityTaxCents, 7363)
  assert.equal(preview.medicareTaxCents, 1722)
  assert.equal(preview.netPayCents, null)
  assert.equal(preview.warnings.filter((item) => item.blocking).length, 3)
})

test('semimonthly periods map the 5th to prior month and 20th to first half', () => {
  assert.deepEqual(generateSemimonthlyPeriods(2026, 9), [
    { periodStart: '2026-08-16', periodEnd: '2026-08-31', nominalPayDate: '2026-09-05', payDate: '2026-09-04', frequency: 'SEMIMONTHLY' },
    { periodStart: '2026-09-01', periodEnd: '2026-09-15', nominalPayDate: '2026-09-20', payDate: '2026-09-18', frequency: 'SEMIMONTHLY' },
  ])
})

test('Maryland sick leave accrues one minute per 30 worked minutes and applies the semimonthly threshold', () => {
  assert.equal(calculateMarylandSickAccrualMinutes({ workedMinutes: 25 * 60, payFrequency: 'SEMIMONTHLY' }), 0)
  assert.equal(calculateMarylandSickAccrualMinutes({ workedMinutes: 30 * 60, payFrequency: 'SEMIMONTHLY' }), 60)
  assert.equal(calculateMarylandSickAccrualMinutes({ workedMinutes: 60 * 60, payFrequency: 'SEMIMONTHLY', yearAccruedMinutes: 2380 }), 20)
})

test('verified bonuses, reimbursements, and deductions flow into separate preview totals', () => {
  const preview = buildEmployeePreview({
    employee: { id: 8, payType: 'HOURLY', hourlyRateCents: 2500, w4Status: 'COMPLETE', stateWithholdingStatus: 'COMPLETE' },
    entries: [{ clockIn: '2026-08-03T20:00:00Z', clockOut: '2026-08-04T00:00:00Z', unpaidBreakMinutes: 0, status: 'APPROVED' }],
    adjustments: [
      { kind: 'BONUS', name: 'Meet bonus', amountCents: 10000, taxTreatmentVerified: true },
      { kind: 'REIMBURSEMENT', name: 'Supplies', amountCents: 2500, taxTreatmentVerified: true },
      { kind: 'POSTTAX_DEDUCTION', name: 'Advance recovery', amountCents: 1500, taxTreatmentVerified: true },
    ],
  })
  assert.equal(preview.regularPayCents, 10000)
  assert.equal(preview.grossPayCents, 20000)
  assert.equal(preview.reimbursementCents, 2500)
  assert.equal(preview.totalDeductionCents, 1500)
})
