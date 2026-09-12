import test from 'node:test'
import assert from 'node:assert/strict'
import {settlementJournalPayload,journalMatches,resolveSettlementJournal} from '../settlementJournal.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const mapping={convention:'CLEARING_LIABILITY',fundingAccountId:id(3),bank:{id:'7',type:'Bank',currency:'USD'},clearing:{id:'6',type:'Other Current Liability',currency:'USD'}},destination={facilityId:1,realmId:'123',environment:'sandbox'}
const event={instructionId:id(1),transactionId:id(2),fundingAccountId:id(3),kind:'WITHDRAWAL',key:`${id(1)}:WITHDRAWAL:${id(2)}`,postedDate:'2026-09-18',amountCents:5970}
test('settlement journals move only net bank amounts between reviewed cash and clearing accounts',()=>{
 const payload=settlementJournalPayload(event,mapping,destination),returned=settlementJournalPayload({...event,kind:'RETURN',key:`${id(1)}:RETURN:${id(2)}`},mapping,destination)
 assert.equal(payload.DocNumber.length,21);assert.notEqual(payload.DocNumber,returned.DocNumber)
 assert.deepEqual(payload.Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value]),[[59.7,'Debit','6'],[59.7,'Credit','7']])
 assert.deepEqual(returned.Line.map(l=>l.JournalEntryLineDetail.AccountRef.value),['7','6'])
 assert.ok(journalMatches({...payload,Id:'55',Line:payload.Line.toReversed()},payload))
 assert.equal(journalMatches({...payload,TxnDate:'2026-09-19'},payload),false)
 assert.throws(()=>settlementJournalPayload({...event,amountCents:0},mapping,destination))
 assert.throws(()=>settlementJournalPayload(event,{...mapping,fundingAccountId:id(9)},destination))
})
for(const variant of ['NORMAL','LOST_RESPONSE','WRONG_ACCOUNT','DUPLICATE','MISSING','CHANGED_DATE'])test(`settlement journal creation has read-only recovery (${variant})`,async()=>{
 const job={id:id(4),payload:settlementJournalPayload(event,mapping,destination)};let journal=null,posts=0
 const request=async(path,options)=>{
  if(options?.body){posts++;assert.equal(path,`journalentry?requestid=${job.id}`);journal={...options.body,Id:'55'};if(variant==='LOST_RESPONSE')throw new Error('Synthetic lost response');return {JournalEntry:journal}}
  if(variant==='MISSING')return {QueryResponse:{}}
  let candidate=journal
  if(journal&&variant==='WRONG_ACCOUNT'){candidate=structuredClone(journal);candidate.Line[0].JournalEntryLineDetail.AccountRef.value='99'}
  if(journal&&variant==='CHANGED_DATE')candidate={...journal,TxnDate:'2026-09-19'}
  return {QueryResponse:{JournalEntry:candidate?(variant==='DUPLICATE'?[candidate,candidate]:[candidate]):[]}}
 }
 assert.equal((await resolveSettlementJournal(job,request)).status,'NOT_FOUND');assert.equal(posts,0)
 const created=await resolveSettlementJournal(job,request,{allowCreate:true});assert.equal(created.status,variant==='LOST_RESPONSE'?'UNCERTAIN':'SYNCED');assert.equal(posts,1)
 const result=await resolveSettlementJournal(job,request);assert.equal(result.status,['WRONG_ACCOUNT','DUPLICATE','CHANGED_DATE'].includes(variant)?'NEEDS_REVIEW':variant==='MISSING'?'NOT_FOUND':'SYNCED');assert.equal(posts,1)
})

test('ambiguous query shapes and missing currency never qualify as confirmed journal evidence',async()=>{const job={id:id(4),payload:settlementJournalPayload(event,mapping,destination)};let posts=0;const request=async(path,options)=>{if(options?.body)posts++;return {}};assert.equal((await resolveSettlementJournal(job,request,{allowCreate:true})).status,'NEEDS_REVIEW');assert.equal(posts,0);const copy=structuredClone(job.payload);delete copy.CurrencyRef;assert.equal(journalMatches(copy,job.payload),false)})
