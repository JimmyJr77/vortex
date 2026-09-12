import test from 'node:test'
import assert from 'node:assert/strict'
import {finalPayStatus,refreshFinalPayAlerts} from '../finalPay.js'
import {createHarness} from '../testing/harness.js'
test('final-period payroll tracks deadlines, scope, missing work and reopened requests',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'FINAL-PAY',legalFirstName:'Final',legalLastName:'Pay',hireDate:'2026-08-03',hourlyRateCents:2500})});assert.equal(r.status,201);const e=(await r.json()).data
 await assert.rejects(()=>finalPayStatus(h.pool,1,e.id),e=>e.status===409)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 const today=new Date('2026-08-15T12:00:00Z')
 assert.equal((await finalPayStatus(h.pool,1,e.id,today)).dueOn,null)
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const clock=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-03T12:00:00Z','2026-08-03T20:00:00Z','ADMIN','UNVERIFIED') RETURNING id",[e.id])).rows[0]
 const status=await finalPayStatus(h.pool,1,e.id,today);assert.equal(status.status,'PAYROLL_OVERDUE');assert.equal(status.dueOn,'2026-08-14');assert.equal(status.unresolvedTimeEntries,1)
 await refreshFinalPayAlerts(h.pool,1,today);await refreshFinalPayAlerts(h.pool,1,today)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_alert WHERE dedupe_key=$1",[`final-pay-${e.id}`])).rows[0].n,1)
 await h.pool.query("UPDATE payroll_time_entry SET status='APPROVED' WHERE id=$1",[clock.id])
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,payment_date,payment_confirmation_reference) VALUES(1,$1,'FINALIZED','2026-08-15','SYNTHETIC-FINAL-PAYMENT') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,net_pay_cents) VALUES($1,$2,17000)',[run.id,e.id])
 await h.pool.query('UPDATE payroll_run SET payment_confirmation_reference=NULL WHERE id=$1',[run.id])
 assert.ok((await finalPayStatus(h.pool,1,e.id,today)).issues.some(i=>i.includes('payment confirmation')))
 await h.pool.query("UPDATE payroll_run SET payment_confirmation_reference='SYNTHETIC-FINAL-PAYMENT' WHERE id=$1",[run.id])
 const paid=await finalPayStatus(h.pool,1,e.id,today);assert.equal(paid.status,'PAYROLL_FINALIZED');assert.equal(paid.paymentTiming,'LATE');assert.deepEqual(paid.issues,[])
 await refreshFinalPayAlerts(h.pool,1,today)
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`final-pay-${e.id}`])).rows[0].status,'DISMISSED')
 await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'TIME_CORRECTION','{}')",[e.id])
 await refreshFinalPayAlerts(h.pool,1,today)
 assert.equal((await finalPayStatus(h.pool,1,e.id,today)).pendingRequests,1)
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`final-pay-${e.id}`])).rows[0].status,'OPEN')
 const scope=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/final-pay`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(scope.status,404)
})
