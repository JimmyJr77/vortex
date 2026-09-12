import test from 'node:test'
import assert from 'node:assert/strict'
import {assertCompensationUnlocked} from '../compensation.js'
import {createHarness} from '../testing/harness.js'
test('approved weighted payroll protects following-period time for the affected employee and void releases it',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const create=async number=>{const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:number,legalFirstName:'Weighted',legalLastName:'Lock',hireDate:'2026-01-01',hourlyRateCents:2500})});assert.equal(r.status,201);return (await r.json()).data}
 const employee=await create('WEIGHTED-LOCK'),other=await create('UNRELATED-LOCK')
 const insert=async(id,start='2026-09-16T14:00:00Z',end='2026-09-16T15:00:00Z')=>(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED') RETURNING id",[id,start,end])).rows[0]
 const entry=await insert(employee.id)
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-01','2026-09-15','2026-09-21','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,calculation_snapshot) VALUES(1,$1,'APPROVED',$2) RETURNING id",[period.id,{employees:[{employeeId:Number(employee.id),weightedOvertimeApplied:true,workweekPayments:[{week:'2026-09-14',weightedPremiumApplied:true},{week:'2026-09-21',premiumCents:0}]}]}])).rows[0]
 const locked=e=>e.code==='23514'&&e.constraint==='payroll_time_locked'
 await assert.rejects(assertCompensationUnlocked(h.pool,1,employee.id,'2026-09-16'),e=>e.status===409)
 await assertCompensationUnlocked(h.pool,1,other.id,'2026-09-16')
 await assertCompensationUnlocked(h.pool,1,employee.id,'2026-09-21')

 await assert.rejects(h.pool.query("UPDATE payroll_time_entry SET status='REJECTED' WHERE id=$1",[entry.id]),locked)
 await assert.rejects(h.pool.query('DELETE FROM payroll_time_entry WHERE id=$1',[entry.id]),locked)
 await assert.rejects(insert(employee.id,'2026-09-17T14:00:00Z','2026-09-17T15:00:00Z'),locked)
 await insert(other.id)
 await insert(employee.id,'2026-09-21T14:00:00Z','2026-09-21T15:00:00Z')
 await h.pool.query("UPDATE payroll_run SET status='FINALIZED' WHERE id=$1",[run.id])
 await assert.rejects(h.pool.query('UPDATE payroll_time_entry SET unpaid_break_minutes=1 WHERE id=$1',[entry.id]),locked)
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[run.id])
 await assertCompensationUnlocked(h.pool,1,employee.id,'2026-09-16')
 await h.pool.query('UPDATE payroll_time_entry SET unpaid_break_minutes=1 WHERE id=$1',[entry.id])
 const blocker=await h.pool.connect()
 try {
  await blocker.query('BEGIN');await blocker.query('SELECT facility_id FROM payroll_settings WHERE facility_id=1 FOR UPDATE')
  const pid=(await blocker.query('SELECT pg_backend_pid() AS id')).rows[0].id
  await blocker.query("UPDATE payroll_run SET status='APPROVED' WHERE id=$1",[run.id])
  const pending=insert(employee.id,'2026-09-18T14:00:00Z','2026-09-18T15:00:00Z').then(()=>null,e=>e)
  let waiting=false
  for(let attempt=0;attempt<100&&!waiting;attempt++) {waiting=(await h.pool.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS waiting',[pid])).rows[0].waiting;if(!waiting)await new Promise(resolve=>setTimeout(resolve,10))}
  assert.equal(waiting,true)
  await blocker.query('COMMIT')
  assert.ok(locked(await pending))
 }finally{await blocker.query('ROLLBACK').catch(()=>{});blocker.release()}

})
