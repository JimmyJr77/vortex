import test from 'node:test'
import assert from 'node:assert/strict'
import {writeFile} from 'node:fs/promises'
import {PDFDocument} from 'pdf-lib'
import {renderW2EmployeePacket} from '../w2Pdf.js'
const snapshot=()=>({version:1,year:2026,employeeId:1,employer:{identifier:'123456789',marylandRegistrationNumber:'01234567',legalName:'Synthetic Employer LLC',address:{line1:'123 Test Street',city:'Bowie',state:'MD',postalCode:'20715'}},employee:{identifier:'987654321',firstName:'Synthetic',middleName:'Test',lastName:'Employee',address:{line1:'456 Sample Avenue',city:'Bowie',state:'MD',postalCode:'20715'}},draft:{status:'DRAFT_REVIEW_REQUIRED',boxes:{box1:'210000.00',box2:'30000.00',box3:'184500.00',box4:'11439.00',box5:'210000.00',box6:'3135.00',box12:[{code:'DD',amount:'6900.25'},{code:'TT',amount:'30000.00'}],box13:{statutoryEmployee:false,retirementPlan:false,thirdPartySickPay:false},box16:'210000.00',box17:'15000.00'}}})
test('W-2 packet retains six employee copy/instruction pages with no editable fields',async()=>{
 const bytes=await renderW2EmployeePacket(snapshot()),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),6);assert.equal(pdf.getForm().getFields().length,0)
 await writeFile('/tmp/payroll-w2-synthetic-packet.pdf',bytes)
})
test('W-2 renderer rejects unsupported snapshots and unreadable identity text',async()=>{
 const bad=snapshot();bad.employee.lastName='TooLong'.repeat(100);await assert.rejects(renderW2EmployeePacket(bad),/capacity/)
 await assert.rejects(renderW2EmployeePacket({...snapshot(),year:2025}),/supported/)
})

test('W-2 renderer refuses to silently discard unsupported classifications and codes',async()=>{
 for(const patch of [{box13:{statutoryEmployee:true,retirementPlan:false,thirdPartySickPay:false}},{box14a:['Other compensation']},{box18:'10.00'},{box12:[{code:'D',amount:'10.00'}]},{box12:[{code:'DD',amount:'1.00'},{code:'DD',amount:'2.00'}]},{box6:'NaN'}]){const value=snapshot();Object.assign(value.draft.boxes,patch);await assert.rejects(renderW2EmployeePacket(value),/Unsupported/)}
})

test('W-2 packet renders retained retirement participation on all employee copies',async()=>{
 const value=snapshot();value.draft.boxes.box13.retirementPlan=true;const bytes=await renderW2EmployeePacket(value),pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),6);assert.equal(pdf.getForm().getFields().length,0);await writeFile('/tmp/payroll-w2-retirement-packet.pdf',bytes)
 value.draft.boxes.box13.retirementPlan='true';await assert.rejects(renderW2EmployeePacket(value),/Unsupported/)
})

test('W-2 packet renders pretax and Roth contribution codes alongside health and overtime codes',async()=>{
 const value=snapshot();value.draft.boxes.box13.retirementPlan=true
 value.draft.boxes.box1='185500.00';value.draft.boxes.box16='185500.00'
 value.draft.boxes.box12=[{code:'D',amount:'24500.00'},{code:'AA',amount:'8000.00'},...value.draft.boxes.box12]
 const bytes=await renderW2EmployeePacket(value),pdf=await PDFDocument.load(bytes)
 assert.equal(pdf.getPageCount(),6);assert.equal(pdf.getForm().getFields().length,0)
 await writeFile('/tmp/payroll-w2-401k-packet.pdf',bytes)
})
