import {randomUUID} from 'node:crypto'
import {syntheticI9CopyPdf} from '../testing/employerI9ReviewFixture.js'
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
 const initial=await api(path+'/context')
 assert.equal(String(initial.signatureId),String(signed.signatureId))
 assert.equal(initial.sourceKind,'SECTION2');assert.equal(initial.rowKey,'A1')
 assert.equal(initial.employerDefaults.firstDayEmployed,current.originalSection2.firstDayEmployed)
 assert.deepEqual(Object.keys(initial.employerDefaults).sort(),['businessAddress','businessName','firstDayEmployed'])
 assert.match(initial.today,/^\d{4}-\d{2}-\d{2}$/)
 const scoped=await fetch(`${h.url}/api/admin/payroll${path}/context`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})
 assert.equal(scoped.status,404)
 const response=await fetch(`${h.url}/api/admin/payroll${path}/context`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(response.headers.get('cache-control'),'no-store')
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
 const upload={...page,rowKey:'B',requestKey:randomUUID(),filename:'PRIVATE-ID.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')}
 await api(path+'/copies',{...upload,rowKey:'A1'},'POST',400)
 await api(path+'/copies',{...upload,contentBase64:Buffer.from('%PDF-invalid').toString('base64')},'POST',400)
 const documentsBefore=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await h.pool.query(`CREATE FUNCTION reject_different_copy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_DIFFERENT_COPY_RETAINED' THEN RAISE EXCEPTION 'Synthetic copy audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_different_copy_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_different_copy_audit()`)
 await api(path+'/copies',upload,'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,documentsBefore)
 await h.pool.query('DROP TRIGGER reject_different_copy_audit ON payroll_audit_log')
 const [copy,retry]=await Promise.all([api(path+'/copies',upload),api(path+'/copies',upload)])
 assert.deepEqual(copy,retry)
 assert.equal(copy.pageCount,2)
 await api(path+'/copies',{...upload,rowKey:'C'},'POST',409)
 const view={...page,rowKey:'B',copyId:copy.id}
 const viewed=await api(path+'/copy',view)
 assert.equal(viewed.contentBase64,upload.contentBase64)
 assert.equal(viewed.filename.includes('PRIVATE'),false)
 const privateRow=(await h.pool.query('SELECT d.encrypted_content FROM payroll_i9_different_copy c JOIN payroll_private_document d ON d.id=c.document_id WHERE c.id=$1',[copy.id])).rows[0]
 assert.equal(privateRow.encrypted_content.includes(Buffer.from('%PDF')),false)
 await api(path+'/copy',{...view,rowKey:'C'},'POST',404)
 await api(path+'/copy-page',{...view,page:3},'POST',400)
 for(let n=1;n<=2;n++)await api(path+'/copy-page',{...view,page:n})
 await api(path+'/copy-page',view)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_different_copy_page')).rowCount,2)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_copy'),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_copy_page'),/immutable/)
 const query=new URLSearchParams({reviewId:page.reviewId,previewSha256:page.previewSha256,rowKey:'B'})
 assert.equal((await api(path+'/copies?'+query)).copies.length,1)
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
 const refreshed={...view,reviewId:second.reviewId,previewSha256:second.previewSha256}
 assert.equal((await api(path+'/copy',refreshed)).contentBase64,upload.contentBase64)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_different_copy_page WHERE review_id=$1',[second.reviewId])).rowCount,0)
 await api(path+'/copy-page',view,'POST',409)
 await api(path+'/copy-page',refreshed)
 await api(path+'/page',valid)
 const changed=await api(path+'/preview',{...body,section2:{...body.section2,listB:{...doc,number:'CHANGED'}}})
 await api(path+'/copy',{...view,reviewId:changed.reviewId,previewSha256:changed.previewSha256},'POST',404)
 const listA=await api(path+'/preview',{...body,section2:{...body.section2,documentChoice:'LIST_A',listB:undefined,listC:undefined,listA:[doc,doc,doc]}})
 for(const rowKey of ['A1','A2','A3']){
  const key={...page,reviewId:listA.reviewId,previewSha256:listA.previewSha256,rowKey}
  const saved=await api(path+'/copies',{...upload,...key,requestKey:randomUUID()})
  assert.equal((await api(path+'/copy',{...key,copyId:saved.id})).pageCount,2)
  await api(path+'/copy',{...key,rowKey:rowKey==='A1'?'A2':'A1',copyId:saved.id},'POST',404)
 }
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[task])).rows[0].status,'OPEN')
})
