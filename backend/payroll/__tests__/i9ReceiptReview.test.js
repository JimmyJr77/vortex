import {decryptDocument} from '../onboarding.js'
import {writeFile} from 'node:fs/promises'
import {reverificationFixture} from '../testing/reverificationFixture.js'
import {currentI9ReceiptReview} from '../i9ReceiptReview.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../testing/employerI9ReviewFixture.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
test('native receipt review retains encrypted source and scopes immutable page evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,task,base,reviewBody}=await employerI9ReviewFixture(h,{draftOverrides:{listA:[{title:'U.S. Passport receipt',issuingAuthority:'U.S. Department of State',number:'receipt SYNTHETIC',expiresOn:'2026-11-30'}],additionalInformation:'RA 09/01/2026: Synthetic lost passport replacement receipt.'}})
 const copy=await api(base+'/employer-copies',{...reviewBody,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')})
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...reviewBody,documentKey:'main',page,displayed:true})
 for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:copy.id,page,displayed:true})
 const signed=await api(base+'/employer-sign',{...reviewBody,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated hiring admin performed the synthetic examination.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Historical synthetic fixture certified at the actual current date.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'RECEIPT',validUntil:'2026-11-30',formNotation:'RA 09/01/2026: Synthetic lost passport replacement receipt.',followUpKind:'RECEIPT_REPLACEMENT',followUpOn:'2026-11-30',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Synthetic employment authorization valid through January 2030.'}]}})

 const followup=(await h.pool.query('SELECT * FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0]
 const path=`/employees/${employee.id}/i9/receipt/${followup.compliance_task_id}`
 const answers={sourceKind:'SECTION2',rowKey:'A1',replacementKind:'ACTUAL_REPLACEMENT',replacement:{title:'U.S. Passport',issuingAuthority:'U.S. Department of State',number:'PRIVATE-REPLACEMENT',expiresOn:'2036-01-01'},examinerName:'Reviewer Alice',initials:'RA',amendedOn:'2026-09-13',explanation:'Actual passport replacing the synthetic lost-document receipt.'}
 const body={signatureId:signed.signatureId,answers}
 await api(path+'/preview',{...body,signatureId:'99999'},'POST',409)
 await api(path+'/preview',{...body,answers:{...answers,rowKey:'B'}},'POST',400)
 await h.pool.query(`CREATE FUNCTION reject_receipt_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_RECEIPT_PREVIEW_CREATED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_receipt_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_receipt_audit()`)
 await api(path+'/preview',body,'POST',500)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_receipt_review')).rowCount,0)
 await h.pool.query('DROP TRIGGER reject_receipt_audit ON payroll_audit_log')
 const review=await api(path+'/preview',body),page={reviewId:review.reviewId,previewSha256:review.previewSha256,documentKey:'amendment',page:1,displayed:true}
 assert.equal(review.pageCount,5);assert.equal(review.source.pageCount,4)
 const form=(await PDFDocument.load(Buffer.from(review.pdfBase64,'base64'))).getForm()
 assert.equal(form.getTextField('vortex.i9.receipt.signature').getText()||'','')
 assert.equal(form.getTextField('Signature of Employer or AR').getText(),'Reviewer Alice')
 const stored=(await h.pool.query('SELECT * FROM payroll_i9_receipt_review')).rows[0]
 assert.equal(stored.encrypted_review.includes(Buffer.from('PRIVATE-REPLACEMENT')),false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_receipt_review'),/immutable/)
 await api(path+'/page',{...page,page:6},'POST',400)
 await api(path+'/page',{...page,documentKey:'source',page:5},'POST',400)
 await api(path+'/page',{...page,displayed:false},'POST',400)
 await api(path+'/page',{...page,previewSha256:'0'.repeat(64)},'POST',409)
 for(const [key,count] of [['source',4],['amendment',5]])for(let n=1;n<=count;n++)await api(path+'/page',{...page,documentKey:key,page:n})
 await api(path+'/page',page)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_receipt_page_visit')).rowCount,9)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_receipt_page_visit'),/immutable/)
 await assert.rejects(()=>h.pool.query("INSERT INTO payroll_i9_receipt_page_visit(review_id,document_key,page_number) VALUES($1,'source',5)",[review.reviewId]),/valid receipt/)
 for(const headers of [{'x-test-facility':'2'}]){
  const response=await fetch(`${h.url}/api/admin/payroll${path}/page`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json',...headers},body:JSON.stringify(page)})
  assert.ok([404,409].includes(response.status),String(response.status))
 }
 await assert.rejects(()=>currentI9ReceiptReview(h.pool,{facility:1,employee:employee.id,admin:100},followup.compliance_task_id,page),e=>e.status===409)
 const upload={...page,requestKey:randomUUID(),filename:'PRIVATE-ID-NUMBER.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')}
 const countBefore=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await h.pool.query(`CREATE FUNCTION reject_receipt_copy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_RECEIPT_COPY_RETAINED' THEN RAISE EXCEPTION 'Synthetic copy audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_receipt_copy_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_receipt_copy_audit()`)
 await api(path+'/copies',upload,'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,countBefore)
 await h.pool.query('DROP TRIGGER reject_receipt_copy_audit ON payroll_audit_log')
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
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_receipt_copy_page')).rowCount,2)
 const raw=(await h.pool.query('SELECT c.*,d.encrypted_content FROM payroll_i9_receipt_copy c JOIN payroll_private_document d ON d.id=c.document_id')).rows[0]
 assert.equal(raw.encrypted_content.includes(Buffer.from('SYNTHETIC ID')),false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_receipt_copy'),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_receipt_copy_page'),/immutable/)
 const next=await api(path+'/preview',body)
 await api(path+'/page',page,'POST',409)
 await api(path+'/page',{...page,reviewId:next.reviewId,previewSha256:next.previewSha256})
 const refreshed={...page,reviewId:next.reviewId,previewSha256:next.previewSha256,copyId:retained.id}
 assert.equal((await api(path+'/copy',refreshed)).contentBase64,upload.contentBase64)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_receipt_copy_page WHERE review_id=$1',[next.reviewId])).rowCount,0)
 const changed=await api(path+'/preview',{...body,answers:{...answers,replacement:{...answers.replacement,number:'CHANGED-REPLACEMENT'}}})
 const changedBody={...page,reviewId:changed.reviewId,previewSha256:changed.previewSha256,copyId:retained.id}
 await api(path+'/copy',changedBody,'POST',404)
 await api(path+'/copy-page',{...changedBody,page:1},'POST',404)
 await assert.rejects(()=>h.pool.query('INSERT INTO payroll_i9_receipt_copy_page(review_id,copy_id,page_number) VALUES($1,$2,1)',[changed.reviewId,retained.id]),/valid page/)
 await api(path+'/copies',{...upload,reviewId:changed.reviewId,previewSha256:changed.previewSha256},'POST',409)
 const expired=(await h.pool.query(`INSERT INTO payroll_i9_receipt_review(facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,preview_sha256,document_fingerprint,encrypted_review,page_count,source_page_count,created_at,expires_at) SELECT facility_id,employee_id,compliance_task_id,signature_id,actor_user_id,basis_hash,preview_sha256,document_fingerprint,encrypted_review,page_count,source_page_count,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour' FROM payroll_i9_receipt_review WHERE id=$1 RETURNING id`,[next.reviewId])).rows[0]
 await api(path+'/page',{...page,reviewId:expired.id,previewSha256:next.previewSha256},'POST',409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[followup.compliance_task_id])).rows[0].status,'OPEN')
 await api(`/compliance/${followup.compliance_task_id}`,{status:'COMPLETE',completionNote:'Viewing a replacement is not a signed examination.'},'PATCH',409)
 const today=(await h.pool.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
 const signing=await api(path+'/preview',{...body,answers:{...answers,amendedOn:today}}),signPage={reviewId:signing.reviewId,previewSha256:signing.previewSha256}
 const examination={examinedOn:today,identityEvidence:'Authenticated named examiner reviewed the original passport.',actualReplacementConfirmed:true,receiptMatchEvidence:'The actual passport matches the retained replacement receipt.',documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[retained.id],examinationMethod:'PHYSICAL',physicalPresence:true,acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Original unexpired passport replaces the retained receipt.',validUntil:'2036-01-01',authorizationIndefinite:true,authorizationThrough:'',documentRequiresReverification:false,followUpKind:'NONE',followUpOn:'',noFurtherFollowupConfirmed:true}
 const signBody={...signPage,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:signing.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination}
 await api(path+'/sign',signBody,'POST',409)
 for(const [key,count] of [['source',4],['amendment',signing.pageCount]])for(let n=1;n<=count;n++)await api(path+'/page',{...signPage,documentKey:key,page:n,displayed:true})
 await api(path+'/sign',signBody,'POST',409)
 for(let n=1;n<=2;n++)await api(path+'/copy-page',{...signPage,copyId:retained.id,page:n,displayed:true})
 await api(path+'/sign',{...signBody,signature:'Other examiner'},'POST',400)
 await h.pool.query(`CREATE FUNCTION reject_receipt_sign_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_RECEIPT_SIGNED' THEN RAISE EXCEPTION 'Synthetic signing audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_receipt_sign_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_receipt_sign_audit()`)
 const docsBefore=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await api(path+'/sign',signBody,'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,docsBefore)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_receipt_signature')).rowCount,0)
 await h.pool.query('DROP TRIGGER reject_receipt_sign_audit ON payroll_audit_log')
 const [complete,repeated]=await Promise.all([api(path+'/sign',signBody),api(path+'/sign',signBody)]);assert.deepEqual(complete,repeated)
 assert.equal(complete.status,'COMPLETE');assert.equal(complete.nextFollowup,null)
 assert.deepEqual(await api(path+'/sign',{...signBody,requestKey:signBody.requestKey.toUpperCase()}),complete)
 await api(path+'/sign',{...signBody,signature:'Other examiner'},'POST',409)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_receipt_signature'),/immutable/)
 const document=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[complete.documentId])).rows[0]
 const signedBytes=decryptDocument(document.encrypted_content,`1:${employee.id}:${task.id}`)
 assert.equal((await PDFDocument.load(signedBytes)).getForm().getTextField('vortex.i9.receipt.signature').getText(),'Reviewer Alice')
 await writeFile('/tmp/payroll-i9-receipt-signed-integrated.pdf',signedBytes)
 const records=await api(`/employees/${employee.id}/i9/employer-records`)
 assert.equal(records.records[0].receiptAmendments[0].signatureId,complete.signatureId)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{onboardingCycle:1,status:'CHANGES_REQUESTED',note:'Reopen source for a corrected examination.'})
 await api(path+'/preview',body,'POST',409)
 await api(path+'/page',{...page,reviewId:next.reviewId,previewSha256:next.previewSha256},'POST',409)
})

