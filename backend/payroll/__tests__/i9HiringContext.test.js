import {readI9HiringContext} from '../i9HiringContext.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('I-9 admin context has explicit inputs, scoped revisions and immutable history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='I9')
 const path=`/employees/${employee.id}/onboarding/${task.id}/i9/context`,get=()=>api(path+'?onboardingCycle=1',undefined,'GET')
 assert.equal((await get()).current,null)
 await assert.rejects(()=>readI9HiringContext(h.pool,{facility:99999,employee:employee.id},task.id,1),e=>e.status===404)
 for(const token of ['', 'monthly-benefits-session']){const denied=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:'{}'});assert.ok([401,403].includes(denied.status))}

 const body={onboardingCycle:1,expectedRevision:0,offerAccepted:true,offerAcceptedOn:'2026-09-01',eVerify:false,evidence:'Synthetic accepted offer and employer hiring-site records reviewed.'}
 await api(path,{...body,eVerify:undefined},'POST',400);await api(path,{...body,offerAccepted:false},'POST',400);await api(path,{...body,offerAcceptedOn:'2099-01-01'},'POST',400)
 const saved=await api(path,body);assert.equal(saved.current.eVerify,false);assert.equal(saved.current.offerAcceptedOn,'2026-09-01');assert.equal(Number(saved.current.actorUserId),99)
 await api(path,body,'POST',409);await api(path,{...body,expectedRevision:1,onboardingCycle:2},'POST',409)
 const other=await api('/employees',{employeeNumber:'OTHER-I9-CONTEXT',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await api(`/employees/${other.id}/onboarding/${task.id}/i9/context?onboardingCycle=1`,undefined,'GET',404)
 const results=await Promise.all([true,false].map(eVerify=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({...body,expectedRevision:1,eVerify})})))
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await get()).history.length,2)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_hiring_context WHERE task_id=$1',[task.id]),/immutable/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_hiring_context SET evidence=$1 WHERE task_id=$2',['Changed evidence',task.id]),/immutable/)
 assert.equal((await h.pool.query("SELECT status FROM payroll_onboarding_task WHERE id=$1",[task.id])).rows[0].status,'OPEN')
 const packet=await api('/onboarding',undefined,'GET',200,true);assert.equal(JSON.stringify(packet).includes(body.evidence),false)
 await h.pool.query(`CREATE FUNCTION reject_i9_context_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_HIRING_CONTEXT_RECORDED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_i9_context_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_i9_context_audit()`)
 await api(path,{...body,expectedRevision:2},'POST',500);assert.equal((await get()).revision,2)
})
