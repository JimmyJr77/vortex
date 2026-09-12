import {createHash} from 'node:crypto'
import {modernTreasuryCarrierInstruction} from './modernTreasuryCarrierPayments.js'
import {journalMatches} from './settlementJournal.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const positive=v=>Number.isSafeInteger(v)&&v>0
const fail=()=>new Error('Carrier settlement requires exact retained payment, bank and accounting evidence.')
// Consume only the verified adapter result. Provider approval/completion alone
// cannot create an accounting event. The coordinator must fetch this evidence
// again before retaining or posting any journal.
export function carrierSettlementEvents(intent,result){
 const expected=modernTreasuryCarrierInstruction(intent)
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
  events.push({key:`${intent.id}:CARRIER_WITHDRAWAL:${bank.transactionId}`,kind:'CARRIER_WITHDRAWAL',authorizationId:intent.id,invoiceId:intent.invoiceId,invoiceRevision:intent.invoiceRevision,facilityId:intent.facilityId,providerId:result.providerId,transactionId:bank.transactionId,fundingRevisionId:intent.fundingRevisionId,fundingAccountId:intent.originatingAccountId,mode:intent.mode,amountCents:amount,postedDate:bank.postedDate,lineItems})
 }
 if(total!==intent.amountCents)throw fail()
 return events.sort((a,b)=>a.transactionId.localeCompare(b.transactionId))
}
export function carrierSettlementJournalPayload(event,mapping,{facilityId,realmId,environment}){
 if(!event||event.kind!=='CARRIER_WITHDRAWAL'||![event.authorizationId,event.invoiceId,event.transactionId,event.providerId,event.fundingAccountId].every(uuid)||event.key!==`${event.authorizationId}:CARRIER_WITHDRAWAL:${event.transactionId}`||!positive(event.invoiceRevision)||!positive(event.fundingRevisionId)||!positive(event.amountCents)||!date(event.postedDate)||!positive(facilityId)||event.facilityId!==facilityId||!['LIVE','TEST'].includes(event.mode)||environment!==(event.mode==='LIVE'?'production':'sandbox')||typeof realmId!=='string'||!/^\d+$/.test(realmId)||mapping?.fundingAccountId!==event.fundingAccountId||mapping?.fundingRevisionId!==event.fundingRevisionId)throw fail()
 for(const [account,type] of [[mapping.bank,'Bank'],[mapping.liability,'Other Current Liability']])if(typeof account?.id!=='string'||!/^\d+$/.test(account.id)||account.type!==type||account.currency!=='USD')throw fail()
 if(mapping.bank.id===mapping.liability.id)throw fail()
 if(!Array.isArray(event.lineItems)||!event.lineItems.length||event.lineItems.some(line=>!uuid(line?.id)||!positive(line.amountCents))||new Set(event.lineItems.map(line=>line.id)).size!==event.lineItems.length||event.lineItems.reduce((sum,line)=>sum+line.amountCents,0)!==event.amountCents)throw fail()
 const document=`VTXK-${createHash('sha256').update(JSON.stringify([facilityId,realmId,environment,event.key])).digest('base64url').slice(0,16)}`
 const payload={TxnDate:event.postedDate,DocNumber:document,PrivateNote:`Vortex carrier bank movement ${event.key}`,CurrencyRef:{value:'USD'},Line:[['Debit',mapping.liability.id],['Credit',mapping.bank.id]].map(([posting,id])=>({Amount:event.amountCents/100,Description:'Carrier premium bank withdrawal',DetailType:'JournalEntryLineDetail',JournalEntryLineDetail:{PostingType:posting,AccountRef:{value:id}}}))}
 if(!journalMatches(payload,payload))throw fail()
 return payload
}
// A posting coordinator must retain a unique claim before enabling create.
// A missing query result during recovery never authorizes a second create.
export async function resolveCarrierSettlementJournal(job,request,{allowCreate=false}={}){
 if(!uuid(job?.id)||typeof request!=='function'||!/^VTXK-[A-Za-z0-9_-]{16}$/.test(job.payload?.DocNumber)||!journalMatches(job.payload,job.payload))throw fail()
 const receipt=journal=>/^[1-9]\d*$/.test(String(journal?.Id))&&journalMatches(journal,job.payload)?{status:'SYNCED',journalId:String(journal.Id)}:{status:'NEEDS_REVIEW'}
 try{
  const query=`select * from JournalEntry where DocNumber = '${job.payload.DocNumber}' maxresults 2`,found=await request(`query?query=${encodeURIComponent(query)}`)
  if(!found?.QueryResponse||typeof found.QueryResponse!=='object'||Array.isArray(found.QueryResponse))return {status:'NEEDS_REVIEW'}
  const rows=found.QueryResponse.JournalEntry===undefined?[]:found.QueryResponse.JournalEntry
  if(!Array.isArray(rows)||rows.length>1)return {status:'NEEDS_REVIEW'}
  if(rows.length)return receipt(rows[0])
  if(allowCreate!==true)return {status:'NOT_FOUND'}
  return receipt((await request(`journalentry?requestid=${job.id}`,{body:job.payload})).JournalEntry)
 }catch{return {status:'UNCERTAIN'}}
}
