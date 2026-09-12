import {createHash} from 'node:crypto'
import {journalMatches} from './settlementJournal.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
const positive=v=>Number.isSafeInteger(v)&&v>0
const fail=()=>new Error('Retirement settlement requires exact reviewed bank, plan liability and accounting evidence.')
export function retirementSettlementJournalPayload(event,mapping,{facilityId,realmId,environment}){
 if(!event||event.kind!=='RETIREMENT_WITHDRAWAL'||![event.authorizationId,event.transactionId,event.providerId,event.fundingAccountId].every(uuid)||event.key!==`${event.authorizationId}:RETIREMENT_WITHDRAWAL:${event.transactionId}`||(!positive(event.runId)||!/^[-a-zA-Z0-9]{1,80}$/.test(event.planId||''))||!positive(event.fundingRevisionId)||!positive(event.amountCents)||!date(event.postedDate)||!positive(facilityId)||event.facilityId!==facilityId||!['LIVE','TEST'].includes(event.mode)||environment!==(event.mode==='LIVE'?'production':'sandbox')||typeof realmId!=='string'||!/^\d+$/.test(realmId)||mapping?.planId!==event.planId||mapping?.fundingAccountId!==event.fundingAccountId||mapping?.fundingRevisionId!==event.fundingRevisionId)throw fail()
 for(const [account,type] of [[mapping.bank,'Bank'],[mapping.liability,'Other Current Liability']])if(typeof account?.id!=='string'||!/^\d+$/.test(account.id)||account.type!==type||account.currency!=='USD')throw fail()
 if(mapping.bank.id===mapping.liability.id)throw fail()
 if(!Array.isArray(event.lineItems)||!event.lineItems.length||event.lineItems.some(line=>!uuid(line?.id)||!positive(line.amountCents))||new Set(event.lineItems.map(line=>line.id)).size!==event.lineItems.length||event.lineItems.reduce((sum,line)=>sum+line.amountCents,0)!==event.amountCents)throw fail()
 const document=`VTXT-${createHash('sha256').update(JSON.stringify([facilityId,realmId,environment,event.key])).digest('base64url').slice(0,16)}`
 const payload={TxnDate:event.postedDate,DocNumber:document,PrivateNote:`Vortex retirement bank movement ${event.key}`,CurrencyRef:{value:'USD'},Line:[['Debit',mapping.liability.id],['Credit',mapping.bank.id]].map(([posting,id])=>({Amount:event.amountCents/100,Description:'Retirement contribution bank withdrawal',DetailType:'JournalEntryLineDetail',JournalEntryLineDetail:{PostingType:posting,AccountRef:{value:id}}}))}
 if(!journalMatches(payload,payload))throw fail()
 return payload
}
// A posting coordinator must retain a unique claim before enabling create.
// A missing query result during recovery never authorizes a second create.
export async function resolveRetirementSettlementJournal(job,request,{allowCreate=false}={}){
 if(!uuid(job?.id)||typeof request!=='function'||!/^VTXT-[A-Za-z0-9_-]{16}$/.test(job.payload?.DocNumber)||!journalMatches(job.payload,job.payload))throw fail()
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
