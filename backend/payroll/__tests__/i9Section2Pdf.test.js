import test from 'node:test'
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {PDFDocument,PDFName} from 'pdf-lib'
import {renderI9Section1Preview} from '../i9Section1Pdf.js'
import {signI9Section1Pdf,signRetainedPayrollForm} from '../i9SignaturePdf.js'
import {i9Section2Input} from '../i9Section2.js'
import {renderI9Section2Preview,I9_SECTION2_TITLE_FIELD} from '../i9Section2Pdf.js'
const row={title:'U.S. Passport',issuingAuthority:'U.S. Department of State',number:'SYNTHETIC123',expiresOn:'2030-09-12'}
const answers={edition:'01/20/25',documentChoice:'LIST_A',listA:[row],examinationMethod:'PHYSICAL',firstDayEmployed:'2026-09-12',representativeNameAndTitle:'Alice Reviewer, Hiring Administrator',businessName:'Synthetic Employer',businessAddress:'20 Example Road, Bowie, MD 20715',additionalInformation:''}
async function source(){
 const preview=await renderI9Section1Preview({answers:{edition:'01/20/25',personal:{lastName:'Żółć',firstName:'Łukasz',address:'100 Synthetic Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29'},attestation:{kind:'CITIZEN'},ssnPending:false,preparerAssisted:false},context:{today:'2026-09-12',offerAccepted:true,eVerify:false}})
 return signI9Section1Pdf(preview,{signature:'Łukasz Żółć',signedOn:'2026-09-12'})
}
test('Section 2 input keeps employee-chosen alternatives exclusive and rejects silent coercions',()=>{
 assert.equal(i9Section2Input(answers).listA.length,1)
 for(const bad of [{...answers,listB:row},{...answers,listA:[]},{...answers,listA:[row,row,row,row]},{...answers,examinationMethod:null},{...answers,firstDayEmployed:'2026-02-30'},{...answers,signature:'Admin'},{...answers,listA:[{...row,expiresOn:'2030-02-30'}]}])assert.throws(()=>i9Section2Input(bad),e=>e.status===400)
 const {listA,...base}=answers
 assert.equal(listA.length,1)
 assert.equal(i9Section2Input({...base,documentChoice:'LIST_B_C',listB:{...row,number:'',expiresOn:''},listC:row}).listA.length,0)
})
test('employer preview and signature preserve Section 1 and isolate Supplement B canonical/widget title',async()=>{
 const original=await source(),before=(await PDFDocument.load(original)).getForm()
 const output=await renderI9Section2Preview(original,answers),pdf=await PDFDocument.load(output),form=pdf.getForm()
 assert.equal(pdf.getPageCount(),4)
 for(const name of ['Signature of Employee',"Today's Date mmddyyy",'Last Name (Family Name)','US Social Security Number'])assert.equal(form.getTextField(name).getText(),before.getTextField(name).getText())
 assert.equal(form.getTextField(I9_SECTION2_TITLE_FIELD).getText(),row.title)
 assert.equal(form.getTextField('Document Title 1').getText()||'','')
 for(const [name,index] of [[I9_SECTION2_TITLE_FIELD,0],['Document Title 1',3]]){
  const field=form.getTextField(name),widgets=field.acroField.getWidgets();assert.equal(widgets.length,1)
  assert.equal(widgets[0].dict.get(PDFName.of('P')).toString(),pdf.getPage(index).ref.toString())
  assert.ok(widgets[0].getAppearances()?.normal);assert.equal(field.isReadOnly(),true)
 }
 assert.equal(form.getTextField('Signature of Employer or AR').getText()||'','')
 const signed=await signRetainedPayrollForm(output,{signature:'Alice Reviewer',signedOn:'2026-09-12',signatureField:'Signature of Employer or AR',dateField:'S2 Todays Date mmddyyyy',pageCount:4,title:'I-9 - employer signed'})
 const signedForm=(await PDFDocument.load(signed)).getForm()
 assert.equal(signedForm.getTextField('Signature of Employer or AR').getText(),'Alice Reviewer')
 assert.equal(signedForm.getTextField('Signature of Employee').getText(),'Łukasz Żółć')
 assert.equal(signedForm.getTextField('S2 Todays Date mmddyyyy').getText(),'09/12/2026')
 assert.equal(signedForm.getTextField('Document Title 1').getText()||'','')
 await assert.rejects(()=>renderI9Section2Preview(signed,answers),/correction workflow/)
 await assert.rejects(()=>renderI9Section2Preview(output,answers),/original employee-signed/)
 await writeFile('/tmp/payroll-i9-section2-signed.pdf',signed)
})
test('List A combinations, List B/C and alternative checkbox have exact independent form values',async()=>{
 const original=await source()
 const combination=await renderI9Section2Preview(original,{...answers,listA:[row,{...row,title:'Second document'},{...row,title:'Third document',expiresOn:'2031-01-02'}]})
 const a=(await PDFDocument.load(combination)).getForm()
 assert.equal(a.getTextField('Document Title 2 If any').getText(),'Second document')
 assert.equal(a.getTextField('Document Number if any_3').getText(),'01/02/2031')
 const {listA,...base}=answers;assert.ok(listA)
 const output=await renderI9Section2Preview(original,{...base,documentChoice:'LIST_B_C',listB:{...row,title:'Driver license'},listC:{...row,title:'Social Security card',expiresOn:''},examinationMethod:'ALTERNATIVE',additionalInformation:'Synthetic examination notes for form rendering verification.'})
 const b=(await PDFDocument.load(output)).getForm()
 assert.equal(b.getTextField(I9_SECTION2_TITLE_FIELD).getText()||'','')
 assert.equal(b.getTextField('List B Document 1 Title').getText(),'Driver license')
 assert.equal(b.getTextField('List C Expiration Date 1').getText()||'','')
 assert.equal(b.getCheckBox('CB_Alt').isChecked(),true)
 for(const widget of b.getCheckBox('CB_Alt').acroField.getWidgets())assert.equal(widget.getAppearanceState().toString(),b.getCheckBox('CB_Alt').acroField.dict.get(PDFName.of('V')).toString())
 await writeFile('/tmp/payroll-i9-section2-list-bc.pdf',output)
})
test('employer renderer rejects unsupported scripts and overflowing fields without truncation',async()=>{
 const original=await source()
 await assert.rejects(()=>renderI9Section2Preview(original,{...answers,businessName:'漢字'}),/font support/)
 await assert.rejects(()=>renderI9Section2Preview(original,{...answers,businessName:'W'.repeat(200)}),/legibly/)
 await assert.rejects(()=>renderI9Section2Preview(original,{...answers,additionalInformation:'W'.repeat(400)}),/too long/)
})
