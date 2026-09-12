import test from 'node:test'
import assert from 'node:assert/strict'
import {hashPayrollToken} from '../employeeAuth.js'
import {createHarness} from '../testing/harness.js'

test('employee writes recheck session revocation and separation after middleware authorization',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const response=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'SESSION-RACE',legalFirstName:'Session',legalLastName:'Race',hireDate:'2025-01-01',hourlyRateCents:2500})})
 assert.equal(response.status,201);const employee=(await response.json()).data
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',portal_password_hash='unchanged' WHERE id=$1",[employee.id])
 const time=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2025-01-02T12:00Z','2025-01-02T13:00Z','ADMIN','UNVERIFIED') RETURNING id",[employee.id])).rows[0]
 const task=(await h.pool.query("SELECT id FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='AVAILABILITY'",[employee.id])).rows[0]
 const original=h.pool.query.bind(h.pool)
 let pause=null
 h.pool.query=async(...args)=>{const result=await original(...args);if(pause&&String(args[0]).startsWith('UPDATE payroll_employee_session SET last_used_at')){const gate=pause;pause=null;gate.reached();await gate.wait}return result}
 const endpoints=[['/pay-rates/1/acknowledge',{acknowledged:true},'POST'],['/salary-changes/1/acknowledge',{acknowledged:true},'POST'],['/pay-schedule-notices/1/acknowledge',{acknowledged:true},'POST'],['/profile',{preferredName:'Should not save'},'PATCH'],['/clock',{action:'IN'},'POST'],[`/time-entries/${time.id}/attest`,{confirmed:true},'POST'],['/access',{password:'A-new-password-that-must-not-save'},'POST'],['/requests',{kind:'GENERAL',payload:{reason:'Should not save'}},'POST'],[`/onboarding/${task.id}`,{note:'Should not save'},'POST'],[`/onboarding/${task.id}/documents`,{filename:'blocked.pdf',contentBase64:Buffer.from('%PDF-1.4 synthetic').toString('base64')},'POST']]
 for(const [index,[path,body,method]] of endpoints.entries()){
  const token=`session-race-${index}`
  const session=(await original("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day') RETURNING id",[employee.id,hashPayrollToken(token)])).rows[0]
  let reached,release
  const authorized=new Promise(resolve=>{reached=resolve}),wait=new Promise(resolve=>{release=resolve})
  pause={reached,wait}
  const pending=fetch(`${h.url}/api/payroll/employee${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)})
  await authorized
  try{await original(index%2?'UPDATE payroll_employee_session SET expires_at=clock_timestamp()-interval \'1 second\' WHERE id=$1':'UPDATE payroll_employee_session SET revoked_at=now() WHERE id=$1',[session.id])}finally{release()}
  const denied=await pending;assert.equal(denied.status,401,`${path}: ${await denied.text()}`)
 }
 const row=(await original('SELECT preferred_name,portal_password_hash FROM payroll_employee WHERE id=$1',[employee.id])).rows[0]
 assert.equal(row.preferred_name,null);assert.equal(row.portal_password_hash,'unchanged')
 assert.equal((await original('SELECT COUNT(*)::int n FROM payroll_time_entry WHERE employee_id=$1',[employee.id])).rows[0].n,1)
 assert.equal((await original('SELECT status FROM payroll_time_entry WHERE id=$1',[time.id])).rows[0].status,'UNVERIFIED')
 assert.equal((await original('SELECT COUNT(*)::int n FROM payroll_employee_request WHERE employee_id=$1',[employee.id])).rows[0].n,0)
 assert.equal((await original('SELECT COUNT(*)::int n FROM payroll_private_document WHERE employee_id=$1',[employee.id])).rows[0].n,0)
 const token='separation-race';await original("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken(token)])
 let reached,release;const authorized=new Promise(resolve=>{reached=resolve}),wait=new Promise(resolve=>{release=resolve});pause={reached,wait}
 const pending=fetch(`${h.url}/api/payroll/employee/onboarding/${task.id}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({note:'Old authorization must not permit new work changes'})})
 await authorized
 try{await original("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-01' WHERE id=$1",[employee.id])}finally{release()}
 assert.equal((await pending).status,403)
 const allowed=await fetch(`${h.url}/api/payroll/employee/requests`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({kind:'GENERAL',payload:{reason:'Former employee asks for a payroll correction'}})})
 assert.equal(allowed.status,200)
})

test('invitation redemption and employment transition serialize before sessions are revoked',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const created=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'INVITE-RACE',legalFirstName:'Invite',legalLastName:'Race',hireDate:'2025-01-01',hourlyRateCents:2500})})
 assert.equal(created.status,201);const employee=(await created.json()).data
 await h.pool.query("INSERT INTO payroll_employee_invitation(facility_id,employee_id,recipient_email,token_hash,expires_at) VALUES(1,$1,'race@example.test',$2,now()+interval '1 day')",[employee.id,hashPayrollToken('invitation-race')])
 const barrier=await h.pool.connect(),transition=await h.pool.connect(),key=100000000+Math.floor(Math.random()*100000000)
 const waitFor=async query=>{for(let i=0;i<100;i++){if((await query()).rows[0].waiting)return;await new Promise(resolve=>setTimeout(resolve,50))}throw new Error('Expected database lock was not reached.')}
 let redeem,change
 try{
  await barrier.query('SELECT pg_advisory_lock($1)',[key])
  await h.pool.query(`CREATE FUNCTION pause_session_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(${key}); RETURN NEW; END $$; CREATE TRIGGER pause_session_insert BEFORE INSERT ON payroll_employee_session FOR EACH ROW EXECUTE FUNCTION pause_session_insert()`)
  redeem=fetch(`${h.url}/api/payroll/employee/invitations/redeem`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'invitation-race'})})
  await waitFor(()=>h.pool.query("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND objid=$1 AND NOT granted) AS waiting",[key]))
  await transition.query('BEGIN')
  change=(async()=>{
   await transition.query('SELECT facility_id FROM payroll_settings WHERE facility_id=1 FOR UPDATE')
   await transition.query('SELECT id FROM payroll_employee WHERE id=$1 FOR UPDATE',[employee.id])
   await transition.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[employee.id])
   await transition.query('UPDATE payroll_employee_invitation SET revoked_at=now() WHERE employee_id=$1',[employee.id])
   await transition.query('COMMIT')
  })()
  await waitFor(()=>h.pool.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock') AS waiting",[transition.processID]))
  await barrier.query('SELECT pg_advisory_unlock($1)',[key])
  assert.equal((await redeem).status,200)
  await change
  const sessions=(await h.pool.query('SELECT revoked_at FROM payroll_employee_session WHERE employee_id=$1',[employee.id])).rows
  assert.equal(sessions.length,1);assert.ok(sessions[0].revoked_at,'The transition must revoke a session issued by the competing invitation redemption')
 }finally{
  await barrier.query('SELECT pg_advisory_unlock($1)',[key]);await Promise.allSettled([redeem,change]);await transition.query('ROLLBACK');barrier.release();transition.release()
 }
})
