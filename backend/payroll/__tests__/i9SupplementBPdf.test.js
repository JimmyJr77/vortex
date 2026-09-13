import test from 'node:test'
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {PDFDocument,PDFName} from 'pdf-lib'
import {renderI9Section1Preview} from '../i9Section1Pdf.js'
import {signI9Section1Pdf,signRetainedPayrollForm} from '../i9SignaturePdf.js'
import {renderI9Section2Preview} from '../i9Section2Pdf.js'
import {i9SupplementBInput} from '../i9SupplementB.js'
import {renderI9SupplementBPreview,signI9SupplementBPdf} from '../i9SupplementBPdf.js'
const answers={edition:'01/20/25',document:{list:'A',title:'Employment Authorization Document',number:'SYNTHETIC123',expiresOn:'2028-09-13'},representativeName:'Alice Reviewer',examinationMethod:'PHYSICAL',additionalInformation:'AR 09/13/2026: Synthetic examination notation.'}
async function source(){
 const preview=await renderI9Section1Preview({answers:{edition:'01/20/25',personal:{lastName:'Żółć',firstName:'Łukasz',address:'100 Synthetic Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29'},attestation:{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'2027-09-12',identifier:{kind:'A_NUMBER',number:'123456789'}},ssnPending:false,preparerAssisted:false},context:{today:'2026-09-12',offerAccepted:true,eVerify:false}})
 const signed=await signI9Section1Pdf(preview,{signature:'Łukasz Żółć',signedOn:'2026-09-12'})
 const employer=await renderI9Section2Preview(signed,{edition:'01/20/25',documentChoice:'LIST_A',listA:[{title:'Employment Authorization Document',issuingAuthority:'USCIS',number:'SYNTHETIC123',expiresOn:'2030-09-12'}],examinationMethod:'PHYSICAL',firstDayEmployed:'2026-09-12',representativeNameAndTitle:'Alice Reviewer, Hiring Administrator',businessName:'Synthetic Employer',businessAddress:'20 Example Road, Bowie, MD 20715',additionalInformation:''})
 return signRetainedPayrollForm(employer,{signature:'Alice Reviewer',signedOn:'2026-09-12',signatureField:'Signature of Employer or AR',dateField:'S2 Todays Date mmddyyyy',pageCount:4,title:'Synthetic I-9 source'})
}
test('reverification form input rejects List B, unknown fields, impossible dates and incomplete name changes',()=>{
 assert.equal(i9SupplementBInput(answers).document.list,'A')
 assert.equal(i9SupplementBInput({...answers,document:{...answers.document,list:'C',expiresOn:''}}).document.expiresOn,'')
 for(const bad of [{...answers,signature:'Alice'},{...answers,document:{...answers.document,expiresOn:false}},{...answers,document:{...answers.document,list:'B'}},{...answers,document:{...answers.document,expiresOn:'2026-02-30'}},{...answers,newName:{lastName:'Changed'}},{...answers,examinationMethod:null},{...answers,document:{...answers.document,number:'bad\nvalue'}}])assert.throws(()=>i9SupplementBInput(bad),e=>e.status===400)
})
test('fresh official supplement preserves Unicode identity and independent widgets, review remains unsigned, signing changes only signature and date',async()=>{
 const original=await source(),unchanged=Buffer.from(original)
 const preview=await renderI9SupplementBPreview(original,{...answers,newName:{firstName:'Łukasz',lastName:'Nowak',middleInitial:'J'},examinationMethod:'ALTERNATIVE'})
 assert.deepEqual(original,unchanged)
 const pdf=await PDFDocument.load(preview),form=pdf.getForm()
 assert.equal(pdf.getPageCount(),1)
 assert.equal(form.getTextField('Last Name Family Name from Section 1-2').getText(),'Żółć')
 assert.equal(form.getTextField('First Name Given Name from Section 1-2').getText(),'Łukasz')
 assert.equal(form.getTextField('Last Name 0').getText(),'Nowak')
 assert.equal(form.getTextField('Document Title 0').getText(),answers.document.title)
 assert.equal(form.getTextField('Expiration Date 0').getText(),'09/13/2028')
 assert.equal(form.getTextField('Signature of Emp Rep 0').getText()||'','')
 assert.equal(form.getCheckBox('CB_Alt_0').isChecked(),true)
 for(const name of ['Document Title 1','Document Title 2','Date of Rehire 0','Signature of Emp Rep 1','Signature of Emp Rep 2'])assert.equal(form.getTextField(name).getText()||'','')
 for(const field of form.getFields())for(const widget of field.acroField.getWidgets())assert.equal(widget.dict.get(PDFName.of('P')).toString(),pdf.getPage(0).ref.toString())
 for(const name of ['Document Title 0','Last Name Family Name from Section 1-2'])assert.ok(form.getTextField(name).acroField.getWidgets()[0].getAppearances().normal)
 assert.equal(form.getFields().some(f=>f.getName()==='Signature of Employee'),false)
 const signed=await signI9SupplementBPdf(preview,{signature:'Alice Reviewer',signedOn:'2026-09-13'}),saved=(await PDFDocument.load(signed)).getForm()
 for(const field of form.getFields())if(!['Signature of Emp Rep 0','Todays Date 0'].includes(field.getName()))assert.equal(saved.getField(field.getName()).acroField.dict.get(PDFName.of('V'))?.toString(),field.acroField.dict.get(PDFName.of('V'))?.toString())
 assert.equal(saved.getTextField('Signature of Emp Rep 0').getText(),'Alice Reviewer')
 assert.equal(saved.getTextField('Todays Date 0').getText(),'09/13/2026')
 await assert.rejects(()=>signI9SupplementBPdf(signed,{signature:'Other',signedOn:'2026-09-14'}),/already contains/)
 await assert.rejects(()=>renderI9SupplementBPreview(original,{...answers,additionalInformation:'Long notation '.repeat(70)}),/continuation sheet/)
 await writeFile('/tmp/payroll-i9-supplement-b-signed.pdf',signed)
})
