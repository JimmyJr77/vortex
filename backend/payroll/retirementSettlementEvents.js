import {modernTreasuryRetirementInstruction} from './modernTreasuryRetirementPayments.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const positive=v=>Number.isSafeInteger(v)&&v>0
const fail=()=>new Error('Retirement settlement requires exact retained payment, bank and accounting evidence.')
// Consume only the verified adapter result. Provider approval/completion alone
// cannot create an accounting event. The coordinator must fetch this evidence
// again before retaining or posting any journal.
export function retirementSettlementEvents(intent,result){
 const expected=modernTreasuryRetirementInstruction(intent)
 if(result?.status!=='COMPLETED'||result.settlementStatus!=='BANK_POSTED'||result.reconciliationStatus!=='reconciled'||result.dateMatches!==true||result.effectiveDate!==intent.paymentDate||result.liveMode!==(intent.mode==='LIVE')||result.externalId!==expected.external_id||!uuid(result.providerId))throw fail()
 const ids=result.transactionIds,evidence=result.settlementEvidence
 if(!Array.isArray(ids)||!ids.length||ids.length>10||!ids.every(uuid)||new Set(ids).size!==ids.length||!Array.isArray(evidence)||evidence.length!==ids.length)throw fail()
 const seenTransactions=new Set(),seenLines=new Set(),events=[];let total=0
 for(const bank of evidence){
  if(!uuid(bank?.transactionId)||!ids.includes(bank.transactionId)||seenTransactions.has(bank.transactionId)||!date(bank.postedDate)||!positive(bank.amountCents)||!Array.isArray(bank.lineItems)||!bank.lineItems.length)throw fail()
  seenTransactions.add(bank.transactionId);let amount=0
  const lineItems=bank.lineItems.map(line=>{
   if(!uuid(line?.id)||seenLines.has(line.id)||!positive(line.amountCents))throw fail()
   seenLines.add(line.id);amount+=line.amountCents;if(!Number.isSafeInteger(amount))throw fail()
   return {id:line.id,amountCents:line.amountCents}
  }).sort((a,b)=>a.id.localeCompare(b.id))
  if(amount!==bank.amountCents)throw fail()
  total+=amount;if(!Number.isSafeInteger(total)||total>intent.amountCents)throw fail()
  events.push({key:`${intent.id}:RETIREMENT_WITHDRAWAL:${bank.transactionId}`,kind:'RETIREMENT_WITHDRAWAL',authorizationId:intent.id,runId:intent.runId,planId:intent.planId,facilityId:intent.facilityId,providerId:result.providerId,transactionId:bank.transactionId,fundingRevisionId:intent.fundingRevisionId,fundingAccountId:intent.originatingAccountId,mode:intent.mode,amountCents:amount,postedDate:bank.postedDate,lineItems})
 }
 if(total!==intent.amountCents)throw fail()
 return events.sort((a,b)=>a.transactionId.localeCompare(b.transactionId))
}
