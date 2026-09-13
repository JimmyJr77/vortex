import test from 'node:test'
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {PDFDocument,PDFName} from 'pdf-lib'
import {renderI9Section1Preview} from '../i9Section1Pdf.js'
import {signI9Section1Pdf} from '../i9SignaturePdf.js'
import {renderI9DifferentDocumentsPreview,signI9DifferentDocumentsPdf} from '../i9DifferentDocumentsPdf.js'
async function source(){
 const preview=await renderI9Section1Preview({answers:{edition:'01/20/25',personal:{lastName:'Żółć',firstName:'Łukasz',address:'100 Synthetic Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29'},attestation:{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'2027-09-12',identifier:{kind:'A_NUMBER',number:'123456789'}},ssnPending:false,preparerAssisted:false},context:{today:'2026-09-12',offerAccepted:true,eVerify:false}})
 const signed=await signI9Section1Pdf(preview,{signature:'Łukasz Żółć',signedOn:'2026-09-12'})
 return signed
}

const doc={title:'Synthetic document',issuingAuthority:'Synthetic issuer',number:'SYNTHETIC-123',expiresOn:'2030-09-12'}
const input={reason:'Employee selected other acceptable documentation after replacement delivery delays.',initials:'AR',recordedOn:'2026-09-13',originalEmployerSha256:'a'.repeat(64),section2:{edition:'01/20/25',documentChoice:'LIST_B_C',listB:doc,listC:doc,examinationMethod:'PHYSICAL',firstDayEmployed:'2026-09-12',representativeNameAndTitle:'Alice Reviewer, Hiring Administrator',businessName:'Synthetic Employer',businessAddress:'20 Example Road, Bowie, MD 20715',additionalInformation:''}}
test('new Section 2 keeps employee identity without copying old signatures or unrelated attestations',async()=>{
 const original=await source(),unchanged=Buffer.from(original),preview=await renderI9DifferentDocumentsPreview(original,input)
 assert.deepEqual(original,unchanged)
 const pdf=await PDFDocument.load(preview.pdf),form=pdf.getForm()
 assert.equal(pdf.getPageCount(),2)
 assert.equal(form.getTextField('First Name Given Name').getText(),'Łukasz')
 assert.equal(form.getTextField('Last Name (Family Name)').getText(),'Żółć')
 for(const name of ['Signature of Employee',"Today's Date mmddyyy",'Signature of Employer or AR','S2 Todays Date mmddyyyy','Address Street Number and Name'])assert.equal(form.getTextField(name).getText()||'','')
 assert.equal(form.getTextField('List B Document Number 1').getText(),'SYNTHETIC-123')
 assert.match(form.getTextField('Additional Information').getText(),/attached explanation starting on page 2/)
 for(const f of form.getFields())for(const w of f.acroField.getWidgets())assert.equal(w.dict.get(PDFName.of('P')).toString(),pdf.getPage(0).ref.toString())
 const signed=await signI9DifferentDocumentsPdf(preview.pdf,{signature:'Alice Reviewer',signedOn:'2026-09-13',pageCount:preview.pageCount}),result=(await PDFDocument.load(signed)).getForm()
 assert.equal(result.getTextField('Signature of Employee').getText()||'','')
 assert.equal(result.getTextField('Signature of Employer or AR').getText(),'Alice Reviewer')
 for(const f of form.getFields())if(!['Signature of Employer or AR','S2 Todays Date mmddyyyy'].includes(f.getName()))assert.equal(result.getField(f.getName()).acroField.dict.get(PDFName.of('V'))?.toString(),f.acroField.dict.get(PDFName.of('V'))?.toString())
 await assert.rejects(()=>signI9DifferentDocumentsPdf(signed,{signature:'Other',signedOn:'2026-09-14',pageCount:preview.pageCount}),/already contains/)
 await writeFile('/tmp/payroll-i9-different-documents-signed.pdf',signed)
})
test('different-document attachment supports multi-row List A and alternative checkbox',async()=>{
 const original=await source(),section2={...input.section2,documentChoice:'LIST_A',listB:undefined,listC:undefined,listA:[doc,doc,doc],examinationMethod:'ALTERNATIVE'}
 const preview=await renderI9DifferentDocumentsPreview(original,{...input,section2}),form=(await PDFDocument.load(preview.pdf)).getForm()
 assert.equal(form.getCheckBox('CB_Alt').isChecked(),true)
 assert.equal(form.getTextField('List A.  Document 3 Number.  If any').getText(),'SYNTHETIC-123')
 for(const raw of [{...input,recordedOn:'2026-02-30'},{...input,reason:'yes'},{...input,signature:'Alice'},{...input,originalEmployerSha256:'bad'}])await assert.rejects(()=>renderI9DifferentDocumentsPreview(original,raw),e=>e.status===400)
})

test('long explanations and employer notes paginate without dropping text or allowing incomplete signing',async()=>{
 const original=await source(),reason='Detailed replacement reason. '.repeat(17),additionalInformation='UnbrokenReference'+ 'X'.repeat(960)
 const preview=await renderI9DifferentDocumentsPreview(original,{...input,reason,section2:{...input.section2,additionalInformation}})
 assert.ok(preview.pageCount>=2)
 const options={signature:'Alice Reviewer',signedOn:'2026-09-13',pageCount:preview.pageCount}
 await assert.rejects(()=>signI9DifferentDocumentsPdf(preview.pdf,{...options,pageCount:preview.pageCount-1}),e=>e.status===400)
 await assert.rejects(()=>signI9DifferentDocumentsPdf(preview.pdf,{...options,pageCount:undefined}),e=>e.status===400)
 const signed=await signI9DifferentDocumentsPdf(preview.pdf,options)
 assert.equal((await PDFDocument.load(signed)).getPageCount(),preview.pageCount)
 await writeFile('/tmp/payroll-i9-different-documents-long.pdf',signed)
})
