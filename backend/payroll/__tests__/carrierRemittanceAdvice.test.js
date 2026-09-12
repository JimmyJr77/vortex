import test from 'node:test'
import assert from 'node:assert/strict'
import {carrierRemittanceAdvice,carrierRemittanceAdviceHtml} from '../carrierRemittanceAdvice.js'
const receipt={id:'00000000-0000-4000-8000-000000000001',invoiceId:'00000000-0000-4000-8000-000000000002',invoiceRevision:2,sourceObservationId:1,employerName:'Synthetic Employer',carrier:'Synthetic <Benefits>',invoiceNumber:'SEP-2026',amountCents:55000,paymentDate:'2026-09-18',mode:'TEST',status:'BANK_CONFIRMED',bankWithdrawals:[{postedDate:'2026-09-17',amountCents:25000},{postedDate:'2026-09-18',amountCents:30000}],observedAt:'2026-09-19T12:00:00Z',destination:{accountLast4:'1234',holderName:'Private holder'},sourceResult:{secret:'private-provider-data'}}
test('remittance advice is scoped to one bank-confirmed payment with allowlisted carrier content',()=>{
 const advice=carrierRemittanceAdvice(receipt),serialized=JSON.stringify(advice)
 assert.match(advice.subject,/^TEST/);assert.match(advice.text,/\$550.00/);assert.match(advice.text,/2026-09-17: \$250.00/);assert.match(advice.text,/does not state that the invoice is paid in full/)
 for(const secret of ['1234','Private holder','private-provider-data'])assert.equal(serialized.includes(secret),false)
 assert.equal(advice.fingerprint,carrierRemittanceAdvice(structuredClone(receipt)).fingerprint)
 assert.notEqual(advice.fingerprint,carrierRemittanceAdvice({...receipt,observedAt:'2026-09-20T12:00:00Z'}).fingerprint)
 assert.notEqual(advice.fingerprint,carrierRemittanceAdvice({...receipt,invoiceRevision:3}).fingerprint)
 const html=carrierRemittanceAdviceHtml(advice);assert.match(html,/Synthetic &lt;Benefits&gt;/);assert.equal(html.includes('<Benefits>'),false)
 const live=carrierRemittanceAdvice({...receipt,mode:'LIVE'});assert.equal(live.text.includes('SYNTHETIC FUNDS'),false);assert.equal(live.subject.startsWith('TEST'),false)
})
test('changed, incomplete, unsafe or contradictory receipt evidence cannot generate remittance advice',()=>{
 for(const patch of [{status:'NEEDS_REVIEW'},{status:'PROVIDER_APPROVED'},{employerName:'Not recorded'},{carrier:'Carrier\nBcc: other@example.com'},{invoiceNumber:''},{invoiceRevision:0},{invoiceId:'bad'},{sourceObservationId:0},{amountCents:0},{amountCents:Number.MAX_SAFE_INTEGER+1},{mode:'unknown'},{paymentDate:'2026-02-30'},{observedAt:'invalid'},{bankWithdrawals:[]},{bankWithdrawals:[{postedDate:'2026-09-18',amountCents:55001}]},{bankWithdrawals:[{postedDate:'2026-02-30',amountCents:55000}]}])assert.throws(()=>carrierRemittanceAdvice({...receipt,...patch}),{status:409})
})
