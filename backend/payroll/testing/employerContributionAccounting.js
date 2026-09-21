import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {encryptDocument} from '../onboarding.js'

export function employerContributionAccounting(){
 const journals=new Map();let posts=0
 const fetcher=async(url,options)=>{
  const reply=body=>({ok:true,json:async()=>body})
  if(options.method==='POST'){const journal={...JSON.parse(options.body),Id:String(++posts)};journals.set(journal.Id,journal);return reply({JournalEntry:journal})}
  if(url.includes('/query?'))return reply({QueryResponse:{JournalEntry:[...journals.values()].filter(j=>decodeURIComponent(url).includes(j.DocNumber))}})
  const id=url.split('/').pop()
  if(url.includes('/journalentry/'))return reply({JournalEntry:journals.get(id)})
  if(url.endsWith('/preferences'))return reply({Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:{}}})
  return reply({Account:{Id:id,Name:`Synthetic account ${id}`,Active:true,AccountType:id==='8'?'Bank':id==='9'?'Expense':'Other Current Liability',CurrencyRef:{value:'USD'}}})
 }
 const verify=async(h,api,{authorizationId,runId})=>{
  const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6',retirement:'7',employerRetirement:'9'}
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-combined-accounting',expiresAt:Date.now()+3600000})),'quickbooks:1')])
  const sync=await api(`/quickbooks/runs/${runId}/sync`,{})
  assert.equal(sync.status,'SYNCED');assert.equal(posts,1)
  const original=journals.get(sync.external_id),lines=original.Line
  const sum=(account,kind)=>lines.filter(l=>l.JournalEntryLineDetail.AccountRef.value===account&&l.JournalEntryLineDetail.PostingType===kind).reduce((n,l)=>n+l.Amount,0)
  assert.equal(sum('9','Debit'),10);assert.equal(sum('7','Credit'),24)
  await api(`/quickbooks/runs/${runId}/sync`,{});assert.equal(posts,1)
  const path='/retirement-plans/standard/settlement-mapping',state=await api(path)
  await api(path,{confirmed:true,requestKey:randomUUID(),expectedRevision:0,fundingRevisionId:state.funding[0].id,connectionGeneration:state.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'8',liabilityAccountId:'7',reference:'Reviewed synthetic combined liability and funding bank mapping'},'POST',201)
  const base=`/retirement-remittance-authorizations/${authorizationId}`,preview=await api(`${base}/settlement-preview`,{})
  assert.equal(preview.journals.length,1)
  assert.deepEqual(preview.journals[0].payload.Line.map(l=>[l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value,l.Amount]),[['Debit','7',24],['Credit','8',24]])
  const body={fingerprint:preview.fingerprint,requestKey:randomUUID(),confirmed:true,autoPost:true,outsideAccountingReviewed:true,reference:'Reviewed combined bank withdrawal and absence of duplicate settlement journals'}
  const auth=await api(`${base}/settlement-authorizations`,body),postPath=`/retirement-settlement-authorizations/${auth.id}/post`
  const results=await Promise.all([api(postPath,{action:'POST',confirmed:true}),api(postPath,{action:'POST',confirmed:true})])
  assert.ok(results.some(r=>r.status==='SYNCED'));assert.equal(posts,2)
  const assessment=await api(`${base}/assessment`)
  assert.equal(assessment.accountingStatus,'MATCHED');assert.equal(assessment.status,'RECONCILED')
 }
 return {fetcher,verify}
}
