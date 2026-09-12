import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
test('rehire preparation reconciles prior records without mutating the employee or reopening tasks',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const created=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers,body:JSON.stringify({employeeNumber:'REHIRE-REVIEW',legalFirstName:'Returning',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500})})
 assert.equal(created.status,201);const employee=(await created.json()).data
 const url=`${h.url}/api/admin/payroll/employees/${employee.id}/rehire-review`
 assert.equal((await fetch(`${url}?startDate=2099-09-07`,{headers})).status,409)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[employee.id])
 for(const date of ['2026-02-30','not-a-date',''])assert.equal((await fetch(`${url}?startDate=${date}`,{headers})).status,400)
 assert.equal((await fetch(`${url}?startDate=2099-09-07`,{headers:{...headers,'x-test-facility':'2'}})).status,404)
 assert.equal((await fetch(`${url}?startDate=2099-09-07`)).status,401)
 const get=async date=>{const response=await fetch(`${url}?startDate=${date}`,{headers});assert.equal(response.status,200);return (await response.json()).data}
 const badDate=await get('2026-08-08');assert.ok(badDate.issues.some(i=>i.includes('follow every recorded separation')))
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const pending=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'REVIEW') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,net_pay_cents) VALUES($1,$2,17000)',[pending.id,employee.id])
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason) VALUES(1,$1,'2099-09-01',2800,'Synthetic reviewed earlier terms'),(1,$1,'2099-10-01',3000,'Synthetic scheduled future terms')",[employee.id])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-01',480,'Synthetic accrued vacation'),(1,$1,'PTO','2200-01-01',600,'Future credit excluded')",[employee.id])
 const before=(await h.pool.query('SELECT to_jsonb(e) AS employee,(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM payroll_onboarding_task t WHERE t.employee_id=e.id) AS tasks,(SELECT COUNT(*) FROM payroll_onboarding_revision v WHERE v.employee_id=e.id) AS revisions FROM payroll_employee e WHERE e.id=$1',[employee.id])).rows[0]
 const review=await get('2099-09-07')
 assert.equal(review.employeeId,Number(employee.id));assert.equal(review.compensation.hourlyRateCents,2800)
 assert.equal(review.compensation.source,'DATED_RECORD');assert.equal(review.compensation.laterChanges.length,1)
 assert.ok(review.issues.some(i=>i.includes('compensation changes')));assert.ok(review.issues.some(i=>i.includes('1 saved payroll runs')))
 assert.ok(review.issues.some(i=>i.includes('has not been finalized')))
 assert.equal(review.pendingRuns[0].id,Number(pending.id));assert.equal(review.leaveBalances[0].minutes,480)
 assert.equal(review.onboarding.length,13);assert.ok(review.onboarding.every(t=>t.cycle===1&&t.status==='OPEN'))
 assert.equal(review.employmentPeriods.length,1)
 const after=(await h.pool.query('SELECT to_jsonb(e) AS employee,(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM payroll_onboarding_task t WHERE t.employee_id=e.id) AS tasks,(SELECT COUNT(*) FROM payroll_onboarding_revision v WHERE v.employee_id=e.id) AS revisions FROM payroll_employee e WHERE e.id=$1',[employee.id])).rows[0]
 assert.deepEqual(after,before)
 await h.pool.query("UPDATE payroll_run SET status='FINALIZED',payment_date='2026-08-14',payment_confirmation_reference='SYNTHETIC-REVIEW-ONLY' WHERE id=$1",[pending.id])
 const paid=await get('2099-11-01');assert.deepEqual(paid.issues,[]);assert.equal(paid.compensation.hourlyRateCents,3000);assert.equal(paid.pendingRuns.length,0)
 // Finalized-period evidence is reported, never elevated to a general rehire approval.
 assert.equal(paid.ready,undefined);assert.equal(paid.canRehire,undefined)
})

test('rehire review selects dated salary terms and reports missing separation history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const created=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers,body:JSON.stringify({employeeNumber:'REHIRE-SALARY',legalFirstName:'Returning',legalLastName:'Salary',hireDate:'2026-08-03',payType:'SALARY',annualSalaryCents:5200000})})
 assert.equal(created.status,201);const employee=(await created.json()).data
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id])
 await h.pool.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason) VALUES(1,$1,'2099-09-01',6000000,'{}','Synthetic salary review')",[employee.id])
 const get=async date=>{const response=await fetch(`${h.url}/api/admin/payroll/employees/${employee.id}/rehire-review?startDate=${date}`,{headers});assert.equal(response.status,200);return (await response.json()).data}
 const opening=await get('2099-08-01');assert.equal(opening.compensation.annualSalaryCents,5200000);assert.equal(opening.compensation.source,'EMPLOYEE_PROFILE')
 assert.equal(opening.compensation.hourlyRateCents,null)
 assert.ok(opening.issues.some(i=>i.includes('Reconcile the employee profile')))
 assert.ok(opening.issues.some(i=>i.includes('Record the employment end date')))
 const changed=await get('2099-09-07');assert.equal(changed.compensation.annualSalaryCents,6000000);assert.equal(changed.compensation.source,'DATED_RECORD');assert.equal(changed.compensation.laterChanges.length,0)
})
