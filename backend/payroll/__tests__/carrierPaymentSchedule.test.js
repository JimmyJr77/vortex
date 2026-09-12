import {prepareCarrierPayment} from '../benefitCarrierInvoice.js'
import {runCarrierPaymentSubmissionSweep} from '../carrierPaymentSchedule.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
test('scheduled carrier submission retains decisions, blocks stale facts and dispatches exactly once when due',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
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

 const schedulePath=`/carrier-payment-authorizations/${authorization.id}/schedule`,dispatchPath=`/carrier-payment-authorizations/${authorization.id}/dispatch`
 dispatchNow=new Date('2026-09-16T12:00:00Z')
 const scheduleBody={submitAt:'2026-09-17T14:00:00.000Z',reference:'Reviewed scheduled carrier submission time',requestKey:'first-carrier-schedule-request',confirmed:true}
 await api(schedulePath,{...scheduleBody,confirmed:false},'POST',400)
 await api(schedulePath,{...scheduleBody,submitAt:'2026-09-18T14:00:00.000Z'},'POST',400)
 const schedules=await Promise.all([api(schedulePath,scheduleBody),api(schedulePath,scheduleBody)]);assert.equal(schedules[0].id,schedules[1].id)
 await api(schedulePath,{...scheduleBody,requestKey:'competing-carrier-schedule-request'},'POST',409)
 await api(dispatchPath,{action:'SUBMIT',confirmed:true},'POST',409)
 const prepare=(db,req,exclude)=>prepareCarrierPayment(db,req,exclude,{fetcher,paymentFetcher}),options={prepare,fetcher:paymentFetcher,facility:1}
 assert.equal((await runCarrierPaymentSubmissionSweep(h.pool,{...options,now:dispatchNow})).attempted,0)
 assert.equal((await runCarrierPaymentSubmissionSweep(h.pool,{...options,facility:2,now:new Date(scheduleBody.submitAt)})).attempted,0)
 changedDestination=true
 assert.equal((await runCarrierPaymentSubmissionSweep(h.pool,{...options,now:new Date(scheduleBody.submitAt)})).blocked,1);assert.equal(paymentWrites,0)
 assert.equal((await runCarrierPaymentSubmissionSweep(h.pool,{...options,now:new Date(scheduleBody.submitAt)})).blocked,0)
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-schedule-${schedules[0].id}`])).rows[0].status,'OPEN')
 const cancellation={scheduleId:schedules[0].id,confirmed:true,reference:'Cancel blocked schedule to recheck carrier instructions'}
 await api(`${schedulePath}/cancel`,cancellation)
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-schedule-${schedules[0].id}`])).rows[0].status,'DISMISSED')
 await api(schedulePath,scheduleBody,'POST',409)
 changedDestination=false;dispatchNow=new Date('2026-09-17T14:05:00Z')
 const next=await api(schedulePath,{...scheduleBody,submitAt:'2026-09-17T14:10:00.000Z',requestKey:'replacement-carrier-schedule-request'})
 const concurrent=await Promise.all([runCarrierPaymentSubmissionSweep(h.pool,{...options,now:new Date('2026-09-17T14:11:00Z')}),runCarrierPaymentSubmissionSweep(h.pool,{...options,now:new Date('2026-09-17T14:11:00Z')})])
 assert.equal(concurrent.reduce((sum,r)=>sum+r.attempted,0),1);assert.equal(paymentWrites,1)
 assert.equal((await runCarrierPaymentSubmissionSweep(h.pool,{...options,now:new Date('2026-09-17T14:20:00Z')})).attempted,0)
 await api(`${schedulePath}/cancel`,{...cancellation,scheduleId:next.id},'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_payment_schedule_cancellation(schedule_id,reference,created_by) VALUES($1,$2,99)',[next.id,cancellation.reference]),/already been claimed/)
 assert.equal((await api(dispatchPath,{action:'RECOVER',confirmed:true})).result.status,'PROVIDER_APPROVED');assert.equal(paymentWrites,1)
 const row=(await api(authPath)).history.find(r=>r.id===authorization.id);assert.equal(row.claimed,true);assert.equal(row.schedules.length,2);assert.equal(row.schedules.find(s=>s.id===next.id).attempt.status,'CLAIMED')
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payment_schedule'),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payment_schedule_attempt'),/append-only/)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${schedulePath}`,{method:'POST',headers,body:JSON.stringify(scheduleBody)})).status,404)
})
