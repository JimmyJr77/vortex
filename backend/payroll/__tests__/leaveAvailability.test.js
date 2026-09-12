import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {leaveAvailabilityAt,leaveAvailabilityFromEvidence} from '../leaveAvailability.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('leave approval preserves dated balances and future approved commitments',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'DATED-LEAVE',legalFirstName:'Dated',legalLastName:'Leave',hireDate:'2026-01-01',hourlyRateCents:2500},201)
 const credit=async(date,minutes)=>(await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO',$2,$3,'Synthetic dated ledger')",[e.id,date,minutes]))
 const request=async(date,minutes)=>(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'LEAVE',$2) RETURNING id",[e.id,{startDate:date,endDate:date,minutes,leaveType:'PTO',reason:'Synthetic planned leave'}])).rows[0]
 const approve=(r,status=200)=>api(`/requests/${r.id}/review`,{status:'APPROVED',note:'Reviewed dated leave availability'},status)
 await credit('2026-10-01',120)
 const early=await request('2026-09-15',60);await approve(early,409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[early.id])).rows[0].status,'PENDING')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction WHERE source_request_id=$1',[early.id])).rows[0].n,0)
 const october=await request('2026-10-01',120);await approve(october)
 assert.equal(await leaveAvailabilityAt(h.pool,1,e.id,'PTO','2026-10-01'),0)
 // An opening grant and later replacement grant cannot be double-booked when
 // an already approved November request consumes the replacement grant.
 await credit('2026-09-01',60);await credit('2026-11-01',120)
 const november=await request('2026-11-02',180);await approve(november)
 assert.equal(await leaveAvailabilityAt(h.pool,1,e.id,'PTO','2026-09-15'),0)
 await approve(early,409)
 await credit('2026-09-15',60);await approve(early)
 assert.equal(await leaveAvailabilityAt(h.pool,1,e.id,'PTO','2026-09-15'),0)
 assert.equal(await leaveAvailabilityAt(h.pool,2,e.id,'PTO','2026-09-15'),0)
 assert.equal(await leaveAvailabilityAt(h.pool,1,e.id,'MD_SICK_SAFE','2026-09-15'),0)
 const evidence=(await h.pool.query("SELECT transaction_date::text AS date,minutes FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO' ORDER BY id DESC",[e.id])).rows
 for(const date of ['2026-08-01','2026-09-01','2026-09-15','2026-10-01','2026-11-01','2026-11-02'])assert.equal(leaveAvailabilityFromEvidence(evidence,date),await leaveAvailabilityAt(h.pool,1,e.id,'PTO',date))

 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_paid_leave WHERE request_id=$1',[early.id])).rows[0].n,1)
 await approve(early,409)
})

test('onboarding packet reports available leave as of the employer day rather than future grants',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
 const create=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers,body:JSON.stringify({employeeNumber:'LEAVE-PACKET',legalFirstName:'Leave',legalLastName:'Packet',hireDate:'2025-01-01',hourlyRateCents:2500})})
 assert.equal(create.status,201);const e=(await create.json()).data
 const date=(await h.pool.query("SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO',$2::date,120,'Synthetic opening'),(1,$1,'PTO',$2::date+10,600,'Synthetic future grant'),(1,$1,'PTO',$2::date+20,-660,'Synthetic future commitment'),(1,$1,'MD_SICK_SAFE',$2::date+10,120,'Synthetic future sick grant')",[e.id,date])
 const response=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/onboarding`,{headers})
 assert.equal(response.status,200);const packet=(await response.json()).data
 assert.deepEqual(packet.leaveBalances.find(row=>row.leave_type==='PTO'),{leave_type:'PTO',minutes:60,asOfDate:date,reservedMinutes:0})
 assert.deepEqual(packet.leaveBalances.find(row=>row.leave_type==='MD_SICK_SAFE'),{leave_type:'MD_SICK_SAFE',minutes:0,asOfDate:date})
 const dashboardResponse=await fetch(`${h.url}/api/admin/payroll/dashboard`,{headers})
 assert.equal(dashboardResponse.status,200)
 const dashboard=(await dashboardResponse.json()).data
 const adminBalance=dashboard.leaveBalances.find(row=>Number(row.employee_id)===e.id&&row.leave_type==='PTO')
 assert.equal(Number(adminBalance.balance_minutes),60);assert.equal(adminBalance.as_of_date,date)
 const debit=async(minutes,status)=>{const r=await fetch(`${h.url}/api/admin/payroll/employees/${e.id}/leave-transactions`,{method:'POST',headers,body:JSON.stringify({leaveType:'PTO',transactionDate:date,minutes,reason:'Synthetic dated manual debit'})});assert.equal(r.status,status,await r.text())}
 await debit(-61,409)

 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('dated-packet-session')])
 const portal=await fetch(`${h.url}/api/payroll/employee/onboarding`,{headers:{Authorization:'Bearer dated-packet-session'}})
 assert.equal(portal.status,200)
 assert.deepEqual((await portal.json()).data.leaveBalances,packet.leaveBalances)
 const preview=async(query,status=200,token='dated-packet-session')=>{
  const r=await fetch(`${h.url}/api/payroll/employee/leave-availability?${new URLSearchParams(query)}`,{headers:{Authorization:`Bearer ${token}`}})
  const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data
 }
 assert.equal((await preview({startDate:date,endDate:date,leaveType:'PTO',employeeId:'999999'})).availableMinutes,60)
 const adminUrl=`${h.url}/api/admin/payroll/employees/${e.id}/leave-availability?${new URLSearchParams({startDate:date,endDate:date,leaveType:'PTO'})}`
 const adminPreview=await fetch(adminUrl,{headers});assert.equal(adminPreview.status,200)
 assert.equal((await adminPreview.json()).data.availableMinutes,60)
 assert.equal((await fetch(adminUrl,{headers:{...headers,'x-test-facility':'2'}})).status,404)
 assert.equal((await fetch(adminUrl)).status,401)

 await preview({startDate:date,endDate:date,leaveType:'PTO'},401,'invalid-token')
 await preview({startDate:date,endDate:date,leaveType:'UNPAID'},400)
 await preview({startDate:'2026-02-30',endDate:date,leaveType:'PTO'},400)
 await preview({startDate:'2024-01-01',endDate:'2024-01-01',leaveType:'PTO'},409)
 await debit(-60,201)
 await debit(-1,409)
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO',$2,-100,'Synthetic legacy deficit')",[e.id,date])
 await debit(30,201)
 assert.equal(await leaveAvailabilityAt(h.pool,1,e.id,'PTO',date),-70)
 await debit(-1,409)

})
