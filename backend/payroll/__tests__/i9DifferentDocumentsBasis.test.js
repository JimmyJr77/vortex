import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {receiptFixture} from '../testing/receiptFixture.js'
import {i9DifferentDocumentsBasis,prepareI9DifferentDocuments} from '../i9DifferentDocumentsBasis.js'
import {encryptDocument,decryptDocument} from '../onboarding.js'
const hash=b=>createHash('sha256').update(b).digest('hex')
test('different-document preparation binds the original employee and employer records',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='94'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {employee,signed}=await receiptFixture(h)
 const task=(await h.pool.query('SELECT compliance_task_id FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0].compliance_task_id
 const ctx={facility:1,employee:employee.id,admin:99}
 const db=await h.pool.connect()
 await db.query('BEGIN')
 try{
  const current=await i9DifferentDocumentsBasis(db,ctx,task)
  assert.equal(current.employeeSource.sha256,hash(current.employeeSource.bytes))
  assert.notEqual(current.employeeSource.sha256,current.row.content_sha256)
  const before=Buffer.from(current.employeeSource.bytes)
  const doc={title:'Synthetic document',issuingAuthority:'Synthetic issuer',number:'SYNTHETIC-123',expiresOn:'2030-09-12'}
  const body={signatureId:signed.signatureId,reason:'Employee selected different acceptable replacement documents.',initials:'RA',section2:{...current.originalSection2,listA:undefined,documentChoice:'LIST_B_C',listB:doc,listC:doc}}
  const prepared=await prepareI9DifferentDocuments(db,ctx,task,body)
  assert.equal(prepared.current.basisHash,current.basisHash)
  assert.equal(prepared.previewSha256,hash(prepared.pdf))
  assert.deepEqual(prepared.current.employeeSource.bytes,before)
  assert.equal((await PDFDocument.load(prepared.pdf)).getPageCount(),prepared.pageCount)
  assert.equal((await PDFDocument.load(prepared.pdf)).getForm().getTextField('Signature of Employee').getText()||'','')
  for(const extra of [{originalEmployerSha256:'a'.repeat(64)},{recordedOn:'2020-01-01'},{pdfBase64:'fake'}])await assert.rejects(()=>prepareI9DifferentDocuments(db,ctx,task,{...body,...extra}),e=>e.status===400)
  await assert.rejects(()=>prepareI9DifferentDocuments(db,ctx,task,{...body,signatureId:'99999'}),e=>e.status===409)
  await assert.rejects(()=>prepareI9DifferentDocuments(db,ctx,task,{...body,section2:{...body.section2,firstDayEmployed:'2020-01-01'}}),e=>e.status===409)
  await assert.rejects(()=>i9DifferentDocumentsBasis(db,{...ctx,facility:2},task),e=>e.status===404)
  await assert.rejects(()=>i9DifferentDocumentsBasis(db,{...ctx,employee:'99999'},task),e=>e.status===404)
  // Alter query results only: immutable production records remain untouched.
  const corrupted={query:async(sql,args)=>{
   const result=await db.query(sql,args)
   if(sql.includes('SELECT s.*,d.encrypted_content')&&result.rows[0])result.rows[0]={...result.rows[0],content_sha256:'a'.repeat(64)}
   return result
  }}
  await assert.rejects(()=>i9DifferentDocumentsBasis(corrupted,ctx,task),/employee I-9 failed/)
  const mismatched={query:async(sql,args)=>{
   const result=await db.query(sql,args)
   if(sql.startsWith('SELECT * FROM payroll_i9_employer_review')&&result.rows[0]){
    const row={...result.rows[0]},aad=`i9-employer-review:1:${employee.id}:${current.row.task_id}:${current.row.onboarding_cycle}:${row.actor_user_id}`
    const evidence=JSON.parse(decryptDocument(row.encrypted_review,aad).toString());evidence.sourceDocumentId='99999'
    row.encrypted_review=encryptDocument(Buffer.from(JSON.stringify(evidence)),aad);result.rows[0]=row
   }
   return result
  }}
  await assert.rejects(()=>i9DifferentDocumentsBasis(mismatched,ctx,task),/employee-source integrity/)
 }finally{await db.query('ROLLBACK');db.release()}
})
