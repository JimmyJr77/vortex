import test from 'node:test'
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {PDFDocument,PDFName} from 'pdf-lib'
import {renderI9Section1Preview} from '../i9Section1Pdf.js'
import {signI9Section1Pdf,signRetainedPayrollForm} from '../i9SignaturePdf.js'
import {renderI9Section2Preview} from '../i9Section2Pdf.js'
import {renderI9SupplementBPreview,signI9SupplementBPdf} from '../i9SupplementBPdf.js'
import {renderI9DifferentSupplementPreview,signI9DifferentSupplementPdf} from '../i9DifferentSupplementPdf.js'
async function source(){
 const preview=await renderI9Section1Preview({answers:{edition:'01/20/25',personal:{lastName:'Żółć',firstName:'Łukasz',address:'100 Synthetic Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29'},attestation:{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'2027-09-12',identifier:{kind:'A_NUMBER',number:'123456789'}},ssnPending:false,preparerAssisted:false},context:{today:'2026-09-12',offerAccepted:true,eVerify:false}})
 const signed=await signI9Section1Pdf(preview,{signature:'Łukasz Żółć',signedOn:'2026-09-12'})
 const employer=await renderI9Section2Preview(signed,{edition:'01/20/25',documentChoice:'LIST_A',listA:[{title:'Employment Authorization Document',issuingAuthority:'USCIS',number:'SYNTHETIC123',expiresOn:'2030-09-12'}],examinationMethod:'PHYSICAL',firstDayEmployed:'2026-09-12',representativeNameAndTitle:'Alice Reviewer, Hiring Administrator',businessName:'Synthetic Employer',businessAddress:'20 Example Road, Bowie, MD 20715',additionalInformation:''})
 return signRetainedPayrollForm(employer,{signature:'Alice Reviewer',signedOn:'2026-09-12',signatureField:'Signature of Employer or AR',dateField:'S2 Todays Date mmddyyyy',pageCount:4,title:'Synthetic I-9 source'})
}

const supplement={edition:'01/20/25',document:{list:'C',title:'Synthetic replacement authorization',number:'SYNTHETIC-C',expiresOn:'2030-01-01'},representativeName:'Alice Reviewer',examinationMethod:'ALTERNATIVE',additionalInformation:'AR 09/13/2026: Examiner verified different acceptable replacement documentation.'}
const input={supplement,reason:'Employee selected different acceptable documentation after the receipt.',initials:'AR',recordedOn:'2026-09-13'}
async function sources(){
 const original=await source(),receipt=await signI9SupplementBPdf(await renderI9SupplementBPreview(original,{...supplement,document:{list:'A',title:'Synthetic authorization receipt',number:'receipt SYNTHETIC',expiresOn:'2026-11-30'},examinationMethod:'PHYSICAL',additionalInformation:''}),{signature:'Alice Reviewer',signedOn:'2026-09-12'})
 return {original,receipt}
}
test('different Supplement B preserves signed sources and prints a fresh List A or C replacement with explanation',async()=>{
 const {original,receipt}=await sources(),before=[Buffer.from(original),Buffer.from(receipt)]
 for(const list of ['A','C']){
  const preview=await renderI9DifferentSupplementPreview(original,receipt,{...input,supplement:{...supplement,document:{...supplement.document,list}}})
  assert.equal(preview.pageCount,2)
  const pdf=await PDFDocument.load(preview.pdf),form=pdf.getForm()
  assert.equal(form.getTextField('Document Number 0').getText(),'SYNTHETIC-C')
  assert.equal(form.getTextField('First Name Given Name from Section 1-2').getText(),'Łukasz')
  assert.equal(form.getTextField('Signature of Emp Rep 0').getText()||'','')
  assert.equal(form.getTextField('Todays Date 0').getText()||'','')
  assert.equal(form.getCheckBox('CB_Alt_0').isChecked(),true)
  for(const field of form.getFields())for(const widget of field.acroField.getWidgets())assert.equal(widget.dict.get(PDFName.of('P')).toString(),pdf.getPage(0).ref.toString())
  const signed=await signI9DifferentSupplementPdf(preview.pdf,{signature:'Alice Reviewer',signedOn:input.recordedOn,pageCount:preview.pageCount}),signedForm=(await PDFDocument.load(signed)).getForm()
  for(const field of form.getFields())if(!['Signature of Emp Rep 0','Todays Date 0'].includes(field.getName()))assert.equal(signedForm.getField(field.getName()).acroField.dict.get(PDFName.of('V'))?.toString(),field.acroField.dict.get(PDFName.of('V'))?.toString())
  assert.equal(signedForm.getTextField('Signature of Emp Rep 0').getText(),'Alice Reviewer')
  await assert.rejects(()=>signI9DifferentSupplementPdf(signed,{signature:'Other',signedOn:input.recordedOn,pageCount:preview.pageCount}),/already contains/)
  await writeFile('/tmp/payroll-different-supplement-signed.pdf',signed)
 }
 assert.deepEqual(original,before[0]);assert.deepEqual(receipt,before[1])
 await assert.rejects(()=>renderI9DifferentSupplementPreview(original,receipt,{...input,supplement:{...supplement,document:{...supplement.document,list:'B'}}}),/List A or List C/)
 await assert.rejects(()=>renderI9DifferentSupplementPreview(original,receipt,{...input,recordedOn:'2026-02-30'}),/real replacement date/)
 const mismatched=await PDFDocument.load(receipt);mismatched.getForm().getTextField('First Name Given Name from Section 1-2').setText('Another employee')
 await assert.rejects(async()=>renderI9DifferentSupplementPreview(original,await mismatched.save(),input),/match the original employee identity/)
 const unsigned=await renderI9SupplementBPreview(original,supplement)
 await assert.rejects(()=>renderI9DifferentSupplementPreview(original,unsigned,input),/signed and dated/)
})
test('different Supplement B paginates long explanations and rejects incomplete page counts',async()=>{
 const {original,receipt}=await sources()
 const preview=await renderI9DifferentSupplementPreview(original,receipt,{...input,reason:'LongReference'.repeat(150),supplement:{...supplement,additionalInformation:'RetainedNotes'.repeat(70)}})
 assert.ok(preview.pageCount>2)
 await assert.rejects(()=>signI9DifferentSupplementPdf(preview.pdf,{signature:'Alice Reviewer',signedOn:input.recordedOn,pageCount:1}),/every replacement supplement/)
 await assert.rejects(()=>signI9DifferentSupplementPdf(preview.pdf,{signature:'Alice Reviewer',signedOn:input.recordedOn,pageCount:2}),/complete form before signing/)
 const signed=await signI9DifferentSupplementPdf(preview.pdf,{signature:'Alice Reviewer',signedOn:input.recordedOn,pageCount:preview.pageCount})
 await writeFile('/tmp/payroll-different-supplement-long.pdf',signed)
})
