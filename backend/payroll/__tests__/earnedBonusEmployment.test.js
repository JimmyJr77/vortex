import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('earned bonus retains prior hourly overtime after an exempt salary rehire and fingerprints dated agreements',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'BONUS-HISTORY',legalFirstName:'Bonus',legalLastName:'History',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 for(const d of ['03','04','05','06','07'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${d}T12:00Z`,`2026-08-${d}T22:00Z`])
 const path=`/employees/${e.id}/bonus-allocation/preview`,input={amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-09'}
 const before=await api(path,input);assert.equal(before.additionalOvertimeCents,1000)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-09' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',hire_date='2026-08-10',termination_date=NULL,pay_type='SALARY',annual_salary_cents=7800000,overtime_classification='EXEMPT',salary_review=$2 WHERE id=$1",[e.id,{classification:'EXEMPT',verifiedAt:'2026-08-10T12:00:00Z'}])
 const prior=await api(path,input)
 assert.equal(prior.additionalOvertimeCents,1000);assert.equal(prior.weeks[0].overtimeEligible,true)
 assert.equal(prior.compensation[0].payType,'HOURLY')
 for(const d of ['10','11','12','13','14'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${d}T12:00Z`,`2026-08-${d}T22:00Z`])
 const both=await api(path,{...input,earnedEnd:'2026-08-16'})
 assert.deepEqual(both.weeks.map(w=>w.overtimeEligible),[true,false]);assert.equal(both.additionalOvertimeCents,500)
 await h.pool.query("UPDATE payroll_pay_rate SET hourly_rate_cents=2600 WHERE employee_id=$1 AND effective_on='2026-08-03'",[e.id])
 const changed=await api(path,input);assert.notEqual(changed.fingerprint,prior.fingerprint);assert.equal(changed.additionalOvertimeCents,1000)
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-02T12:00Z','2026-08-02T13:00Z','ADMIN','APPROVED')",[e.id])
 await api(path,{...input,earnedStart:'2026-08-02'},409)
})
test('a bonus week crossing hourly and exempt salary classifications requires individual review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const r=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'BONUS-MIXED-WEEK',legalFirstName:'Mixed',legalLastName:'Week',hireDate:'2026-08-03',hourlyRateCents:2500})})
 assert.equal(r.status,201);const e=(await r.json()).data
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-05' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',hire_date='2026-08-07',termination_date=NULL,pay_type='SALARY',annual_salary_cents=7800000,overtime_classification='EXEMPT',salary_review=$2 WHERE id=$1",[e.id,{classification:'EXEMPT',verifiedAt:'2026-08-07T12:00:00Z'}])
 for(const d of ['03','07'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${d}T12:00Z`,`2026-08-${d}T13:00Z`])
 const result=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/bonus-allocation/preview`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-09'})})
 assert.equal(result.status,409);assert.match((await result.json()).message,/different overtime classifications/)
})
