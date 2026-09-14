import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
test('I-9 previews bind encrypted answers to current draft, session and hiring context',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='83'.repeat(32);t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='I9'),path=`/onboarding/${task.id}/i9`
 const initial=await api(path+'/draft?onboardingCycle=1',undefined,'GET',200,true)
 const draft={lastName:'Żółć',firstName:'Łukasz',address:'100 Example Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-01-01',ssn:'123456789',attestationKind:'CITIZEN',ssnPending:false,preparerAssisted:false}
 const saved=await api(path+'/draft',{draft,expectedRevision:0,baseResponseHash:initial.baseResponseHash,onboardingCycle:1,requestKey:randomUUID()},'POST',200,true)
 const body={onboardingCycle:1,expectedRevision:saved.revision,baseResponseHash:saved.baseResponseHash}
 await api(path+'/preview',body,'POST',409,true)
 const contextPath=`/employees/${employee.id}/onboarding/${task.id}/i9/context`,context={onboardingCycle:1,expectedRevision:0,offerAccepted:true,offerAcceptedOn:'2026-09-01',participationVerifiedOn:'2026-09-02',eVerify:false}
 await api(contextPath,context)
 const preview=await api(path+'/preview',body,'POST',200,true)
 const pdf=await PDFDocument.load(Buffer.from(preview.pdfBase64,'base64'));assert.equal(pdf.getPageCount(),4);assert.equal(pdf.getForm().getTextField('US Social Security Number').getText(),'123456789');assert.equal(pdf.getForm().getTextField('Signature of Employee').getText()||'','')
 const row=(await h.pool.query('SELECT * FROM payroll_i9_review WHERE id=$1',[preview.reviewId])).rows[0];assert.equal(row.encrypted_review.includes(Buffer.from('123456789')),false)
 const page={onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,page:1,displayed:true}
 for(let n=1;n<=4;n++)await api(path+'/page',{...page,page:n},'POST',200,true)
 await api(path+'/page',page,'POST',200,true);assert.equal((await h.pool.query('SELECT * FROM payroll_i9_page_visit WHERE review_id=$1',[preview.reviewId])).rowCount,4)
 await api(path+'/page',{...page,page:5},'POST',400,true)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[employee.id,hashPayrollToken('i9-preview-second')])
 const second=await fetch(`${h.url}/api/payroll/employee${path}/page`,{method:'POST',headers:{Authorization:'Bearer i9-preview-second','Content-Type':'application/json'},body:JSON.stringify(page)});assert.equal(second.status,409)
 await api(contextPath,{...context,expectedRevision:1,eVerify:true})
 await api(path+'/page',page,'POST',409,true)
 const revised=await api(path+'/preview',body,'POST',200,true);assert.equal(revised.hiringRevision,2)
 await api(path+'/draft',{draft:{...draft,firstName:'Changed'},expectedRevision:1,baseResponseHash:saved.baseResponseHash,onboardingCycle:1,requestKey:randomUUID()},'POST',200,true)
 await api(path+'/page',{...page,reviewId:revised.reviewId,previewSha256:revised.previewSha256},'POST',409,true)
 await api(path+'/preview',body,'POST',409,true)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_review WHERE id=$1',[preview.reviewId]),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_page_visit WHERE review_id=$1',[preview.reviewId]),/immutable/)
 const packet=await api('/onboarding',undefined,'GET',200,true);assert.equal(packet.tasks.find(t=>t.id===task.id).status,'OPEN');assert.equal(JSON.stringify(packet).includes('123456789'),false)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_PREVIEW_CREATED'")).rows).includes('123456789'),false)
 await h.pool.query(`CREATE FUNCTION reject_i9_preview_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_PREVIEW_CREATED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_i9_preview_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_i9_preview_audit()`)
 await api(path+'/preview',{...body,expectedRevision:2},'POST',500,true);assert.equal((await h.pool.query('SELECT * FROM payroll_i9_review WHERE task_id=$1',[task.id])).rowCount,2)
})
