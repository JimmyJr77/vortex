import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
const waitFor=async(work)=>{for(let i=0;i<100;i++){if(await work())return;await new Promise(r=>setTimeout(r,10))}assert.fail('Expected PostgreSQL lock contention was not observed')}
test('payroll input writes wait for the payroll lock and adjustment audit failures roll back',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 let blocker
 const h=await createHarness();t.after(()=>{blocker?.release();return h.close()})
 const send=(path,body,method='POST',facility=1)=>fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)})
 const api=async(path,body,method='POST',status=200)=>{const r=await send(path,body,method),j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'LOCK-1',legalFirstName:'Lock',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500},'POST',201)
 const adjustment={name:'Verified reimbursement fixture',kind:'REIMBURSEMENT',amountCents:100,activeFrom:'2026-01-01',authorizationReference:'Synthetic receipt',taxTreatmentVerified:true,status:'ACTIVE'}
 const saved=await api(`/employees/${e.id}/adjustments`,adjustment,'POST',201)
 blocker=await h.pool.connect()
 const pid=(await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
 async function lockedWrite(path,body,method,status) {
  await blocker.query('BEGIN');await blocker.query('SELECT facility_id FROM payroll_settings WHERE facility_id=1 FOR UPDATE')
  let complete=false;const pending=send(path,body,method).then(r=>{complete=true;return r})
  try {
   await waitFor(async()=>Number((await h.pool.query('SELECT COUNT(*) AS n FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',[pid])).rows[0].n)>0)
   assert.equal(complete,false)
  }finally{await blocker.query('COMMIT')}
  const r=await pending,j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data
 }
 await lockedWrite('/clock',{employeeId:e.id,action:'IN'},'POST',201)
 await api('/clock',{employeeId:e.id,action:'OUT'})
 await lockedWrite(`/employees/${e.id}/adjustments`,{...adjustment,name:'Second reimbursement'},'POST',201)
 await lockedWrite(`/adjustments/${saved.id}/status`,{status:'PAUSED'},'PATCH',200)
 await lockedWrite(`/employees/${e.id}/leave-transactions`,{minutes:60,leaveType:'PTO',transactionDate:'2026-01-01',reason:'Verified initial PTO balance'},'POST',201)
 // Validation that depends on employee state also happens after acquiring the lock.
 await lockedWrite(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Signed forms reviewed for concurrency fixture',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',exemptions:0,localRate:3.2}},'PATCH',409)
 await lockedWrite(`/employees/${e.id}/activate`,{},'POST',409)
 const task=(await h.pool.query("SELECT id FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='W4'",[e.id])).rows[0]
 await lockedWrite(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'CHANGES_REQUESTED',note:'Please resubmit the signed form'},'POST',200)
 const cross=await send(`/adjustments/${saved.id}/status`,{status:'ACTIVE'},'PATCH',2);assert.equal(cross.status,404)
 await h.pool.query(`CREATE FUNCTION reject_adjustment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='payroll_adjustment' THEN RAISE EXCEPTION 'Synthetic audit storage failure'; END IF; RETURN NEW; END $$`)
 await h.pool.query('CREATE TRIGGER reject_adjustment_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_adjustment_audit()')
 const count=Number((await h.pool.query('SELECT COUNT(*) AS n FROM payroll_recurring_adjustment')).rows[0].n)
 await api(`/employees/${e.id}/adjustments`,{...adjustment,name:'Must roll back'},'POST',500)
 assert.equal(Number((await h.pool.query('SELECT COUNT(*) AS n FROM payroll_recurring_adjustment')).rows[0].n),count)
 await api(`/adjustments/${saved.id}/status`,{status:'ACTIVE'},'PATCH',500)
 assert.equal((await h.pool.query('SELECT status FROM payroll_recurring_adjustment WHERE id=$1',[saved.id])).rows[0].status,'PAUSED')
 await h.pool.query('DROP TRIGGER reject_adjustment_audit ON payroll_audit_log')
})
