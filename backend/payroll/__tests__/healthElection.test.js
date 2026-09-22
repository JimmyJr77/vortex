import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {healthElectionFixture} from '../testing/healthElectionFixture.js'
import {requireHealthElection} from '../healthElection.js'
import {resolveHealthPremiumAuthorization} from '../healthPremiumAuthorization.js'
const options={skip:!process.env.PAYROLL_TEST_DATABASE_URL}
async function fixture(t){const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='1b'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old});const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close());return healthElectionFixture(h)}
test('employee reads only the disclosed plan, signs exact terms and recovers the retained election',options,async t=>{
 const {api,h,employee,path,state,proposal,electionBody,disclosureBytes,disclosureBody,disclosurePath}=await fixture(t)
 const listed=await api('/health-elections',undefined,'GET',200,true);assert.equal(listed.plans.length,1);assert.equal(listed.plans[0].planId,'medical');assert.ok(!JSON.stringify(listed).includes('CONFIDENTIAL-ADMIN-REFERENCE'))
 assert.ok(proposal);assert.equal(proposal.monthlyCents,12500);assert.equal(proposal.effectiveOn,'2026-09-18');assert.equal(proposal.effectiveThrough,'2026-12-31')
 assert.ok(!JSON.stringify(await state()).includes('CONFIDENTIAL-ADMIN-REFERENCE'))
 const disclosed=await api('/health-plans/medical/disclosure?effectiveOn=2026-09-18',undefined,'GET',200,true)
 const download=await fetch(`${h.url}/api/payroll/employee/health-plans/medical/disclosure/document?effectiveOn=2026-09-18&disclosureId=${disclosed.id}`,{headers:{Authorization:'Bearer monthly-benefits-session'}})
 assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),disclosureBytes)
 const privatePdf=await fetch(`${h.url}/api/admin/payroll/health-plan-qualification/medical/${disclosed.qualificationId}/document`,{headers:{Authorization:'Bearer monthly-benefits-session'}});assert.equal(privatePdf.status,401)
 const saved=await api(path,electionBody,'POST',200,true);assert.deepEqual(await api(path,electionBody,'POST',200,true),{id:saved.id,reused:true})
 const current=await state();assert.equal(current.offers.length,0);assert.equal(current.history.length,1);assert.equal(current.history[0].election.proposal.terms,proposal.terms)
 assert.equal((await requireHealthElection(h.pool,1,employee.id,'medical','2026-10-20')).id,saved.id)
 await assert.rejects(()=>requireHealthElection(h.pool,1,employee.id,'medical','2026-09-17'))
 await api(path,{...electionBody,signature:'Changed signature'},'POST',409,true)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_health_election WHERE id=$1',[saved.id]))
 await h.pool.query(await readFile(new URL('../../migrations/832_payroll_health_election.sql',import.meta.url),'utf8'))
 delete process.env.PAYROLL_DOCUMENT_KEY;assert.deepEqual(await api(path,electionBody,'POST',200,true),{id:saved.id,reused:true});assert.equal((await api(disclosurePath,disclosureBody)).reused,true)
})
test('changed disclosures and withdrawal invalidate elections without exposing private admin findings',options,async t=>{
 const {api,h,employee,path,state,electionBody,disclosurePath,disclosureBody}=await fixture(t)
 await api(path,electionBody,'POST',200,true)
 await api(disclosurePath,{...disclosureBody,requestKey:randomUUID(),expectedRevision:1,employeeTerms:'Revised employee-facing plan terms require new qualification and a new permitted election review.'})
 await assert.rejects(()=>requireHealthElection(h.pool,1,employee.id,'medical','2026-09-18'),/current signed/)
 assert.equal((await state()).offers.length,0)
 const packet=await api('/onboarding',undefined,'GET',200,true)
 await api('/benefits-deduction-authorization/withdraw',{confirmed:true,requestKey:'health-election-withdrawal',authorizationRequestKey:packet.benefitsDeduction.saved.requestKey,onboardingCycle:1},'POST',200,true)
 await assert.rejects(()=>requireHealthElection(h.pool,1,employee.id,'medical','2026-09-18'),/qualification/)
 assert.equal((await state()).history.length,1)
})
test('signed decline never authorizes pretax collection or permits an unreviewed replacement election',options,async t=>{
 const {api,h,employee,path,state,electionBody}=await fixture(t)
 await api(path,{...electionBody,action:'DECLINE'},'POST',200,true)
 await assert.rejects(()=>requireHealthElection(h.pool,1,employee.id,'medical','2026-09-18'),/current signed/)
 await api(path,{...electionBody,requestKey:randomUUID(),expectedRevision:1},'POST',409,true)
 assert.equal((await state()).history[0].election.action,'DECLINE')
})
test('employees retain their exact signed disclosure after later publication and coverage withdrawal',options,async t=>{
 const {api,h,path,electionBody,disclosurePath,disclosureBody,disclosureBytes}=await fixture(t)
 const saved=await api(path,electionBody,'POST',200,true)
 await api(disclosurePath,{...disclosureBody,requestKey:randomUUID(),expectedRevision:1,employeeTerms:'Updated employee disclosure terms for later reviewed election opportunities.'})
 const packet=await api('/onboarding',undefined,'GET',200,true)
 await api('/benefits-deduction-authorization/withdraw',{confirmed:true,requestKey:'history-withdrawal',authorizationRequestKey:packet.benefitsDeduction.saved.requestKey,onboardingCycle:1},'POST',200,true)
 const download=async(plan,id,authorized=true)=>fetch(`${h.url}/api/payroll/employee/health-plans/${plan}/election/${id}/document`,{headers:authorized?{Authorization:'Bearer monthly-benefits-session'}:{}})
 const response=await download('medical',saved.id)
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(Buffer.from(await response.arrayBuffer()),disclosureBytes)
 assert.equal((await download('another-plan',saved.id)).status,404)
 assert.equal((await download('medical',randomUUID())).status,404)
 assert.equal((await download('medical','not-an-id')).status,404)
 assert.equal((await download('medical',saved.id,false)).status,401)
})
test('health election requires confirmations and handles simultaneous signatures and audit rollback',options,async t=>{
 const {api,h,path,state,electionBody}=await fixture(t)
 for(const patch of [{confirmed:false},{disclosureConfirmed:false},{electionRulesConfirmed:false},{signature:''},{action:'MAYBE'}])await api(path,{...electionBody,...patch},'POST',400,true)
 await h.pool.query("CREATE FUNCTION reject_health_election_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='HEALTH_SECTION125_ELECTION_SIGNED' THEN RAISE EXCEPTION 'synthetic failed audit'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_health_election_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_health_election_audit()")
 await api(path,electionBody,'POST',500,true);assert.equal((await state()).history.length,0)
 await h.pool.query('DROP TRIGGER reject_health_election_audit ON payroll_audit_log')
 const results=await Promise.all([api(path,electionBody,'POST',200,true),api(path,electionBody,'POST',200,true)])
 assert.equal(results[0].id,results[1].id);assert.equal((await state()).history.length,1)
})
test('employee scope and prospective election deadlines are enforced inside the signing transaction',options,async t=>{
 const {api,h,employee,path,state,electionBody}=await fixture(t)
 await h.pool.query("CREATE OR REPLACE FUNCTION clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '2026-09-19T16:00:00Z'::timestamptz $$")
 await h.pool.query("UPDATE payroll_employee_session SET expires_at='2026-10-01T00:00:00Z' WHERE employee_id=$1",[employee.id])
 assert.equal((await state()).offers.length,0);await api(path,electionBody,'POST',409,true)
 await h.pool.query("CREATE OR REPLACE FUNCTION clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '2026-09-16T16:00:00Z'::timestamptz $$")
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=clock_timestamp() WHERE employee_id=$1',[employee.id])
 const response=await fetch(`${h.url}/api/payroll/employee${path}`,{method:'POST',headers:{Authorization:'Bearer monthly-benefits-session','Content-Type':'application/json'},body:JSON.stringify(electionBody)});assert.equal(response.status,401)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_health_election')).rows[0].n,0)
})

