import {allocationEntryCoverage} from '../allocationEntryCoverage.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {buildEmployeePreview} from '../payrollEngine.js'
import {calculateWithholding2026} from '../withholding2026.js'
import {statementLines} from '../payStatement.js'
const fixture=()=>{
 const entries=[3,4,5,7,8,9].map((d,i)=>({id:i+1,workDate:`2026-08-0${d}`,clockIn:`2026-08-0${d}T12:00:00Z`,clockOut:`2026-08-0${d}T${i===5?22:20}:00:00Z`,unpaidBreakMinutes:0,status:'APPROVED'}))
 const calculation={workedMinutes:3000,overtimeMinutes:600,straightTimePayCents:180000,overtimePremiumCents:18000,regularRateNumerator:'10800000',regularRateDenominator:'3000'}
 const review={week:'2026-08-03',end:'2026-08-09',time:entries.map(e=>({...e,minutes:e.id===6?600:480})),allocationReview:{id:1,status:'CURRENT',calculation},paymentReconciliation:{status:'EVIDENCE_RECONCILED',fingerprint:'current',paid:[],totals:{workedMinutes:0,straightTimePayCents:0,premiumCents:0},differences:{straightTimeCents:180000,premiumCents:18000}},settlementAuthorization:{id:2,status:'CURRENT',historyCompletenessVerified:true,fingerprint:'current'}}
 review.allocationReview.coverage=allocationEntryCoverage(review,[{start:'2026-08-03',end:'2026-08-05',payType:'HOURLY',hourlyRateCents:2500,minutes:1440},{start:'2026-08-07',end:'2026-08-09',payType:'SALARY',earningsCents:120000,minutes:1560}],calculation)
 return {employee:{id:1,payType:'SALARY',annualSalaryCents:6240000,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE',workState:'MD',residenceState:'MD',authorizedWorkweeks:[review]},entries,payPeriod:{period_start:'2026-08-03',period_end:'2026-08-09'},payFrequency:'WEEKLY',timezone:'America/New_York',taxElection:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},adjustments:[{kind:'REIMBURSEMENT',amountCents:10000,taxTreatmentVerified:true},{kind:'POSTTAX_DEDUCTION',amountCents:1500,taxTreatmentVerified:true}]}
}
test('authorized full-week earnings replace salary once before taxes, with matching payment and statement totals',()=>{
 const input=fixture(),result=buildEmployeePreview(input)
 assert.equal(result.regularPayCents,180000);assert.equal(result.overtimePayCents,18000);assert.equal(result.otherTaxablePayCents,0)
 assert.equal(result.grossPayCents,198000);assert.equal(result.regularMinutes,2400);assert.equal(result.overtimeMinutes,600);assert.equal(result.splitLeaveBasisMinutes,3000)
 assert.equal(result.workweekPayments.length,1);assert.equal(result.workweekPayments[0].straightTimePayCents+result.workweekPayments[0].premiumCents,198000)
 const tax=calculateWithholding2026({grossPayCents:198000,regularWagesCents:198000,election:input.taxElection,payFrequency:'WEEKLY',year:2026,workState:'MD',residenceState:'MD'})
 assert.equal(result.federalIncomeTaxCents,tax.federalIncomeTaxCents);assert.equal(result.stateIncomeTaxCents,tax.stateIncomeTaxCents)
 assert.equal(result.socialSecurityTaxCents,12276);assert.equal(result.medicareTaxCents,2871)
 assert.equal(result.netPayCents,198000+10000-1500-12276-2871-tax.federalIncomeTaxCents-tax.stateIncomeTaxCents)
 const row={regular_pay_cents:180000,overtime_pay_cents:18000,other_taxable_pay_cents:0,statement_snapshot:result,federal_income_tax_cents:result.federalIncomeTaxCents,state_income_tax_cents:result.stateIncomeTaxCents,social_security_tax_cents:12276,medicare_tax_cents:2871}
 const lines=statementLines(row).lines
 assert.equal(lines.filter(l=>l[0]==='Allocated straight-time wages').length,1);assert.equal(lines.filter(l=>l[0]==='Salary').length,0)
 assert.equal(lines.reduce((n,l)=>n+l[2],0),result.netPayCents)
 assert.equal(result.warnings.length,0)
})
test('incomplete coverage, changed time, additional earnings and paid portions cannot use the allocation replacement',()=>{
 for(const mutate of [
  i=>i.payPeriod.period_end='2026-08-16',
  i=>i.entries[0].clockOut='2026-08-03T21:00:00Z',
  i=>i.entries[0].status='UNVERIFIED',
  i=>i.entries.push({...i.entries[0]}),
  i=>i.adjustments.push({kind:'PAID_LEAVE',amountCents:1000,taxTreatmentVerified:true}),
  i=>i.employee.authorizedWorkweeks[0].paymentReconciliation.totals.premiumCents=1,
  i=>i.employee.authorizedWorkweeks[0].settlementAuthorization.fingerprint='stale',
 ]){
  const input=fixture();mutate(input);const result=buildEmployeePreview(input)
  assert.equal(result.authorizedSettlement,undefined);assert.ok(result.warnings.some(w=>w.code==='AUTHORIZED_SETTLEMENT_COVERAGE'&&w.blocking))
 }
})

test('adjacent periods settle only their dated earnings and leave hours against exact prior coverage',()=>{
 const first=fixture();first.payPeriod.period_end='2026-08-05';first.entries=first.entries.slice(0,3)
 const paid=buildEmployeePreview(first)
 assert.equal(paid.regularPayCents,60000);assert.equal(paid.overtimePayCents,0);assert.equal(paid.splitLeaveBasisMinutes,1440)
 const second=fixture();second.payPeriod.period_start='2026-08-07';second.entries=second.entries.slice(3)
 assert.ok(buildEmployeePreview(second).warnings.some(w=>w.code==='AUTHORIZED_SETTLEMENT_COVERAGE'))
 const review=second.employee.authorizedWorkweeks[0]
 review.paymentReconciliation.paid=[{runId:1,...paid.workweekPayments[0],periodStart:'2026-08-03',periodEnd:'2026-08-05'}]
 review.paymentReconciliation.totals={workedMinutes:1440,straightTimePayCents:60000,premiumCents:0}
 review.paymentReconciliation.differences={straightTimeCents:120000,premiumCents:18000}
 const remaining=buildEmployeePreview(second)
 assert.equal(remaining.warnings.length,0)
 assert.equal(remaining.regularPayCents,120000);assert.equal(remaining.overtimePayCents,18000);assert.equal(remaining.splitLeaveBasisMinutes,1560)
 assert.equal(remaining.regularMinutes,960);assert.equal(remaining.overtimeMinutes,600)
 assert.equal(paid.grossPayCents+remaining.grossPayCents,198000)
 assert.equal(remaining.authorizedSettlement[0].periodStart,'2026-08-07')
 review.paymentReconciliation.paid[0].coverage.entries[0].clockOut='2026-08-03T21:00:00Z'
 assert.ok(buildEmployeePreview(second).warnings.some(w=>w.code==='AUTHORIZED_SETTLEMENT_COVERAGE'))
})
