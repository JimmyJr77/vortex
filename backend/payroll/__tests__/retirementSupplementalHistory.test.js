import test from 'node:test'
import assert from 'node:assert/strict'
import {buildEmployeePreview} from '../payrollEngine.js'
import {retirementStatementSummary} from '../retirementStatement.js'
import {reconcileSupplementalPayments} from '../supplementalPaymentHistory.js'
function fixture(){
 const c=buildEmployeePreview({employee:{id:1,payType:'HOURLY',hourlyRateCents:2500,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE',workState:'MD',residenceState:'MD'},entries:[{clockIn:'2026-09-07T12:00:00Z',clockOut:'2026-09-07T16:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}],adjustments:[{kind:'BONUS',name:'Annual bonus',amountCents:10000,taxTreatmentVerified:true,bonusReview:{paymentType:'ANNUAL_LUMP_SUM',verifiedAt:'synthetic-reviewed'}}],taxElection:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},retirement401k:{planType:'STANDARD_401K',pretaxCents:2000,rothCents:1000,pretaxAnnualBonusCents:1000}})
 c.retirementPlans=[{planId:'standard',calculation:{planName:'Synthetic 401k',requiresPayrollIntegration:false,ordinary:{pretax:2000,roth:1000},catchUp:{pretax:0,roth:0},pretaxCents:2000,rothCents:1000,totalCents:3000}}]
 return {id:1,facility_id:1,run_id:1,employee_id:1,run_kind:'REGULAR',payment_date:'2026-09-15',payment_confirmation_reference:'SYNTHETIC-PAID',withholding_verified_at:'2026-09-15T12:00:00Z',regular_pay_cents:c.regularPayCents,overtime_pay_cents:c.overtimePayCents,other_taxable_pay_cents:c.otherTaxablePayCents,federal_income_tax_cents:c.federalIncomeTaxCents,state_income_tax_cents:c.stateIncomeTaxCents,pretax_deduction_cents:c.pretaxDeductionCents,posttax_deduction_cents:c.posttaxDeductionCents,calculation_snapshot:{employees:[c]},statement_snapshot:{payItems:c.payItems,incomeTaxWageBasis:c.incomeTaxWageBasis,retirement:retirementStatementSummary(c)}}
}
test('supplemental history subtracts only the retained bonus deferral allocation and preserves gross FICA wages',()=>{
 const result=reconcileSupplementalPayments([fixture()],'2026-09-30')
 assert.equal(result.reconciled,true,JSON.stringify(result.issues));assert.equal(result.ytdSupplementalCents,9000);assert.equal(result.evidence[0].grossCents,20000);assert.equal(result.evidence[0].incomeTaxGrossCents,18000);assert.equal(result.evidence[0].retirementSupplementalPretaxCents,1000);assert.equal(result.regularWithholdingVerified,false)
})
test('supplemental retirement history rejects changed amounts, missing statements and unclassified pretax allocations',()=>{
 for(const mutate of [r=>r.pretax_deduction_cents++,r=>r.posttax_deduction_cents++,r=>delete r.statement_snapshot.retirement,r=>r.statement_snapshot.retirement.plans[0].ordinaryPretaxCents++,r=>r.calculation_snapshot.employees[0].incomeTaxWageBasis.retirement401k.pretaxAnnualBonusCents++,r=>{const c=r.calculation_snapshot.employees[0];c.payItems[0].kind='LEAVE_PAYOUT';r.statement_snapshot.payItems=c.payItems}]){
  const row=fixture();mutate(row);const result=reconcileSupplementalPayments([row],'2026-09-30');assert.equal(result.reconciled,false);assert.equal(result.regularWithholdingVerified,false)
 }
})
