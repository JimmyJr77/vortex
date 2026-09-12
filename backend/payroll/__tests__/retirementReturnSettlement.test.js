import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementSettlementEvents} from '../retirementSettlementEvents.js'
import {retirementReturnSettlementEvent,retirementReturnSettlementJournalPayload} from '../retirementReturnSettlement.js'
import {retirementSettlementJournalPayload,resolveRetirementSettlementJournal} from '../retirementSettlementJournal.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const intent={id:id(1),runId:2,planId:'standard',destinationId:id(3),submitBefore:'2026-09-17T18:00:00Z',fundingRevisionId:1,originatingAccountId:id(4),receivingAccountId:id(5),counterpartyId:id(6),facilityId:1,mode:'TEST',paymentDate:'2026-09-18',amountCents:55000,destinationFingerprint:'1'.repeat(64)}
const result={status:'COMPLETED',settlementStatus:'BANK_POSTED',reconciliationStatus:'reconciled',dateMatches:true,effectiveDate:'2026-09-18',liveMode:false,externalId:`vortex_retirement_${id(1)}`,providerId:id(7),transactionIds:[id(8),id(9)],settlementEvidence:[{transactionId:id(8),postedDate:'2026-09-17',amountCents:25000,lineItems:[{id:id(10),amountCents:10000},{id:id(11),amountCents:15000}]},{transactionId:id(9),postedDate:'2026-09-18',amountCents:30000,lineItems:[{id:id(12),amountCents:30000}]}]}
const mapping={planId:'standard',fundingAccountId:id(4),fundingRevisionId:1,bank:{id:'10',type:'Bank',currency:'USD'},liability:{id:'8',type:'Other Current Liability',currency:'USD'}},company={facilityId:1,realmId:'123',environment:'sandbox'}
const returned={...result,status:'RETURNED',settlementStatus:'EXCEPTION',returnEvidenceStatus:'BANK_CREDIT_POSTED',returnEvidence:{returnId:id(40),transactionId:id(41),lineItemId:id(42),amountCents:55000,postedDate:'2026-09-20'}}
test('verified full retirement return restores the original liability on the actual bank-credit date',async()=>{
 const event=retirementReturnSettlementEvent(intent,result,returned),payload=retirementReturnSettlementJournalPayload(event,mapping,company)
 assert.equal(event.withdrawalKeys.length,2);assert.equal(payload.TxnDate,'2026-09-20')
 assert.deepEqual(payload.Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value]),[[550,'Credit','8'],[550,'Debit','10']])
 const original=retirementSettlementJournalPayload(retirementSettlementEvents(intent,result)[0],mapping,company)
 assert.notEqual(payload.DocNumber,original.DocNumber)
 assert.equal(retirementReturnSettlementJournalPayload(event,{...mapping,bank:{...mapping.bank,id:'11'}},company).DocNumber,payload.DocNumber)
 let creates=0,stored=null;const request=async(path,options)=>{if(options?.body){creates++;stored={...options.body,Id:'100'};throw new Error('Synthetic lost credit journal response')}return {QueryResponse:{JournalEntry:stored?[stored]:[]}}}
 const job={id:id(50),payload}
 assert.equal((await resolveRetirementSettlementJournal(job,request,{allowCreate:true})).status,'UNCERTAIN')
 assert.equal((await resolveRetirementSettlementJournal(job,request)).status,'SYNCED');assert.equal(creates,1)
 stored=null;assert.equal((await resolveRetirementSettlementJournal(job,request)).status,'NOT_FOUND');assert.equal(creates,1)
})
test('retirement credit events reject unverified, partial, mismatched and impossible bank evidence',()=>{
 for(const patch of [{status:'REVERSED'},{returnEvidenceStatus:'NEEDS_REVIEW'},{providerId:id(99)},{externalId:'different'},{liveMode:true},{dateMatches:false},{effectiveDate:'2026-09-19'}])assert.throws(()=>retirementReturnSettlementEvent(intent,result,{...returned,...patch}))
 for(const patch of [{amountCents:54999},{returnId:null},{transactionId:id(8)},{lineItemId:id(10)},{postedDate:'2026-09-16'},{postedDate:'2026-02-30'}])assert.throws(()=>retirementReturnSettlementEvent(intent,result,{...returned,returnEvidence:{...returned.returnEvidence,...patch}}))
 assert.throws(()=>retirementReturnSettlementEvent(intent,{...result,settlementStatus:'PENDING'},returned))
 const event=retirementReturnSettlementEvent(intent,result,returned)
 for(const patch of [{kind:'RETIREMENT_WITHDRAWAL'},{key:'other'},{withdrawalKeys:[]},{withdrawalKeys:['other']},{returnId:null}])assert.throws(()=>retirementReturnSettlementJournalPayload({...event,...patch},mapping,company))
 assert.throws(()=>retirementReturnSettlementJournalPayload(event,{...mapping,planId:'other'},company))
})
