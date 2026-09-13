import {writeFile} from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {receiptFixture} from '../testing/receiptFixture.js'
import {i9DifferentDocumentsBasis} from '../i9DifferentDocumentsBasis.js'
import {i9SupplementBBasis} from '../i9SupplementBReview.js'
import {i9EmployerRecords} from '../i9EmployerRecords.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
import {decryptDocument} from '../onboarding.js'
for(const authorizedWorker of [false,true])test(`replacement signing retains evidence and resolves receipt (${authorizedWorker?'finite authorization':'citizen'})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee,signed,pdf}=await receiptFixture(h,{authorizedWorker}),ctx={facility:1,employee:employee.id,admin:99}
 const task=(await h.pool.query('SELECT compliance_task_id FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0].compliance_task_id
 const current=await i9DifferentDocumentsBasis(h.pool,ctx,task)
 const path=`/employees/${employee.id}/i9/different-documents/${task}`
 const doc={title:'Synthetic document',issuingAuthority:'Synthetic issuer',number:'SYNTHETIC',expiresOn:'2030-01-01'}
 const review=await api(path+'/preview',{signatureId:signed.signatureId,initials:'RA',reason:'Employee selected different acceptable replacement documents.',section2:{...current.originalSection2,representativeNameAndTitle:'Reviewer Alice, Hiring Administrator',listA:undefined,documentChoice:'LIST_B_C',listB:doc,listC:doc}})
 const key={reviewId:review.reviewId,previewSha256:review.previewSha256},documents=[]
 for(const rowKey of ['B','C']){
  const copy=await api(path+'/copies',{...key,rowKey,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
  documents.push({rowKey,copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:authorizedWorker&&rowKey==='C'?'REVERIFICATION':'NONE',noFollowUpConfirmed:!authorizedWorker||rowKey==='B',...(authorizedWorker&&rowKey==='C'?{followUpOn:'2030-01-01',ruleSource:'https://www.uscis.gov/i-9-central',ruleEvidence:'Reviewed current employment authorization expiration.'}:{})})
 }
 const facts={differentDocumentsConfirmed:true,authorizationIndefinite:!authorizedWorker,authorizationThrough:authorizedWorker?'2030-01-01':'',authorizationEvidence:'Verified current authorization from the examined replacement evidence.',examination:{examinedOn:review.recordedOn,examinerInitials:'RA',identityEvidence:'Authenticated hiring administrator performed the actual examination.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents}}
 const body={...key,requestKey:randomUUID(),signature:'Reviewer Alice',attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:facts}
 await api(path+'/sign',body,'POST',409)
 for(const part of review.packet)for(let page=1;page<=part.pageCount;page++)await api(path+'/page',{...key,documentKey:part.documentKey,page,displayed:true})
 await api(path+'/sign',body,'POST',409)
 for(const d of documents)for(let page=1;page<=2;page++)await api(path+'/copy-page',{...key,rowKey:d.rowKey,copyId:d.copyIds[0],page,displayed:true})
 await api(path+'/sign',{...body,signature:'Other Reviewer'},'POST',400)
 await h.pool.query(`CREATE FUNCTION reject_different_sign_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_DIFFERENT_SIGNED' THEN RAISE EXCEPTION 'Synthetic signing audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_different_sign_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_different_sign_audit()`)
 await api(path+'/sign',body,'POST',500)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_different_signature')).rowCount,0)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[task])).rows[0].status,'OPEN')
 await h.pool.query('DROP TRIGGER reject_different_sign_audit ON payroll_audit_log')
 const result=await api(path+'/sign',body),retry=await api(path+'/sign',body)
 assert.deepEqual(retry,result)
 await api(path+'/sign',{...body,signature:'Changed'},'POST',409)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_different_signature')).rowCount,1)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[task])).rows[0].status,'COMPLETE')
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_signature'),/immutable/)
 const retained=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[result.documentId])).rows[0]
 const output=decryptDocument(retained.encrypted_content,`1:${employee.id}:${retained.task_id}`),form=(await PDFDocument.load(output)).getForm()
 await writeFile(`/tmp/payroll-different-signed-${authorizedWorker?'worker':'citizen'}.pdf`,output)
 assert.equal(form.getTextField('Signature of Employer or AR').getText(),'Reviewer Alice')
 assert.equal(form.getTextField('Signature of Employee').getText()||'','')
 const original=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[current.row.document_id])).rows[0]
 assert.deepEqual(decryptDocument(original.encrypted_content,`1:${employee.id}:${original.task_id}`),current.bytes)
 const history=await i9EmployerRecords(h.pool,ctx)
 assert.equal(history.records[0].differentCertifications[0].document.id,result.documentId)
 const followups=(await h.pool.query("SELECT * FROM payroll_i9_signature_followup WHERE row_key LIKE 'DIFFERENT:%'")).rows
 assert.equal(followups.length,authorizedWorker?1:0)
 if(authorizedWorker){
  const next=await i9SupplementBBasis(h.pool,ctx,followups[0].compliance_task_id)
  assert.equal(next.previousReceiptAmendments.find(p=>p.documentKey===`different:${result.signatureId}`).documentId,result.documentId)
  const nextPath=`/employees/${employee.id}/i9/supplement/${followups[0].compliance_task_id}`
  const supplement=await api(nextPath+'/preview',{signatureId:signed.signatureId,answers:{edition:'01/20/25',document:{list:'A',title:'Synthetic authorization document',number:'SYNTHETIC-NEW',expiresOn:'2032-01-01'},representativeName:'Reviewer Alice',additionalInformation:'',examinationMethod:'PHYSICAL'}})
  const page={reviewId:supplement.reviewId,previewSha256:supplement.previewSha256,displayed:true}
  const copy=await api(nextPath+'/copies',{...page,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
  for(let n=1;n<=4;n++)await api(nextPath+'/page',{...page,documentKey:'source',page:n})
  await api(nextPath+'/page',{...page,documentKey:'supplement',page:1})
  for(let n=1;n<=2;n++)await api(nextPath+'/copy-page',{...page,copyId:copy.id,page:n})
  const subsequent={...page,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:supplement.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:review.recordedOn,examinerInitials:'RA',identityEvidence:'Authenticated examiner reviewed the new authorization document.',reverificationRequired:true,requirementSource:'https://www.uscis.gov/i-9-central',requirementEvidence:'Employee has finite employment authorization requiring reverification.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[copy.id],physicalPresence:true,acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Examiner verified current original authorization documentation.',validUntil:'2032-01-01',authorizationIndefinite:false,authorizationThrough:'2032-01-01',followUpKind:'REVERIFICATION',followUpOn:'2032-01-01',noFurtherReverificationRequired:false}}
  await api(nextPath+'/sign',subsequent,'POST',409)
  const previous=supplement.previousReceiptAmendments.find(p=>p.documentKey===`different:${result.signatureId}`)
  for(let n=1;n<=previous.pageCount;n++)await api(nextPath+'/page',{...page,documentKey:previous.documentKey,page:n})
  await api(nextPath+'/page',{...page,documentKey:previous.documentKey,page:previous.pageCount+1},'POST',400)
  await api(nextPath+'/sign',{...subsequent,examination:{...subsequent.examination,examinedOn:'2026-09-02'}},'POST',400)
  const completed=await api(nextPath+'/sign',subsequent)
  assert.equal(completed.status,'COMPLETE')
  assert.equal(completed.nextFollowup.due_on,'2032-01-01')
  const record=(await h.pool.query('SELECT * FROM payroll_i9_supplement_signature WHERE id=$1',[completed.signatureId])).rows[0]
  const evidence=JSON.parse(decryptDocument(record.encrypted_evidence,`i9-supplement-signature:1:${employee.id}:${record.compliance_task_id}:99`).toString())
  assert.deepEqual(evidence.priorReceiptAmendmentIds,[])
  assert.deepEqual(evidence.priorDifferentCertificationIds,[result.signatureId])
  assert.equal(evidence.reviewedReceiptHistory[0].documentKey,`different:${result.signatureId}`)
  assert.equal(evidence.reviewedReceiptHistory[0].documentId,result.documentId)
  assert.deepEqual(await api(nextPath+'/sign',subsequent),completed)

 }
})
