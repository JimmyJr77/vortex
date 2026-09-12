import {recoverCarrierPayments} from '../carrierPaymentRecovery.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
test('automatic carrier recovery is scoped, deduplicated, rate-limited and retains configuration failures and alerts',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
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
 let changedDestination=false,paymentWrites=0,providerOrder=null,providerMissing=false;let dispatchNow=new Date('2051-01-01T12:00:00Z')
 const uid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 const paymentFetcher=async(url,options)=>{
  if(options.method==='POST'){paymentWrites++;providerOrder={...JSON.parse(options.body),id:uid(30),live_mode:false,status:'approved',reconciliation_status:'unreconciled',transaction_ids:[]};throw new Error('Synthetic lost carrier response')}
  if(url.includes('/transactions/'))return {ok:true,status:200,json:async()=>({id:uid(40),live_mode:false,internal_account_id:uid(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-18',amount:25000})}
  if(url.includes('/transaction_line_items?'))return {ok:true,status:200,json:async()=>[{id:uid(41),transaction_id:uid(40),transactable_type:'payment_order',transactable_id:uid(30),live_mode:false,type:'originating',amount:25000}]}
  if(url.includes('/payment_orders/'))return {ok:!!providerOrder&&!providerMissing,status:providerOrder&&!providerMissing?200:404,json:async()=>providerOrder}
  return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:uid(2),currency:'USD',live_mode:false}:{id:uid(3),counterparty_id:uid(4),party_type:'business',party_name:'Synthetic Benefits LLC',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:changedDestination?'2026-09-11T12:01:00Z':'2026-09-11T12:00:00Z',account_details:[{id:uid(5),account_number_safe:'1234'}],routing_details:[{id:uid(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}}
 }

 const h=await createHarness({quickbooksFetcher:fetcher,paymentFetcher,payrollNow:()=>dispatchNow});t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
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

 const authPath=`${path}/${invoice.id}/payment-authorizations`,partial=await api(paymentPath,{...payment,amountCents:25000}),authorization=await api(authPath,{...payment,amountCents:25000,confirmed:true,outsideActivityReviewed:true,reference:'Reviewed carrier payment with no outside activity',requestKey:'carrier-dispatch-authorization',fingerprint:partial.fingerprint})
 const remainder=await api(paymentPath,{...payment,amountCents:32500});await api(authPath,{...payment,amountCents:32500,confirmed:true,outsideActivityReviewed:true,reference:'Separate remaining carrier payment authorization',requestKey:'carrier-remainder-authorization',fingerprint:remainder.fingerprint})
 const dispatchPath=`/carrier-payment-authorizations/${authorization.id}/dispatch`,submit={action:'SUBMIT',confirmed:true}
 await api(dispatchPath,{action:'RECOVER',confirmed:true},'POST',409)
 await api(dispatchPath,submit,'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_payment_claim')).rowCount,0)
 dispatchNow=new Date('2026-09-17T12:00:00Z')
 changedDestination=true;await api(dispatchPath,submit,'POST',409);changedDestination=false
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_payment_claim')).rowCount,0)
 const sent=await api(dispatchPath,submit);assert.equal(sent.result.status,'UNCERTAIN');assert.equal(paymentWrites,1)
 const claim=(await h.pool.query('SELECT * FROM payroll_carrier_payment_claim')).rows[0];assert.equal(claim.encrypted_instruction.includes(Buffer.from(uid(3))),false)
 const cancel={confirmed:true,reference:'Attempt cancel after dispatch claim'}
 await api(`/carrier-payment-authorizations/${authorization.id}/cancel`,cancel,'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_payment_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[authorization.id,cancel.reference]),/requires provider recovery/)
 const alert=async()=>(await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`carrier-payment-${authorization.id}`])).rows[0]?.status
 assert.equal(await alert(),'OPEN')
 const tick=new Date(Date.now()+6*60000)
 assert.equal((await recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:new Date()})).checked,0)
 assert.equal((await recoverCarrierPayments(h.pool,2,{fetcher:paymentFetcher,now:tick})).checked,0)
 const parallel=await Promise.all([recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:tick}),recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:tick})])
 assert.equal(parallel.reduce((n,r)=>n+r.checked,0),1);assert.equal(await alert(),'DISMISSED');assert.equal(paymentWrites,1)
 const afterTick=new Date(tick.getTime()+6*60000)
 delete process.env.PAYROLL_DOCUMENT_KEY
 assert.equal((await recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:afterTick})).needsReview,1)
 assert.equal(await alert(),'OPEN');assert.equal((await api(authPath)).history.find(r=>r.id===authorization.id).result.status,'RECOVERY_UNAVAILABLE')
 assert.equal((await recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:afterTick})).checked,0)
 process.env.PAYROLL_DOCUMENT_KEY='27'.repeat(32)
 assert.equal((await recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:new Date(afterTick.getTime()+6*60000)})).checked,1);assert.equal(await alert(),'DISMISSED')
 const recovered=await Promise.all([api(dispatchPath,submit),api(dispatchPath,{action:'RECOVER',confirmed:true})]);assert.ok(recovered.every(r=>r.recovery&&r.result.status==='PROVIDER_APPROVED'));assert.equal(paymentWrites,1)
 providerMissing=true;assert.equal((await api(dispatchPath,{action:'RECOVER',confirmed:true})).result.status,'NOT_FOUND');assert.equal(paymentWrites,1);providerMissing=false
 const replacement=await api('/payment-connection',{organizationId:uid(1),originatingAccountId:uid(2),apiKey:'new-synthetic-private-key',mode:'TEST',reference:'New employer credential after claimed payment',expectedRevision:conn.revision,confirmed:true},'POST',201);assert.ok(replacement.revision>conn.revision)
 assert.equal((await api(dispatchPath,{action:'RECOVER',confirmed:true})).result.status,'PROVIDER_APPROVED');assert.equal(paymentWrites,1)
 providerOrder={...providerOrder,status:'completed',reconciliation_status:'reconciled',transaction_ids:[uid(40)]};dispatchNow=new Date('2026-09-21T12:00:00Z')
 const settled=await api(dispatchPath,{action:'RECOVER',confirmed:true});assert.equal(settled.result.settlementStatus,'BANK_POSTED');assert.equal(settled.result.settlementEvidence[0].amountCents,25000);assert.equal(paymentWrites,1)
 const hist=await api(authPath),retained=hist.history.find(r=>r.id===authorization.id);assert.equal(retained.claimed,true);assert.equal(retained.result.status,'COMPLETED');assert.equal(hist.availableCents,0)
 const dayTick=new Date(Date.now()+25*3600000)
 assert.equal((await recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:new Date(Date.now()+6*60000)})).checked,0)
 assert.equal((await recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:dayTick})).settled,1)
 providerOrder={...providerOrder,status:'returned'}
 assert.equal((await recoverCarrierPayments(h.pool,1,{fetcher:paymentFetcher,now:new Date(dayTick.getTime()+25*3600000)})).needsReview,1);assert.equal(await alert(),'OPEN');assert.equal(paymentWrites,1)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payment_claim'),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payment_observation'),/append-only/)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${dispatchPath}`,{method:'POST',headers,body:JSON.stringify(submit)})).status,404)
})
