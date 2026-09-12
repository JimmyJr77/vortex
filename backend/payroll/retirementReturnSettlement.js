import {createHash} from 'node:crypto'
import {retirementSettlementEvents} from './retirementSettlementEvents.js'
import {retirementSettlementJournalPayload} from './retirementSettlementJournal.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const fail=()=>new Error('Retirement return accounting requires the exact original withdrawal and verified full returned bank credit.')
// The coordinator must reverify source accounting and current returned-credit
// evidence before authorization or posting. These functions perform no I/O.
export function retirementReturnSettlementEvent(intent,withdrawal,returned){
 const originals=retirementSettlementEvents(intent,withdrawal),credit=returned?.returnEvidence
 if(returned?.status!=='RETURNED'||returned.settlementStatus!=='EXCEPTION'||returned.returnEvidenceStatus!=='BANK_CREDIT_POSTED'||returned.providerId!==withdrawal.providerId||returned.externalId!==withdrawal.externalId||returned.liveMode!==withdrawal.liveMode||returned.dateMatches!==true||returned.effectiveDate!==intent.paymentDate||!credit||![credit.returnId,credit.transactionId,credit.lineItemId].every(uuid)||credit.amountCents!==intent.amountCents||!date(credit.postedDate)||originals.some(e=>e.postedDate>credit.postedDate||e.transactionId===credit.transactionId||e.lineItems.some(l=>l.id===credit.lineItemId)))throw fail()
 return {kind:'RETIREMENT_RETURN_CREDIT',key:`${intent.id}:RETIREMENT_RETURN_CREDIT:${credit.returnId}:${credit.transactionId}`,authorizationId:intent.id,runId:intent.runId,planId:intent.planId,facilityId:intent.facilityId,providerId:returned.providerId,returnId:credit.returnId,transactionId:credit.transactionId,fundingRevisionId:intent.fundingRevisionId,fundingAccountId:intent.originatingAccountId,mode:intent.mode,amountCents:credit.amountCents,postedDate:credit.postedDate,lineItems:[{id:credit.lineItemId,amountCents:credit.amountCents}],withdrawalKeys:originals.map(e=>e.key)}
}
export function retirementReturnSettlementJournalPayload(event,mapping,company){
 if(event?.kind!=='RETIREMENT_RETURN_CREDIT'||!uuid(event.returnId)||event.key!==`${event.authorizationId}:RETIREMENT_RETURN_CREDIT:${event.returnId}:${event.transactionId}`||!Array.isArray(event.withdrawalKeys)||!event.withdrawalKeys.length||event.withdrawalKeys.length>10||new Set(event.withdrawalKeys).size!==event.withdrawalKeys.length||event.withdrawalKeys.some(k=>typeof k!=='string'||!k.startsWith(`${event.authorizationId}:RETIREMENT_WITHDRAWAL:`)||!uuid(k.slice(`${event.authorizationId}:RETIREMENT_WITHDRAWAL:`.length)))||event.lineItems?.length!==1)throw fail()
 const payload=retirementSettlementJournalPayload({...event,kind:'RETIREMENT_WITHDRAWAL',key:`${event.authorizationId}:RETIREMENT_WITHDRAWAL:${event.transactionId}`},mapping,company)
 payload.DocNumber=`VTXT-${createHash('sha256').update(JSON.stringify([company.facilityId,company.realmId,company.environment,event.key])).digest('base64url').slice(0,16)}`
 payload.PrivateNote=`Vortex retirement returned bank movement ${event.key}`
 payload.Line=payload.Line.map(line=>({...line,Description:'Retirement contribution returned bank credit',JournalEntryLineDetail:{...line.JournalEntryLineDetail,PostingType:line.JournalEntryLineDetail.PostingType==='Debit'?'Credit':'Debit'}}))
 return payload
}
