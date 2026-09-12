import {randomUUID} from 'node:crypto'
import {encryptDocument} from '../onboarding.js'
import {journalPayload} from '../quickbooks.js'
export function retirementReversalAccountingFixture(h,f){
 const journals=new Map(),accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6',retirement:'7'}
 let posts=0
 const fetcher=async(url,options)=>{
  const reply=body=>({ok:true,json:async()=>body})
  if(options.method==='POST'){const entry={...JSON.parse(options.body),Id:String(100+posts++)};journals.set(entry.Id,entry);return reply({JournalEntry:entry})}
  if(url.includes('/query?'))return reply({QueryResponse:{JournalEntry:[...journals.values()].filter(j=>decodeURIComponent(url).includes(j.DocNumber))}})
  const id=url.split('/').pop()
  if(url.includes('/journalentry/'))return reply({JournalEntry:journals.get(id)})
  if(url.endsWith('/preferences'))return reply({Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:{}}})
  return reply({Account:{Id:id,Name:`Account ${id}`,Active:true,AccountType:id==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}})
 }
 const base=`/retirement-remittance-authorizations/${f.remittanceId}`
 const post=async(kind)=>{
  const preview=await f.api(`${base}/${kind}-preview`,{}),a=await f.api(`${base}/${kind}-authorizations`,{fingerprint:preview.fingerprint,requestKey:randomUUID(),confirmed:true,autoPost:true,outsideAccountingReviewed:true,reference:'Reviewed exact original banking and accounting with no outside duplicate journals'})
  return f.api(`/retirement-${kind}-authorizations/${a.id}/post`,{action:'POST',confirmed:true})
 }
 const prepareOriginal=async()=>{
  const run=(await h.pool.query('SELECT r.*,COALESCE(r.payment_date,p.pay_date) pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1',[f.run.id])).rows[0],payload=journalPayload(run,accounts)
  journals.set('99',{...payload,Id:'99'})
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-participant-reversal',expiresAt:Date.now()+3600000})),'quickbooks:1')])
  await h.pool.query("INSERT INTO payroll_quickbooks_sync(facility_id,payroll_run_id,realm_id,environment,request_id,payload,status,external_id) VALUES(1,$1,'123','sandbox','synthetic-reversal-source',$2,'SYNCED','99')",[f.run.id,payload])
  const path='/retirement-plans/standard/settlement-mapping',state=await f.api(path)
  await f.api(path,{confirmed:true,requestKey:randomUUID(),expectedRevision:0,fundingRevisionId:state.funding[0].id,connectionGeneration:state.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'8',liabilityAccountId:'7',reference:'Verified original payroll retirement liability and funding bank'},'POST',201)
  return post('settlement')
 }
 return {fetcher,prepareOriginal,prepareReturn:()=>post('return'),posts:()=>posts}
}
