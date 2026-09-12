import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {loadSupplementalPaymentHistory} from '../supplementalPaymentHistory.js'
import {retirementAnnualReporting} from '../retirementAnnualReporting.js'
for(const federalMethod of ['FLAT_22','AGGREGATE'])test(`retirement bonus payroll rechecks ${federalMethod} tax wages and retains one ledger contribution per payment`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods}=await regularRetirementFixture(h,{includeBonus:true,hourlyRateCents:10000})
 const finish=async(run,date)=>{await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:date,paymentConfirmationReference:'SYNTHETIC-RETIREMENT-BONUS-PAYMENT'})}
 const regular=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await finish(regular,'2026-09-18')
 const bonus={employeeId:employee.id,amountCents:100000,classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic discretionary annual bonus without a prior promise',amountDiscretionVerified:true,paymentDiscretionVerified:true,noPriorPromiseVerified:true,historyCompleteVerified:true,stateBonusRateVerified:true,historySource:'Synthetic complete employer payment history reconciliation',federalMethod}
 for(const [index,date] of ['2026-09-22','2026-09-23'].entries()){
  const body={payPeriodId:periods[1].id,paymentDate:date,offCycleBonus:{...bonus,requestKey:randomUUID()}}
  const preview=(await api('/runs/preview',body)).preview,c=preview.employees[0]
  assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings));assert.equal(c.retirementPlans[0].calculation.pretaxCents,5000);assert.equal(c.retirementPlans[0].calculation.rothCents,2000)
  assert.equal(c.incomeTaxWageBasis.federalWagesCents,95000);assert.equal(c.retirement401k.pretaxAnnualBonusCents,5000);assert.equal(c.ficaWageBasis.medicareTaxableCents,100000);assert.equal(c.stateIncomeTaxCents,9215)
  assert.equal(preview.deductionCents,7000);assert.equal(c.supplementalTax.ordinaryCents,95000);assert.equal(c.supplementalTax.ytdSupplementalCents,index*95000)
  if(federalMethod==='FLAT_22'){assert.equal(c.federalIncomeTaxCents,20900);assert.equal(c.netPayCents,55235)}else{assert.equal(c.supplementalTax.aggregateBasis.regularWagesCents,76000);assert.equal(c.supplementalTax.aggregateBasis.previousSupplementalCents,index*95000)}
  const run=await api('/runs',body,'POST',201);await finish(run,date)
  const rows=(await h.pool.query('SELECT calculation FROM payroll_retirement_run_ledger WHERE run_id=$1',[run.id])).rows;assert.equal(rows.length,1);assert.equal(rows[0].calculation.pretaxCents,5000)
 }
 const history=await loadSupplementalPaymentHistory(h.pool,1,employee.id,'2026-09-30');assert.equal(history.reconciled,true,JSON.stringify(history.issues));assert.equal(history.ytdSupplementalCents,190000)
 const annual=await retirementAnnualReporting(h.pool,1,employee.id);assert.equal(annual.pretaxDeferrals,'140.00');assert.equal(annual.rothDeferrals,'56.00');assert.equal(annual.records.length,3)
 const eligibilityPath=`/employees/${employee.id}/retirement-eligibility/standard`,eligibility=await api(eligibilityPath)
 await api(eligibilityPath,{sourceFingerprint:eligibility.source.fingerprint,expectedRevision:1,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE','FIXED_PER_REGULAR_PAY'],reference:'Synthetic confirmed fixed regular-pay election availability',employeeExplanation:'The plan permits a fixed contribution from regular payroll.'})
 const proposal=(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal
 await api('/retirement/standard/elections',{action:'ELECT',method:'FIXED_PER_REGULAR_PAY',pretax:1000,roth:500,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-24',expectedRevision:1,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},'POST',200,true)
 const fixedBody={payPeriodId:periods[1].id,paymentDate:'2026-09-24',offCycleBonus:{...bonus,requestKey:randomUUID()}},fixed=(await api('/runs/preview',fixedBody)).preview
 assert.equal(fixed.canApprove,true,JSON.stringify(fixed.warnings));assert.equal(fixed.deductionCents,0);assert.equal(fixed.employees[0].retirementPlans[0].calculation.notAppliedReason,'REGULAR_PAY_ONLY')
 const fixedRun=await api('/runs',fixedBody,'POST',201);await finish(fixedRun,'2026-09-24')
 assert.equal((await h.pool.query('SELECT calculation FROM payroll_retirement_run_ledger WHERE run_id=$1',[fixedRun.id])).rows[0].calculation.totalCents,0)
 const sources=await api('/retirement-remittance-sources');assert.equal(sources.items.length,4);assert.equal(sources.items[0].status,'NO_EMPLOYEE_CONTRIBUTION');assert.equal(sources.items[0].totalCents,0);assert.equal(sources.items[1].totalCents,7000);assert.equal(sources.items[1].status,'DELIVERY_UNVERIFIED')
})
