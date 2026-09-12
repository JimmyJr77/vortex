import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('leave submission and approval revalidate inclusive employment dates without debiting or cancelling on failure',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,employee=false,facility=1)=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:'POST',headers:{Authorization:`Bearer ${employee?'leave-employment-session':'payroll-test-admin'}`,'Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'LEAVE-EMPLOYMENT',legalFirstName:'Leave',legalLastName:'History',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-09-07',termination_date=NULL WHERE id=$1",[e.id])
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('leave-employment-session')])
 const leave=(start,end=start,type='UNPAID')=>({kind:'LEAVE',payload:{startDate:start,endDate:end,minutes:60,leaveType:type,reason:'Synthetic planned leave'}})
 for(const [start,end] of [['2026-08-02','2026-08-03'],['2026-08-09','2026-08-09'],['2026-08-08','2026-09-07']])await api('/requests',leave(start,end),409,true)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_employee_request WHERE employee_id=$1',[e.id])).rows[0].n,0)
 const earlier=await api('/requests',leave('2026-08-08'),200,true)
 await api(`/requests/${earlier.id}/review`,{status:'APPROVED',note:'Prior employment end date is included'})
 const current=await api('/requests',leave('2026-09-07'),200,true)
 await api(`/requests/${current.id}/review`,{status:'APPROVED',note:'Hire date is included'})
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-07',120,'Synthetic bank')",[e.id])
 const pending=await api('/requests',leave('2026-09-10','2026-09-10','PTO'),200,true)
 const shift=(await h.pool.query("INSERT INTO payroll_shift(facility_id,employee_id,scheduled_start,scheduled_end) VALUES(1,$1,'2026-09-10T13:00Z','2026-09-10T14:00Z') RETURNING id",[e.id])).rows[0]
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-09' WHERE id=$1",[e.id])
 const decision={status:'APPROVED',note:'Must recheck dates after separation',cancelConflictingShifts:true}
 await api(`/requests/${pending.id}/review`,decision,404,false,2)
 await api(`/requests/${pending.id}/review`,decision,409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[pending.id])).rows[0].status,'PENDING')
 assert.equal((await h.pool.query('SELECT status FROM payroll_shift WHERE id=$1',[shift.id])).rows[0].status,'SCHEDULED')
 assert.equal((await h.pool.query('SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,120)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_paid_leave WHERE request_id=$1',[pending.id])).rows[0].n,0)
 await api(`/requests/${pending.id}/review`,{status:'DECLINED',note:'Dates fall after separation'})
})
