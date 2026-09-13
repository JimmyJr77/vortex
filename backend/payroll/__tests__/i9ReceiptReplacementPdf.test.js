import test from 'node:test'
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {PDFDocument,PDFName} from 'pdf-lib'
import {renderI9Section1Preview} from '../i9Section1Pdf.js'
import {signI9Section1Pdf,signRetainedPayrollForm} from '../i9SignaturePdf.js'
import {renderI9Section2Preview} from '../i9Section2Pdf.js'
import {renderI9SupplementBPreview,signI9SupplementBPdf} from '../i9SupplementBPdf.js'
import {i9ReceiptReplacementInput,renderI9ReceiptReplacementPreview,signI9ReceiptReplacementPdf,RECEIPT_SIGNATURE_FIELD,RECEIPT_DATE_FIELD} from '../i9ReceiptReplacementPdf.js'
async function source(overrides={}){
 const preview=await renderI9Section1Preview({answers:{edition:'01/20/25',personal:{lastName:'Żółć',firstName:'Łukasz',address:'100 Synthetic Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29'},attestation:{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'2027-09-12',identifier:{kind:'A_NUMBER',number:'123456789'}},ssnPending:false,preparerAssisted:false},context:{today:'2026-09-12',offerAccepted:true,eVerify:false}})
 const signed=await signI9Section1Pdf(preview,{signature:'Łukasz Żółć',signedOn:'2026-09-12'})
 const employer=await renderI9Section2Preview(signed,{edition:'01/20/25',documentChoice:'LIST_A',listA:[{title:'Employment Authorization Document receipt',issuingAuthority:'USCIS',number:'SYNTHETIC123',expiresOn:'2030-09-12'}],examinationMethod:'PHYSICAL',firstDayEmployed:'2026-09-12',representativeNameAndTitle:'Alice Reviewer, Hiring Administrator',businessName:'Synthetic Employer',businessAddress:'20 Example Road, Bowie, MD 20715',additionalInformation:'AR 09/12/2026: Original receipt examination notes.',...overrides})
 return signRetainedPayrollForm(employer,{signature:'Alice Reviewer',signedOn:'2026-09-12',signatureField:'Signature of Employer or AR',dateField:'S2 Todays Date mmddyyyy',pageCount:4,title:'Synthetic I-9 source'})
}

const input={sourceKind:'SECTION2',rowKey:'A1',replacementKind:'ACTUAL_REPLACEMENT',replacement:{title:'Employment Authorization Document',issuingAuthority:'USCIS',number:'SYNTHETIC456',expiresOn:'2030-09-12'},examinerName:'Alice Reviewer',initials:'AR',amendedOn:'2026-09-13',explanation:'Actual replacement for the lost document receipt examined on September 12.'}
test('receipt amendment input rejects unsupported branches and invalid entries',()=>{
 assert.equal(i9ReceiptReplacementInput(input).rowKey,'A1')
 for(const bad of [{...input,rowKey:'SUPPLEMENT'},{...input,replacementKind:'DIFFERENT_DOCUMENTS'},{...input,amendedOn:'2026-02-30'},{...input,signature:'Alice'},{...input,replacement:{...input.replacement,title:''}}])assert.throws(()=>i9ReceiptReplacementInput(bad),e=>e.status===400)
})
test('actual replacement preserves source certifications and signs only a distinct amendment',async()=>{
 const original=await source(),unchanged=Buffer.from(original),old=(await PDFDocument.load(original)).getForm()
 const preview=await renderI9ReceiptReplacementPreview(original,input)
 assert.deepEqual(original,unchanged)
 assert.equal(preview.markedReceiptWords,1)
 assert.equal(preview.pageCount,5)
 const pdf=await PDFDocument.load(preview.pdf),form=pdf.getForm()
 assert.equal(form.getTextField(RECEIPT_SIGNATURE_FIELD).getText()||'','')
 for(const field of old.getFields())if(field.getName()!=='Additional Information')assert.equal(form.getField(field.getName()).acroField.dict.get(PDFName.of('V'))?.toString(),field.acroField.dict.get(PDFName.of('V'))?.toString())
 const signed=await signI9ReceiptReplacementPdf(preview.pdf,{signature:'Alice Reviewer',signedOn:'2026-09-13',pageCount:preview.pageCount})
 const saved=(await PDFDocument.load(signed)).getForm()
 assert.equal(saved.getTextField(RECEIPT_SIGNATURE_FIELD).getText(),'Alice Reviewer')
 for(const field of form.getFields())if(![RECEIPT_SIGNATURE_FIELD,RECEIPT_DATE_FIELD].includes(field.getName()))assert.equal(saved.getField(field.getName()).acroField.dict.get(PDFName.of('V'))?.toString(),field.acroField.dict.get(PDFName.of('V'))?.toString())
 await assert.rejects(()=>signI9ReceiptReplacementPdf(signed,{signature:'Other',signedOn:'2026-09-14',pageCount:preview.pageCount}),/already contains/)
 await assert.rejects(()=>renderI9ReceiptReplacementPreview(signed,input),/original retained/)
 await assert.rejects(()=>renderI9ReceiptReplacementPreview(original,{...input,rowKey:'B'}),/no receipt marker/)
 await writeFile('/tmp/payroll-i9-receipt-replacement-signed.pdf',signed)
})
test('Supplement B receipt replacement retains its own certification and paginates long evidence',async()=>{
 const original=await source()
 const supplement=await renderI9SupplementBPreview(original,{edition:'01/20/25',document:{list:'A',title:'Employment Authorization Document receipt',number:'SYNTHETIC123',expiresOn:'2030-09-12'},representativeName:'Alice Reviewer',examinationMethod:'PHYSICAL',additionalInformation:'AR: Prior receipt notation.'})
 const signed=await signI9SupplementBPdf(supplement,{signature:'Alice Reviewer',signedOn:'2026-09-13'})
 const preview=await renderI9ReceiptReplacementPreview(signed,{...input,sourceKind:'SUPPLEMENT_B',rowKey:'SUPPLEMENT',explanation:'Synthetic receipt replacement evidence. '.repeat(50)})
 assert.ok(preview.pageCount>=3)
 const pdf=await PDFDocument.load(preview.pdf)
 assert.equal(pdf.getForm().getTextField('Signature of Emp Rep 0').getText(),'Alice Reviewer')
 assert.equal(pdf.getForm().getTextField(RECEIPT_SIGNATURE_FIELD).acroField.getWidgets()[0].dict.get(PDFName.of('P')).toString(),pdf.getPages().at(-1).ref.toString())
 await writeFile('/tmp/payroll-i9-receipt-supplement-preview.pdf',preview.pdf)
})

test('each additional Section 2 receipt row supports the same isolated amendment',async()=>{
 const doc={title:'Synthetic document',issuingAuthority:'Synthetic issuer',number:'SYNTHETIC',expiresOn:'2030-09-12'}
 for(const rowKey of ['A2','A3','B','C']){
  const receipt={...doc,number:'receipt SYNTHETIC'}
  const overrides=rowKey.startsWith('A')?{listA:Array.from({length:Number(rowKey[1])},(_,i)=>i===Number(rowKey[1])-1?receipt:doc)}:{documentChoice:'LIST_B_C',listA:undefined,listB:rowKey==='B'?receipt:doc,listC:rowKey==='C'?receipt:doc}
  const original=await source(overrides),preview=await renderI9ReceiptReplacementPreview(original,{...input,rowKey})
  assert.equal(preview.markedReceiptWords,1,rowKey)
  assert.equal(preview.pageCount,5,rowKey)
 }
})
