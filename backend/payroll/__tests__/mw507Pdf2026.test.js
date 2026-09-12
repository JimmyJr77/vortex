import test from 'node:test'
import assert from 'node:assert/strict'
import {PDFDocument,PDFName} from 'pdf-lib'
import {renderMw507Pdf2026} from '../mw507Pdf2026.js'
import {MW507_FIELDS} from '../mw507Form2026.js'
import {syntheticMw507} from '../testing/mw507Fixture.js'
const value=(form,key)=>form.getTextField(MW507_FIELDS[key]).getText()??''
const checked=(form,key)=>form.getCheckBox(MW507_FIELDS[key]).acroField.getWidgets().filter(widget=>widget.getAppearanceState()?.decodeText()!=='Off').map(widget=>widget.getAppearanceState().decodeText())
test('MW507 retains both pages, canonical names, signature and worksheet with matching widget data',async()=>{
 const pdf=await PDFDocument.load(await renderMw507Pdf2026({answers:syntheticMw507(),signature:'Łukasz Żółć',signedOn:'2026-09-12',employer:{nameAddress:'Synthetic Employer, 200 Example Road, Bowie MD',ein:'12-3456789'}})),form=pdf.getForm()
 assert.equal(pdf.getPageCount(),2);assert.equal(value(form,'fullName'),'Łukasz Żółć');assert.equal(value(form,'ssn'),'123456789');assert.equal(value(form,'additionalWithholdingCents'),'12.50');assert.equal(value(form,'f'),'6');assert.equal(value(form,'e'),'19600.00');assert.equal(value(form,'signedOn'),'2026-09-12')
 assert.equal(form.getTextField('vortex.mw507.employeeSignature').getText(),'Łukasz Żółć')
 assert.deepEqual(checked(form,'withholdingRate'),['Married, but withhold at Single rate'])
 assert.equal(form.getCheckBox(MW507_FIELDS.withholdingRate).acroField.dict.get(PDFName.of('V')).decodeText(),'Married, but withhold at Single rate')
 for(const field of form.getFields()){
  assert.ok(field.isReadOnly())
  for(const widget of field.acroField.getWidgets())assert.ok(widget.getAppearances()?.normal)
 }
})
test('all original grouped rate and domicile checkboxes select only the intended canonical export',async()=>{
 for(const [withholdingRate,expected,state,domicile] of [['SINGLE','Single','DC','District of Columbia'],['MARRIED','Married Rate','VA','Virginia'],['MARRIED_SINGLE','Married, but withhold at Single rate','WV','West Virginia']]){
  const form=(await PDFDocument.load(await renderMw507Pdf2026({answers:{...syntheticMw507(),withholdingRate,claim:{kind:'RECIPROCAL',state,noMarylandAbode:true}}}))).getForm()
  assert.deepEqual(checked(form,'withholdingRate'),[expected]);assert.deepEqual(checked(form,'domicile'),[domicile]);assert.equal(value(form,'line4'),'EXEMPT');assert.equal(value(form,'signedOn'),'')
 }
})
test('Pennsylvania state-only and combined local claims print their separate required lines',async()=>{
 for(const localExemption of ['NONE','YORK_ADAMS','NO_LOCAL_TAX']){
  const form=(await PDFDocument.load(await renderMw507Pdf2026({answers:{...syntheticMw507(),claim:{kind:'PENNSYLVANIA',noMarylandAbode:true,localExemption}}}))).getForm()
  assert.equal(value(form,'line5'),'EXEMPT');assert.equal(value(form,'line4'),localExemption==='NONE'?'':'EXEMPT');assert.equal(value(form,'line6'),localExemption==='YORK_ADAMS'?'EXEMPT':'');assert.equal(value(form,'line7'),localExemption==='NO_LOCAL_TAX'?'EXEMPT':'');assert.deepEqual(checked(form,'domicile'),[])
 }
})
test('no-liability and military claims retain certifications and never invent an unsigned date',async()=>{
 const form=(await PDFDocument.load(await renderMw507Pdf2026({answers:{...syntheticMw507(),claim:{kind:'NO_LIABILITY',priorYearNoTax:true,currentYearNoTax:true,effectiveYear:2026}}}))).getForm()
 assert.equal(value(form,'effectiveYear'),'2026');assert.equal(value(form,'line3'),'EXEMPT');assert.equal(form.getCheckBox(MW507_FIELDS.priorYearNoTax).isChecked(),true);assert.equal(form.getCheckBox(MW507_FIELDS.currentYearNoTax).isChecked(),true)
 const military=(await PDFDocument.load(await renderMw507Pdf2026({answers:{...syntheticMw507(),claim:{kind:'MILITARY_SPOUSE',state:'VA',certifiedEligible:true}}}))).getForm()
 assert.equal(value(military,'line8'),'EXEMPT');assert.equal(value(military,'militaryState'),'VA')
 await assert.rejects(()=>renderMw507Pdf2026({answers:syntheticMw507(),signedOn:'2026-09-12'}),{status:400})
 await assert.rejects(()=>renderMw507Pdf2026({answers:syntheticMw507(),signature:'Name',signedOn:'2026-02-31'}),{status:400})
})
