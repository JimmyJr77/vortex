import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
const api=h=>async(path,body)=>{
 const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers,body:JSON.stringify(body)})
 const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result.data
}
test('regular payroll retains previous employment while rehire onboarding remains incomplete',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const call=api(h)
 const employee=await call('/employees',{employeeNumber:'REHIRE-PAYROLL',legalFirstName:'Returning',legalLastName:'Hourly',hireDate:'2026-08-03',hourlyRateCents:2500})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[employee.id])
 // Model the transition directly until its transactional onboarding endpoint is implemented.
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-09-07',termination_date=NULL,hourly_rate_cents=3000 WHERE id=$1",[employee.id])
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason) VALUES(1,$1,'2026-09-07',3000,'Synthetic rehire agreement')",[employee.id])
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-03T12:00Z','2026-08-03T13:00Z','ADMIN','APPROVED'),(1,$1,'2026-09-07T12:00Z','2026-09-07T13:00Z','ADMIN','APPROVED')",[employee.id])
 const periods=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY'),(1,'2026-08-10','2026-08-16','2026-08-21','WEEKLY'),(1,'2026-09-07','2026-09-13','2026-09-18','WEEKLY') RETURNING id")).rows
 const preview=async index=>(await call('/runs/preview',{payPeriodId:periods[index].id})).preview
 const historical=await preview(0)
 assert.equal(historical.employees.length,1);assert.equal(historical.employees[0].employeeId,employee.id)
 assert.equal(historical.employees[0].grossPayCents,2500)
 assert.equal((await preview(1)).employees.length,0)
 const pending=await preview(2);assert.equal(pending.employees.length,0)
 assert.ok(pending.warnings.some(w=>w.code==='PAYROLL_EMPLOYMENT_RECONCILIATION'&&w.blocking))
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 assert.equal((await preview(2)).employees[0].grossPayCents,3000)
 assert.equal((await preview(0)).employees[0].grossPayCents,2500)
})

test('salary payroll uses each employment interval for leave basis and pays one scheduled salary across a rehire gap',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const call=api(h)
 const employee=await call('/employees',{employeeNumber:'REHIRE-SALARY-PAYROLL',legalFirstName:'Returning',legalLastName:'Salary',hireDate:'2026-08-03',payType:'SALARY',annualSalaryCents:5200000,jobTitle:'Office manager'})
 await call(`/employees/${employee.id}/salary-review`,{classification:'EXEMPT',category:'ADMINISTRATIVE',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true,dutiesEvidence:'Verified independent discretion and judgment on significant office management matters.',source:'Synthetic job duties and salary basis agreement',confirmed:true})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-05' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-07',termination_date=NULL WHERE id=$1",[employee.id])
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-07T12:00Z','2026-08-07T13:00Z','ADMIN','APPROVED')",[employee.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const before=(await call('/runs/preview',{payPeriodId:period.id})).preview.employees
 assert.equal(before.length,1);assert.equal(before[0].salaryCalculation.regularPayCents,100000)
 assert.equal(before[0].salaryCalculation.leaveBasisMinutes,1440)
 assert.equal(before[0].entries.length,0)
 assert.ok(before[0].warnings.some(w=>w.code==='PAYROLL_EMPLOYMENT_RECONCILIATION'))
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 const after=(await call('/runs/preview',{payPeriodId:period.id})).preview.employees
 assert.equal(after.length,1);assert.equal(after[0].salaryCalculation.regularPayCents,100000)
 assert.equal(after[0].salaryCalculation.leaveBasisMinutes,1920)
 assert.equal(after[0].entries.length,1)
 assert.equal(after[0].warnings.some(w=>w.code==='PAYROLL_EMPLOYMENT_RECONCILIATION'),false)
 assert.equal(after[0].salaryCalculation.partialPeriod,true)
 assert.equal(after[0].salaryCalculation.paymentPolicy,'FULL_PERIOD_SALARY_NO_ABSENCE_DEDUCTIONS')
})