test('database and payroll require complete signature proof while later session revocation preserves consent',options,async t=>{
 const {api,h,employee,path,electionBody}=await fixture(t)
 const saved=await api(path,electionBody,'POST',200,true)
 const insert=async patch=>h.pool.query(`INSERT INTO payroll_health_election(id,facility_id,employee_id,onboarding_cycle,plan_id,revision,participant_qualification_id,disclosure_id,effective_on,effective_through,proposal_fingerprint,election,employee_session_id,request_key,request_fingerprint) SELECT $1,facility_id,employee_id,onboarding_cycle,plan_id,2,participant_qualification_id,disclosure_id,effective_on,effective_through,proposal_fingerprint,election||$2::jsonb,employee_session_id,$3,request_fingerprint FROM payroll_health_election WHERE id=$4`,[randomUUID(),patch,randomUUID(),saved.id])
 for(const patch of [{signature:''},{signature:null},{confirmed:false},{confirmed:null},{disclosureConfirmed:false},{electionRulesConfirmed:false},{version:2}])await assert.rejects(()=>insert(patch),/complete retained signature proof/)
 await assert.rejects(()=>insert({signedAt:'not-a-date'}),/timestamp is invalid/)
 await assert.rejects(()=>insert({signedAt:'2026-09-19T16:00:00Z'}),/timestamp is not current/)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=clock_timestamp() WHERE employee_id=$1',[employee.id])
 assert.equal((await requireHealthElection(h.pool,1,employee.id,'medical','2026-09-18')).id,saved.id)
 await assert.rejects(()=>insert({signature:'Monthly Benefits'}),/session is not current/)
 // Simulate malformed historical storage to exercise the independent read guard.
 const original=(await h.pool.query('SELECT election FROM payroll_health_election WHERE id=$1',[saved.id])).rows[0].election
 await h.pool.query('ALTER TABLE payroll_health_election DISABLE TRIGGER payroll_guard_health_election')
 try{
  for(const patch of [{signature:''},{confirmed:false},{disclosureConfirmed:false},{electionRulesConfirmed:false},{signedAt:'2026-09-19T16:00:00Z'},{signedAt:'2000-01-01T00:00:00Z'}]){
   await h.pool.query('UPDATE payroll_health_election SET election=$1 WHERE id=$2',[{...original,...patch},saved.id])
   await assert.rejects(()=>requireHealthElection(h.pool,1,employee.id,'medical','2026-09-18'),/current signed/)
  }
  await h.pool.query('UPDATE payroll_health_election SET election=$1 WHERE id=$2',[original,saved.id])
 }finally{await h.pool.query('ALTER TABLE payroll_health_election ENABLE TRIGGER payroll_guard_health_election')}
})

