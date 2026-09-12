import {randomUUID} from 'node:crypto'
import {createHarness} from './harness.js'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
export async function carrierRemittanceFixture({sender,providerIntake}={}){
 const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,journals=new Map();let next=50,order=null,bankReturned=false,now=new Date('2051-01-01T12:00:00Z')
 const fetcher=async(url,options={})=>{let data
  if(url.includes('/account/'))data={Account:{Id:url.split('/').at(-1),Name:'Synthetic account',Active:true,AccountType:url.endsWith('/7')?'Expense':'Other Current Liability',CurrencyRef:{value:'USD'}}}
  else if(url.endsWith('/preferences'))data={Preferences:{AccountingInfoPrefs:{},CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}
  else if(url.includes('/query?')){const doc=decodeURIComponent(url).match(/DocNumber = '([^']+)'/)?.[1],row=journals.get(doc);data={QueryResponse:{JournalEntry:row?[row]:[]}}}
  else if(options.body){const body=JSON.parse(options.body),row={...body,Id:String(++next)};journals.set(row.DocNumber,row);data={JournalEntry:row}}
  else data={JournalEntry:[...journals.values()].find(row=>url.endsWith('/'+row.Id))}
  return {ok:true,status:200,json:async()=>data}
 }
 const paymentFetcher=async(url,options={})=>{
  if(options.method==='POST')order={...JSON.parse(options.body),id:uid(30),live_mode:false,status:'completed',reconciliation_status:'reconciled',transaction_ids:[uid(40)]}
  if(url.includes('/payment_orders'))return {ok:!!order,status:order?200:404,json:async()=>bankReturned?{...order,status:'returned',reconciliation_status:'unreconciled',transaction_ids:[]}:order}
  if(url.includes('/transactions/'))return {ok:true,status:200,json:async()=>({id:uid(40),live_mode:false,internal_account_id:uid(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-18',amount:57500})}
  if(url.includes('/transaction_line_items?'))return {ok:true,status:200,json:async()=>[{id:uid(41),transaction_id:uid(40),transactable_type:'payment_order',transactable_id:uid(30),live_mode:false,type:'originating',amount:57500}]}
  return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:uid(2),currency:'USD',live_mode:false}:{id:uid(3),counterparty_id:uid(4),party_type:'business',party_name:'Synthetic Benefits LLC',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:'2026-09-11T12:00:00Z',account_details:[{id:uid(5),account_number_safe:'1234'}],routing_details:[{id:uid(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}}
 }
 const h=await createHarness({providerIntake,quickbooksFetcher:fetcher,paymentFetcher,carrierNoticeSender:sender,payrollNow:()=>now})
 try{
  const {api,periods}=await monthlyBenefitsFixture(h),run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-REMITTANCE-FIXTURE'})
  const tokens=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[{wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'},tokens]);await syncQuickbooksRun(h.pool,1,run.id,{fetcher})
  const source=(await api('/benefit-carrier-invoices?month=2026-09')).source,invoice=await api('/benefit-carrier-invoices',{month:'2026-09',carrier:'Synthetic Remittance Carrier',invoiceNumber:'REMIT-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic carrier invoice for remittance',reconciliation:'Matched carrier coverage and retained contribution',confirmed:true,fingerprint:source.fingerprint,allocation:{employerExpenseCents:45000,employeeContributionCents:12500,confirmed:true,reference:'Verified payroll contribution for carrier',contributions:[{key:source.contributions[0].key,amountCents:12500}]}})
  const invoicePath=`/benefit-carrier-invoices/${invoice.id}`,selected={prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'},preview=(await api(`${invoicePath}/accounting-check`,selected)).premiumPreview,authorization=await api(`${invoicePath}/premium-authorizations`,{...selected,confirmed:true,reference:'Reviewed carrier premium journal',requestKey:'synthetic-remittance-premium',fingerprint:preview.fingerprint});await api(`/carrier-premium-authorizations/${authorization.id}/post`,{confirmed:true})
  const connection=await api('/payment-connection',{organizationId:uid(1),originatingAccountId:uid(2),apiKey:'synthetic-private-key',mode:'TEST',reference:'Reviewed synthetic employer funding',expectedRevision:0,confirmed:true},'POST',201),payee={carrier:'Synthetic Remittance Carrier',accountId:uid(3),connectionRevision:connection.revision},payeePreview=await api('/carrier-payees/preview',payee)
  await api('/carrier-payees',{...payee,previousId:payeePreview.previousId,fingerprint:payeePreview.fingerprint,confirmed:true,reference:'Independently verified synthetic carrier account'})
  const amount={amountCents:57500,paymentDate:'2026-09-18'},paymentPreview=await api(`${invoicePath}/payment-preview`,amount),payment=await api(`${invoicePath}/payment-authorizations`,{...amount,confirmed:true,outsideActivityReviewed:true,reference:'Reviewed synthetic carrier payment instruction',requestKey:'synthetic-remittance-payment',fingerprint:paymentPreview.fingerprint})
  const dispatchPath=`/carrier-payment-authorizations/${payment.id}/dispatch`;now=new Date('2026-09-17T12:00:00Z');await api(dispatchPath,{action:'SUBMIT',confirmed:true});await api(dispatchPath,{action:'RECOVER',confirmed:true})
  const recipientPath=`${invoicePath}/remittance-recipient`,recipientBody={action:'REVIEW',expectedRevision:0,requestKey:randomUUID(),confirmed:true,name:'Carrier remittance team',email:'carrier@example.test',reference:'Independent synthetic carrier contact verification'};await api(recipientPath,recipientBody)
  const noticePath=`/carrier-payment-authorizations/${payment.id}/remittance-notices`,noticePreview=await api(`${noticePath}/preview`,{}),notice=await api(noticePath,{confirmed:true,reference:'Reviewed exact synthetic remittance notice and recipient',requestKey:randomUUID(),fingerprint:noticePreview.fingerprint})
  return {h,api,invoice,payment,notice,noticePath,recipientPath,recipientBody,now:()=>now,setNow:value=>{now=new Date(value)},returnBank:async()=>{bankReturned=true;await api(dispatchPath,{action:'RECOVER',confirmed:true})}}
 }catch(e){await h.close();throw e}
}
