import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,createHash} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {decryptDocument} from '../onboarding.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {MW507_2026} from '../mw507Form2026.js'
import {syntheticMw507} from '../testing/mw507Fixture.js'

test('native MW507 retains encrypted exact preview, signs atomically, rejects stale/replayed inputs and preserves scope',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='45'.repeat(32)
 t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='STATE_WITHHOLDING')
 const path=`/onboarding/${task.id}/mw507`,answers=syntheticMw507()
 const draftBody={draft:{ssn:'123-4',priorYearNoTax:false,currentYearNoTax:false,noMarylandAbode:false,certifiedEligible:false,useWorksheet:false},expectedRevision:0,baseSubmissionId:null,onboardingCycle:1,requestKey:randomUUID()}
 await api(`${path}/draft`,draftBody,'POST',200,true)
 const preview=()=>api(`${path}/preview`,{onboardingCycle:1,answers},'POST',200,true)
 const first=await preview(),second=await preview()
 const body=p=>({onboardingCycle:1,reviewId:p.reviewId,previewSha256:p.previewSha256,signature:'Synthetic Employee',perjury:MW507_2026.perjury,confirmed:true,reviewedAllPages:true,requestKey:randomUUID()})
 await api(`${path}/sign`,body(first),'POST',409,true)
 const signing=body(second)
 await api(`${path}/sign`,signing,'POST',409,true)
 for(let page=1;page<=2;page++)await api(`${path}/page`,{onboardingCycle:1,reviewId:second.reviewId,previewSha256:second.previewSha256,page,displayed:true},'POST',200,true)
 await api(`${path}/sign`,{...signing,perjury:'I agree'},'POST',400,true)
 await api(`${path}/sign`,{...signing,previewSha256:'a'.repeat(64)},'POST',409,true)
 await api(`${path}/sign`,{...signing,onboardingCycle:2},'POST',409,true)
 // Failure after the PDF insert must roll back the document, signature and task.
 await h.pool.query(`CREATE FUNCTION reject_mw507_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='MW507_ELECTRONICALLY_SIGNED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_mw507_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_mw507_audit()`)
 await api(`${path}/sign`,signing,'POST',500,true)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_mw507_submission')).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document WHERE task_id=$1',[task.id])).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_mw507_audit ON payroll_audit_log')
 const [saved,retry]=await Promise.all([api(`${path}/sign`,signing,'POST',200,true),api(`${path}/sign`,signing,'POST',200,true)])
 assert.deepEqual(saved,retry)
 const cleared=await api(`${path}/draft?onboardingCycle=1`,undefined,'GET',200,true);assert.equal(cleared.draft,null);assert.equal(cleared.revision,2)
 await api(`${path}/draft`,{...draftBody,expectedRevision:1,requestKey:randomUUID()},'POST',409,true)
 await api(`${path}/sign`,{...signing,signature:'Changed signature'},'POST',409,true)
 await api(`${path}/sign`,{...signing,requestKey:randomUUID()},'POST',409,true)
 const review=(await h.pool.query('SELECT * FROM payroll_mw507_review WHERE id=$1',[second.reviewId])).rows[0]
 assert.equal(review.encrypted_review.includes(Buffer.from(answers.personal.ssn)),false)
 const doc=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[saved.documentId])).rows[0]
 const pdfBytes=decryptDocument(doc.encrypted_content,`1:${employee.id}:${task.id}`),pdf=await PDFDocument.load(pdfBytes)
 assert.equal(createHash('sha256').update(pdfBytes).digest('hex'),doc.content_sha256)
 assert.equal(pdf.getPageCount(),2);assert.equal(pdf.getForm().getTextField('vortex.mw507.employeeSignature').getText(),'Synthetic Employee')
 await api(`/onboarding/${task.id}`,{confirmed:true,reference:'attempted generic replacement',onboardingCycle:1},'POST',409,true)
 await h.pool.query("UPDATE payroll_onboarding_task SET status='OPEN' WHERE id=$1",[task.id])
 await api(`/onboarding/${task.id}/draft`,{onboardingCycle:1,note:'attempted generic draft replacement'},'POST',409,true)
 assert.equal((await h.pool.query('SELECT response FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0].response.mw507SubmissionId,saved.submissionId)
 await h.pool.query("UPDATE payroll_onboarding_task SET status='SUBMITTED' WHERE id=$1",[task.id])
 const election=(await h.pool.query('SELECT elections FROM payroll_tax_election WHERE employee_id=$1',[employee.id])).rows[0].elections
 assert.equal(election.mw507ReviewRequired,saved.submissionId)
 await h.pool.query("UPDATE payroll_employee SET state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
 await api(`/employees/${employee.id}/tax-elections`,{federal:election.federal,maryland:election.maryland,sourceNote:'Synthetic attempted stale election transfer',confirmed:true},'PATCH',409)
 const packet=await api('/onboarding',undefined,'GET',200,true)
 assert.equal(packet.tasks.find(t=>t.id===task.id).status,'SUBMITTED')
 assert.equal(JSON.stringify(packet).includes(answers.personal.ssn),false)
 const audit=await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action LIKE 'MW507_%'")
 assert.equal(JSON.stringify(audit.rows).includes(answers.personal.ssn),false)
 await assert.rejects(h.pool.query('UPDATE payroll_mw507_submission SET request_hash=$1 WHERE id=$2',['0'.repeat(64),saved.submissionId]),/retained unchanged/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_mw507_review WHERE id=$1',[first.reviewId]),/retained unchanged/)
 const other=await api('/employees',{employeeNumber:'OTHER-MW507',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,clock_timestamp()+interval '1 day')",[other.id,hashPayrollToken('other-mw507-session')])
 const cross=await fetch(`${h.url}/api/payroll/employee${path}/sign`,{method:'POST',headers:{Authorization:'Bearer other-mw507-session','Content-Type':'application/json'},body:JSON.stringify(signing)})
 assert.equal(cross.status,404)
 const expired=(await h.pool.query(`INSERT INTO payroll_mw507_review(facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,encrypted_review,preview_sha256,created_at,expires_at)
  SELECT facility_id,employee_id,task_id,onboarding_cycle,employee_session_id,encrypted_review,preview_sha256,clock_timestamp()-interval '40 minutes',clock_timestamp()-interval '1 minute' FROM payroll_mw507_review WHERE id=$1 RETURNING id`,[second.reviewId])).rows[0]
 await api(`${path}/sign`,{...body(second),reviewId:expired.id},'POST',409,true)
 delete process.env.PAYROLL_DOCUMENT_KEY
 await api(`${path}/preview`,{onboardingCycle:1,answers},'POST',503,true)
 process.env.PAYROLL_DOCUMENT_KEY='45'.repeat(32)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document WHERE task_id=$1',[task.id])).rows[0].n,1)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=clock_timestamp() WHERE employee_id=$1',[employee.id])
 await api(`${path}/sign`,signing,'POST',401,true)
})
