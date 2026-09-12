import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctedWeightedFixture} from '../testing/correctedWeightedFixture.js'
test('later mixed-rate hourly payroll credits paid corrected hours and premiums once',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,original,period}=await correctedWeightedFixture(h)
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 const employee=preview.employees[0]
 assert.equal(employee.workweekPaidHistory[0].paidWorkedMinutes,1680)
 assert.equal(employee.workweekPaidHistory[0].historyVerified,true)
 assert.equal(employee.workweekPaidHistory[0].premiums[0].correctionSettlementIds.length,1)
 assert.equal(employee.weightedOvertimeApplied,true)
 assert.equal(employee.workweekSettlements[0].premiumDueCents,19185)
 assert.equal(employee.grossPayCents,97185)
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const run=await api('/runs',{payPeriodId:period.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 const correctionRow=original.find(row=>row.statement_snapshot.correctionSettlements?.length)
 const changed=structuredClone(correctionRow.statement_snapshot)
 changed.payItems.find(item=>item.kind==='WAGE_CORRECTION').amountCents+=1
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE id=$2',[changed,correctionRow.id])
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE id=$2',[correctionRow.statement_snapshot,correctionRow.id])
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-CORRECTED-WEIGHTED'})
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id<>$1 ORDER BY id',[run.id])).rows,original)
})

test('paid correction premium remains credited to its original workweek',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {settledCorrectedHourlyFixture}=await import('../testing/settledCorrectedHourlyFixture.js')
 const {loadWorkweekPaymentHistory}=await import('../workweekPaymentHistory.js')
 const {e}=await settledCorrectedHourlyFixture(h,{})
 const history=await loadWorkweekPaymentHistory(h.pool,1,e.id,['2026-08-03'],'2026-08-10')
 assert.equal(history[0].paidWorkedMinutes,2520)
 assert.equal(history[0].premiums.reduce((n,p)=>n+p.premiumCents,0),2500)
 assert.equal(history[0].premiums[0].correctionSettlementIds.length,1)
 assert.deepEqual(history[0].issues,[])
})
