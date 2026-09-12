import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {W4_2026,W4_2026_FIELDS,w4FormInput2026} from '../w4Form2026.js'
const input=()=>({year:2026,personal:{firstNameMiddleInitial:'Synthetic M',lastName:'Employee',address:'100 Example Street',cityStateZip:'Bowie, MD 20715',ssn:'123-45-6789'},filingStatus:'SINGLE',twoJobs:false,exempt:false,nonresidentAlien:false,qualifyingChildrenCents:220000,otherDependentsCents:50000,creditsCents:312345,otherIncomeCents:100000,deductionsCents:234567,extraWithholdingCents:2512})
test('W-4 preserves free-form credit totals, optional blanks, explicit options and identity without mutating input',()=>{
 const body=input(),before=structuredClone(body),form=w4FormInput2026(body)
 assert.deepEqual(body,before);assert.equal(form.personal.ssn,'123456789');assert.equal(form.creditsCents,312345);assert.equal(form.extraWithholdingCents,2512)
 for(const filingStatus of ['SINGLE','MARRIED','HEAD_OF_HOUSEHOLD'])assert.equal(w4FormInput2026({...body,filingStatus}).filingStatus,filingStatus)
 assert.equal(w4FormInput2026({...body,creditsCents:null}).creditsCents,null)
 assert.equal(w4FormInput2026({...body,nonresidentAlien:true}).nonresidentAlien,true)
 assert.equal(w4FormInput2026({...body,personal:{...body.personal,lastName:'García'}}).personal.lastName,'García')
 for(const patch of [{year:2025},{filingStatus:'DEFAULT'},{twoJobs:undefined},{exempt:'false'},{nonresidentAlien:null},{creditsCents:1.2},{creditsCents:-1},{creditsCents:'100'},{creditsCents:Number.MAX_SAFE_INTEGER+1},{personal:{...body.personal,ssn:'900-12-3456'}},{personal:{...body.personal,ssn:'123-00-6789'}},{personal:{...body.personal,address:'Bad\nAddress'}}])assert.throws(()=>w4FormInput2026({...body,...patch}),{status:400})
})
test('W-4 exemption leaves every non-personal entry blank and does not silently erase entered answers',()=>{
 const body=input(),exempt={...body,exempt:true,filingStatus:null,qualifyingChildrenCents:null,otherDependentsCents:null,creditsCents:null,otherIncomeCents:null,deductionsCents:null,extraWithholdingCents:null}
 assert.equal(w4FormInput2026(exempt).exempt,true)
 for(const patch of [{filingStatus:'SINGLE'},{twoJobs:true},{creditsCents:0},{extraWithholdingCents:1}])assert.throws(()=>w4FormInput2026({...exempt,...patch}),{status:400})
 assert.throws(()=>w4FormInput2026({...body,exempt:true}),{status:400})
})
test('pinned official W-4 preserves all five pages and mapped AcroForm fields',async()=>{
 const bytes=await readFile(new URL('../forms/irs-w4-2026.pdf',import.meta.url))
 assert.equal(createHash('sha256').update(bytes).digest('hex'),W4_2026.templateSha256)
 const pdf=await PDFDocument.load(bytes),form=pdf.getForm()
 assert.equal(pdf.getPageCount(),5)
 for(const [key,name] of Object.entries(W4_2026_FIELDS)){
  const field=form.getField(name)
  assert.equal(field.constructor.name,['SINGLE','MARRIED','HEAD_OF_HOUSEHOLD','twoJobs','exempt'].includes(key)?'PDFCheckBox':'PDFTextField')
 }
 // The official form also retains editable worksheets on pages 3 and 4.
 assert.ok(form.getFields().some(field=>field.getName().includes('.Page3[')))
 assert.ok(form.getFields().some(field=>field.getName().includes('.Page4[')))
})
