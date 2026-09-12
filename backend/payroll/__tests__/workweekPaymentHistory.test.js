import test from 'node:test'
import assert from 'node:assert/strict'
import {employmentWorkweekReviews} from '../employmentWorkweeks.js'
import {reconcileAllocationPayments} from '../allocationPaymentReconciliation.js'
import {createHarness} from '../testing/harness.js'
import {loadWorkweekPaymentHistory as load} from '../workweekPaymentHistory.js'
test('workweek history uses reconciled finalized snapshots, isolates employers and flags missing evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'WEEK-HISTORY',legalFirstName:'History',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500})})
 assert.equal(response.status,201);const employee=(await response.json()).data
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-01','2026-09-15','2026-09-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[period.id])).rows[0]
 const snapshot={workweekPaymentVersion:1,workweekPayments:[{week:'2026-09-14',workedMinutes:660,straightTimePayCents:27500,premiumCents:1250}]}
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_minutes,overtime_minutes,regular_pay_cents,overtime_pay_cents,statement_snapshot) VALUES($1,$2,600,60,25000,3750,$3)',[run.id,employee.id,snapshot])
 const details=await employmentWorkweekReviews(h.pool,1,[{employeeId:employee.id,week:'2026-09-14'}],[])
 assert.equal(details[0].payments[0].workweekPaymentVersion,1)
 assert.equal(details[0].payments[0].regularMinutes,600)
 details[0].allocationReview={status:'CURRENT',fingerprint:'synthetic',calculation:{workedMinutes:660,straightTimePayCents:27500,overtimePremiumCents:1250}}
 assert.equal(reconcileAllocationPayments(details[0]).status,'EVIDENCE_RECONCILED')
 assert.deepEqual(reconcileAllocationPayments(details[0]).differences,{straightTimeCents:0,premiumCents:0})
 const scoped=await employmentWorkweekReviews(h.pool,2,[{employeeId:employee.id,week:'2026-09-14'}],[])
 assert.deepEqual(scoped[0].payments,[]);assert.deepEqual(scoped[0].historicalPayments,[])
 const history=()=>load(h.pool,1,employee.id,['2026-09-14'],'2026-09-16')
 let result=await history();assert.equal(result[0].paidWorkedMinutes,660);assert.deepEqual(result[0].premiums,[{runId:Number(run.id),premiumCents:1250}]);assert.deepEqual(result[0].issues,[])
 assert.deepEqual((await load(h.pool,2,employee.id,['2026-09-14'],'2026-09-16'))[0].premiums,[])
 assert.deepEqual((await load(h.pool,1,employee.id,['2026-09-14'],'2026-09-01'))[0].premiums,[])
 await h.pool.query("UPDATE payroll_run SET status='APPROVED' WHERE id=$1",[run.id]);assert.deepEqual((await history())[0].premiums,[])
 await h.pool.query("UPDATE payroll_run SET status='FINALIZED' WHERE id=$1",[run.id])
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE payroll_run_id=$2',[{...snapshot,workweekPayments:[{...snapshot.workweekPayments[0],premiumCents:1251}]},run.id])
 result=await history();assert.equal(result[0].issues.length,1);assert.deepEqual(result[0].premiums,[])
 await h.pool.query("UPDATE payroll_run_employee SET statement_snapshot='{}' WHERE payroll_run_id=$1",[run.id])
 assert.equal((await history())[0].issues.length,1)
 await h.pool.query("INSERT INTO payroll_historical_payment(facility_id,employee_id,period_start,period_end,payment_date,method,gross_amount_cents,net_amount_cents) VALUES(1,$1,'2026-09-01','2026-09-15','2026-09-20','CHECK',100000,90000)",[employee.id])
 const imported=await employmentWorkweekReviews(h.pool,1,[{employeeId:employee.id,week:'2026-09-14'}],[])
 assert.equal(imported[0].historicalPayments.length,1)
 assert.match(reconcileAllocationPayments(imported[0]).issues.join(' '),/Historical payment/)
 assert.deepEqual((await employmentWorkweekReviews(h.pool,2,[{employeeId:employee.id,week:'2026-09-14'}],[]))[0].historicalPayments,[])
})