test('receipt review resolves the signed supplement that created the follow-up',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,signed,pdf}=await reverificationFixture(h)
 const followup=(await h.pool.query('SELECT * FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0]
 const path=`/employees/${employee.id}/i9/supplement/${followup.compliance_task_id}`
 const today=(await h.pool.query("SELECT (clock_timestamp() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
 const validUntil=new Date(Date.parse(today)+60*86400000).toISOString().slice(0,10)
 const stamp=`${today.slice(5,7)}/${today.slice(8,10)}/${today.slice(0,4)}`
 const notation=`RA ${stamp}: Synthetic lost document receipt review.`
 const answers={edition:'01/20/25',document:{list:'A',title:'Employment Authorization Document receipt',number:'receipt SYNTHETIC',expiresOn:validUntil},representativeName:'Reviewer Alice',examinationMethod:'PHYSICAL',additionalInformation:notation}
 const review=await api(path+'/preview',{signatureId:signed.signatureId,answers}),page={reviewId:review.reviewId,previewSha256:review.previewSha256,displayed:true}
 const copy=await api(path+'/copies',{...page,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
 for(let n=1;n<=4;n++)await api(path+'/page',{...page,documentKey:'source',page:n})
 await api(path+'/page',{...page,documentKey:'supplement',page:1})
 for(let n=1;n<=2;n++)await api(path+'/copy-page',{...page,copyId:copy.id,page:n})
 const examination={examinedOn:today,examinerInitials:'RA',identityEvidence:'Authenticated examiner reviewed the synthetic replacement receipt.',reverificationRequired:true,requirementSource:'https://www.uscis.gov/i-9-central',requirementEvidence:'Synthetic finite authorization requires review.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[copy.id],physicalPresence:true,acceptance:'RECEIPT',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Synthetic receipt used only to test retained source selection.',validUntil,formNotation:notation,authorizationIndefinite:false,authorizationThrough:'2032-01-01',followUpKind:'RECEIPT_REPLACEMENT',followUpOn:validUntil,noFurtherReverificationRequired:false}
 const completed=await api(path+'/sign',{...page,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:review.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination})
 const receiptPath=`/employees/${employee.id}/i9/receipt/${completed.nextFollowup.id}`
 const replacement={sourceKind:'SUPPLEMENT_B',rowKey:'SUPPLEMENT',replacementKind:'ACTUAL_REPLACEMENT',replacement:{title:'Employment Authorization Document',issuingAuthority:'USCIS',number:'SYNTHETIC-ACTUAL',expiresOn:'2032-01-01'},examinerName:'Reviewer Alice',initials:'RA',amendedOn:today,explanation:'Actual replacement for the receipt recorded on the signed supplement.'}
 const retained=await api(receiptPath+'/preview',{signatureId:signed.signatureId,answers:replacement})
 const receiptReview={reviewId:retained.reviewId,previewSha256:retained.previewSha256}
 const receiptCopy=await api(receiptPath+'/copies',{...receiptReview,requestKey:randomUUID(),filename:'private-replacement.pdf',contentBase64:pdf.toString('base64')})
 assert.equal((await api(receiptPath+'/copy',{...receiptReview,copyId:receiptCopy.id})).contentBase64,pdf.toString('base64'))
 for(let n=1;n<=2;n++)await api(receiptPath+'/copy-page',{...receiptReview,copyId:receiptCopy.id,page:n,displayed:true})
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_receipt_copy_page WHERE review_id=$1',[retained.reviewId])).rowCount,2)
 assert.equal(retained.source.documentId,completed.documentId)
 assert.equal(retained.source.pageCount,1);assert.equal(retained.pageCount,2)
 const form=(await PDFDocument.load(Buffer.from(retained.source.pdfBase64,'base64'))).getForm()
 assert.equal(form.getTextField('Signature of Emp Rep 0').getText(),'Reviewer Alice')
 await api(receiptPath+'/preview',{signatureId:signed.signatureId,answers:{...replacement,sourceKind:'SECTION2',rowKey:'A1'}},'POST',400)
 await api(receiptPath+'/page',{reviewId:retained.reviewId,previewSha256:retained.previewSha256,documentKey:'source',page:2,displayed:true},'POST',400)
 for(const [key,count] of [['source',1],['amendment',retained.pageCount]])for(let n=1;n<=count;n++)await api(receiptPath+'/page',{...receiptReview,documentKey:key,page:n,displayed:true})
 const receiptExam={examinedOn:today,identityEvidence:'Authenticated named examiner reviewed the actual replacement.',actualReplacementConfirmed:true,receiptMatchEvidence:'Replacement EAD matches the receipt in the signed supplement.',documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[receiptCopy.id],examinationMethod:'PHYSICAL',physicalPresence:true,acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'The actual original EAD replaces the reviewed receipt.',validUntil:'2032-01-01',authorizationIndefinite:false,authorizationThrough:'2032-01-01',documentRequiresReverification:true,followUpKind:'REVERIFICATION',followUpOn:'2032-01-01',noFurtherFollowupConfirmed:false}
 const receiptSigned=await api(receiptPath+'/sign',{...receiptReview,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:retained.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:receiptExam})
 assert.equal(receiptSigned.nextFollowup.kind,'REVERIFICATION')
 const nextPath=`/employees/${employee.id}/i9/supplement/${receiptSigned.nextFollowup.id}`
 const next=await api(nextPath+'/preview',{signatureId:signed.signatureId,answers:{...answers,document:{...answers.document,title:'Employment Authorization Document',number:'SYNTHETIC-ACTUAL',expiresOn:'2032-01-01'}}})
 assert.equal(next.previousReceiptAmendments.length,1)
 const prior=next.previousReceiptAmendments[0]
 assert.equal(prior.documentKey,`receipt:${receiptSigned.signatureId}`)
 assert.equal(prior.pageCount,2)
 const nextPage={reviewId:next.reviewId,previewSha256:next.previewSha256,displayed:true}
 const nextCopy=await api(nextPath+'/copies',{...nextPage,requestKey:randomUUID(),filename:'next.pdf',contentBase64:pdf.toString('base64')})
 for(let n=1;n<=4;n++)await api(nextPath+'/page',{...nextPage,documentKey:'source',page:n})
 await api(nextPath+'/page',{...nextPage,documentKey:'supplement',page:1})
 for(const previous of next.previousSupplements)await api(nextPath+'/page',{...nextPage,documentKey:previous.documentKey,page:1})
 for(let n=1;n<=2;n++)await api(nextPath+'/copy-page',{...nextPage,copyId:nextCopy.id,page:n})
 const nextBody={...nextPage,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:next.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{...examination,copyIds:[nextCopy.id],acceptance:'STANDARD',formNotation:'',validUntil:'2032-01-01',followUpKind:'REVERIFICATION',followUpOn:'2032-01-01'}}
 await api(nextPath+'/sign',nextBody,'POST',409)
 for(let n=1;n<=prior.pageCount;n++)await api(nextPath+'/page',{reviewId:next.reviewId,previewSha256:next.previewSha256,documentKey:prior.documentKey,page:n,displayed:true})
 await api(nextPath+'/page',{reviewId:next.reviewId,previewSha256:next.previewSha256,documentKey:prior.documentKey,page:3,displayed:true},'POST',400)

 assert.equal((await api(nextPath+'/sign',nextBody)).status,'COMPLETE')
})
