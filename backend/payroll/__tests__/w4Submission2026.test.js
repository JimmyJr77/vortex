import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {decryptDocument} from '../onboarding.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {W4_2026} from '../w4Form2026.js'

test('native W-4 retains encrypted exact preview, signs atomically, rejects stale/replayed inputs and preserves scope',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='45'.repeat(32)
 t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='W4')
 const path=`/onboarding/${task.id}/w4`,answers={year:2026,personal:{firstNameMiddleInitial:'Synthetic',lastName:'Employee',address:'123 Test Street',cityStateZip:'Bowie MD 20715',ssn:'123456789'},filingStatus:'SINGLE',twoJobs:false,exempt:false,nonresidentAlien:false,creditsCents:12555,extraWithholdingCents:1000}
 const draftBody={draft:{ssn:'123-4',twoJobs:false,exempt:false},expectedRevision:0,baseSubmissionId:null,onboardingCycle:1,requestKey:randomUUID()}
 await api(`${path}/draft`,draftBody,'POST',200,true)
 const preview=()=>api(`${path}/preview`,{onboardingCycle:1,answers},'POST',200,true)
 const first=await preview(),second=await preview()
 const body=p=>({onboardingCycle:1,reviewId:p.reviewId,previewSha256:p.previewSha256,signature:'Synthetic Employee',perjury:W4_2026.perjury,confirmed:true,reviewedAllPages:true,requestKey:randomUUID()})
 await api(`${path}/sign`,body(first),'POST',409,true)
 const signing=body(second)
 await api(`${path}/sign`,signing,'POST',409,true)
 for(let page=1;page<=5;page++)await api(`${path}/page`,{onboardingCycle:1,reviewId:second.reviewId,previewSha256:second.previewSha256,page,displayed:true},'POST',200,true)
 await api(`${path}/sign`,{...signing,perjury:'I agree'},'POST',400,true)
 await api(`${path}/sign`,{...signing,previewSha256:'a'.repeat(64)},'POST',409,true)
 await api(`${path}/sign`,{...signing,onboardingCycle:2},'POST',409,true)
 // Failure after the PDF insert must roll back the document, signature and task.
 await h.pool.query(`CREATE FUNCTION reject_w4_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='W4_ELECTRONICALLY_SIGNED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_w4_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_w4_audit()`)
 await api(`${path}/sign`,signing,'POST',500,true)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_w4_submission')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document WHERE task_id=$1',[task.id])).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_w4_audit ON payroll_audit_log')
 const [saved,retry]=await Promise.all([api(`${path}/sign`,signing,'POST',200,true),api(`${path}/sign`,signing,'POST',200,true)])
 assert.deepEqual(saved,retry)
 const cleared=await api(`${path}/draft?onboardingCycle=1`,undefined,'GET',200,true);assert.equal(cleared.draft,null);assert.equal(cleared.revision,2)
 await api(`${path}/draft`,{...draftBody,expectedRevision:1,requestKey:randomUUID()},'POST',409,true)
 await api(`${path}/sign`,{...signing,signature:'Changed signature'},'POST',409,true)
 await api(`${path}/sign`,{...signing,requestKey:randomUUID()},'POST',409,true)
 const review=(await h.pool.query('SELECT * FROM payroll_w4_review WHERE id=$1',[second.reviewId])).rows[0]
 assert.equal(review.encrypted_review.includes(Buffer.from(answers.personal.ssn)),false)
 const doc=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[saved.documentId])).rows[0]
 const pdfBytes=decryptDocument(doc.encrypted_content,`1:${employee.id}:${task.id}`),pdf=await PDFDocument.load(pdfBytes)
 assert.equal(createHash('sha256').update(pdfBytes).digest('hex'),doc.content_sha256)
 assert.equal(pdf.getPageCount(),5);assert.equal(pdf.getForm().getTextField('vortex.w4.employeeSignature').getText(),'Synthetic Employee')
 const packet=await api('/onboarding',undefined,'GET',200,true)
 assert.equal(packet.tasks.find(t=>t.id===task.id).status,'SUBMITTED')
 assert.equal(JSON.stringify(packet).includes(answers.personal.ssn),false)
 const audit=await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action LIKE 'W4_%'")
 assert.equal(JSON.stringify(audit.rows).includes(answers.personal.ssn),false)
 await assert.rejects(h.pool.query('UPDATE payroll_w4_submission SET request_hash=$1 WHERE id=$2',['0'.repeat(64),saved.submissionId]),/retained unchanged/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_w4_review WHERE id=$1',[first.reviewId]),/retained unchanged/)
 const other=await api('/employees',{employeeNumber:'OTHER-W4',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[other.id,hashPayrollToken('other-w4-session')])
 const cross=await fetch(`${h.url}/api/payroll/employee${path}/sign`,{method:'POST',headers:{Authorization:'Bearer other-w4-session','Content-Type':'application/json'},body:JSON.stringify(signing)})
 assert.equal(cross.status,404)
 const expired=(await h.pool.query(`INSERT INTO payroll_w4_review(facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,encrypted_review,preview_sha256,created_at,expires_at)
  SELECT facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,encrypted_review,preview_sha256,clock_timestamp()-interval '40 minutes',clock_timestamp()-interval '1 minute' FROM payroll_w4_review WHERE id=$1 RETURNING id`,[second.reviewId])).rows[0]
 await api(`${path}/sign`,{...body(second),reviewId:expired.id},'POST',409,true)
 delete process.env.PAYROLL_DOCUMENT_KEY
 await api(`${path}/preview`,{onboardingCycle:1,answers},'POST',503,true)
 process.env.PAYROLL_DOCUMENT_KEY='45'.repeat(32)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document WHERE task_id=$1',[task.id])).rows[0].n,1)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=clock_timestamp() WHERE employee_id=$1',[employee.id])
 await api(`${path}/sign`,signing,'POST',401,true)
})
