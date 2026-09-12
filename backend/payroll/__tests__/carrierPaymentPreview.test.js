import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
test('carrier payment preview binds current invoice liability, payee and funding without sending',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const key=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='27'.repeat(32);t.after(()=>{if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key})
 const journals=new Map();let hiddenDoc=null,nextId=50,creates=0
 const fetcher=async(url,options)=>{let data
  if(url.includes('/account/'))data={Account:{Id:url.split('/').at(-1),Name:'Synthetic account',Active:true,AccountType:url.endsWith('/7')?'Expense':'Other Current Liability',CurrencyRef:{value:'USD'}}}
  else if(url.endsWith('/preferences'))data={Preferences:{AccountingInfoPrefs:{},CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}
  else if(url.includes('/query?')){const doc=decodeURIComponent(url).match(/DocNumber = '([^']+)'/)?.[1],row=doc===hiddenDoc?null:journals.get(doc);data={QueryResponse:{JournalEntry:row?[row]:[]}}}
  else if(options.body){const payload=JSON.parse(options.body),row={...payload,Id:String(++nextId)};journals.set(row.DocNumber,row);creates++;data={JournalEntry:row}}
  else data={JournalEntry:[...journals.values()].find(j=>url.endsWith('/'+j.Id))}
  return {ok:true,status:200,json:async()=>data}
 }
 let changedDestination=false,paymentWrites=0
 const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const paymentFetcher=async(url,options)=>{if(options.method==='POST')paymentWrites++;return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:uid(2),currency:'USD',live_mode:false}:{id:uid(3),counterparty_id:uid(4),party_type:'business',party_name:'Synthetic Benefits LLC',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:changedDestination?'2026-09-11T12:01:00Z':'2026-09-11T12:00:00Z',account_details:[{id:uid(5),account_number_safe:'1234'}],routing_details:[{id:uid(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}}}
 const h=await createHarness({quickbooksFetcher:fetcher,paymentFetcher});t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-INVOICE-CORRECTION'})
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'},tokens=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,tokens]);await syncQuickbooksRun(h.pool,1,run.id,{fetcher})
 const path='/benefit-carrier-invoices',source=(await api(`${path}?month=2026-09`)).source
 const body={month:'2026-09',carrier:'Synthetic Health',invoiceNumber:'CORRECT-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic carrier invoice reference',reconciliation:'Matched coverage and retained employee contribution',confirmed:true,fingerprint:source.fingerprint,allocation:{employerExpenseCents:45000,employeeContributionCents:12500,confirmed:true,reference:'Verified retained payroll contribution',contributions:[{key:source.contributions[0].key,amountCents:12500}]}}
 const invoice=await api(path,body),selected={prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'},preview=(await api(`${path}/${invoice.id}/accounting-check`,selected)).premiumPreview
 const a=await api(`${path}/${invoice.id}/premium-authorizations`,{...selected,confirmed:true,reference:'Reviewed original premium journal',requestKey:'original-correction-premium-request',fingerprint:preview.fingerprint});await api(`/carrier-premium-authorizations/${a.id}/post`,{confirmed:true})

 const paymentPath=`${path}/${invoice.id}/payment-preview`,payment={amountCents:57500,paymentDate:'2026-09-18'}
 await api(paymentPath,payment,'POST',409)
 const conn=await api('/payment-connection',{organizationId:uid(1),originatingAccountId:uid(2),apiKey:'synthetic-private-key',mode:'TEST',reference:'Reviewed employer funding',expectedRevision:0,confirmed:true},'POST',201)
 const payeeBody={carrier:'Synthetic Health',accountId:uid(3),connectionRevision:conn.revision},p=await api('/carrier-payees/preview',payeeBody)
 await api('/carrier-payees',{...payeeBody,previousId:p.previousId,fingerprint:p.fingerprint,confirmed:true,reference:'Independently verified carrier instructions'})
 const ready=await api(paymentPath,payment)
 assert.equal(ready.status,'PREVIEW_ONLY');assert.equal(ready.premiumJournalId,'52');assert.equal(ready.destination.accountLast4,'1234');assert.equal(ready.amountCents,57500);assert.equal(ready.liabilityAccount.id,'8');assert.equal(JSON.stringify(ready).includes(uid(3)),false)
 for(const patch of [{amountCents:57501},{amountCents:0},{amountCents:0.5},{paymentDate:'2026-02-30'}])await api(paymentPath,{...payment,...patch},'POST',400)
 await api(paymentPath,{...payment,paymentDate:'2026-08-31'},'POST',409)
 assert.notEqual((await api(paymentPath,{...payment,amountCents:25000})).fingerprint,ready.fingerprint)
 assert.equal((await api(paymentPath,payment)).fingerprint,ready.fingerprint)
 changedDestination=true;await api(paymentPath,payment,'POST',409);changedDestination=false
 hiddenDoc=preview.payload.DocNumber;await api(paymentPath,payment,'POST',409);hiddenDoc=null
 const original=journals.get(preview.payload.DocNumber);journals.set(preview.payload.DocNumber,{...original,Id:'999'});await api(paymentPath,payment,'POST',409);journals.set(preview.payload.DocNumber,original)
 const headers={Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'}
 assert.equal((await fetch(`${h.url}/api/admin/payroll${paymentPath}`,{method:'POST',headers,body:JSON.stringify(payment)})).status,404)
 const reverse=await api(`/carrier-premium-authorizations/${a.id}/reversal-preview`,{reversalDate:'2026-09-02'})
 const reversal=await api(`/carrier-premium-authorizations/${a.id}/reversal-authorizations`,{confirmed:true,reference:'Reviewed pending reversal before payment',requestKey:'block-payment-with-reversal',reversalDate:'2026-09-02',fingerprint:reverse.fingerprint})
 await api(paymentPath,payment,'POST',409)
 await api(`/carrier-reversal-authorizations/${reversal.id}/cancel`,{confirmed:true,reference:'Cancelled pending accounting correction'})
 assert.equal((await api(paymentPath,payment)).fingerprint,ready.fingerprint)
 await api('/payment-connection',{organizationId:uid(1),originatingAccountId:uid(2),apiKey:'new-synthetic-private-key',mode:'TEST',reference:'Reviewed replacement funding credential',expectedRevision:conn.revision,confirmed:true},'POST',201)
 await api(paymentPath,payment,'POST',409);assert.equal(paymentWrites,0);assert.equal(creates,2)
})
