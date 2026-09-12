import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateMarylandSickAccrual} from '../payrollEngine.js'
import {loadLeaveRemainder} from '../leaveRemainder.js'
import {createHarness} from '../testing/harness.js'
test('fractional sick leave survives subsequent eligible and ineligible periods without rounding loss',()=>{
 const first=calculateMarylandSickAccrual({workedMinutes:1561,payFrequency:'SEMIMONTHLY'})
 assert.deepEqual(first,{minutes:52,remainder:1})
 const second=calculateMarylandSickAccrual({workedMinutes:1589,payFrequency:'SEMIMONTHLY',priorRemainder:first.remainder})
 assert.deepEqual(second,{minutes:53,remainder:0});assert.equal(first.minutes+second.minutes,(1561+1589)/30)
 assert.deepEqual(calculateMarylandSickAccrual({workedMinutes:100,payFrequency:'SEMIMONTHLY',priorRemainder:17}),{minutes:0,remainder:17})
 assert.deepEqual(calculateMarylandSickAccrual({workedMinutes:1561,payFrequency:'SEMIMONTHLY',priorRemainder:29,currentBalanceMinutes:3839}),{minutes:1,remainder:0})
 assert.throws(()=>calculateMarylandSickAccrual({workedMinutes:1560,payFrequency:'SEMIMONTHLY',priorRemainder:30}),/fractional remainder/)
})
test('payroll loads finalized fractional carry and preserves it in the new draft',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.ok(response.ok,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'LEAVE-FRACTION',legalFirstName:'Fraction',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 const current=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-16','2026-08-31','2026-09-04','SEMIMONTHLY') RETURNING id")).rows[0]
 const previous=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-01','2026-08-15','2026-08-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'FINALIZED') RETURNING id",[previous.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_minutes,sick_leave_accrual_minutes,statement_snapshot) VALUES($1,$2,1589,52,$3)',[run.id,employee.id,{sickLeaveFraction:{version:1,remainderAfter:29}}])
 for(const [date,hours] of [['2026-08-17',9],['2026-08-18',9],['2026-08-19',8]])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`${date}T12:00:00Z`,`${date}T${12+hours}:00:00Z`])
 await h.pool.query("UPDATE payroll_time_entry SET clock_out=clock_out+interval '1 minute' WHERE employee_id=$1 AND clock_in='2026-08-19T12:00:00Z'",[employee.id])
 const preview=(await api('/runs/preview',{payPeriodId:current.id})).preview
 assert.equal(preview.employees[0].sickLeaveAccrualMinutes,53)
 assert.deepEqual(preview.employees[0].sickLeaveFraction,{version:1,remainderBefore:29,remainderAfter:0,sourceRunId:String(run.id),source:'FINALIZED_FRACTION'})
 await api('/runs',{payPeriodId:current.id})
 const draft=(await h.pool.query("SELECT calculation_snapshot FROM payroll_run WHERE pay_period_id=$1",[current.id])).rows[0]
 assert.deepEqual(draft.calculation_snapshot.employees[0].sickLeaveFraction,preview.employees[0].sickLeaveFraction)
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=NULL WHERE payroll_run_id=$1',[run.id])
 await assert.rejects(loadLeaveRemainder(h.pool,1,employee.id,current.id,'2026-09-04'),/untracked fractional/)
})
