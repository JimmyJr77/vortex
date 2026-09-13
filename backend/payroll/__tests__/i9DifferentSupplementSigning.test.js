import {i9SupplementBBasis} from '../i9SupplementBReview.js'
import {i9EmployerRecords} from '../i9EmployerRecords.js'
import {PDFDocument} from 'pdf-lib'
import {decryptDocument} from '../onboarding.js'
import {signI9DifferentSupplement} from '../i9DifferentSupplementSigning.js'
import {reviewedI9DifferentSupplementExamination} from '../i9DifferentSupplementExamination.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {supplementReceiptFixture} from '../testing/supplementReceiptFixture.js'
import {currentI9DifferentSupplementCopy} from '../i9DifferentSupplementCopies.js'
test('Supplement B replacement signing is atomic and recovers completed retries',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee,signed,receiptTaskId,pdf}=await supplementReceiptFixture(h),ctx={facility:1,employee:employee.id,admin:99}
 const path=`/employees/${employee.id}/i9/different-supplement/${receiptTaskId}`
 const body={signatureId:signed.signatureId,initials:'RA',reason:'Employee selected a different acceptable authorization document.',supplement:{edition:'01/20/25',document:{list:'C',title:'Synthetic replacement authorization',number:'SYNTHETIC-C',expiresOn:'2032-01-01'},representativeName:'Reviewer Alice',examinationMethod:'PHYSICAL',additionalInformation:''}}
 const preview=await api(path+'/preview',body),page={reviewId:preview.reviewId,previewSha256:preview.previewSha256,rowKey:'document',displayed:true}
 const upload={...page,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')}
 const copy=await api(path+'/copies',upload)
 assert.deepEqual(await api(path+'/copies',{...upload,requestKey:upload.requestKey.toUpperCase()}),copy)
 assert.equal(copy.pageCount,2)
 assert.equal((await api(path+'/copies/list',page)).copies.length,1)
 assert.equal((await api(path+'/copy',{...page,copyId:copy.id})).contentBase64,pdf.toString('base64'))
 await assert.rejects(()=>api(path+'/copies',{...upload,rowKey:'A1'}),/400/)
 await assert.rejects(()=>api(path+'/copies',{...upload,requestKey:randomUUID(),contentBase64:Buffer.from('%PDF-invalid').toString('base64')}),/400/)
 const selected={...page,copyId:copy.id}
 await assert.rejects(()=>api(path+'/copy-page',{...selected,page:3}),/400/)
 await assert.rejects(()=>api(path+'/copy-page',{...selected,page:1,displayed:false}),/400/)
 for(const n of [1,2,2])await api(path+'/copy-page',{...selected,page:n})
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_copy_page WHERE review_id=$1',[page.reviewId])).rows[0].count),2)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_supplement_copy WHERE id=$1',[copy.id]),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_supplement_copy_page WHERE copy_id=$1',[copy.id]),/immutable/)
 const today=preview.recordedOn,findings={differentDocumentsConfirmed:true,replacementEvidence:'Employee chose different acceptable authorization evidence.',examination:{examinedOn:today,examinerInitials:'RA',identityEvidence:'Reviewer Alice examined the original document.',reverificationRequired:true,requirementSource:'https://www.uscis.gov/i-9-central',requirementEvidence:'Synthetic finite authorization requires review.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[copy.id],physicalPresence:true,acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Synthetic document acceptance used for testing.',authorizationIndefinite:false,authorizationThrough:'2031-01-01',followUpKind:'REVERIFICATION',followUpOn:'2031-01-01',noFurtherReverificationRequired:false}}
 await assert.rejects(()=>reviewedI9DifferentSupplementExamination(h.pool,ctx,receiptTaskId,{...page,findings}),/every page of the current replacement packet/)
 for(const part of preview.packet)for(let n=1;n<=part.pageCount;n++)await api(path+'/page',{...page,documentKey:part.documentKey,page:n})
 const checked=await reviewedI9DifferentSupplementExamination(h.pool,ctx,receiptTaskId,{...page,findings})
 assert.equal(checked.copies.length,1);assert.equal(checked.findings.nextFollowUpOn,'2031-01-01')
 const request={...page,findings,requestKey:randomUUID(),signature:'Reviewer Alice',attestation:preview.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true}
 const transact=async body=>{const db=await h.pool.connect();try{await db.query('BEGIN');const result=await signI9DifferentSupplement(db,ctx,receiptTaskId,body);await db.query('COMMIT');return result}catch(error){await db.query('ROLLBACK');throw error}finally{db.release()}}
 await assert.rejects(()=>transact({...request,signature:'Other Reviewer'}),/named/)
 await assert.rejects(()=>transact({...request,attestationRead:false}),/certification/)
 const before=(await h.pool.query('SELECT id,content_sha256,encrypted_content FROM payroll_private_document ORDER BY id')).rows
 await h.pool.query("CREATE FUNCTION reject_replacement_sign_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_DIFFERENT_SUPPLEMENT_SIGNED' THEN RAISE EXCEPTION 'synthetic signing audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_replacement_sign_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_replacement_sign_audit()")
 await assert.rejects(()=>transact(request),/synthetic signing audit failure/)
 assert.deepEqual((await h.pool.query('SELECT id,content_sha256,encrypted_content FROM payroll_private_document ORDER BY id')).rows,before)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_signature')).rows[0].count),0)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[receiptTaskId])).rows[0].status,'OPEN')
 await h.pool.query('DROP TRIGGER reject_replacement_sign_audit ON payroll_audit_log')
 const signedReplacement=await api(path+'/sign',request)
 assert.equal(signedReplacement.status,'COMPLETE')
 const saved=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[signedReplacement.documentId])).rows[0]
 const signedPdf=await PDFDocument.load(decryptDocument(saved.encrypted_content,`1:${employee.id}:${saved.task_id}`))
 assert.equal(signedPdf.getPageCount(),2)
 assert.equal(signedPdf.getForm().getTextField('Signature of Emp Rep 0').getText(),'Reviewer Alice')
 assert.equal(signedPdf.getForm().getTextField('Todays Date 0').getText(),`${today.slice(5,7)}/${today.slice(8,10)}/${today.slice(0,4)}`)
 assert.deepEqual(await api(path+'/sign',{...request,requestKey:request.requestKey.toUpperCase()}),signedReplacement)
 await assert.rejects(()=>transact({...request,signature:'Changed Reviewer'}),/different replacement evidence/)
 const next=(await h.pool.query("SELECT f.kind,f.due_on::text,c.status FROM payroll_i9_signature_followup f JOIN payroll_compliance_task c ON c.id=f.compliance_task_id WHERE f.row_key=$1",[`DIFFERENT_SUPPLEMENT:${signedReplacement.signatureId}`])).rows
 assert.deepEqual(next,[{kind:'REVERIFICATION',due_on:'2031-01-01',status:'OPEN'}])
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[receiptTaskId])).rows[0].status,'COMPLETE')
 assert.deepEqual((await h.pool.query('SELECT id,content_sha256,encrypted_content FROM payroll_private_document WHERE id=ANY($1::bigint[]) ORDER BY id',[before.map(d=>d.id)])).rows,before)
 const nextTask=(await h.pool.query('SELECT compliance_task_id FROM payroll_i9_signature_followup WHERE row_key=$1',[`DIFFERENT_SUPPLEMENT:${signedReplacement.signatureId}`])).rows[0].compliance_task_id
 const basis=await i9SupplementBBasis(h.pool,ctx,nextTask)
 assert.equal(basis.followupExaminedOn,today)
 assert.equal(basis.previousReceiptAmendments.find(p=>p.documentKey===`different-supplement:${signedReplacement.signatureId}`).pageCount,2)
 const history=await i9EmployerRecords(h.pool,ctx)
 assert.equal(history.records[0].differentSupplements[0].document.id,signedReplacement.documentId)
 const followPreview=await api(`/employees/${employee.id}/i9/supplement/${nextTask}/preview`,{signatureId:signed.signatureId,answers:body.supplement})
 const retainedPart=followPreview.previousReceiptAmendments.find(p=>p.documentKey===`different-supplement:${signedReplacement.signatureId}`)
 assert.equal(retainedPart.pageCount,2)
 const nextPath=`/employees/${employee.id}/i9/supplement/${nextTask}`,nextPage={reviewId:followPreview.reviewId,previewSha256:followPreview.previewSha256,displayed:true}
 const nextCopy=await api(nextPath+'/copies',{...nextPage,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
 for(let n=1;n<=4;n++)await api(nextPath+'/page',{...nextPage,documentKey:'source',page:n})
 await api(nextPath+'/page',{...nextPage,documentKey:'supplement',page:1})
 for(const previous of followPreview.previousSupplements)await api(nextPath+'/page',{...nextPage,documentKey:previous.documentKey,page:1})
 for(let n=1;n<=2;n++)await api(nextPath+'/copy-page',{...nextPage,copyId:nextCopy.id,page:n})
 const nextRequest={...nextPage,requestKey:randomUUID(),signature:'Reviewer Alice',attestation:followPreview.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{...findings.examination,copyIds:[nextCopy.id]}}
 await assert.rejects(()=>api(nextPath+'/sign',nextRequest),/409.*prior receipt amendment page/)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_supplement_signature WHERE compliance_task_id=$1',[nextTask])).rows[0].count),0)
 await api(nextPath+'/page',{...nextPage,documentKey:retainedPart.documentKey,page:1})
 await assert.rejects(()=>api(nextPath+'/sign',nextRequest),/409.*prior receipt amendment page/)
 await api(nextPath+'/page',{...nextPage,documentKey:retainedPart.documentKey,page:2})
 const yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10)
 await assert.rejects(()=>api(nextPath+'/sign',{...nextRequest,examination:{...nextRequest.examination,examinedOn:yesterday}}),/400.*actual examination date/)
 const nextSigned=await api(nextPath+'/sign',nextRequest)
 assert.equal(nextSigned.status,'COMPLETE')
 assert.deepEqual(await api(nextPath+'/sign',nextRequest),nextSigned)
 assert.deepEqual(await api(path+'/sign',request),signedReplacement)
 const nextEvidenceRow=(await h.pool.query('SELECT * FROM payroll_i9_supplement_signature WHERE id=$1',[nextSigned.signatureId])).rows[0]
 const nextEvidence=JSON.parse(decryptDocument(nextEvidenceRow.encrypted_evidence,`i9-supplement-signature:1:${employee.id}:${nextTask}:99`).toString())
 assert.equal(nextEvidence.reviewedReceiptHistory.find(p=>p.documentKey===retainedPart.documentKey).sha256,saved.content_sha256)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[nextTask])).rows[0].status,'COMPLETE')
 assert.equal((await i9EmployerRecords(h.pool,ctx)).records[0].differentSupplements.length,1)

 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_supplement_signature WHERE id=$1',[signedReplacement.signatureId]),/immutable/)
})
