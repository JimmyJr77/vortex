import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {signedI9Fixture} from '../testing/signedI9Fixture.js'
import {i9EmployerDraftInput} from '../i9EmployerDraft.js'
test('employer drafts preserve partial answers and reject signature or unsupported fields',()=>{
 const draft=i9EmployerDraftInput({listA:[{number:'SYNTHETIC-PARTIAL',expiresOn:'2026-0'}],examinationMethod:null})
 assert.equal(draft.listA[0].expiresOn,'2026-0');assert.equal(draft.documentChoice,null)
 for(const bad of [{signature:'Admin'},{documentChoice:'OTHER'},{listA:[{unexpected:true}]},{listA:[{},{},{},{}]},{businessName:'a\nb'}])assert.throws(()=>i9EmployerDraftInput(bad),e=>e.status===400)
})
test('encrypted admin draft is scoped, retry safe, invalidated by context and rolled back on audit failure',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const priorKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='93'.repeat(32)
 t.after(()=>{if(priorKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=priorKey})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,task:employeeTask,signed}=await signedI9Fixture(h,{assisted:false})
 const packet=await api(`/employees/${employee.id}/onboarding`),task=packet.tasks.find(t=>t.task_key==='I9_REVIEW')
 const path=`/employees/${employee.id}/onboarding/${task.id}/i9/employer-draft`,read=()=>api(path+'?onboardingCycle=1')
 const initial=await read();assert.equal(initial.revision,0);assert.equal(String(initial.submissionId),String(signed.submissionId))
 const body={onboardingCycle:1,expectedRevision:0,basisHash:initial.basisHash,requestKey:randomUUID(),draft:{documentChoice:'LIST_A',listA:[{title:'Synthetic Passport',number:'SYNTHETIC-SECRET-123',expiresOn:'2030-0'}]}}
 const saved=await api(path,body);assert.equal(saved.revision,1)
 assert.deepEqual(await api(path,{...body,requestKey:body.requestKey.toUpperCase()}),saved)
 await api(path,{...body,draft:{businessName:'Changed'}},'POST',409)
 await api(path,{...body,requestKey:randomUUID()},'POST',409)
 const resumed=await read();assert.equal(resumed.draft.listA[0].number,'SYNTHETIC-SECRET-123')
 const dbrow=(await h.pool.query('SELECT * FROM payroll_i9_employer_draft')).rows[0]
 assert.equal(dbrow.encrypted_draft.includes(Buffer.from('SYNTHETIC-SECRET')),false)
 const request=await fetch(`${h.url}/api/admin/payroll${path}?onboardingCycle=1`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(request.status,200);assert.equal(request.headers.get('cache-control'),'no-store')
 const otherFacility=await fetch(`${h.url}/api/admin/payroll${path}?onboardingCycle=1`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(otherFacility.status,404)
 const foreign=await api('/employees',{employeeNumber:'OTHER-EMPLOYER-DRAFT',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await api(`/employees/${foreign.id}/onboarding/${task.id}/i9/employer-draft?onboardingCycle=1`,undefined,'GET',404)
 await api(`/employees/${employee.id}/onboarding/${employeeTask.id}/i9/employer-draft?onboardingCycle=1`,undefined,'GET',404)
 const denied=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer monthly-benefits-session','Content-Type':'application/json'},body:JSON.stringify(body)})
 assert.equal(denied.status,401)
 const next={...body,expectedRevision:1,requestKey:randomUUID(),draft:{...body.draft,businessName:'Synthetic Business'}}
 const [a,b]=await Promise.all([api(path,next),api(path,next)]);assert.deepEqual(a,b);assert.equal(a.revision,2)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_employer_draft'),/revision history/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_employer_draft SET revision=revision'),/revision must advance/)
 await api(`/employees/${employee.id}/onboarding/${employeeTask.id}/i9/context`,{onboardingCycle:1,expectedRevision:1,offerAccepted:true,offerAcceptedOn:'2026-09-01',participationVerifiedOn:'2026-09-03',eVerify:true})
 const changed=await read();assert.equal(changed.draft,null);assert.equal(changed.invalidated,true);assert.equal(changed.revision,2)
 await api(path,{...next,expectedRevision:2,requestKey:randomUUID()},'POST',409)
 const current={...next,expectedRevision:2,basisHash:changed.basisHash,requestKey:randomUUID()}
 await h.pool.query(`CREATE FUNCTION reject_employer_draft_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_EMPLOYER_DRAFT_SAVED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_employer_draft_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_employer_draft_audit()`)
 await api(path,current,'POST',500);assert.deepEqual(await read(),changed)
 await h.pool.query('DROP TRIGGER reject_employer_draft_audit ON payroll_audit_log')
 await api(path,current);assert.equal((await read()).revision,3)
 const finalPacket=await api(`/employees/${employee.id}/onboarding`)
 assert.equal(finalPacket.tasks.find(t=>t.id===task.id).status,'OPEN');assert.equal(JSON.stringify(finalPacket).includes('SYNTHETIC-SECRET'),false)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_EMPLOYER_DRAFT_SAVED'")).rows).includes('SYNTHETIC-SECRET'),false)
 delete process.env.PAYROLL_DOCUMENT_KEY;await api(path+'?onboardingCycle=1',undefined,'GET',503);process.env.PAYROLL_DOCUMENT_KEY='93'.repeat(32)
 const beforeAmendment=await read(),employeePath=`/onboarding/${employeeTask.id}/i9`,employeeDraft=await api(employeePath+'/draft?onboardingCycle=1',undefined,'GET',200,true)
 const amended=await api(employeePath+'/draft',{onboardingCycle:1,expectedRevision:employeeDraft.revision,baseResponseHash:employeeDraft.baseResponseHash,requestKey:randomUUID(),draft:{lastName:'Żółć',firstName:'Łukasz',address:'200 Amended Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-01-01',ssn:'123456789',attestationKind:'CITIZEN',ssnPending:false,preparerAssisted:false}},'POST',200,true)
 const preview=await api(employeePath+'/preview',{onboardingCycle:1,expectedRevision:amended.revision,baseResponseHash:amended.baseResponseHash},'POST',200,true)
 for(let page=1;page<=4;page++)await api(employeePath+'/page',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,page,displayed:true},'POST',200,true)
 const newSignature=await api(employeePath+'/sign',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,signature:'Łukasz Żółć',attestation:preview.attestation,attestationRead:true,reviewedAllPages:true,signingAsEmployee:true,requestKey:randomUUID()},'POST',200,true)
 const afterAmendment=await read();assert.equal(afterAmendment.draft,null);assert.equal(afterAmendment.invalidated,true);assert.equal(String(afterAmendment.submissionId),String(newSignature.submissionId))
 await api(path,{...current,expectedRevision:beforeAmendment.revision,basisHash:beforeAmendment.basisHash,requestKey:randomUUID()},'POST',409)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_employer_draft SET revision=revision+1,request_revision=revision WHERE task_id=$1',[task.id]),/current scoped employee signature/)
})
