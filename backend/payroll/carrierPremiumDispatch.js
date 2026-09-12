import {journalMatches} from './settlementJournal.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
export async function resolveCarrierPremiumJournal(job,request,{allowCreate=false}={}){
 if(!uuid(job?.id)||typeof request!=='function'||!/^VTXC-[A-Za-z0-9_-]{16}$/.test(job.payload?.DocNumber)||!journalMatches(job.payload,job.payload))throw new Error('Invalid retained premium journal.')
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