test('health premium input resolves exact current qualification, employee election and authorized coverage',options,async t=>{
 const {api,h,employee,path,electionBody}=await fixture(t)
 const authorization=(await api('/onboarding',undefined,'GET',200,true)).benefitsDeduction.saved
 await assert.rejects(()=>resolveHealthPremiumAuthorization(h.pool,1,employee.id,'2026-09-18',authorization),/current signed/)
 const saved=await api(path,electionBody,'POST',200,true)
 const result=await resolveHealthPremiumAuthorization(h.pool,1,employee.id,'2026-09-18',authorization)
 assert.equal(result.health125.items.length,1);assert.equal(result.health125.items[0].deductionCents,12500);assert.equal(result.health125.items[0].annualBonusDeductionCents,0);assert.equal(result.evidence[0].electionId,saved.id)
 assert.equal((await resolveHealthPremiumAuthorization(h.pool,1,employee.id,'2026-09-18',authorization,{medical:2500})).health125.items[0].annualBonusDeductionCents,2500)
 await assert.rejects(()=>resolveHealthPremiumAuthorization(h.pool,1,employee.id,'2026-09-18',authorization,{medical:12501}),/valid annual-bonus/)
 await assert.rejects(()=>resolveHealthPremiumAuthorization(h.pool,1,employee.id,'2026-09-18',authorization,{other:1}),/outside this authorization/)
 const altered=structuredClone(authorization);altered.proposal.items[0].monthlyCents++
 await assert.rejects(()=>resolveHealthPremiumAuthorization(h.pool,1,employee.id,'2026-09-18',altered),/differs from the authorized/)
 await api('/benefits-deduction-authorization/withdraw',{confirmed:true,requestKey:'typed-premium-withdrawal',authorizationRequestKey:authorization.requestKey,onboardingCycle:1},'POST',200,true)
 await assert.rejects(()=>resolveHealthPremiumAuthorization(h.pool,1,employee.id,'2026-09-18',authorization))
})
