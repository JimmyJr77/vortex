import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('employee submission retries reuse one request and audit while changed keyed payloads fail',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const create=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'REQUEST-RETRY',legalFirstName:'Request',legalLastName:'Retry',hireDate:'2026-01-01',hourlyRateCents:2500})})
 assert.equal(create.status,201);const e=(await create.json()).data
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('request-retry-session')])
 const post=async(body,status=200)=>{const r=await fetch(`${h.url}/api/payroll/employee/requests`,{method:'POST',headers:{Authorization:'Bearer request-retry-session','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const body={kind:'EXPENSE',payload:{reason:'Synthetic receipt for supplies',amountCents:1234,receiptReference:'RETRY-RECEIPT'},requestKey:'request-retry-test-key'}
 const results=await Promise.all([post(body),post(body),post(body)])
 assert.ok(results.every(r=>r.id===results[0].id))
 const id=results[0].id
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_employee_request WHERE employee_id=$1',[e.id])).rows[0].n,1)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE entity_id=$1 AND action='REQUEST_SUBMITTED'",[String(id)])).rows[0].n,1)
 await post({...body,payload:{...body.payload,amountCents:9999}},409)
 await post({...body,requestKey:'bad'},400)
 // Review may enrich the stored request. Retry compares the original submission.
 await h.pool.query("UPDATE payroll_employee_request SET status='APPROVED',payload=payload||'{\"reimbursementPeriod\":{\"id\":123}}'::jsonb WHERE id=$1",[id])
 assert.equal((await post(body)).status,'APPROVED')
 assert.notEqual((await post({...body,requestKey:'intentional-new-request-key'})).id,id)
})
