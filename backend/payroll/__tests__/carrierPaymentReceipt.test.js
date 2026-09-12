import test from 'node:test'
import assert from 'node:assert/strict'
import {carrierPaymentReceiptData,carrierReceiptBankFingerprint,carrierPaymentReceiptHtml} from '../carrierPaymentReceipt.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const intent={id:id(1),invoiceId:id(2),invoiceRevision:2,payeeRevisionId:id(3),fundingRevisionId:1,originatingAccountId:id(4),receivingAccountId:id(5),counterpartyId:id(6),facilityId:1,mode:'TEST',paymentDate:'2026-09-18',amountCents:55000,destinationFingerprint:'1'.repeat(64)}
const result={status:'COMPLETED',settlementStatus:'BANK_POSTED',reconciliationStatus:'reconciled',dateMatches:true,effectiveDate:'2026-09-18',liveMode:false,externalId:`vortex_carrier_${id(1)}`,providerId:id(7),transactionIds:[id(8),id(9)],settlementEvidence:[{transactionId:id(8),postedDate:'2026-09-17',amountCents:25000,lineItems:[{id:id(10),amountCents:10000},{id:id(11),amountCents:15000}]},{transactionId:id(9),postedDate:'2026-09-18',amountCents:30000,lineItems:[{id:id(12),amountCents:30000}]}]}
const preview={invoiceId:intent.invoiceId,invoiceRevision:intent.invoiceRevision,invoiceNumber:'SYNTHETIC-01',carrier:'Synthetic Carrier',amountCents:intent.amountCents,paymentDate:intent.paymentDate,destination:{holderName:'Benefits Business',accountType:'checking',accountLast4:'1234',mode:'TEST'}}
test('carrier receipts preserve split bank evidence and compare meaning independently of JSON ordering',()=>{
 const receipt=carrierPaymentReceiptData(intent,preview,result);assert.equal(receipt.bankWithdrawals.length,2);assert.equal(receipt.amountCents,55000)
 const reordered=structuredClone(result);reordered.settlementEvidence.reverse();reordered.transactionIds.reverse();reordered.settlementEvidence[1].lineItems.reverse();assert.equal(carrierReceiptBankFingerprint(reordered),receipt.bankFingerprint)
 for(const patch of [{status:'PROVIDER_APPROVED'},{status:'RETURNED'},{dateMatches:false},{settlementStatus:'UNAVAILABLE'},{reconciliationStatus:'unreconciled'}])assert.equal(carrierReceiptBankFingerprint({...result,...patch}),null)
 for(const patch of [{liveMode:true},{effectiveDate:'2026-09-19'},{providerId:id(99)}])assert.notEqual(carrierReceiptBankFingerprint({...result,...patch}),receipt.bankFingerprint)
 assert.throws(()=>carrierPaymentReceiptData(intent,{...preview,amountCents:1},result));assert.throws(()=>carrierPaymentReceiptData(intent,preview,{...result,status:'RETURNED'}))
})
test('carrier receipt download escapes untrusted names and distinguishes bank evidence from carrier application',()=>{
 const receipt={...carrierPaymentReceiptData(intent,preview,result),employerName:'<script>employer</script>',carrier:'<img src=x onerror=alert(1)>',status:'NEEDS_REVIEW',createdAt:'2026-09-18T12:00:00Z',observedAt:'2026-09-19T12:00:00Z'}
 const html=carrierPaymentReceiptHtml(receipt);assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img'),false);assert.match(html,/&lt;script&gt;/);assert.match(html,/Needs review/);assert.match(html,/Test — synthetic funds/);assert.match(html,/does not confirm that the carrier applied/);assert.match(html,/2026-09-17/);assert.equal(html.includes(intent.receivingAccountId),false)
})
