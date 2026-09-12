import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('approved future leave cancellation restores once, preserves history and removes unpaid leave from payroll',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'CANCEL-LEAVE',legalFirstName:'Cancel',legalLastName:'Leave',hireDate:'2026-01-01',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2099-10-01','2099-10-15','2099-10-20','SEMIMONTHLY') RETURNING id")).rows[0]
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-01-01',120,'Synthetic opening')",[e.id])
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'LEAVE',$2) RETURNING id",[e.id,{startDate:'2099-10-02',endDate:'2099-10-02',leaveType:'PTO',minutes:60,reason:'Synthetic planned leave'}])).rows[0]
 await api(`/requests/${request.id}/review`,{status:'APPROVED',note:'Original approval evidence'})
 const preview=async()=>(await api('/runs/preview',{payPeriodId:period.id,paymentDate:'2099-10-20'})).preview.employees.find(row=>row.employeeId===e.id)
 assert.equal((await preview()).paidLeavePayCents,2500)
 const shift={employeeId:e.id,scheduledStart:'2099-10-02T13:00:00Z',scheduledEnd:'2099-10-02T14:00:00Z'}
 await api('/shifts',shift,409)
 const cancel={reason:'Employee changed the planned leave date'}
 const dates=(await h.pool.query("SELECT (now() AT TIME ZONE timezone)::date::text AS today,((now() AT TIME ZONE timezone)::date-1)::text AS yesterday FROM payroll_settings WHERE facility_id=1")).rows[0]
 for(const date of [dates.yesterday,dates.today]){
  const started=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,status,payload) VALUES(1,$1,'LEAVE','APPROVED',$2) RETURNING id",[e.id,{startDate:date,endDate:date,leaveType:'UNPAID',minutes:60,reason:'Synthetic leave without recorded start time'}])).rows[0]
  await api(`/requests/${started.id}/cancel-approved-leave`,cancel,409)
  assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[started.id])).rows[0].status,'APPROVED')
 }

 await api(`/requests/${request.id}/cancel-approved-leave`,cancel,404,2)
 const lock=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[period.id])).rows[0]
 await api(`/requests/${request.id}/cancel-approved-leave`,cancel,409)
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[lock.id])
 await h.pool.query("CREATE FUNCTION reject_leave_cancel_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='APPROVED_LEAVE_CANCELLED' THEN RAISE EXCEPTION 'Synthetic cancellation audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_leave_cancel_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_leave_cancel_audit()')
 await api(`/requests/${request.id}/cancel-approved-leave`,cancel,500)
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[request.id])).rows[0].status,'APPROVED')
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND transaction_kind='RESTORATION'",[e.id])).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_leave_cancel_audit ON payroll_audit_log')
 assert.equal((await api(`/requests/${request.id}/cancel-approved-leave`,cancel)).restoredMinutes,60)
 await api(`/requests/${request.id}/cancel-approved-leave`,cancel)
 await api(`/requests/${request.id}/cancel-approved-leave`,{reason:'A different cancellation explanation'},409)
 assert.equal((await preview()).paidLeavePayCents,0)
 await api('/shifts',shift,201)
 const saved=(await h.pool.query('SELECT * FROM payroll_employee_request WHERE id=$1',[request.id])).rows[0]
 assert.equal(saved.status,'CANCELLED');assert.equal(saved.review_note,'Original approval evidence')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_paid_leave WHERE request_id=$1',[request.id])).rows[0].n,1)
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO'",[e.id])).rows[0].n,120)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='APPROVED_LEAVE_CANCELLED' AND entity_id=$1",[String(request.id)])).rows[0].n,1)
})
