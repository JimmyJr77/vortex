import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('weekly payroll reads immediately prior paid hours and blocks missing leave history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.ok(response.ok,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'WEEKLY-LEAVE',legalFirstName:'Weekly',legalLastName:'Leave',hireDate:'2026-01-01',hourlyRateCents:2500})
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='WEEKLY' WHERE facility_id=1")
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 const current=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-07','2026-09-13','2026-09-18','WEEKLY') RETURNING id")).rows[0]
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-09-07T12:00:00Z','2026-09-08T00:00:00Z','ADMIN','APPROVED')",[employee.id])
 let preview=(await api('/runs/preview',{payPeriodId:current.id})).preview
 assert.ok(preview.warnings.some(w=>w.code==='WEEKLY_LEAVE_HISTORY_REQUIRED'&&w.blocking))
 const previous=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-31','2026-09-06','2026-09-11','WEEKLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[previous.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_minutes) VALUES($1,$2,720)',[run.id,employee.id])
 preview=(await api('/runs/preview',{payPeriodId:current.id})).preview
 assert.equal(preview.employees[0].sickLeaveAccrualMinutes,24)
 assert.equal(preview.warnings.some(w=>w.code==='WEEKLY_LEAVE_HISTORY_REQUIRED'),false)
})
for(const frequency of ['SEMIMONTHLY','BIWEEKLY'])test(`first weekly period uses the previous finalized ${frequency} period only at a recorded schedule transition`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.ok(response.ok,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'TRANSITION-LEAVE',legalFirstName:'Transition',legalLastName:'Leave',hireDate:'2026-01-01',hourlyRateCents:2500})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 const current=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-16','2026-08-22','2026-08-27','WEEKLY') RETURNING id")).rows[0]
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-16T12:00:00Z','2026-08-17T00:00:00Z','ADMIN','APPROVED')",[employee.id])
 const priorStart=frequency==='SEMIMONTHLY'?'2026-08-01':'2026-08-02'
 const prior=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1,'2026-08-15','2026-08-20',$2) RETURNING id",[priorStart,frequency])).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[prior.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_minutes) VALUES($1,$2,720)',[run.id,employee.id])
 const preview=async()=>(await api('/runs/preview',{payPeriodId:current.id})).preview
 assert.ok((await preview()).warnings.some(w=>w.code==='WEEKLY_LEAVE_HISTORY_REQUIRED'))
 await h.pool.query(`INSERT INTO payroll_schedule_version(facility_id,effective_on,schedule_settings,source) VALUES(1,'2000-01-01',$1,'Synthetic original schedule'),(1,'2026-08-16',$2,'Synthetic weekly transition')`,[{pay_frequency:frequency},{pay_frequency:'WEEKLY',pay_period_anchor_start:'2026-08-16',pay_period_payment_lag_days:5}])
 const result=await preview()
 assert.equal(result.warnings.some(w=>w.code==='WEEKLY_LEAVE_HISTORY_REQUIRED'),false)
 assert.equal(result.employees[0].sickLeaveAccrualMinutes,24)
 assert.deepEqual(result.employees[0].sickLeaveEligibility,{priorPeriodStart:priorStart,priorPeriodEnd:'2026-08-15',priorFrequency:frequency,priorRunId:String(run.id),priorWorkedMinutes:720})
 await h.pool.query('UPDATE payroll_run_employee SET regular_minutes=600 WHERE payroll_run_id=$1',[run.id])
 assert.equal((await preview()).employees[0].sickLeaveAccrualMinutes,0)
 await h.pool.query("UPDATE payroll_schedule_version SET cancelled_at=now() WHERE effective_on='2026-08-16'")
 assert.ok((await preview()).warnings.some(w=>w.code==='WEEKLY_LEAVE_HISTORY_REQUIRED'))
})
