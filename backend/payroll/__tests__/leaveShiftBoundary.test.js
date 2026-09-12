import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('leave and shifts use an exclusive shift end at employer-local midnight',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'LEAVE-MIDNIGHT',legalFirstName:'Leave',legalLastName:'Boundary',hireDate:'2026-01-01',hourlyRateCents:2500},201)
 const shift=(start,end)=>({employeeId:e.id,scheduledStart:start,scheduledEnd:end})
 // Midnight on October 2 in the employer's New York timezone is 04:00 UTC.
 await api('/shifts',shift('2099-10-02T02:00:00Z','2099-10-02T04:00:00Z'),201)
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'LEAVE',$2) RETURNING id",[e.id,{startDate:'2099-10-02',endDate:'2099-10-02',minutes:60,leaveType:'UNPAID',reason:'Synthetic midnight boundary'}])).rows[0]
 await api(`/requests/${request.id}/review`,{status:'APPROVED',note:'No shift overlaps the requested local day'})
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_shift WHERE employee_id=$1 AND status='SCHEDULED'",[e.id])).rows[0].n,1)
 // Cancel the original shift to isolate leave conflict checks on creation.
 await h.pool.query("UPDATE payroll_shift SET status='CANCELLED' WHERE employee_id=$1",[e.id])
 await api('/shifts',shift('2099-10-02T03:00:00Z','2099-10-02T04:00:00.001Z'),409)
 await api('/shifts',shift('2099-10-02T03:00:00Z','2099-10-02T04:00:00Z'),201)
 await api('/shifts',shift('2099-10-02T04:00:00Z','2099-10-02T05:00:00Z'),409)
 await api('/shifts',shift('2099-10-03T04:00:00Z','2099-10-03T05:00:00Z'),201)
})
