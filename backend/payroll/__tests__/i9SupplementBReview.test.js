import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {writeFile} from 'node:fs/promises'
import {decryptDocument} from '../onboarding.js'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../testing/employerI9ReviewFixture.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
const answers={edition:'01/20/25',document:{list:'A',title:'Employment Authorization Document',number:'REPLACEMENT-SYNTHETIC',expiresOn:'2032-01-01'},representativeName:'Reviewer Alice',examinationMethod:'PHYSICAL',additionalInformation:''}
test('native Supplement B preview retains exact encrypted source, scopes page review and rejects stale/reopened certification',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,task,base,reviewBody}=await employerI9ReviewFixture(h,{authorizedWorker:true})
 const copy=await api(base+'/employer-copies',{...reviewBody,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')})
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...reviewBody,documentKey:'main',page,displayed:true})
 for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:copy.id,page,displayed:true})
 const signed=await api(base+'/employer-sign',{...reviewBody,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated hiring admin performed the synthetic examination.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Historical synthetic fixture certified at the actual current date.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'REVERIFICATION',followUpOn:'2030-01-01',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Synthetic employment authorization valid through January 2030.'}]}})
 const followup=(await h.pool.query('SELECT * FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0]
 const path=`/employees/${employee.id}/i9/supplement/${followup.compliance_task_id}`,body={signatureId:signed.signatureId,answers}
 await api(path+'/preview',{...body,signatureId:'99999'},'POST',409)
 await api(path+'/preview',{...body,answers:{...answers,document:{...answers.document,list:'B'}}},'POST',400)
 await h.pool.query(`CREATE FUNCTION reject_supplement_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_SUPPLEMENT_PREVIEW_CREATED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_supplement_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_supplement_audit()`)
 await api(path+'/preview',body,'POST',500)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_supplement_review')).rowCount,0)
 await h.pool.query('DROP TRIGGER reject_supplement_audit ON payroll_audit_log')
 const preview=await api(path+'/preview',body),page={reviewId:preview.reviewId,previewSha256:preview.previewSha256,documentKey:'supplement',page:1,displayed:true}
 assert.equal(preview.pageCount,1);assert.equal(preview.source.pageCount,4)
 const form=(await PDFDocument.load(Buffer.from(preview.pdfBase64,'base64'))).getForm()
 assert.equal(form.getTextField('Document Number 0').getText(),'REPLACEMENT-SYNTHETIC');assert.equal(form.getTextField('Signature of Emp Rep 0').getText()||'','')
 const source=(await PDFDocument.load(Buffer.from(preview.source.pdfBase64,'base64'))).getForm();assert.equal(source.getTextField('Signature of Employer or AR').getText(),'Reviewer Alice')
 const row=(await h.pool.query('SELECT * FROM payroll_i9_supplement_review')).rows[0]
 assert.equal(row.encrypted_review.includes(Buffer.from('REPLACEMENT-SYNTHETIC')),false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_supplement_review'),/immutable/)
 await api(path+'/page',{...page,displayed:false},'POST',400)
 await api(path+'/page',{...page,page:2},'POST',400)
 await api(path+'/page',{...page,previewSha256:'0'.repeat(64)},'POST',409)
 await api(path+'/page',page);await api(path+'/page',page)
 for(let n=1;n<=4;n++)await api(path+'/page',{...page,documentKey:'source',page:n})
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_supplement_page_visit')).rowCount,5)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_supplement_page_visit'),/immutable/)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}/page`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify(page)});assert.equal(foreign.status,404)
 const upload={...page,requestKey:randomUUID(),filename:'PRIVATE-ID-NUMBER.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')}
 const countBefore=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await h.pool.query(`CREATE FUNCTION reject_supplement_copy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_SUPPLEMENT_COPY_RETAINED' THEN RAISE EXCEPTION 'Synthetic copy audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_supplement_copy_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_supplement_copy_audit()`)
 await api(path+'/copies',upload,'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,countBefore)
 await h.pool.query('DROP TRIGGER reject_supplement_copy_audit ON payroll_audit_log')
 const [retained,retry]=await Promise.all([api(path+'/copies',upload),api(path+'/copies',upload)]);assert.deepEqual(retained,retry)
 assert.deepEqual(await api(path+'/copies',{...upload,requestKey:upload.requestKey.toUpperCase()}),retained)
 await api(path+'/copies',{...upload,requestKey:randomUUID(),contentBase64:Buffer.from('%PDF-broken').toString('base64')},'POST',400)
 const copyParams={...page,copyId:retained.id}
 const viewed=await api(path+'/copy',copyParams);assert.equal(viewed.contentBase64,upload.contentBase64);assert.equal(viewed.filename.includes('PRIVATE'),false);assert.equal(viewed.pageCount,2)
 const query=new URLSearchParams({reviewId:page.reviewId,previewSha256:page.previewSha256})
 assert.equal((await api(path+'/copies?'+query)).copies.length,1)
 await api(path+'/copy-page',{...copyParams,displayed:false},'POST',400)
 await api(path+'/copy-page',{...copyParams,page:3},'POST',400)
 for(let n=1;n<=2;n++)await api(path+'/copy-page',{...copyParams,page:n})
 await api(path+'/copy-page',{...copyParams,page:2})
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_supplement_copy_page')).rowCount,2)
 const raw=(await h.pool.query('SELECT c.*,d.encrypted_content FROM payroll_i9_supplement_copy c JOIN payroll_private_document d ON d.id=c.document_id')).rows[0]
 assert.equal(raw.encrypted_content.includes(Buffer.from('SYNTHETIC ID')),false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_supplement_copy'),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_supplement_copy_page'),/immutable/)
 const newer=await api(path+'/preview',body)
 await api(path+'/page',page,'POST',409)
 await api(path+'/page',{...page,reviewId:newer.reviewId,previewSha256:newer.previewSha256})
 const refreshed={...page,reviewId:newer.reviewId,previewSha256:newer.previewSha256,copyId:retained.id}
 assert.equal((await api(path+'/copy',refreshed)).contentBase64,upload.contentBase64)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_supplement_copy_page WHERE review_id=$1',[newer.reviewId])).rowCount,0)
 const state=(await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[followup.compliance_task_id])).rows[0];assert.equal(state.status,'OPEN')
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_SUPPLEMENT_PREVIEW_CREATED'")).rows;assert.equal(audit.length,2);assert.equal(JSON.stringify(audit).includes('REPLACEMENT-SYNTHETIC'),false)
 const changed=await api(path+'/preview',{...body,answers:{...answers,document:{...answers.document,number:'DIFFERENT-DOCUMENT'}}})
 const changedBody={...page,reviewId:changed.reviewId,previewSha256:changed.previewSha256,copyId:retained.id}
 await api(path+'/copy',changedBody,'POST',404)
 await api(path+'/copy-page',changedBody,'POST',404)
 await assert.rejects(()=>h.pool.query('INSERT INTO payroll_i9_supplement_copy_page(review_id,copy_id,page_number) VALUES($1,$2,1)',[changed.reviewId,retained.id]),/valid page/)
 await api(path+'/copies',{...upload,reviewId:changed.reviewId,previewSha256:changed.previewSha256},'POST',409)
 const expired=(await h.pool.query(`INSERT INTO payroll_i9_supplement_review(facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,preview_sha256,encrypted_review,document_fingerprint,created_at,expires_at) SELECT facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,preview_sha256,encrypted_review,document_fingerprint,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour' FROM payroll_i9_supplement_review WHERE id=$1 RETURNING id`,[newer.reviewId])).rows[0]
 await api(path+'/page',{...page,reviewId:expired.id,previewSha256:newer.previewSha256},'POST',409)
 await api(`/compliance/${followup.compliance_task_id}`,{status:'COMPLETE',completionNote:'A generic note is not signed reverification evidence.'},'PATCH',409)
 await assert.rejects(()=>h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE id=$1",[followup.compliance_task_id]),/retained signed evidence/)
 const signingReview=await api(path+'/preview',body),signingPage={...page,reviewId:signingReview.reviewId,previewSha256:signingReview.previewSha256}
 const today=(await h.pool.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
 const examination={examinedOn:today,examinerInitials:'RA',identityEvidence:'Authenticated named examiner performed the synthetic physical review.',reverificationRequired:true,requirementSource:'https://www.uscis.gov/i-9-central',requirementEvidence:'Synthetic current employment authorization required reverification.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[retained.id],physicalPresence:true,acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Synthetic current employment authorization document accepted.',validUntil:'2032-01-01',authorizationIndefinite:false,authorizationThrough:'2032-01-01',followUpKind:'REVERIFICATION',followUpOn:'2032-01-01',noFurtherReverificationRequired:false}
 const signBody={...signingPage,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:signingReview.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination}
 await api(path+'/sign',signBody,'POST',409)
 for(let n=1;n<=4;n++)await api(path+'/page',{...signingPage,documentKey:'source',page:n})
 await api(path+'/page',signingPage)
 await api(path+'/sign',signBody,'POST',409)
 for(let n=1;n<=2;n++)await api(path+'/copy-page',{...signingPage,copyId:retained.id,page:n})
 await api(path+'/sign',{...signBody,signature:'Different examiner'},'POST',400)
 await h.pool.query(`CREATE FUNCTION reject_supplement_sign_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_SUPPLEMENT_SIGNED' THEN RAISE EXCEPTION 'Synthetic signing audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_supplement_sign_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_supplement_sign_audit()`)
 const documentCount=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await api(path+'/sign',signBody,'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,documentCount)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_supplement_signature')).rowCount,0)
 await h.pool.query('DROP TRIGGER reject_supplement_sign_audit ON payroll_audit_log')
 const [completed,repeated]=await Promise.all([api(path+'/sign',signBody),api(path+'/sign',signBody)]);assert.deepEqual(completed,repeated)
 assert.deepEqual(await api(path+'/sign',{...signBody,requestKey:signBody.requestKey.toUpperCase()}),completed)
 assert.equal(completed.status,'COMPLETE');assert.equal(completed.nextFollowup.kind,'REVERIFICATION');assert.equal(completed.nextFollowup.due_on,'2032-01-01')
 await api(path+'/sign',{...signBody,signature:'Different examiner'},'POST',409)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_supplement_signature'),/immutable/)
 const savedDocument=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[completed.documentId])).rows[0]
 const signedPdf=decryptDocument(savedDocument.encrypted_content,`1:${employee.id}:${task.id}`),signedForm=(await PDFDocument.load(signedPdf)).getForm()
 assert.equal(signedForm.getTextField('Signature of Emp Rep 0').getText(),'Reviewer Alice')
 assert.equal(signedForm.getTextField('Todays Date 0').getText(),`${today.slice(5,7)}/${today.slice(8,10)}/${today.slice(0,4)}`)
 await writeFile('/tmp/payroll-i9-supplement-signed-integrated.pdf',signedPdf)
 // A subsequent reverification retains and requires review of the prior signed supplement.
 const nextPath=`/employees/${employee.id}/i9/supplement/${completed.nextFollowup.id}`
 const finalAnswers={...answers,document:{list:'C',title:'Unrestricted Social Security card',number:'SYNTHETIC-CARD',expiresOn:''}}
 const finalReview=await api(nextPath+'/preview',{signatureId:signed.signatureId,answers:finalAnswers})
 assert.equal(finalReview.previousSupplements.length,1);assert.equal(finalReview.previousSupplements[0].signatureId,completed.signatureId)
 const finalPage={...page,reviewId:finalReview.reviewId,previewSha256:finalReview.previewSha256}
 const finalCopy=await api(nextPath+'/copies',{...upload,...finalPage,requestKey:randomUUID()})
 for(let n=1;n<=4;n++)await api(nextPath+'/page',{...finalPage,documentKey:'source',page:n})
 await api(nextPath+'/page',finalPage)
 for(let n=1;n<=2;n++)await api(nextPath+'/copy-page',{...finalPage,copyId:finalCopy.id,page:n})
 const finalBody={...signBody,...finalPage,requestKey:randomUUID(),attestation:finalReview.attestation,examination:{...examination,copyIds:[finalCopy.id],validUntil:'',authorizationIndefinite:true,authorizationThrough:'',followUpKind:'NONE',followUpOn:'',noFurtherReverificationRequired:true,acceptanceEvidence:'Synthetic unrestricted card and permanent authorization reviewed.'}}
 await api(nextPath+'/sign',finalBody,'POST',409)
 await api(nextPath+'/page',{...finalPage,documentKey:finalReview.previousSupplements[0].documentKey})
 assert.equal((await api(nextPath+'/sign',finalBody)).nextFollowup,null)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_supplement_signature')).rowCount,2)
 const records=await api(`/employees/${employee.id}/i9/employer-records`);assert.equal(records.records[0].supplements.length,2);assert.equal(records.records[0].supplements[0].signature,'Reviewer Alice');assert.equal(records.records[0].supplements[1].examination.followUpKind,'NONE')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{onboardingCycle:1,status:'CHANGES_REQUESTED',note:'Reopen employer certification for a corrected examination.'})
 await api(path+'/preview',body,'POST',409)
 await api(path+'/page',{...page,reviewId:newer.reviewId,previewSha256:newer.previewSha256},'POST',409)
})
