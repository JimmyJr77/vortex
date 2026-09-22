import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {healthQualificationFixture} from '../testing/healthQualificationFixture.js'
import {requireHealthParticipantQualification} from '../healthParticipantQualification.js'
const options={skip:!process.env.PAYROLL_TEST_DATABASE_URL}
async function fixture(t){
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='19'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close());const f=await healthQualificationFixture(h)
 const path=`/employees/${f.employee.id}/health-qualification/medical`,state=()=>f.api(`${path}?paymentDate=2026-09-18`),source=(await state()).source
 const body={requestKey:randomUUID(),sourceFingerprint:source.fingerprint,expectedRevision:0,effectiveOn:'2026-09-18',effectiveThrough:'2026-12-31',disposition:'ELIGIBLE',electionBasis:'INITIAL_ENROLLMENT',electionDeadline:'2026-09-18',employeeElectionExplanation:'Initial enrollment under the retained written plan; sign by the stated deadline.',commonLawEmployeeConfirmed:true,ownershipEligibleConfirmed:true,coverageEligibleConfirmed:true,electionRulesConfirmed:true,nondiscriminationConfirmed:true,confirmed:true,reference:'Synthetic reviewed employee classification, covered-person tax eligibility and effective election under retained written plan'}
 return {...f,planPath:f.path,planBody:f.body,path,state,body}
}
test('participant eligibility binds written plan and signed election, survives exact retry and applies to later payroll dates',options,async t=>{
 const {h,api,employee,path,state,body}=await fixture(t)
 assert.deepEqual((await state()).source.issues,[])
 const saved=await api(path,body);assert.deepEqual(await api(path,body),{id:saved.id,reused:true});assert.equal((await state()).status,'ELIGIBLE')
 const first=await requireHealthParticipantQualification(h.pool,1,employee.id,'medical','2026-09-18'),later=await requireHealthParticipantQualification(h.pool,1,employee.id,'medical','2026-10-20')
 assert.equal(first.reviewId,saved.id);assert.equal(first.fingerprint,later.fingerprint);assert.equal(first.selection.monthlyCents,12500);assert.equal(first.authorizationFingerprint.length,64)
 await assert.rejects(()=>requireHealthParticipantQualification(h.pool,1,employee.id,'medical','2027-01-01'),/Review the employee/)
 await assert.rejects(()=>requireHealthParticipantQualification(h.pool,2,employee.id,'medical','2026-09-18'),/Employee not found/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_health_participant_qualification WHERE id=$1',[saved.id]))
 await api(path,{...body,reference:'Changed participant findings require another request'},'POST',409)
})
test('employee withdrawal invalidates qualification and cannot be overridden by another admin eligibility review',options,async t=>{
 const {h,api,employee,path,state,body}=await fixture(t);await api(path,body)
 const before=await state(),saved=before.source.authorization
 await api('/benefits-deduction-authorization/withdraw',{confirmed:true,requestKey:'synthetic-health-withdrawal',authorizationRequestKey:saved.requestKey,onboardingCycle:1},'POST',200,true)
 const after=await state();assert.equal(after.status,'STALE');assert.notEqual(after.source.fingerprint,before.source.fingerprint);assert.equal(after.source.authorizationStatus,'WITHDRAWN')
 await assert.rejects(()=>requireHealthParticipantQualification(h.pool,1,employee.id,'medical','2026-09-18'),/Review the employee/)
 await api(path,{...body,sourceFingerprint:after.source.fingerprint,expectedRevision:1,requestKey:randomUUID()},'POST',409)
 assert.equal((await state()).history.length,1)
})
test('plan requalification invalidates participant review and future suspension preserves earlier applicable review',options,async t=>{
 const {h,api,employee,path,state,body,planPath,planBody}=await fixture(t);await api(path,body)
 await api(path,{...body,requestKey:randomUUID(),expectedRevision:1,disposition:'SUSPENDED',effectiveOn:'2026-10-01',reference:'Suspend pretax eligibility beginning October pending participant findings'})
 assert.equal((await state()).status,'ELIGIBLE')
 await assert.rejects(()=>requireHealthParticipantQualification(h.pool,1,employee.id,'medical','2026-10-20'),/Review the employee/)
 await api(planPath,{...planBody,expectedRevision:1,requestKey:randomUUID(),reference:'New written-plan qualification review with revised evidence reference'})
 assert.equal((await state()).status,'STALE');await assert.rejects(()=>requireHealthParticipantQualification(h.pool,1,employee.id,'medical','2026-09-18'),/Review the employee/)
})
test('participant review validates all findings, is atomic with audit, and rejects competing revisions',options,async t=>{
 const {h,api,path,state,body}=await fixture(t)
 for(const key of ['commonLawEmployeeConfirmed','ownershipEligibleConfirmed','coverageEligibleConfirmed','electionRulesConfirmed','nondiscriminationConfirmed','confirmed'])await api(path,{...body,[key]:false},'POST',400)
 await h.pool.query("CREATE FUNCTION reject_health_participant_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='HEALTH_PARTICIPANT_QUALIFICATION_REVIEWED' THEN RAISE EXCEPTION 'synthetic failed audit'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_health_participant_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_health_participant_audit()")
 await api(path,body,'POST',500);assert.equal((await state()).history.length,0)
 await h.pool.query('DROP TRIGGER reject_health_participant_audit ON payroll_audit_log')
 const send=b=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(b)})
 const responses=await Promise.all([send(body),send({...body,requestKey:randomUUID()})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await state()).history.length,1)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='HEALTH_PARTICIPANT_QUALIFICATION_REVIEWED'")).rows[0].n,1)
})
