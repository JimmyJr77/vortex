import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementSettlementEvents} from '../retirementSettlementEvents.js'
import {retirementSettlementJournalPayload,resolveRetirementSettlementJournal} from '../retirementSettlementJournal.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const intent={id:id(1),runId:2,planId:'standard',destinationId:id(3),submitBefore:'2026-09-17T18:00:00Z',fundingRevisionId:1,originatingAccountId:id(4),receivingAccountId:id(5),counterpartyId:id(6),facilityId:1,mode:'TEST',paymentDate:'2026-09-18',amountCents:55000,destinationFingerprint:'1'.repeat(64)}
const result={status:'COMPLETED',settlementStatus:'BANK_POSTED',reconciliationStatus:'reconciled',dateMatches:true,effectiveDate:'2026-09-18',liveMode:false,externalId:`vortex_retirement_${id(1)}`,providerId:id(7),transactionIds:[id(8),id(9)],settlementEvidence:[{transactionId:id(8),postedDate:'2026-09-17',amountCents:25000,lineItems:[{id:id(10),amountCents:10000},{id:id(11),amountCents:15000}]},{transactionId:id(9),postedDate:'2026-09-18',amountCents:30000,lineItems:[{id:id(12),amountCents:30000}]}]}
const mapping={planId:'standard',fundingAccountId:id(4),fundingRevisionId:1,bank:{id:'10',type:'Bank',currency:'USD'},liability:{id:'8',type:'Other Current Liability',currency:'USD'}},company={facilityId:1,realmId:'123',environment:'sandbox'}
test('retirement settlement consumes exact bank allocations and preserves split withdrawal dates independently of provider effective date',()=>{
 const events=retirementSettlementEvents(intent,result);assert.equal(events.length,2);assert.deepEqual(events.map(e=>e.amountCents),[25000,30000]);assert.deepEqual(events.map(e=>e.postedDate),['2026-09-17','2026-09-18'])
 const reordered=structuredClone(result);reordered.transactionIds.reverse();reordered.settlementEvidence.reverse();reordered.settlementEvidence[1].lineItems.reverse();assert.deepEqual(retirementSettlementEvents(intent,reordered),events)
 for(const patch of [{status:'PROVIDER_APPROVED'},{status:'RETURNED'},{settlementStatus:'PENDING'},{reconciliationStatus:'unreconciled'},{dateMatches:false},{effectiveDate:'2026-09-19'},{liveMode:true},{externalId:'other'},{providerId:null},{transactionIds:[id(8),id(8)]},{settlementEvidence:[]}])assert.throws(()=>retirementSettlementEvents(intent,{...result,...patch}))
 for(const mutate of [r=>{r.settlementEvidence[0].amountCents=24999},r=>{r.settlementEvidence[0].lineItems[0].amountCents=9999},r=>{r.settlementEvidence[1].lineItems[0].id=id(10)},r=>{r.settlementEvidence[1].transactionId=id(8)},r=>{r.settlementEvidence[1].postedDate='2026-02-30'},r=>{r.settlementEvidence[1].lineItems[0].amountCents=Number.MAX_SAFE_INTEGER}]){const bad=structuredClone(result);mutate(bad);assert.throws(()=>retirementSettlementEvents(intent,bad))}
})
test('retirement bank journals debit the retirement liability and credit the reviewed bank with stable per-movement identities',()=>{
 const events=retirementSettlementEvents(intent,result),journals=events.map(e=>retirementSettlementJournalPayload(e,mapping,company))
 assert.notEqual(journals[0].DocNumber,journals[1].DocNumber);assert.match(journals[0].DocNumber,/^VTXT-/)
 assert.equal(journals[0].TxnDate,'2026-09-17');assert.deepEqual(journals[0].Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value]),[[250,'Debit','8'],[250,'Credit','10']])
 assert.equal(retirementSettlementJournalPayload(events[0],{...mapping,bank:{...mapping.bank,id:'11'}},company).DocNumber,journals[0].DocNumber)
 for(const patch of [{facilityId:2},{environment:'production'},{realmId:'invalid'}])assert.throws(()=>retirementSettlementJournalPayload(events[0],mapping,{...company,...patch}))
 for(const patch of [{planId:'other'},{fundingAccountId:id(20)},{fundingRevisionId:2},{bank:{...mapping.bank,type:'Expense'}},{bank:{...mapping.bank,id:'8'}},{liability:{...mapping.liability,currency:'EUR'}}])assert.throws(()=>retirementSettlementJournalPayload(events[0],{...mapping,...patch},company))
 assert.throws(()=>retirementSettlementJournalPayload({...events[0],kind:'RETURN'},mapping,company));assert.throws(()=>retirementSettlementJournalPayload({...events[0],amountCents:24999},mapping,company))
})
test('retirement accounting recovery never creates after a lost response or missing journal and refuses mismatched or duplicate provider records',async()=>{
 const payload=retirementSettlementJournalPayload(retirementSettlementEvents(intent,result)[0],mapping,company),job={id:id(30),payload};let stored=null,creates=0
 const request=async(path,options)=>{if(options?.body){creates++;stored={...options.body,Id:'99'};throw new Error('Synthetic lost journal response')}return {QueryResponse:{JournalEntry:stored?[stored]:[]}}}
 assert.deepEqual(await resolveRetirementSettlementJournal(job,request),{status:'NOT_FOUND'});assert.equal(creates,0)
 for(const allowCreate of ['true',1,{}])assert.deepEqual(await resolveRetirementSettlementJournal(job,request,{allowCreate}),{status:'NOT_FOUND'});assert.equal(creates,0)
 assert.deepEqual(await resolveRetirementSettlementJournal(job,request,{allowCreate:true}),{status:'UNCERTAIN'});assert.equal(creates,1)
 assert.deepEqual(await resolveRetirementSettlementJournal(job,request),{status:'SYNCED',journalId:'99'});assert.equal(creates,1)
 const altered={...stored,Line:stored.Line.map(line=>({...line,Amount:249}))}
 assert.deepEqual(await resolveRetirementSettlementJournal(job,async()=>({QueryResponse:{JournalEntry:[altered]}})),{status:'NEEDS_REVIEW'})
 assert.deepEqual(await resolveRetirementSettlementJournal(job,async()=>({QueryResponse:{JournalEntry:[stored,stored]}})),{status:'NEEDS_REVIEW'})
 stored=null;assert.deepEqual(await resolveRetirementSettlementJournal(job,request),{status:'NOT_FOUND'});assert.equal(creates,1)
})
