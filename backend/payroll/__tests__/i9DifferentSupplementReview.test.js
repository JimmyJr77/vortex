import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {supplementReceiptFixture} from '../testing/supplementReceiptFixture.js'
import {currentI9DifferentSupplementReview} from '../i9DifferentSupplementReview.js'
test('Supplement B replacement retains encrypted scoped packets and immutable current page reviews',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee,signed,receipt,receiptTaskId}=await supplementReceiptFixture(h),ctx={facility:1,employee:employee.id,admin:99}
 const path=`/employees/${employee.id}/i9/different-supplement/${receiptTaskId}`
 const body={signatureId:signed.signatureId,initials:'RA',reason:'Employee selected a different acceptable authorization document.',supplement:{edition:'01/20/25',document:{list:'C',title:'Synthetic replacement authorization',number:'SYNTHETIC-C',expiresOn:'2032-01-01'},representativeName:'Reviewer Alice',examinationMethod:'PHYSICAL',additionalInformation:''}}
 const review=await api(path+'/preview',body),page={reviewId:review.reviewId,previewSha256:review.previewSha256,displayed:true}
 assert.equal(String(review.receiptSignatureId),String(receipt.signatureId))
 assert.deepEqual(review.packet.map(p=>[p.documentKey,p.pageCount]),[['replacement',2],['source',4],['employee',4],[`prior:${receipt.signatureId}`,1]])
 const retained=(await h.pool.query('SELECT * FROM payroll_i9_different_supplement_review WHERE id=$1',[review.reviewId])).rows[0]
 assert.equal(retained.encrypted_review.includes(Buffer.from(body.reason)),false)
 assert.equal((await currentI9DifferentSupplementReview(h.pool,ctx,receiptTaskId,page)).retained.answers.supplement.document.number,'SYNTHETIC-C')
 await assert.rejects(()=>currentI9DifferentSupplementReview(h.pool,{...ctx,admin:100},receiptTaskId,page),/expired or its source changed/)
 await assert.rejects(()=>api(path+'/page',{...page,documentKey:'replacement',page:3}),/400/)
 await assert.rejects(()=>api(path+'/page',{...page,documentKey:'unknown',page:1}),/400/)
 await assert.rejects(()=>api(path+'/page',{...page,displayed:false,documentKey:'replacement',page:1}),/400/)
 for(const part of review.packet)for(let n=1;n<=part.pageCount;n++)await api(path+'/page',{...page,documentKey:part.documentKey,page:n})
 await api(path+'/page',{...page,documentKey:'replacement',page:1})
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_page_visit WHERE review_id=$1',[review.reviewId])).rows[0].count),11)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_supplement_page_visit WHERE review_id=$1',[review.reviewId]),/immutable/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_different_supplement_review SET basis_hash=$2 WHERE id=$1',[review.reviewId,'0'.repeat(64)]),/immutable/)
 const next=await api(path+'/preview',body),nextPage={...page,reviewId:next.reviewId,previewSha256:next.previewSha256}
 await assert.rejects(()=>api(path+'/page',{...page,documentKey:'replacement',page:1}),/409/)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_page_visit WHERE review_id=$1',[next.reviewId])).rows[0].count),0)
 const damaged={query:async(sql,args)=>{const result=await h.pool.query(sql,args);if(sql.startsWith('SELECT *,expires_at'))result.rows=result.rows.map(row=>({...row,page_counts:{...row.page_counts,replacement:3}}));return result}}
 await assert.rejects(()=>currentI9DifferentSupplementReview(damaged,ctx,receiptTaskId,nextPage),/integrity check/)
 const expired={query:async(sql,args)=>{const result=await h.pool.query(sql,args);if(sql.startsWith('SELECT *,expires_at'))result.rows=result.rows.map(row=>({...row,unexpired:false}));return result}}
 await assert.rejects(()=>currentI9DifferentSupplementReview(expired,ctx,receiptTaskId,nextPage),/expired/)
 await h.pool.query("UPDATE payroll_compliance_task SET status='IN_PROGRESS' WHERE id=$1",[receiptTaskId])
 await assert.rejects(()=>api(path+'/page',{...nextPage,documentKey:'replacement',page:1}),/409/)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_review')).rows[0].count),2)
})
