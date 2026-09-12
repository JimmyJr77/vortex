import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionFixture} from '../testing/correctionFixture.js'
test('correction leave replay includes later finalized payroll and detects ledger changes',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,e,request}=await correctionFixture(h),path=`/requests/${request.id}/payroll-correction-preview`
 const initial=await api(path,{})
 assert.equal(initial.leave.creditDifferenceMinutes,4)
 for(const day of ['10','11','12','13','14'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T20:00Z`])
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-10','2026-08-16','2026-08-21','SEMIMONTHLY') RETURNING id")).rows[0]
 const second=await api('/runs',{payPeriodId:p.id},'POST',201)
 await api(`/runs/${second.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${second.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${second.id}/finalize`,{paymentDate:'2026-08-21',paymentConfirmationReference:'SYNTHETIC-CORRECTION-LATER'})
 const current=await api(path,{})
 assert.equal(current.leave.items.length,2);assert.deepEqual(current.leave.items.map(i=>i.deltaMinutes),[4,0]);assert.notEqual(current.fingerprint,initial.fingerprint)
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason,transaction_kind) VALUES(1,$1,'MD_SICK_SAFE','2026-08-15',10,'Synthetic intervening restoration','RESTORATION')",[e.id])
 const changed=await api(path,{})
 assert.equal(changed.leave.status,'LEAVE_RECONCILIATION_REQUIRED');assert.equal(changed.leaveCalculated,false);assert.match(changed.leave.issue,/restoration/)
 assert.equal(changed.workedWagesDifferenceCents,7500);assert.notEqual(changed.fingerprint,current.fingerprint)
})
