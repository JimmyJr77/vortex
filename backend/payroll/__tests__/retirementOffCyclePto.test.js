import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {loadSupplementalPaymentHistory,reconcileSupplementalPayments} from '../supplementalPaymentHistory.js'
import {retirementAnnualReporting} from '../retirementAnnualReporting.js'
import {ptoStateReviewInput} from '../ptoStateWithholding.js'
test('state PTO withholding requires an exact reviewed basis and valid cent amount',()=>{
 const b={basisFingerprint:'a'.repeat(64),stateIncomeTaxCents:760,sourceReference:'Reviewed professional Maryland PTO calculation',confirmed:true}
 assert.equal(ptoStateReviewInput(b).stateIncomeTaxCents,760)
 for(const patch of [{basisFingerprint:'forged'},{stateIncomeTaxCents:-1},{stateIncomeTaxCents:'760'},{stateIncomeTaxCents:1.1},{sourceReference:'short'},{confirmed:false}])assert.throws(()=>ptoStateReviewInput({...b,...patch}),{status:409})
})
for(const scenario of ['FLAT_22','AGGREGATE','POST_SEVERANCE_EXCLUDED'])test(`retirement PTO applies reviewed withholding, reserves contributions and finalizes repeated ${scenario} payments`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const excluded=scenario==='POST_SEVERANCE_EXCLUDED',federalMethod=excluded?'FLAT_22':scenario
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const unusedPto={inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:excluded?'EXCLUDED':'INCLUDED',postSeverance415:excluded?'EXCLUDED':'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Actual plan unused-leave cashout compensation review'}
 const {api,employee,periods}=await regularRetirementFixture(h,{unusedPto,hourlyRateCents:10000})
 const regular=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${regular.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${regular.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${regular.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-REGULAR-PTO-RETIREMENT'})
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-01',480,'Synthetic accrued vacation')",[employee.id])
 if(excluded)await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-20' WHERE id=$1",[employee.id])
 const period=(await h.pool.query('SELECT id,started_on::text,ended_on::text FROM payroll_employment_period WHERE employee_id=$1',[employee.id])).rows[0]
 const evidence={employmentPeriodId:Number(period.id),employmentStartedOn:period.started_on,employmentEndedOn:period.ended_on,usableIfContinued:true,sourceReference:'Retained actual earned leave and continued-use records',confirmed:true}
 const pretax=excluded?0:500,roth=excluded?0:200,taxWages=10000-pretax,total=pretax+roth
 for(const paymentDate of ['2026-09-22','2026-09-23']){
  const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Retained reviewed unused vacation payment policy'}
  const preview=await api(`/employees/${employee.id}/leave-payout/preview`,policy)
  const payout=await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[1].id,fingerprint:preview.fingerprint,requestKey:randomUUID(),paymentMode:'STANDALONE'},'POST',201)
  const body={payPeriodId:periods[1].id,paymentDate,offCyclePto:{payoutId:Number(payout.id),historyCompleteVerified:true,historySource:'Complete employer and related-employer payroll reconciliation',federalMethod,retirementPtoEvidence:evidence}}
  const initial=(await api('/runs/preview',body)).preview.employees[0],basis=initial.ptoStateWithholdingBasis
  assert.equal(basis.marylandHistory.reconciled,true);assert.ok(basis.marylandHistory.evidence.length>0);assert.ok(basis.marylandHistory.evidence.every(e=>e.reconciled&&Number.isSafeInteger(e.stateIncomeTaxCents)));assert.equal(basis.marylandWagesCents,taxWages);assert.equal(initial.pretaxDeductionCents,0)
  const stateWithholdingReview={basisFingerprint:basis.fingerprint,stateIncomeTaxCents:760,sourceReference:'Synthetic professional state calculation for exact displayed wages',confirmed:true}
  const reviewed={...body,offCyclePto:{...body.offCyclePto,stateWithholdingReview}}
  const stale=(await api('/runs/preview',{...reviewed,offCyclePto:{...reviewed.offCyclePto,historySource:'Changed employer history reconciliation source'}})).preview
  assert.equal(stale.canApprove,false);assert.ok(stale.warnings.some(w=>w.message.includes('changed')))
  const tooMuch=(await api('/runs/preview',{...reviewed,offCyclePto:{...reviewed.offCyclePto,stateWithholdingReview:{...stateWithholdingReview,stateIncomeTaxCents:10000}}})).preview
  assert.equal(tooMuch.canApprove,false);assert.equal(tooMuch.netPayCents,null)
  const calculated=(await api('/runs/preview',reviewed)).preview
  assert.equal(calculated.canApprove,true,JSON.stringify(calculated.warnings));assert.equal(calculated.deductionCents,total)
  const c=calculated.employees[0];assert.equal(c.pretaxDeductionCents,pretax);assert.equal(c.posttaxDeductionCents,roth);assert.equal(c.stateIncomeTaxCents,760);assert.equal(c.retirementPlans[0].calculation.requiresPayrollIntegration,false)
  assert.equal(c.netPayCents,10000-total-765-c.federalIncomeTaxCents-760)
  assert.equal(c.supplementalTax.method,federalMethod)
  if(federalMethod==='AGGREGATE'){
   assert.equal(c.supplementalTax.aggregateBasis.regularWagesCents,76000)
   assert.equal(c.federalIncomeTaxCents,950,JSON.stringify(c.supplementalTax))
  }
  if(federalMethod==='FLAT_22'){assert.equal(c.federalIncomeTaxCents,excluded?2200:2090);assert.equal(c.netPayCents,excluded?6275:5685)}
  assert.equal(c.retirementPlans[0].calculation.compensation415Cents,excluded?0:10000)
  const run=await api('/runs',reviewed,'POST',201)
  await api(`/runs/${run.id}/employees/${employee.id}/withholding`,{federalIncomeTaxCents:c.federalIncomeTaxCents+1,stateIncomeTaxCents:760,sourceNote:'Synthetic attempted override of integrated retirement',professionalConfirmed:true},'PATCH',409)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger WHERE run_id=$1',[run.id])).rows[0].n,1)
  await api(`/runs/${run.id}/finalize`,{paymentDate,paymentConfirmationReference:`SYNTHETIC-RETIREMENT-PTO-${paymentDate}`})
  const row=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
  assert.equal(row.statement_snapshot.retirement.plans[0].ordinaryPretaxCents,pretax);assert.equal(row.statement_snapshot.incomeTaxWageBasis.federalWagesCents,taxWages)
  const raw=(await h.pool.query('SELECT r.id AS run_id,r.facility_id,r.run_kind,r.payment_date,r.payment_confirmation_reference,r.calculation_snapshot,re.* FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.id=$1',[run.id])).rows[0]
  const altered=structuredClone(raw);altered.calculation_snapshot.employees[0].supplementalTax.retirementAllocation.pretaxCents++
  assert.equal(reconcileSupplementalPayments([altered],paymentDate).reconciled,false)
  const history=await loadSupplementalPaymentHistory(h.pool,1,employee.id,paymentDate)
  assert.equal(history.reconciled,true,JSON.stringify(history.issues));assert.equal(history.evidence.at(-1).supplementalCents,taxWages);assert.equal(history.evidence.at(-1).grossCents,10000)
 }
 const annual=await retirementAnnualReporting(h.pool,1,employee.id)
 assert.equal(annual.status,'RECONCILED');assert.equal(annual.pretaxDeferrals,excluded?'40.00':'50.00');assert.equal(annual.rothDeferrals,excluded?'16.00':'20.00');assert.equal(annual.records.length,3)
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO'",[employee.id])).rows[0].n,0)
 const remittance=await api('/retirement-remittance-sources');assert.equal(remittance.items.length,3);assert.ok(remittance.items.every(r=>r.status!=='RECONCILIATION_REQUIRED'),JSON.stringify(remittance));assert.equal(remittance.items[0].totalCents,scenario==='POST_SEVERANCE_EXCLUDED'?0:700)

})
