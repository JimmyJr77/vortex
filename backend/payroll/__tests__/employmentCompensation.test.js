import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {employmentCompensationAt} from '../employmentCompensation.js'
test('payroll evidence separates employment terms and rejects missing historical compensation',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'COMP-SEGMENTS',legalFirstName:'Terms',legalLastName:'History',hireDate:'2026-08-03',hourlyRateCents:2500})
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason) VALUES(1,$1,'2026-08-05',2700,'Synthetic retained rate change')",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-09-07',termination_date=NULL,pay_type='SALARY',annual_salary_cents=6240000,hourly_rate_cents=0 WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic current salary agreement evidence'})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const period={period_start:'2026-08-03',period_end:'2026-09-13'}
 let segments=await employmentCompensationAt(h.pool,1,period)
 assert.deepEqual(segments.map(s=>[s.start,s.end,s.payType,s.hourlyRateCents,s.annualSalaryCents]),[['2026-08-03','2026-08-04','HOURLY',2500,null],['2026-08-05','2026-08-08','HOURLY',2700,null],['2026-09-07','2026-09-13','SALARY',null,6240000]])
 assert.equal(segments.at(-1).source,'CURRENT_SALARY_REVIEW')
 assert.ok(segments.every(s=>!s.issue))
 assert.deepEqual(await employmentCompensationAt(h.pool,2,period),[])
 await h.pool.query("UPDATE payroll_pay_rate SET cancelled_at=now(),cancellation_reason='Synthetic missing history' WHERE employee_id=$1 AND effective_on='2026-08-03'",[e.id])
 segments=await employmentCompensationAt(h.pool,1,period)
 assert.equal(segments[0].source,'MISSING');assert.equal(segments[0].hourlyRateCents,null);assert.ok(segments[0].issue);assert.ok(!segments[1].issue)
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const preview=(await api('/runs/preview',{payPeriodId:p.id,paymentDate:'2026-08-14'})).preview
 assert.equal(preview.canApprove,false)
 assert.ok(preview.warnings.some(w=>w.code==='EMPLOYMENT_COMPENSATION_MISSING'&&w.blocking))
 assert.deepEqual(preview.employees.find(r=>r.employeeId===e.id).employmentCompensation,segments.slice(0,2))
})
test('a prior salary agreement cannot fill missing terms for a later salary hiring period',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const request=async(path,body)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok);return (await r.json()).data}
 const e=await request('/employees',{employeeNumber:'SALARY-SEGMENTS',legalFirstName:'Salary',legalLastName:'History',hireDate:'2026-08-03',payType:'SALARY',annualSalaryCents:5200000})
 await request(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic initial salary agreement evidence'})
 await h.pool.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason) SELECT facility_id,id,hire_date,annual_salary_cents,salary_review,'Retained initial agreement' FROM payroll_employee WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-09-07',termination_date=NULL,annual_salary_cents=6240000,salary_review=NULL WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const segments=await employmentCompensationAt(h.pool,1,{period_start:'2026-08-01',period_end:'2026-09-30'})
 assert.equal(segments.length,2);assert.equal(segments[0].annualSalaryCents,5200000);assert.ok(!segments[0].issue)
 assert.equal(segments[1].source,'MISSING');assert.equal(segments[1].annualSalaryCents,null);assert.ok(segments[1].issue)
})
