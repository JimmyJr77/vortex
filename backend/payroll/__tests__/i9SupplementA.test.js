import test from 'node:test'
import assert from 'node:assert/strict'
import {PDFDocument} from 'pdf-lib'
import {writeFile} from 'node:fs/promises'
import {renderSupplementA} from '../i9SupplementA.js'
import {signRetainedPayrollForm} from '../i9SignaturePdf.js'
test('each preparer receives an original Supplement A with independent canonical identity and signature',async()=>{
 const bytes=await renderSupplementA({employee:{firstName:'Łukasz',lastName:'Żółć',middleInitial:''},preparer:{firstName:'Alice',lastName:'Translator',middleInitial:'',address:'20 Example Road',city:'Bowie',state:'MD',postalCode:'20715'}})
 const preview=await PDFDocument.load(bytes);assert.equal(preview.getPageCount(),1);assert.equal(preview.getForm().getTextField('First Name Given Name from Section 1').getText(),'Łukasz');assert.equal(preview.getForm().getTextField('Signature of Preparer or Translator 0').getText()||'','')
 assert.throws(()=>preview.getForm().getField('US Social Security Number'))
 const signed=await signRetainedPayrollForm(bytes,{signature:'Alice Translator',signedOn:'2026-09-12',signatureField:'Signature of Preparer or Translator 0',dateField:'Sig Date mmddyyyy 0',pageCount:1,title:'I-9 Supplement A - preparer signed'})
 const form=(await PDFDocument.load(signed)).getForm();assert.equal(form.getTextField('Signature of Preparer or Translator 0').getText(),'Alice Translator');assert.equal(form.getTextField('Sig Date mmddyyyy 0').getText(),'09/12/2026');assert.equal(form.getTextField('Preparer or Translator First Name (Given Name) 0').getText(),'Alice')
 for(let i=1;i<=3;i++)assert.equal(form.getTextField(`Signature of Preparer or Translator ${i}`).getText()||'','')
 for(const f of form.getFields()){assert.equal(f.isReadOnly(),true);for(const w of f.acroField.getWidgets())assert.ok(w.getAppearances()?.normal)}
 await writeFile('/tmp/payroll-i9-supplement-a-signed.pdf',signed)
})
