import {createHash} from 'node:crypto'
const fail=()=>new Error('Settlement journal does not match the retained bank movement.')
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
export function settlementJournalPayload(event,mapping,{facilityId,realmId,environment}){
 if(!event||!['WITHDRAWAL','RETURN'].includes(event.kind)||!uuid(event.instructionId)||!uuid(event.transactionId)||event.key!==`${event.instructionId}:${event.kind}:${event.transactionId}`||!Number.isSafeInteger(event.amountCents)||event.amountCents<=0||!date(event.postedDate)||event.fundingAccountId!==mapping?.fundingAccountId||mapping?.convention!=='CLEARING_LIABILITY'||mapping.bank?.type!=='Bank'||mapping.clearing?.type!=='Other Current Liability'||mapping.bank?.currency!=='USD'||mapping.clearing?.currency!=='USD'||![mapping.bank.id,mapping.clearing.id].every(v=>typeof v==='string'&&/^\d+$/.test(v))||mapping.bank.id===mapping.clearing.id||!Number.isSafeInteger(facilityId)||facilityId<=0||typeof realmId!=='string'||!/^\d+$/.test(realmId)||!['sandbox','production'].includes(environment))throw fail()
 const doc=`VTXB-${createHash('sha256').update(JSON.stringify([facilityId,realmId,environment,event.key])).digest('base64url').slice(0,16)}`
 const debit=event.kind==='WITHDRAWAL'?mapping.clearing.id:mapping.bank.id,credit=event.kind==='WITHDRAWAL'?mapping.bank.id:mapping.clearing.id
 return {TxnDate:event.postedDate,DocNumber:doc,PrivateNote:`Vortex bank movement ${event.key}`,CurrencyRef:{value:'USD'},Line:[['Debit',debit],['Credit',credit]].map(([posting,id])=>({Amount:event.amountCents/100,Description:`Payroll ${event.kind==='WITHDRAWAL'?'withdrawal':'returned credit'}`,DetailType:'JournalEntryLineDetail',JournalEntryLineDetail:{PostingType:posting,AccountRef:{value:id}}}))}
}
function normalized(journal){
 if(!journal||!date(journal.TxnDate)||typeof journal.DocNumber!=='string'||typeof journal.PrivateNote!=='string'||!Array.isArray(journal.Line)||!journal.Line.length||journal.CurrencyRef?.value&&journal.CurrencyRef.value!=='USD')throw fail()
 let balance=0
 const lines=journal.Line.map(line=>{
  const detail=line.JournalEntryLineDetail,cents=Math.round(line.Amount*100)
  if(line.DetailType!=='JournalEntryLineDetail'||!['Debit','Credit'].includes(detail?.PostingType)||!/^\d+$/.test(detail?.AccountRef?.value)||typeof line.Amount!=='number'||!Number.isSafeInteger(cents)||cents<=0||Math.abs(line.Amount*100-cents)>0.000001||detail.TaxCodeRef)throw fail()
  balance+=detail.PostingType==='Debit'?cents:-cents
  if(!Number.isSafeInteger(balance))throw fail()
  return {cents,posting:detail.PostingType,accountId:String(detail.AccountRef.value),description:line.Description||''}
 }).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 if(balance!==0||journal.TxnTaxDetail?.TotalTax)throw fail()
 return {date:journal.TxnDate,document:journal.DocNumber,note:journal.PrivateNote,lines}
}
export function journalMatches(actual,expected){try{if(expected?.CurrencyRef?.value&&actual?.CurrencyRef?.value!==expected.CurrencyRef.value)return false;return JSON.stringify(normalized(actual))===JSON.stringify(normalized(expected))}catch{return false}}
// The caller must commit a unique operation claim before allowCreate=true.
// Once claimed, every retry defaults to query-only recovery.
export async function resolveSettlementJournal(job,request,{allowCreate=false}={}){
 if(!uuid(job?.id)||typeof request!=='function'||!/^VTXB-[A-Za-z0-9_-]{16}$/.test(job.payload?.DocNumber)||!journalMatches(job.payload,job.payload))throw fail()
 const receipt=journal=>/^[1-9]\d*$/.test(String(journal?.Id))&&journalMatches(journal,job.payload)?{status:'SYNCED',journalId:String(journal.Id)}:{status:'NEEDS_REVIEW'}
 try{
  const query=`select * from JournalEntry where DocNumber = '${job.payload.DocNumber}' maxresults 2`
  const found=await request(`query?query=${encodeURIComponent(query)}`)
  if(!found?.QueryResponse||typeof found.QueryResponse!=='object'||Array.isArray(found.QueryResponse))return {status:'NEEDS_REVIEW'}
  const rows=found.QueryResponse.JournalEntry===undefined?[]:found.QueryResponse.JournalEntry
  if(!Array.isArray(rows)||rows.length>1)return {status:'NEEDS_REVIEW'}
  if(rows.length)return receipt(rows[0])
  if(allowCreate!==true)return {status:'NOT_FOUND'}
  const result=await request(`journalentry?requestid=${job.id}`,{body:job.payload})
  return receipt(result.JournalEntry)
 }catch{return {status:'UNCERTAIN'}}
}
