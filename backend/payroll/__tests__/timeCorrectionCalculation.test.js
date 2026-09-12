import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionFixture} from '../testing/correctionFixture.js'
test('correction preview recalculates overtime without changing paid source records',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,e,first,entry,request}=await correctionFixture(h)
 const state=async()=>({time:(await h.pool.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows,paid:(await h.pool.query('SELECT * FROM payroll_run_employee ORDER BY id')).rows,leave:(await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows,audit:(await h.pool.query('SELECT * FROM payroll_audit_log ORDER BY id')).rows,request:(await h.pool.query('SELECT * FROM payroll_employee_request ORDER BY id')).rows})
 const before=await state()
 const path=`/requests/${request.id}/payroll-correction-preview`
 const correction=await api(path,{})
 assert.equal(correction.workedWagesDifferenceCents,7500)
 assert.equal(correction.runs[0].before.regularMinutes,2400)
 assert.equal(correction.runs[0].after.overtimeMinutes,120)
 assert.equal(correction.leave.creditDifferenceMinutes,4);assert.equal(correction.leave.items[0].accruedMinutesBefore,80);assert.equal(correction.leave.items[0].accruedMinutesAfter,84);assert.equal(correction.paymentApplied,false);assert.equal(correction.taxesCalculated,false);assert.equal(correction.leaveCalculated,true)
 assert.deepEqual(await state(),before)
 assert.equal((await api(path,{})).fingerprint,correction.fingerprint)
 for(const [name,payload,expected] of [
  ['shorter',{entryId:entry.id,clockIn:entry.clock_in.toISOString(),clockOut:'2026-08-03T18:00:00Z',unpaidBreakMinutes:0},-5000],
  ['missing',{clockIn:'2026-08-08T12:00:00Z',clockOut:'2026-08-08T16:00:00Z',unpaidBreakMinutes:0},15000],
  ['overlap',{entryId:entry.id,clockIn:'2026-08-04T12:00:00Z',clockOut:'2026-08-04T20:00:00Z',unpaidBreakMinutes:0},null],
  ['outside',{entryId:entry.id,clockIn:'2026-08-10T12:00:00Z',clockOut:'2026-08-10T20:00:00Z',unpaidBreakMinutes:0},null],
 ]){
  const q=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'TIME_CORRECTION',$2) RETURNING id",[e.id,{...payload,reason:'Synthetic correction scenario for '+name}])).rows[0]
  const impact=await api(`/requests/${q.id}/payroll-impact`,undefined,'GET')
  await api(`/requests/${q.id}/payroll-impact/reviews`,{requestKey:'correction-scenario-'+name,fingerprint:impact.fingerprint,reason:'Verified synthetic correction scenario '+name,confirmed:true},'POST',201)
  const result=await api(`/requests/${q.id}/payroll-correction-preview`,{},'POST',expected===null?409:200)
  if(expected!==null)assert.equal(result.workedWagesDifferenceCents,expected,name)
 }
 const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:'{}'});assert.equal(r.status,404)
 await h.pool.query('ALTER TABLE payroll_time_entry DISABLE TRIGGER payroll_time_change_guard')
 // Synthetic legacy corruption: production changes are protected by this trigger.
 // A different workday with unchanged total minutes is still stale paid evidence.
 await h.pool.query("UPDATE payroll_time_entry SET clock_in=clock_in+interval '1 hour',clock_out=clock_out+interval '1 hour' WHERE employee_id=$1 AND id<>$2",[e.id,entry.id])
 await api(path,{},'POST',409)
 await h.pool.query("UPDATE payroll_time_entry SET clock_in=clock_in-interval '1 hour',clock_out=clock_out-interval '1 hour' WHERE employee_id=$1 AND id<>$2",[e.id,entry.id])
 assert.equal((await api(path,{})).fingerprint,correction.fingerprint)
 await h.pool.query('ALTER TABLE payroll_time_entry ENABLE TRIGGER payroll_time_change_guard')
 await h.pool.query('UPDATE payroll_run_employee SET regular_pay_cents=regular_pay_cents+1 WHERE payroll_run_id=$1',[first.id])
 await api(path,{},'POST',409)
})
