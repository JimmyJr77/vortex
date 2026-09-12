import test from 'node:test'
import assert from 'node:assert/strict'
import {PDFDocument} from 'pdf-lib'
import {renderW4Pdf2026} from '../w4Pdf2026.js'
import {W4_2026_FIELDS} from '../w4Form2026.js'
export const syntheticW4=()=>({year:2026,personal:{firstNameMiddleInitial:'Synthetic M',lastName:'García',address:'100 Example Street',cityStateZip:'Bowie, MD 20715',ssn:'123456789'},filingStatus:'HEAD_OF_HOUSEHOLD',twoJobs:true,exempt:false,nonresidentAlien:false,qualifyingChildrenCents:220000,otherDependentsCents:50000,creditsCents:312345,otherIncomeCents:100000,deductionsCents:234567,extraWithholdingCents:2512})
test('W-4 renderer retains all official pages, exact values and read-only signature fields',async()=>{
 const bytes=await renderW4Pdf2026({answers:syntheticW4(),signature:'Synthetic M García',signedOn:'2026-09-12',employer:{nameAddress:'Synthetic Employer, 200 Example Road, Bowie MD 20715',firstEmploymentDate:'2026-09-01',ein:'12-3456789'}})
 const pdf=await PDFDocument.load(bytes),form=pdf.getForm()
 assert.equal(pdf.getPageCount(),5)
 for(const [key,value] of Object.entries({lastName:'García',ssn:'123-45-6789',creditsCents:'3123.45',extraWithholdingCents:'25.12'}))assert.equal(form.getTextField(W4_2026_FIELDS[key]).getText(),value)
 assert.equal(form.getCheckBox(W4_2026_FIELDS.HEAD_OF_HOUSEHOLD).isChecked(),true);assert.equal(form.getCheckBox(W4_2026_FIELDS.SINGLE).isChecked(),false)
 assert.equal(form.getCheckBox(W4_2026_FIELDS.twoJobs).isChecked(),true);assert.equal(form.getCheckBox(W4_2026_FIELDS.exempt).isChecked(),false)
 assert.equal(form.getTextField('vortex.w4.employeeSignature').getText(),'Synthetic M García');assert.equal(form.getTextField('vortex.w4.signedOn').getText(),'2026-09-12')
 assert.ok(form.getFields().every(field=>field.isReadOnly()))
 for(const field of form.getFields())for(const widget of field.acroField.getWidgets())assert.ok(widget.getAppearances()?.normal)
})
test('W-4 unsigned and exempt outputs preserve blank choices and cannot invent signing dates',async()=>{
 const body={...syntheticW4(),filingStatus:null,twoJobs:false,exempt:true,qualifyingChildrenCents:null,otherDependentsCents:null,creditsCents:null,otherIncomeCents:null,deductionsCents:null,extraWithholdingCents:null}
 const pdf=await PDFDocument.load(await renderW4Pdf2026({answers:body})),form=pdf.getForm()
 assert.match(pdf.getTitle(),/unsigned preview/);assert.equal(form.getTextField('vortex.w4.employeeSignature').getText()??'','');assert.equal(form.getCheckBox(W4_2026_FIELDS.exempt).isChecked(),true)
 for(const key of ['SINGLE','MARRIED','HEAD_OF_HOUSEHOLD'])assert.equal(form.getCheckBox(W4_2026_FIELDS[key]).isChecked(),false)
 await assert.rejects(()=>renderW4Pdf2026({answers:body,signedOn:'2026-09-12'}),{status:400})
 await assert.rejects(()=>renderW4Pdf2026({answers:body,signature:'Name',signedOn:'2026-02-31'}),{status:400})
})
test('embedded W-4 font preserves extended Latin, Greek and Cyrillic canonical names',async()=>{
 for(const name of ['Łukasz Żółć','Nguyễn Thị','Ελένη Παπαδοπούλου','Олена Коваль']){
  const answers=syntheticW4();answers.personal.firstNameMiddleInitial=name;answers.personal.lastName=name
  const bytes=await renderW4Pdf2026({answers,signature:name,signedOn:'2026-09-12'})
  const form=(await PDFDocument.load(bytes)).getForm()
  assert.equal(form.getTextField(W4_2026_FIELDS.lastName).getText(),name)
  assert.equal(form.getTextField('vortex.w4.employeeSignature').getText(),name)
  assert.ok(form.getFields().every(field=>field.acroField.getWidgets().every(widget=>widget.getAppearances()?.normal)))
 }
 const unsupported=syntheticW4();unsupported.personal.lastName='王'
 await assert.rejects(()=>renderW4Pdf2026({answers:unsupported}),{status:400})
})
