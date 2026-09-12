import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('payroll caps sick accrual using ledger balance as of payment and ignores future leave bookings',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.ok(response.ok,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'BALANCE-CAP',legalFirstName:'Balance',legalLastName:'Cap',hireDate:'2025-01-01',hourlyRateCents:2500})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-01','2026-08-15','2026-08-20','SEMIMONTHLY') RETURNING id")).rows[0]
 for(let day=3;day<8;day++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-08-0${day}T12:00:00Z`,`2026-08-0${day}T20:00:00Z`])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason) VALUES(1,$1,'2025-12-31',3830,'Synthetic opening balance'),(1,$1,'2026-09-01',-600,'Synthetic future leave')",[employee.id])
 const preview=async()=>(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0]
 let result=await preview();assert.equal(result.sickLeaveAccrualMinutes,10);assert.equal(result.sickLeaveBalanceBeforeMinutes,3830);assert.equal(result.sickLeaveYearAccruedBeforeMinutes,0)
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason) VALUES(1,$1,'2026-08-10',-100,'Synthetic leave used')",[employee.id])
 result=await preview();assert.equal(result.sickLeaveAccrualMinutes,80);assert.equal(result.sickLeaveBalanceBeforeMinutes,3730)
 await h.pool.query('DELETE FROM payroll_leave_transaction WHERE employee_id=$1',[employee.id])
 const opening=await api(`/employees/${employee.id}/leave-transactions`,{transactionDate:'2026-01-01',minutes:2400,transactionKind:'OPENING_BALANCE',reason:'Verified prior employer ledger import'})
 assert.equal(opening.transaction_kind,'OPENING_BALANCE')
 result=await preview();assert.equal(result.sickLeaveYearAccruedBeforeMinutes,0);assert.equal(result.sickLeaveBalanceBeforeMinutes,2400);assert.equal(result.sickLeaveAccrualMinutes,80)
 await api(`/employees/${employee.id}/leave-transactions`,{transactionDate:'2026-02-01',minutes:60,transactionKind:'RESTORATION',reason:'Verified restoration of previously earned leave'})
 result=await preview();assert.equal(result.sickLeaveYearAccruedBeforeMinutes,0);assert.equal(result.sickLeaveBalanceBeforeMinutes,2460)
 await api(`/employees/${employee.id}/leave-transactions`,{transactionDate:'2026-03-01',minutes:60,transactionKind:'FRONTLOAD',reason:'Verified annual frontload policy supplement'})
 result=await preview();assert.equal(result.sickLeaveYearAccruedBeforeMinutes,60)

})
