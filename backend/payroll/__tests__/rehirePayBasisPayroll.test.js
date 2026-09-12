import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {salaryRowsAt} from '../salaryChanges.js'
for(const initial of ['HOURLY','SALARY'])test(`historical ${initial} payroll retains its basis and terms after a different-basis rehire`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:`BASIS-PAYROLL-${initial}`,legalFirstName:'Historical',legalLastName:'Pay',hireDate:'2026-08-03',hourlyRateCents:2500,...(initial==='SALARY'?{payType:'SALARY',annualSalaryCents:5200000}:{})})
 if(initial==='SALARY')await api(`/employees/${e.id}/salary-review`,{classification:'EXEMPT',category:'ADMINISTRATIVE',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true,dutiesEvidence:'Synthetic reviewed administrative duties with independent judgment for this fixture',source:'Synthetic verified initial salary agreement',confirmed:true})
 if(initial==='SALARY')await h.pool.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason) SELECT facility_id,id,hire_date,annual_salary_cents,salary_review,'Synthetic prior agreement retained before conversion' FROM payroll_employee WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-09-07',termination_date=NULL,pay_type=$1,hourly_rate_cents=3000,annual_salary_cents=$2,salary_review=NULL,overtime_classification=$3 WHERE id=$4",[initial==='HOURLY'?'SALARY':'HOURLY',initial==='HOURLY'?6240000:null,initial==='HOURLY'?'EXEMPT_REVIEW':'NONEXEMPT',e.id])
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason) VALUES(1,$1,'2026-09-07',3000,'Synthetic new terms')",[e.id])
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-03T12:00Z','2026-08-03T13:00Z','ADMIN','APPROVED')",[e.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const result=(await api('/runs/preview',{payPeriodId:period.id,paymentDate:'2026-08-14'})).preview
 const employee=result.employees.find(row=>row.employeeId===e.id)
 assert.equal(employee.payType,initial)
 assert.equal(employee.grossPayCents,initial==='HOURLY'?2500:100000)
 if(initial==='SALARY')assert.equal(employee.salaryCalculation.annualSalaryCents,5200000)
 assert.ok(!result.warnings.some(w=>w.code==='MIXED_EMPLOYMENT_PAY_BASIS'))
 if(initial==='SALARY'){
  await api('/employees',{employeeNumber:'OTHER-SALARY-ROW',legalFirstName:'Other',legalLastName:'Salary',hireDate:'2099-01-01',payType:'SALARY',annualSalaryCents:5200000})
  const current=(await salaryRowsAt(h.pool,1,(await h.pool.query('SELECT * FROM payroll_employee WHERE facility_id=1')).rows)).find(row=>Number(row.id)===e.id)
  assert.equal(current.pay_type,'HOURLY');assert.equal(current.overtime_classification,'NONEXEMPT');assert.equal(current.annual_salary_cents,null)
 }
 if(initial==='HOURLY')await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic verified new salary agreement'})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const mixed=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-10','2026-09-13','2026-09-18','SEMIMONTHLY') RETURNING id")).rows[0]
 // Extend the synthetic test period to include both recorded employment periods.
 await h.pool.query("UPDATE payroll_pay_period SET period_start='2026-08-03' WHERE id=$1",[mixed.id])
 const blocked=(await api('/runs/preview',{payPeriodId:mixed.id,paymentDate:'2026-09-18'})).preview
 assert.ok(!blocked.warnings.some(w=>w.code==='MIXED_EMPLOYMENT_PAY_BASIS'))
 assert.equal(blocked.canApprove,false)
 const split=blocked.employees.find(row=>row.employeeId===e.id)
 assert.equal(split.payType,'MIXED');assert.equal(split.splitCompensation.length,2)
 assert.equal(split.grossPayCents,initial==='HOURLY'?262500:216667)
})
