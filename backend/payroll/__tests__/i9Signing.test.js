import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {writeFile} from 'node:fs/promises'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {decryptDocument} from '../onboarding.js'
for(const assisted of [false,true])test(`I-9 Section 1 signing retains exact form and retry evidence; assisted=${assisted}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='83'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const packet=await api('/onboarding',undefined,'GET',200,true),task=packet.tasks.find(t=>t.task_key==='I9'),employer=packet.tasks.find(t=>t.task_key==='I9_REVIEW'),path=`/onboarding/${task.id}/i9`
 const initial=await api(path+'/draft?onboardingCycle=1',undefined,'GET',200,true)
 await api(`/employees/${employee.id}/onboarding/${task.id}/i9/context`,{onboardingCycle:1,expectedRevision:0,offerAccepted:true,offerAcceptedOn:'2026-09-01',participationVerifiedOn:'2026-09-02',eVerify:false})
 const draft={lastName:'Żółć',firstName:'Łukasz',address:'100 Example Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-01-01',ssn:'123456789',attestationKind:'CITIZEN',ssnPending:false,preparerAssisted:assisted}
 const saved=await api(path+'/draft',{draft,expectedRevision:0,baseResponseHash:initial.baseResponseHash,onboardingCycle:1,requestKey:randomUUID()},'POST',200,true)
 let preview=await api(path+'/preview',{onboardingCycle:1,expectedRevision:saved.revision,baseResponseHash:saved.baseResponseHash},'POST',200,true)
 let body={onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,signature:'Łukasz Żółć',attestation:preview.attestation,attestationRead:true,reviewedAllPages:true,signingAsEmployee:true,requestKey:randomUUID()}
 await api(path+'/sign',{...body,attestationRead:false},'POST',400,true);await api(path+'/sign',body,'POST',409,true)
 for(let page=1;page<=4;page++)await api(path+'/page',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,page,displayed:true},'POST',200,true)
 if(!assisted){
  await api(`/employees/${employee.id}/onboarding/${task.id}/i9/context`,{onboardingCycle:1,expectedRevision:1,offerAccepted:true,offerAcceptedOn:'2026-09-01',participationVerifiedOn:'2026-09-03',eVerify:true})
  await api(path+'/sign',body,'POST',409,true)
  preview=await api(path+'/preview',{onboardingCycle:1,expectedRevision:saved.revision,baseResponseHash:saved.baseResponseHash},'POST',200,true)
  body={...body,reviewId:preview.reviewId,previewSha256:preview.previewSha256,requestKey:randomUUID()}
  for(let page=1;page<=4;page++)await api(path+'/page',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,page,displayed:true},'POST',200,true)
 }
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',completed_at=clock_timestamp() WHERE id=$1",[employer.id])
 await h.pool.query("UPDATE payroll_employee SET i9_status='COMPLETE' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_employee_document SET status='VERIFIED',completed_at=clock_timestamp() WHERE employee_id=$1 AND document_type='I9'",[employee.id])
 await h.pool.query(`CREATE FUNCTION reject_i9_signature_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_SECTION1_SIGNED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_i9_signature_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_i9_signature_audit()`)
 await api(path+'/sign',body,'POST',500,true)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_submission')).rowCount,0)
 assert.equal((await h.pool.query('SELECT status FROM payroll_onboarding_task WHERE id=$1',[employer.id])).rows[0].status,'COMPLETE')
 assert.equal((await api(path+'/draft?onboardingCycle=1',undefined,'GET',200,true)).draft.ssn,'123456789')
 await h.pool.query('DROP TRIGGER reject_i9_signature_audit ON payroll_audit_log')
 const [signed,retry]=await Promise.all([api(path+'/sign',body,'POST',200,true),api(path+'/sign',{...body,requestKey:body.requestKey.toUpperCase()},'POST',200,true)]);assert.deepEqual(signed,retry)
 await api(path+'/sign',{...body,signature:'Changed'},'POST',409,true)
 const row=(await h.pool.query('SELECT * FROM payroll_i9_submission WHERE id=$1',[signed.submissionId])).rows[0],doc=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[signed.documentId])).rows[0]
 assert.equal((await h.pool.query('SELECT i9_status FROM payroll_employee WHERE id=$1',[employee.id])).rows[0].i9_status,'SECTION_1')
 assert.equal((await h.pool.query("SELECT status FROM payroll_employee_document WHERE employee_id=$1 AND document_type='I9'",[employee.id])).rows[0].status,'REVERIFY')
 assert.equal(row.preparer_required,assisted);assert.equal(row.encrypted_signature.includes(Buffer.from('Łukasz')),false)
 const bytes=decryptDocument(doc.encrypted_content,`1:${employee.id}:${task.id}`),pdf=await PDFDocument.load(bytes),form=pdf.getForm()
 assert.equal(pdf.getPageCount(),4);assert.equal(form.getTextField('Signature of Employee').getText(),'Łukasz Żółć');assert.match(form.getTextField("Today's Date mmddyyy").getText(),/^\d{2}\/\d{2}\/2026$/);assert.equal(form.getTextField('US Social Security Number').getText(),'123456789')
 const evidence=JSON.parse(decryptDocument(row.encrypted_signature,`i9-signature:1:${employee.id}:${task.id}:1:${row.employee_session_id}`).toString());assert.equal(evidence.attestationRead,true);assert.equal(String(evidence.authenticatedSessionId),String(row.employee_session_id))
 if(!assisted)await writeFile('/tmp/payroll-i9-section1-signed.pdf',bytes)
 const after=await api('/onboarding',undefined,'GET',200,true);assert.equal(after.tasks.find(t=>t.id===task.id).status,'SUBMITTED');assert.equal(after.tasks.find(t=>t.id===employer.id).status,'OPEN');assert.equal(JSON.stringify(after).includes('123456789'),false)
 assert.equal((await api(path+'/draft?onboardingCycle=1',undefined,'GET',200,true)).draft,null)
 await api(`/onboarding/${task.id}`,{onboardingCycle:1,confirmed:true,reference:'Replace native evidence'},'POST',409,true)
 await api(`/employees/${employee.id}/onboarding/${employer.id}/review`,{onboardingCycle:1,status:'COMPLETE',note:'Synthetic attempted premature employer review'},'POST',409)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{onboardingCycle:1,status:'COMPLETE',note:'Reviewed synthetic employee Section 1'},'POST',assisted?409:200)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_submission WHERE id=$1',[signed.submissionId]),/immutable/)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_submission')).rowCount,1)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_SECTION1_SIGNED'")).rows).includes('Łukasz'),false)
})
