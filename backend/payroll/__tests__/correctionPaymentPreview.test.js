import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionPaymentFixture} from '../testing/correctionPaymentFixture.js'
test('correction payment preview adds prior wages to current regular payroll without duplicating time or leave',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input,target,e}=await correctionPaymentFixture(h),path=`/requests/${request.id}/payroll-correction-payment-preview`
 const state=async()=>({runs:(await h.pool.query('SELECT * FROM payroll_run ORDER BY id')).rows,entries:(await h.pool.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows,leave:(await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows,audit:(await h.pool.query('SELECT * FROM payroll_audit_log ORDER BY id')).rows})
 const before=await state(),preview=await api(path,input)
 assert.equal(preview.delta.grossPayCents,7500);assert.equal(preview.delta.federalIncomeTaxCents,750);assert.equal(preview.delta.stateIncomeTaxCents,596)
 assert.equal(preview.delta.socialSecurityTaxCents,465);assert.equal(preview.delta.medicareTaxCents,109);assert.equal(preview.delta.netPayCents,5580)
 assert.equal(preview.currentWorkedMinutes,2400);assert.equal(preview.currentLeaveAccrualMinutes,80);assert.equal(preview.correctionLeave.creditDifferenceMinutes,4)
 assert.equal(preview.payItems.filter(i=>i.kind==='WAGE_CORRECTION').length,1);assert.equal(preview.paymentApplied,false)
 assert.deepEqual(await state(),before);assert.equal((await api(path,input)).fingerprint,preview.fingerprint)
 await api(path,{...input,historyCompleteConfirmed:false},'POST',400)
 await api(path,{...input,paymentDate:'2026-08-13'},'POST',409)
 const scoped=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(input)});assert.equal(scoped.status,404)
 await h.pool.query("UPDATE payroll_time_entry SET clock_out=clock_out+interval '1 hour' WHERE employee_id=$1 AND clock_in='2026-08-17T12:00Z'",[e.id])
 const changed=await api(path,input);assert.notEqual(changed.fingerprint,preview.fingerprint);assert.equal(changed.delta.grossPayCents,7500)
 const run=await api('/runs',{payPeriodId:target.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(path,input,'POST',409)
})

test('correction payment preview offsets target leave accrual at the annual cap without editing the ledger',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input}=await correctionPaymentFixture(h,{openingAccruedMinutes:2250})
 const before=(await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows
 const result=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 assert.equal(result.correctionLeave.creditDifferenceMinutes,4)
 assert.equal(result.targetLeave.before.accrualMinutes,70);assert.equal(result.targetLeave.after.accrualMinutes,66)
 assert.equal(result.targetLeave.before.yearAccruedBeforeMinutes,2330);assert.equal(result.targetLeave.after.yearAccruedBeforeMinutes,2334)
 assert.equal(result.targetLeave.accrualDifferenceMinutes,-4);assert.equal(result.targetLeave.combinedCreditDifferenceMinutes,0)
 assert.equal(result.currentWorkedMinutes,2400);assert.equal(result.delta.netPayCents,5580)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows,before)
})

test('correction source hours change target overtime when pay periods share a workweek',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input,target}=await correctionPaymentFixture(h,{sharedWeek:true})
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 assert.equal(preview.priorWageCorrectionCents,5000);assert.equal(preview.currentWageReclassificationCents,2500);assert.equal(preview.delta.grossPayCents,7500)
 assert.deepEqual(preview.targetHours,{before:{regularMinutes:960,overtimeMinutes:600},after:{regularMinutes:840,overtimeMinutes:720}})
 assert.equal(preview.currentWorkedMinutes,1560)
 await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'shared-week-authorization',reason:'Reviewed source correction and additional target-period overtime',confirmed:true},'POST',201)
 const payroll=(await api('/runs/preview',{payPeriodId:target.id})).preview
 assert.equal(payroll.canApprove,true,JSON.stringify(payroll.warnings));assert.equal(payroll.employees[0].grossPayCents,85000)
 assert.equal(payroll.employees[0].overtimeMinutes,720);assert.equal(payroll.employees[0].payItems.find(i=>i.kind==='WAGE_CORRECTION').amountCents,5000)
})
