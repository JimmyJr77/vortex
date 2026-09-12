import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateWeeklyOvertime,
  workweekStartFor,
  buildEmployeePreview,
  calculateWorkedMinutes,
  calculateMarylandSickAccrualMinutes,
  generateSemimonthlyPeriods,
} from '../payrollEngine.js'

test('worked minutes subtract unpaid breaks exactly', () => {
  assert.equal(calculateWorkedMinutes('2026-08-03T20:00:00Z', '2026-08-04T01:00:00Z', 30), 270)
})

test('open clocks show a payroll blocker instead of failing the entire preview',()=>{
 const preview=buildEmployeePreview({employee:{id:1,payType:'HOURLY',hourlyRateCents:2500,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'},entries:[{clockIn:'2026-09-10T14:00:00Z',clockOut:null,unpaidBreakMinutes:0,status:'UNVERIFIED'}]})
 assert.equal(preview.grossPayCents,0)
 assert.ok(preview.warnings.some(w=>w.code==='INCOMPLETE_TIME'&&w.blocking))
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

test('workweeks accept PostgreSQL Date values and respect the facility timezone',()=>{
 const instant=new Date('2026-09-14T02:00:00Z')
 assert.equal(workweekStartFor(instant,1,'America/New_York'),'2026-09-07')
 assert.equal(workweekStartFor(instant,1,'UTC'),'2026-09-14')
})

test('Maryland weekly and biweekly sick eligibility uses the correct period thresholds',()=>{
 assert.equal(calculateMarylandSickAccrualMinutes({workedMinutes:1439,payFrequency:'BIWEEKLY'}),0)
 assert.equal(calculateMarylandSickAccrualMinutes({workedMinutes:1440,payFrequency:'BIWEEKLY'}),48)
 assert.equal(calculateMarylandSickAccrualMinutes({workedMinutes:720,payFrequency:'WEEKLY',previousPeriodWorkedMinutes:719}),0)
 assert.equal(calculateMarylandSickAccrualMinutes({workedMinutes:720,payFrequency:'WEEKLY',previousPeriodWorkedMinutes:720}),24)
 assert.equal(calculateMarylandSickAccrualMinutes({workedMinutes:1440,payFrequency:'WEEKLY'}),48)
 assert.throws(()=>calculateMarylandSickAccrualMinutes({workedMinutes:720,payFrequency:'WEEKLY'}),/preceding pay period/)
})
test('sick accrual respects both the annual allowance and the accumulated balance cap',()=>{
 const base={workedMinutes:2400,payFrequency:'SEMIMONTHLY'}
 assert.equal(calculateMarylandSickAccrualMinutes({...base,currentBalanceMinutes:3830}),10)
 assert.equal(calculateMarylandSickAccrualMinutes({...base,currentBalanceMinutes:3840}),0)
 assert.equal(calculateMarylandSickAccrualMinutes({...base,currentBalanceMinutes:4000}),0)
 assert.equal(calculateMarylandSickAccrualMinutes({...base,currentBalanceMinutes:3800,yearAccruedMinutes:2395}),5)
 assert.equal(calculateMarylandSickAccrualMinutes({...base,currentBalanceMinutes:3700}),80)
 assert.throws(()=>calculateMarylandSickAccrualMinutes({...base,currentBalanceMinutes:NaN}),/balance/)
})

test('payroll retains exact FICA wage bases across caps without reversing rounded taxes',()=>{
 const calculate=(gross,ytd)=>buildEmployeePreview({employee:{id:1,payType:'HOURLY',hourlyRateCents:0,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'},entries:[],adjustments:[{kind:'BONUS',amountCents:gross,taxTreatmentVerified:true}],ytdSocialSecurityWagesCents:ytd})
 let result=calculate(101,18449950)
 assert.equal(result.ficaWageBasis.socialSecurityTaxableCents,50)
 assert.equal(result.ficaWageBasis.medicareTaxableCents,101)
 assert.equal(result.socialSecurityTaxCents,3)
 assert.equal(result.ficaWageBasis.ytdWagesBeforeCents,18449950)
 result=calculate(101,19999950)
 assert.equal(result.ficaWageBasis.socialSecurityTaxableCents,0)
 assert.equal(result.ficaWageBasis.additionalMedicareTaxableCents,51)
 assert.equal(result.additionalMedicareTaxCents,0)
 assert.equal(result.ficaWageBasis.grossWagesCents,101)
 assert.equal(calculate(0,20000000).ficaWageBasis.medicareTaxableCents,0)
})
