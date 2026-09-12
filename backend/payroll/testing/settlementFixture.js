import assert from 'node:assert/strict'
import {encryptDocument} from '../onboarding.js'
export async function configureSettlementFixture(h,api,runId,paymentConnectionId,setFetcher){
 const state={posts:0,loseNextSettlement:true,badGross:false,badWithdrawal:false,journals:new Map()}
 const bank={Id:'7',Name:'Payroll Bank',Active:true,AccountType:'Bank',CurrencyRef:{value:'USD'}},clearing={Id:'6',Name:'Payroll Clearing',Active:true,AccountType:'Other Current Liability'}
 const fetcher=async(url,options)=>{
  const parsed=new URL(url),path=parsed.pathname
  assert.ok(url.startsWith('https://sandbox-quickbooks.api.intuit.com/v3/company/123/'))
  if(options.method==='POST'){
   const payload=JSON.parse(options.body),settlement=payload.DocNumber.startsWith('VTXB-')
   if(settlement){state.posts++;assert.equal((await h.pool.query('SELECT * FROM payroll_settlement_journal_claim WHERE journal_id=$1',[parsed.searchParams.get('requestid')])).rowCount,1)}
   const journal={...payload,CurrencyRef:{value:'USD'},Id:String(100+state.journals.size)};state.journals.set(journal.Id,journal)
   if(settlement&&state.loseNextSettlement){state.loseNextSettlement=false;throw new Error('Synthetic lost journal response')}
   return {ok:true,json:async()=>({JournalEntry:journal})}
  }
  if(path.endsWith('/preferences'))return {ok:true,json:async()=>({Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}}}})}
  if(path.includes('/account/'))return {ok:true,json:async()=>({Account:path.endsWith('/7')?bank:clearing})}
  if(path.endsWith('/query')){const doc=parsed.searchParams.get('query').match(/DocNumber = '([^']+)'/)[1];return {ok:true,json:async()=>({QueryResponse:{JournalEntry:[...state.journals.values()].filter(j=>j.DocNumber===doc)}})}}
  const original=state.journals.get(path.split('/').at(-1)),journal=original?structuredClone(original):null
  if(journal&&((state.badGross&&journal.Id==='100')||(state.badWithdrawal&&journal.Id==='101')))journal.TxnDate='2026-09-19'
  return {ok:true,json:async()=>({JournalEntry:journal})}
 }
 setFetcher(fetcher)
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,encrypted_tokens,environment,account_ids) VALUES(1,'123',$1,'sandbox',$2)",[encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-settlement-token',refresh_token:'synthetic-refresh',expiresAt:Date.now()+3600000})),'quickbooks:1'),{wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'}])
 const mapping=await api('/quickbooks/payment-mapping')
 await api('/quickbooks/payment-mapping',{paymentConnectionId,connectionGeneration:mapping.connection.generation,realmId:'123',environment:'sandbox',expectedRevision:0,bankAccountId:'7',clearingAccountId:'6',reference:'Synthetic reviewed settlement mapping',confirmed:true},'POST',201)
 await api(`/quickbooks/runs/${runId}/sync`,{})
 return state
}
