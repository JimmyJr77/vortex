import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {supplementReceiptFixture} from '../testing/supplementReceiptFixture.js'
import {receiptFixture} from '../testing/receiptFixture.js'
import {i9DifferentSupplementBasis,prepareI9DifferentSupplement} from '../i9DifferentSupplementBasis.js'
test('replacement Supplement B preparation binds the exact current signed receipt and employer source',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const fixture=await supplementReceiptFixture(h),{api,employee,signed,receipt,receiptTaskId,today}=fixture,ctx={facility:1,employee:employee.id,admin:99}
 const before=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[receipt.documentId])).rows[0]
 const current=await i9DifferentSupplementBasis(h.pool,ctx,receiptTaskId)
 assert.equal(current.receiptSignatureId,String(receipt.signatureId))
 assert.equal(String(current.receipt.documentId),String(receipt.documentId))
 const path=`/employees/${employee.id}/i9/different-supplement/${receiptTaskId}/context`,context=await api(path)
 assert.equal(context.sourceKind,'SUPPLEMENT_B');assert.equal(context.today,today);assert.equal(context.originalExaminedOn,today)
 assert.equal(String(context.receiptSignatureId),String(receipt.signatureId))
 const response=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(response.headers.get('cache-control'),'no-store')
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})
 assert.equal(foreign.status,404)
 const body={signatureId:signed.signatureId,initials:'RA',reason:'Employee selected a different acceptable authorization document.',supplement:{edition:'01/20/25',document:{list:'C',title:'Synthetic replacement authorization',number:'SYNTHETIC-C',expiresOn:'2032-01-01'},representativeName:'Reviewer Alice',examinationMethod:'PHYSICAL',additionalInformation:''}}
 const rendered=await prepareI9DifferentSupplement(h.pool,ctx,receiptTaskId,body)
 assert.equal(rendered.recordedOn,today);assert.equal(rendered.pageCount,2)
 assert.equal(rendered.sourceEmployerSha256,current.row.content_sha256)
 assert.equal(rendered.sourceSupplementSha256,before.content_sha256)
 await assert.rejects(()=>prepareI9DifferentSupplement(h.pool,ctx,receiptTaskId,{...body,recordedOn:'2020-01-01'}),e=>e.status===400)
 await assert.rejects(()=>prepareI9DifferentSupplement(h.pool,ctx,receiptTaskId,{...body,signatureId:'999999'}),e=>e.status===409)
 const initialHarness=await createHarness();t.after(()=>initialHarness.close())
 const first=await receiptFixture(initialHarness),initialTask=(await initialHarness.pool.query('SELECT compliance_task_id FROM payroll_i9_signature_followup WHERE signature_id=$1',[first.signed.signatureId])).rows[0].compliance_task_id
 await assert.rejects(()=>i9DifferentSupplementBasis(initialHarness.pool,{...ctx,employee:first.employee.id},initialTask),/new Section 2/)
 await h.pool.query("UPDATE payroll_compliance_task SET status='IN_PROGRESS' WHERE id=$1",[receiptTaskId])
 assert.notEqual((await i9DifferentSupplementBasis(h.pool,ctx,receiptTaskId)).basisHash,current.basisHash)
 const changed={query:async(sql,args)=>{const result=await h.pool.query(sql,args);if(sql.includes('s.*,d.content_sha256,d.encrypted_content,d.task_id')&&sql.includes('payroll_i9_supplement_signature'))result.rows=result.rows.map(row=>({...row,content_sha256:'0'.repeat(64)}));return result}}
 await assert.rejects(()=>i9DifferentSupplementBasis(changed,ctx,receiptTaskId),/integrity check/)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[receipt.documentId])).rows[0],before)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[receiptTaskId])).rows[0].status,'IN_PROGRESS')
})
