import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {datedBenefitContinuationFixture as fixture} from '../testing/datedBenefitContinuationFixture.js'

const options={skip:!process.env.PAYROLL_TEST_DATABASE_URL}
test('final-pay review uses the signed earlier coverage when a future waiver is already retained',options,async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods,path,state}=await fixture(h),current=await state()
 assert.deepEqual(current.source.issues,[])
 assert.equal(current.source.monthlyCents,12500);assert.equal(current.source.datedCoverage.changeEffectiveOn,'2026-09-20');assert.ok(current.source.datedCoverage.revisionId>0)
 await api(path,{paymentDate:'2026-09-18',sourceFingerprint:current.source.fingerprint,expectedRevision:0,disposition:'COLLECT_SIGNED_MONTHLY',reference:'Reviewed actual dated coverage and retained signed authorization for the earlier final payment',confirmed:true,requestKey:randomUUID()})
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings));assert.equal(preview.deductionCents,12500)
 assert.equal(preview.employees[0].benefitCollection.authorization.requestKey,current.source.authorization.requestKey)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-DATED-CONTINUATION'})
 const posted=(await h.pool.query('SELECT posttax_deduction_cents FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0];assert.equal(Number(posted.posttax_deduction_cents),12500)
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-09-16T12:00:00Z','2026-09-16T20:00:00Z','ADMIN','APPROVED')",[employee.id])
 const later=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(later.canApprove,true,JSON.stringify(later.warnings));assert.equal(later.deductionCents,0);assert.equal(later.employees[0].benefitCollection.review.disposition,'WAIVED')
})

test('dated coverage must not bypass a subsequent withdrawal of its retained authorization',options,async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,path,state}=await fixture(h),before=await state()
 assert.deepEqual(before.source.issues,[])
 await h.pool.query("UPDATE payroll_onboarding_task SET response=jsonb_set(response,'{benefitsDeductionWithdrawal}',jsonb_build_object('authorizationRequestKey',$2::text,'recordedAt','2026-09-16T17:00:00Z')) WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[employee.id,before.source.authorization.requestKey])
 const current=await state();assert.notEqual(current.source.fingerprint,before.source.fingerprint);assert.equal(current.source.authorizationStatus,'WITHDRAWN');assert.ok(current.source.issues.some(issue=>issue.includes('employee-signed')))
 await api(path,{paymentDate:'2026-09-18',sourceFingerprint:current.source.fingerprint,expectedRevision:0,disposition:'COLLECT_SIGNED_MONTHLY',reference:'This admin review cannot override the later employee withdrawal',confirmed:true,requestKey:randomUUID()},'POST',409)
})
