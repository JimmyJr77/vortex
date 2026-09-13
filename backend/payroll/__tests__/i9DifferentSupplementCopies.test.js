import {reviewedI9DifferentSupplementExamination} from '../i9DifferentSupplementExamination.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {supplementReceiptFixture} from '../testing/supplementReceiptFixture.js'
import {currentI9DifferentSupplementCopy} from '../i9DifferentSupplementCopies.js'
test('Supplement B replacement copies survive retries and require fresh document-bound page review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
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
 const damaged={query:async(sql,args)=>{const result=await h.pool.query(sql,args);if(sql.startsWith('SELECT c.*,d.encrypted_content'))result.rows=result.rows.map(row=>({...row,content_sha256:'0'.repeat(64)}));return result}}
 await assert.rejects(()=>currentI9DifferentSupplementCopy(damaged,ctx,receiptTaskId,selected),/integrity check/)
 const fresh=await api(path+'/preview',body),freshPage={...page,reviewId:fresh.reviewId,previewSha256:fresh.previewSha256}
 assert.equal((await api(path+'/copies/list',freshPage)).copies.length,1)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_copy_page WHERE review_id=$1',[fresh.reviewId])).rows[0].count),0)
 await assert.rejects(()=>api(path+'/copy',selected),/409/)
 await api(path+'/copy-page',{...freshPage,copyId:copy.id,page:1})
 for(const part of fresh.packet)for(let n=1;n<=part.pageCount;n++)await api(path+'/page',{...freshPage,documentKey:part.documentKey,page:n})
 await assert.rejects(()=>reviewedI9DifferentSupplementExamination(h.pool,ctx,receiptTaskId,{...freshPage,findings}),/every page of each selected replacement copy/)
 const changed=await api(path+'/preview',{...body,supplement:{...body.supplement,document:{...body.supplement.document,number:'DIFFERENT'}}}),changedPage={...page,reviewId:changed.reviewId,previewSha256:changed.previewSha256}
 assert.equal((await api(path+'/copies/list',changedPage)).copies.length,0)
 await assert.rejects(()=>api(path+'/copy',{...changedPage,copyId:copy.id}),/404/)
 await assert.rejects(()=>api(path+'/copies',{...upload,...changedPage}),/409/)
 const before=Number((await h.pool.query('SELECT count(*) FROM payroll_private_document')).rows[0].count)
 await h.pool.query("CREATE FUNCTION reject_supplement_copy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_DIFFERENT_SUPPLEMENT_COPY_RETAINED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_supplement_copy_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_supplement_copy_audit()")
 await assert.rejects(()=>api(path+'/copies',{...upload,...changedPage,requestKey:randomUUID()}),/500/)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_private_document')).rows[0].count),before)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_copy')).rows[0].count),1)
})
