import test from 'node:test'
import assert from 'node:assert/strict'
import {PDFDocument} from 'pdf-lib'
import {renderI9Section1Preview} from '../i9Section1Pdf.js'
const context={today:'2026-09-12',offerAccepted:true,eVerify:false}
const personal={lastName:'Żółć',firstName:'Łukasz',address:'100 Synthetic Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-02-29'}
test('I-9 preview retains original pages, exact Section 1 fields and matching checkbox appearances',async()=>{
 const variants=[{kind:'CITIZEN'},{kind:'NONCITIZEN_NATIONAL'},{kind:'PERMANENT_RESIDENT',aNumber:'1234567'},{kind:'AUTHORIZED_WORKER',authorizationExpiresOn:'N/A',identifier:{kind:'PASSPORT',number:'Synthetic123',country:'Canada'}}]
 for(const [index,attestation] of variants.entries()){
  const output=await renderI9Section1Preview({answers:{edition:'01/20/25',personal,attestation,ssnPending:false,preparerAssisted:false},context})
  const pdf=await PDFDocument.load(output),form=pdf.getForm()
  assert.equal(pdf.getPageCount(),4);assert.equal(form.getTextField('Last Name (Family Name)').getText(),'Żółć')
  assert.equal(form.getTextField('Signature of Employee').getText()||'','');assert.equal(form.getTextField("Today's Date mmddyyy").getText()||'','')
  assert.equal(form.getTextField('US Social Security Number').getText()||'','')
  for(let n=1;n<=4;n++){
   const f=form.getCheckBox(`CB_${n}`);assert.equal(f.isChecked(),n===index+1)
   for(const widget of f.acroField.getWidgets())assert.equal(widget.getAppearanceState().decodeText(),n===index+1?'On':'Off')
  }
  assert.deepEqual(form.getDropdown('State').getSelected(),['MD'])
  if(index===3){assert.equal(form.getTextField('Exp Date mmddyyyy').getText(),'N/A');assert.equal(form.getTextField('Foreign Passport Number and Country of IssuanceRow1').getText(),'Synthetic123, Canada')}
  for(const field of form.getFields())assert.equal(field.isReadOnly(),true)
 }
})
test('I-9 renderer rejects unprintable or unsupported entries before returning a preview',async()=>{
 const answers={edition:'01/20/25',personal,attestation:{kind:'CITIZEN'},ssnPending:false,preparerAssisted:false}
 await assert.rejects(()=>renderI9Section1Preview({answers:{...answers,personal:{...personal,address:'W'.repeat(200)}},context}),/legibly/)
 await assert.rejects(()=>renderI9Section1Preview({answers:{...answers,personal:{...personal,lastName:'漢字'}},context}),/font support/)
})
