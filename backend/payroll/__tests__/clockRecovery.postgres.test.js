import test from 'node:test'
import assert from 'node:assert/strict'
import { createHarness } from '../testing/harness.js'
import { runWorkforceAutomation } from '../workforceAutomation.js'

test('rejected open clocks release the clock slot and resolved alerts clear', {skip:!process.env.PAYROLL_TEST_DATABASE_URL}, async t => {
 const h=await createHarness();t.after(()=>h.close())
 let employeeToken
 async function api(path,body,{employee=false,method='POST',status=200}={}) {
  const response=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${employee?employeeToken:'payroll-test-admin'}`},body:body===undefined?undefined:JSON.stringify(body)})
  const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data
 }
 const employee=await api('/employees',{employeeNumber:'CLOCK-TEST',legalFirstName:'Clock',legalLastName:'Recovery',hireDate:'2026-01-01',hourlyRateCents:2500,personalEmail:'clock@example.test'},{status:201})
 const invite=await api(`/employees/${employee.id}/invitations`,{email:'clock@example.test',sendEmail:false},{status:201})
 employeeToken=(await api('/invitations/redeem',{token:new URL(invite.inviteUrl).searchParams.get('invite')},{employee:true})).sessionToken
 const stale=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,source,status) VALUES(1,$1,now()-interval '17 hours','EMPLOYEE_CLOCK','UNVERIFIED') RETURNING id",[employee.id])).rows[0]
 await runWorkforceAutomation(h.pool,1,{sync:false})
 const alert=async()=> (await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`open-clock-${stale.id}`])).rows[0].status
 assert.equal(await alert(),'OPEN')
 await api(`/time-entries/${stale.id}/status`,{status:'REJECTED'},{method:'PATCH'})
 await runWorkforceAutomation(h.pool,1,{sync:false})
 assert.equal(await alert(),'DISMISSED')
 await api(`/time-entries/${stale.id}/status`,{status:'UNVERIFIED'},{method:'PATCH'})
 await runWorkforceAutomation(h.pool,1,{sync:false})
 assert.equal(await alert(),'OPEN')
 await api(`/time-entries/${stale.id}/status`,{status:'REJECTED'},{method:'PATCH'})
 assert.equal((await api('/dashboard',undefined,{method:'GET'})).summary.openClocks,0)
 await api('/clock',{action:'OUT'},{employee:true,status:409})
 await api('/clock',{action:'OUT',employeeId:employee.id},{status:409})
 const fresh=await api('/clock',{action:'IN'},{employee:true,status:201})
 await api('/clock',{action:'IN'},{employee:true,status:409})
 assert.equal((await api('/dashboard',undefined,{method:'GET'})).summary.openClocks,1)
 await h.pool.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES(1,$1,'WARNING','Long-running employee clock','Test resolved clock alert')",[`open-clock-${fresh.id}`])
 const outs=await Promise.all([1,2].map(()=>fetch(`${h.url}/api/payroll/employee/clock`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${employeeToken}`},body:JSON.stringify({action:'OUT'})})))
 assert.deepEqual(outs.map(response=>response.status).sort(),[200,409])
 const closed=(await outs.find(response=>response.status===200).json()).data
 assert.equal(closed.id,fresh.id)
 assert.equal((await h.pool.query('SELECT clock_out FROM payroll_time_entry WHERE id=$1',[stale.id])).rows[0].clock_out,null)
 await runWorkforceAutomation(h.pool,1,{sync:false})
 assert.equal(await alert(),'DISMISSED')
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`open-clock-${fresh.id}`])).rows[0].status,'DISMISSED')
 await h.pool.query(`CREATE FUNCTION reject_clock_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('CLOCK_IN','EMPLOYEE_CLOCK_IN') THEN RAISE EXCEPTION 'Synthetic clock audit failure'; END IF; RETURN NEW; END $$`)
 await h.pool.query('CREATE TRIGGER reject_clock_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_clock_audit()')
 await api('/clock',{action:'IN'},{employee:true,status:500})
 assert.equal((await api('/dashboard',undefined,{method:'GET'})).summary.openClocks,0)
 await h.pool.query('DROP TRIGGER reject_clock_audit ON payroll_audit_log')
 const shift=await api('/shifts',{employeeId:employee.id,scheduledStart:'2050-01-10T14:00:00Z',scheduledEnd:'2050-01-10T16:00:00Z'},{status:201})
 const adminClock=await api('/clock',{action:'IN',employeeId:employee.id},{status:201})
 await api(`/employees/${employee.id}`,{employmentStatus:'TERMINATED'},{method:'PATCH'})
 assert.equal((await h.pool.query('SELECT status FROM payroll_shift WHERE id=$1',[shift.id])).rows[0].status,'CANCELLED')
 await api('/clock',{action:'IN',employeeId:employee.id},{status:409})
 await api('/clock',{action:'IN'},{employee:true,status:403})
 await api(`/shifts/${shift.id}`,{status:'SCHEDULED'},{method:'PATCH',status:409})
 await api('/shifts',{employeeId:employee.id,scheduledStart:'2050-01-11T14:00:00Z',scheduledEnd:'2050-01-11T16:00:00Z'},{status:404})
 await runWorkforceAutomation(h.pool,1,{sync:false})
 assert.equal(Number((await h.pool.query("SELECT COUNT(*) AS n FROM payroll_alert WHERE status='OPEN' AND dedupe_key LIKE 'onboarding-%'")).rows[0].n),0)

 assert.equal((await api('/clock',{action:'OUT',employeeId:employee.id})).id,adminClock.id)
 assert.equal((await api('/dashboard',undefined,{method:'GET'})).summary.openClocks,0)
})
