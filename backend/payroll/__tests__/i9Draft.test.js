import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
const draft=()=>({firstName:'Łukasz',ssn:'123-4',dateOfBirth:'2000-0',preparerAssisted:null,ssnPending:null})
test('I9 encrypted draft resumes across sessions, prevents stale writes and isolates employee scope',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='81'.repeat(32)
 t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='I9'),path=`/onboarding/${task.id}/i9/draft`
 const body={draft:draft(),expectedRevision:0,baseResponseHash:(await api(path+'?onboardingCycle=1',undefined,'GET',200,true)).baseResponseHash,onboardingCycle:1,requestKey:randomUUID()}
 const saved=await api(path,body,'POST',200,true)
 assert.equal(saved.revision,1);assert.deepEqual(await api(path,{...body,requestKey:body.requestKey.toUpperCase()},'POST',200,true),saved)
 await api(path,{...body,requestKey:randomUUID()},'POST',409,true)
 await api(path,{...body,draft:{...body.draft,firstName:'Changed'}},'POST',409,true)
 const row=(await h.pool.query('SELECT * FROM payroll_i9_draft WHERE task_id=$1',[task.id])).rows[0]
 assert.equal(row.encrypted_draft.includes(Buffer.from('123-4')),false)
 const request=async(token,method='GET',payload)=>fetch(`${h.url}/api/payroll/employee${path}${method==='GET'?'?onboardingCycle=1':''}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})})
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[employee.id,hashPayrollToken('i9-second-session')])
 const resumed=await request('i9-second-session');assert.equal(resumed.status,200);assert.equal(resumed.headers.get('cache-control'),'no-store');assert.equal((await resumed.json()).data.draft.ssn,'123-4')
 const other=await api('/employees',{employeeNumber:'OTHER-MW-DRAFT',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[other.id,hashPayrollToken('i9-other-session')])
 assert.equal((await request('i9-other-session')).status,404);assert.equal((await request('i9-other-session','POST',body)).status,404)
 const concurrent={...body,expectedRevision:1,requestKey:randomUUID(),draft:{...body.draft,firstName:'Updated'}}
 const [a,b]=await Promise.all([api(path,concurrent,'POST',200,true),api(path,concurrent,'POST',200,true)]);assert.deepEqual(a,b);assert.equal(a.revision,2)
 await api(path,{...concurrent,onboardingCycle:2},'POST',409,true)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_DRAFT_SAVED'")).rows).includes('123-4'),false)
 const packet=await api('/onboarding',undefined,'GET',200,true)
 assert.equal(packet.tasks.find(t=>t.id===task.id).status,'OPEN');assert.equal(JSON.stringify(packet).includes('123-4'),false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_draft WHERE task_id=$1',[task.id]),/preserving revision/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_draft SET revision=revision WHERE task_id=$1',[task.id]),/revision must/)
 await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"reference\":\"Changed outside draft\"}' WHERE id=$1",[task.id])
 const changed=await api(path+'?onboardingCycle=1',undefined,'GET',200,true);assert.equal(changed.draft,null);assert.notEqual(changed.baseResponseHash,body.baseResponseHash)
 await api(path,{...concurrent,expectedRevision:2,requestKey:randomUUID()},'POST',409,true)
 await api(path,{...concurrent,expectedRevision:2,baseResponseHash:changed.baseResponseHash,requestKey:randomUUID()},'POST',200,true)
 await h.pool.query("UPDATE payroll_employee_session SET revoked_at=clock_timestamp() WHERE token_hash=$1",[hashPayrollToken('i9-second-session')])
 assert.equal((await request('i9-second-session')).status,401)
 const beforeFailure=await api(path+'?onboardingCycle=1',undefined,'GET',200,true)
 await h.pool.query(`CREATE FUNCTION reject_i9_draft_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_DRAFT_SAVED' THEN RAISE EXCEPTION 'Synthetic draft audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_i9_draft_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_i9_draft_audit()`)
 await api(path,{...body,expectedRevision:beforeFailure.revision,baseResponseHash:beforeFailure.baseResponseHash,requestKey:randomUUID(),draft:{firstName:'Must roll back'}},'POST',500,true)
 const afterFailure=await api(path+'?onboardingCycle=1',undefined,'GET',200,true)
 assert.deepEqual(afterFailure,beforeFailure)
 await h.pool.query('DROP TRIGGER reject_i9_draft_audit ON payroll_audit_log')
 delete process.env.PAYROLL_DOCUMENT_KEY;await api(path+'?onboardingCycle=1',undefined,'GET',503,true)
})
