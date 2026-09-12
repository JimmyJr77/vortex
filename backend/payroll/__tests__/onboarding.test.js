import {wageNoticeTerms} from '../onboarding.js'
import { journalPayload } from '../quickbooks.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { dueDate, readiness, encryptDocument, decryptDocument, validateResponse, documentInput } from '../onboarding.js'
test('I-9 business-day and new-hire calendar deadlines',()=>{assert.equal(dueDate('2026-09-11','I9_REVIEW'),'2026-09-16');assert.equal(dueDate('2026-09-11','NEW_HIRE_REPORT'),'2026-10-01')})
test('readiness cannot pass without a packet or with pending required steps',()=>{const employee={personal_email:'test@example.test',hourly_rate_cents:2500,pay_type:'HOURLY'};assert.equal(readiness(employee,[]).ready,false);assert.equal(readiness(employee,[{title:'W4',required:true,status:'SUBMITTED'}]).ready,false);assert.equal(readiness(employee,[{title:'W4',required:true,status:'COMPLETE'}]).ready,true)})
test('documents are encrypted and bound to their employee and task',()=>{const original=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');try{const bytes=Buffer.from('%PDF-secret');const encrypted=encryptDocument(bytes,'1:2:3');assert.equal(encrypted.includes(bytes),false);assert.deepEqual(decryptDocument(encrypted,'1:2:3'),bytes);assert.throws(()=>decryptDocument(encrypted,'1:9:3'));encrypted[30]^=1;assert.throws(()=>decryptDocument(encrypted,'1:2:3'))}finally{if(original===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=original}})
test('document storage fails closed and rejects executable formats',()=>{const original=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY;try{assert.throws(()=>encryptDocument(Buffer.from('secret'),'a'),/PAYROLL_DOCUMENT_KEY/);assert.throws(()=>documentInput({contentBase64:Buffer.from('<html>bad').toString('base64')}),/PDF/)}finally{if(original!==undefined)process.env.PAYROLL_DOCUMENT_KEY=original}})
test('acknowledgments require explicit signature and preserve terms',()=>{assert.throws(()=>validateResponse('HANDBOOK',{acknowledged:true,signature:'Test'}, {},{}),/publish/);const response=validateResponse('WAGE_NOTICE',{acknowledged:true,signature:'Test',displayedWageTerms:wageNoticeTerms({hourly_rate_cents:2500},{})}, {hourly_rate_cents:2500},{});assert.equal(response.terms.hourlyRateCents,2500);assert.throws(()=>validateResponse('PAYMENT',{method:'DIRECT_DEPOSIT'},{},{}),/reference/)})

test('QuickBooks journals balance exactly and reject incomplete mappings',()=>{
 const run={id:1,pay_date:'2026-09-20',gross_pay_cents:10000,employee_tax_cents:1000,employer_tax_cents:765,reimbursement_cents:500,deduction_cents:200,net_pay_cents:9300}
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'}
 const payload=journalPayload(run,accounts);assert.equal(payload.Line.length,6);assert.equal(payload.TxnDate,'2026-09-20')
 assert.throws(()=>journalPayload({...run,net_pay_cents:9301},accounts),/balance/)
 assert.throws(()=>journalPayload(run,{}),/account/)
})
