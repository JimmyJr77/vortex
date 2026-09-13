import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {signedI9Fixture} from '../testing/signedI9Fixture.js'
import {employerDraftAnswers} from '../i9EmployerReview.js'
import {decryptDocument} from '../onboarding.js'
const draft={documentChoice:'LIST_A',listA:[{title:'U.S. Passport',issuingAuthority:'U.S. Department of State',number:'SYNTHETIC-DOC-123',expiresOn:'2030-01-01'}],listB:{title:'Unselected partial'},examinationMethod:'PHYSICAL',firstDayEmployed:'2026-09-01',representativeNameAndTitle:'Reviewer Alice, Hiring Admin',businessName:'Synthetic Employer',businessAddress:'20 Example Road, Bowie, MD 20715'}
test('employer form preparation includes only the selected saved document branch',()=>{
 assert.equal(employerDraftAnswers(draft).listB,undefined)
 assert.equal(employerDraftAnswers({...draft,documentChoice:'LIST_B_C'}).listA,undefined)
})
for(const assisted of [false,true])test(`employer preview retains exact signed source, current certificates and scoped immutable page evidence; assisted=${assisted}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='95'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness({adminMiddleware:()=>(req,res,next)=>{if(req.headers.authorization!=='Bearer payroll-test-admin')return res.sendStatus(401);req.canonicalAccess={facilityId:Number(req.headers['x-test-facility']||1)};req.adminId=Number(req.headers['x-test-admin']||99);next()}});t.after(()=>h.close())
 const {api,employee,task:employeeTask,signed}=await signedI9Fixture(h,{assisted})
 const task=(await api(`/employees/${employee.id}/onboarding`)).tasks.find(t=>t.task_key==='I9_REVIEW'),base=`/employees/${employee.id}/onboarding/${task.id}/i9`,preparers=`/employees/${employee.id}/onboarding/${employeeTask.id}/i9/preparers`
 await api(base+'/employer-preview',{onboardingCycle:1},'POST',409)
 let roster
 if(assisted){
  const invite=await api(preparers,{onboardingCycle:1,submissionId:signed.submissionId,name:'Alice Translator',email:'alice@example.test',evidence:'Synthetic preparer identity and contact verified by admin.',confirmed:true,requestKey:randomUUID()})
  const guest=async(path,body)=>{const r=await fetch(`${h.url}/api/payroll/preparer/${path}`,{method:'POST',headers:{Authorization:`Bearer ${invite.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return (await r.json()).data}
  const p=await guest('preview',{preparer:{firstName:'Alice',lastName:'Translator',address:'20 Example Road',city:'Bowie',state:'MD',postalCode:'20715'}})
  await guest('page',{reviewId:p.reviewId,previewSha256:p.previewSha256,displayed:true})
  await guest('sign',{reviewId:p.reviewId,previewSha256:p.previewSha256,signature:'Alice Translator',attestation:p.attestation,attestationRead:true,reviewed:true,signingAsPreparer:true,requestKey:randomUUID()})
  roster=await api(preparers+'?onboardingCycle=1')
 }
 await api(`/employees/${employee.id}/onboarding/${employeeTask.id}/review`,{onboardingCycle:1,status:'COMPLETE',note:'Reviewed current signed Section 1 and all required preparer certifications.',...(roster?{i9PreparerReview:{confirmed:true,fingerprint:roster.fingerprint}}:{})})
 const initial=await api(base+'/employer-draft?onboardingCycle=1'),saved=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:initial.revision,basisHash:initial.basisHash,requestKey:randomUUID(),draft:{...draft,businessName:' Synthetic Employer '}})
 const body={onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash},preview=await api(base+'/employer-preview',body)
 assert.equal(preview.supplements.length,assisted?1:0)
 const form=(await PDFDocument.load(Buffer.from(preview.pdfBase64,'base64'))).getForm()
 assert.equal(form.getTextField('Signature of Employee').getText(),'Łukasz Żółć');assert.equal(form.getTextField('Signature of Employer or AR').getText()||'','')
 assert.equal(form.getTextField('Document Number 0 (if any)').getText(),'SYNTHETIC-DOC-123')
 if(assisted){const pdf=await PDFDocument.load(Buffer.from(preview.supplements[0].pdfBase64,'base64'));assert.equal(pdf.getPageCount(),1);assert.equal(pdf.getForm().getTextField('Signature of Preparer or Translator 0').getText(),'Alice Translator')}
 const pageBody={onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,documentKey:'main',page:1,displayed:true}
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...pageBody,page})
 await api(base+'/employer-page',pageBody)
 for(const s of preview.supplements)await api(base+'/employer-page',{...pageBody,documentKey:s.documentKey})
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_employer_page_visit WHERE review_id=$1',[preview.reviewId])).rowCount,assisted?5:4)
 await api(base+'/employer-page',{...pageBody,documentKey:'999999'},'POST',400)
 const other=await fetch(`${h.url}/api/admin/payroll${base}/employer-page`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-admin':'100'},body:JSON.stringify(pageBody)});assert.equal(other.status,409)
 const foreign=await fetch(`${h.url}/api/admin/payroll${base}/employer-preview`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(body)});assert.equal(foreign.status,404)
 const retained=(await h.pool.query('SELECT * FROM payroll_i9_employer_review WHERE id=$1',[preview.reviewId])).rows[0]
 assert.equal(retained.encrypted_review.includes(Buffer.from('SYNTHETIC-DOC-123')),false)
 const evidence=JSON.parse(decryptDocument(retained.encrypted_review,`i9-employer-review:1:${employee.id}:${task.id}:1:99`).toString())
 assert.equal(evidence.answers.businessName,'Synthetic Employer');assert.equal(evidence.answers.businessName,form.getTextField('Employers Business or Org Name').getText())
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_employer_review WHERE id=$1',[preview.reviewId]),/immutable/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_employer_page_visit SET page_number=page_number WHERE review_id=$1',[preview.reviewId]),/immutable/)
 const second=await api(base+'/employer-preview',body);await api(base+'/employer-page',pageBody,'POST',409)
 await h.pool.query(`CREATE FUNCTION reject_employer_preview_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_EMPLOYER_PREVIEW_CREATED' THEN RAISE EXCEPTION 'Synthetic preview audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_employer_preview_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_employer_preview_audit()`)
 await api(base+'/employer-preview',body,'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_i9_employer_review')).rows[0].n,2)
 await h.pool.query('DROP TRIGGER reject_employer_preview_audit ON payroll_audit_log')
 await api(base+'/employer-draft',{...body,requestKey:randomUUID(),draft:{...draft,businessName:'Updated synthetic employer'}})
 await api(base+'/employer-page',{...pageBody,reviewId:second.reviewId,previewSha256:second.previewSha256},'POST',409)
 await assert.rejects(()=>h.pool.query("INSERT INTO payroll_i9_employer_page_visit(review_id,document_key,page_number) VALUES($1,'main',1)",[second.reviewId]),/current draft and employee evidence/)
 const fresh=await api(base+'/employer-preview',{...body,expectedRevision:saved.revision+1})
 const expired=(await h.pool.query(`INSERT INTO payroll_i9_employer_review(facility_id,employee_id,task_id,onboarding_cycle,submission_id,draft_revision,basis_hash,preparer_fingerprint,preparer_document_ids,actor_user_id,encrypted_review,preview_sha256,expires_at) SELECT facility_id,employee_id,task_id,onboarding_cycle,submission_id,draft_revision,basis_hash,preparer_fingerprint,preparer_document_ids,actor_user_id,encrypted_review,preview_sha256,clock_timestamp()-interval '1 second' FROM payroll_i9_employer_review WHERE id=$1 RETURNING id`,[fresh.reviewId])).rows[0]
 await api(base+'/employer-page',{...pageBody,reviewId:expired.id,previewSha256:fresh.previewSha256},'POST',409)
 await assert.rejects(()=>h.pool.query("INSERT INTO payroll_i9_employer_page_visit(review_id,document_key,page_number) VALUES($1,'main',1)",[expired.id]),/latest unexpired/)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_EMPLOYER_PREVIEW_CREATED'")).rows).includes('SYNTHETIC-DOC'),false)
 assert.equal((await api(`/employees/${employee.id}/onboarding`)).tasks.find(t=>t.id===task.id).status,'OPEN')
})
