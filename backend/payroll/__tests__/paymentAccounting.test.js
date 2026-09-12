import test from 'node:test'
import assert from 'node:assert/strict'
import {paymentAccountingEvidence} from '../paymentAccounting.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const instruction={id:id(1),originating_account_id:id(8),amount_cents:10000,mode:'LIVE'}
const base={providerId:id(2),externalId:`vortex_payroll_${id(1)}`,dateMatches:true,liveMode:true,reconciliationStatus:'reconciled'}
const debit={id:1,source:'RECOVERY',result:{...base,status:'COMPLETED',settlementStatus:'BANK_POSTED',settlementEvidence:[{transactionId:id(3),postedDate:'2026-09-18',amountCents:10000,lineItems:[{id:id(4),amountCents:10000}]}]}}
const returned={id:3,source:'RECOVERY',result:{...base,status:'RETURNED',returnEvidenceStatus:'BANK_CREDIT_POSTED',returnEvidence:{transactionId:id(5),lineItemId:id(6),returnId:id(7),postedDate:'2026-09-20',amountCents:10000}}}
test('bank reconciliation deduplicates repeated observations and preserves withdrawal plus return without another wage',()=>{
 const result=paymentAccountingEvidence(instruction,[debit,{...debit,id:2},returned,{...returned,id:4}]);assert.deepEqual(result.issues,[]);assert.equal(result.events.length,2);assert.equal(result.events[0].observationId,2);assert.equal(result.events[1].observationId,4);assert.deepEqual(result.events.map(e=>[e.kind,e.amountCents]),[['WITHDRAWAL',10000],['RETURN',10000]])
})
for(const variant of ['WRONG_PAYMENT','TEST_MODE','MISSING_LINES','WRONG_AMOUNT','DUPLICATE_LINE','CHANGED_EVIDENCE','RETURN_ONLY','MALFORMED_DATE'])test(`bank reconciliation rejects unreliable or incomplete accounting evidence (${variant})`,()=>{
 const candidate=structuredClone(debit)
 if(variant==='WRONG_PAYMENT')candidate.result.externalId=`vortex_payroll_${id(9)}`
 if(variant==='TEST_MODE')candidate.result.liveMode=false
 if(variant==='MISSING_LINES')candidate.result.settlementEvidence[0].lineItems=[]
 if(variant==='WRONG_AMOUNT')candidate.result.settlementEvidence[0].amountCents=9999
 if(variant==='DUPLICATE_LINE')candidate.result.settlementEvidence[0].lineItems.push(candidate.result.settlementEvidence[0].lineItems[0])
 if(variant==='MALFORMED_DATE')candidate.result.settlementEvidence[0].postedDate='2026-02-30'
 if(variant==='CHANGED_EVIDENCE')candidate.result.settlementEvidence[0].postedDate='2026-09-19'
 const rows=variant==='RETURN_ONLY'?[returned]:variant==='CHANGED_EVIDENCE'?[debit,candidate]:[candidate]
 assert.ok(paymentAccountingEvidence(instruction,rows).issues.length>0)
})

test('split bank withdrawals reconcile the entire net amount with stable event ordering',()=>{const split=structuredClone(debit);split.result.settlementEvidence=[{transactionId:id(10),postedDate:'2026-09-19',amountCents:6000,lineItems:[{id:id(11),amountCents:6000}]},{transactionId:id(12),postedDate:'2026-09-18',amountCents:4000,lineItems:[{id:id(13),amountCents:4000}]}];const repeated=structuredClone(split);repeated.id=2;repeated.result.settlementEvidence.reverse();const result=paymentAccountingEvidence(instruction,[split,repeated]);assert.deepEqual(result.issues,[]);assert.equal(result.events.length,2);assert.equal(result.events[0].postedDate,'2026-09-18');assert.ok(result.events.every(e=>e.fundingAccountId===id(8)));assert.equal(result.events.reduce((n,e)=>n+e.amountCents,0),10000)})

for(const status of ['UNCERTAIN','RETURNED'])test(`new unresolved provider evidence keeps accounting in review while preserving known bank movements (${status})`,()=>{const result=paymentAccountingEvidence(instruction,[debit,{id:2,source:'RECOVERY',result:{status}}]);assert.equal(result.events.length,1);assert.ok(result.issues.length);assert.equal(result.events[0].kind,'WITHDRAWAL')})

for(const variant of ['VALID','ACH_ID','EXPIRED_IDENTITY','RETURN'])test(`check accounting requires check-specific bank evidence (${variant})`,()=>{
 const candidate=structuredClone(variant==='RETURN'?returned:debit);candidate.result.externalId=`vortex_payroll_check_${instruction.id}`;candidate.result.expiryMatches=true
 if(variant==='ACH_ID')candidate.result.externalId=base.externalId
 if(variant==='EXPIRED_IDENTITY')candidate.result.expiryMatches=false
 const evidence=paymentAccountingEvidence({...instruction,payment_rail:'CHECK'},[candidate])
 assert.equal(evidence.events.length,variant==='VALID'?1:0);assert.equal(evidence.issues.length===0,variant==='VALID')
})
