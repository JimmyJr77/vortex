import test from 'node:test'
import assert from 'node:assert/strict'
import {encryptDocument,decryptDocument} from '../onboarding.js'
import {createHarness} from '../testing/harness.js'
import {receiptFixture} from '../testing/receiptFixture.js'
import {i9DifferentDocumentsBasis} from '../i9DifferentDocumentsBasis.js'
import {currentI9DifferentDocumentsReview} from '../i9DifferentDocumentsReview.js'
test('different-document reviews retain scoped encrypted packets and immutable current page visits',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee,signed}=await receiptFixture(h),ctx={facility:1,employee:employee.id,admin:99}
 const task=(await h.pool.query('SELECT compliance_task_id FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0].compliance_task_id
 const current=await i9DifferentDocumentsBasis(h.pool,ctx,task)
 const doc={title:'Synthetic document',issuingAuthority:'Synthetic issuer',number:'PRIVATE-REPLACEMENT',expiresOn:'2030-09-12'}
 const body={signatureId:signed.signatureId,reason:'Employee selected different acceptable replacement documents.',initials:'RA',section2:{...current.originalSection2,listA:undefined,documentChoice:'LIST_B_C',listB:doc,listC:doc}}
 const path=`/employees/${employee.id}/i9/different-documents/${task}`
 await h.pool.query(`CREATE FUNCTION reject_different_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_DIFFERENT_PREVIEW_CREATED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_different_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_different_audit()`)
 await api(path+'/preview',body,'POST',500)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_different_review')).rowCount,0)
 await h.pool.query('DROP TRIGGER reject_different_audit ON payroll_audit_log')
 const review=await api(path+'/preview',body),page={reviewId:review.reviewId,previewSha256:review.previewSha256,documentKey:'replacement',page:1,displayed:true}
 assert.deepEqual(review.packet.map(p=>[p.documentKey,p.pageCount]),[['replacement',2],['source',4],['employee',4]])
 const stored=(await h.pool.query('SELECT * FROM payroll_i9_different_review')).rows[0]
 assert.equal(stored.encrypted_review.includes(Buffer.from('PRIVATE-REPLACEMENT')),false)
 for(const sql of ['DELETE FROM payroll_i9_different_review','UPDATE payroll_i9_different_review SET actor_user_id=100'])await assert.rejects(()=>h.pool.query(sql),/immutable/)
 await api(path+'/page',{...page,documentKey:'__proto__'},'POST',400)
 await api(path+'/page',{...page,page:3},'POST',400)
 await api(path+'/page',{...page,displayed:false},'POST',400)
 await api(path+'/page',{...page,previewSha256:'a'.repeat(64)},'POST',409)
 await assert.rejects(()=>currentI9DifferentDocumentsReview(h.pool,{...ctx,admin:100},task,page),e=>e.status===409)
 for(const p of review.packet)for(let n=1;n<=p.pageCount;n++)await api(path+'/page',{...page,documentKey:p.documentKey,page:n})
 await api(path+'/page',page)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_different_page_visit')).rowCount,10)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_page_visit'),/immutable/)
 await assert.rejects(()=>h.pool.query("INSERT INTO payroll_i9_different_page_visit VALUES($1,'source',5,clock_timestamp())",[review.reviewId]),/valid page/)
 const second=await api(path+'/preview',body)
 await api(path+'/page',page,'POST',409)
 await assert.rejects(()=>h.pool.query("INSERT INTO payroll_i9_different_page_visit VALUES($1,'replacement',2,clock_timestamp()) ON CONFLICT DO NOTHING",[review.reviewId]),/valid page/)
 const valid={...page,reviewId:second.reviewId,previewSha256:second.previewSha256}
 const expired={query:async(sql,args)=>{const result=await h.pool.query(sql,args);if(sql.includes('AS unexpired')&&result.rows[0])result.rows[0]={...result.rows[0],unexpired:false};return result}}
 await assert.rejects(()=>currentI9DifferentDocumentsReview(expired,ctx,task,valid),/expired/)
 for(const mutation of [packet=>packet.pop(),packet=>{packet[0].pdfBase64=Buffer.from('tampered').toString('base64')},packet=>{packet[1].documentId='99999'}]){
  const altered={query:async(sql,args)=>{
   const result=await h.pool.query(sql,args)
   if(sql.includes('AS unexpired')&&result.rows[0]){
    const row={...result.rows[0]},key=`i9-different-review:1:${employee.id}:${task}:99`
    const retained=JSON.parse(decryptDocument(row.encrypted_review,key).toString());mutation(retained.packet)
    row.encrypted_review=encryptDocument(Buffer.from(JSON.stringify(retained)),key);result.rows[0]=row
   }
   return result
  }}
  await assert.rejects(()=>currentI9DifferentDocumentsReview(altered,ctx,task,valid),/incomplete|integrity/)
 }
 await api(path+'/page',valid)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[task])).rows[0].status,'OPEN')
})
