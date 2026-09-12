import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
test('verified reversal reconciliation unlocks a new invoice revision and revalidates prior corrections before reposting',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
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
 const h=await createHarness({quickbooksFetcher:fetcher});t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-INVOICE-CORRECTION'})
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'},tokens=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,tokens]);await syncQuickbooksRun(h.pool,1,run.id,{fetcher})
 const path='/benefit-carrier-invoices',source=(await api(`${path}?month=2026-09`)).source
 const body={month:'2026-09',carrier:'Synthetic Health',invoiceNumber:'CORRECT-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic carrier invoice reference',reconciliation:'Matched coverage and retained employee contribution',confirmed:true,fingerprint:source.fingerprint,allocation:{employerExpenseCents:45000,employeeContributionCents:12500,confirmed:true,reference:'Verified retained payroll contribution',contributions:[{key:source.contributions[0].key,amountCents:12500}]}}
 const invoice=await api(path,body),selected={prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'},preview=(await api(`${path}/${invoice.id}/accounting-check`,selected)).premiumPreview
 const a=await api(`${path}/${invoice.id}/premium-authorizations`,{...selected,confirmed:true,reference:'Reviewed original premium journal',requestKey:'original-correction-premium-request',fingerprint:preview.fingerprint});await api(`/carrier-premium-authorizations/${a.id}/post`,{confirmed:true})
 const reversalPreview=await api(`/carrier-premium-authorizations/${a.id}/reversal-preview`,{reversalDate:'2026-09-02'}),r=await api(`/carrier-premium-authorizations/${a.id}/reversal-authorizations`,{confirmed:true,reference:'Reviewed full reversal before correcting invoice',requestKey:'original-correction-reversal-request',reversalDate:'2026-09-02',fingerprint:reversalPreview.fingerprint})
 const reconcile=`/carrier-reversal-authorizations/${r.id}/reconcile`,review={confirmed:true,reference:'Verified original and reversal offset before corrected invoice'}
 await api(reconcile,review,'POST',409);await api(`/carrier-reversal-authorizations/${r.id}/post`,{confirmed:true});assert.equal(creates,3)
 hiddenDoc=reversalPreview.payload.DocNumber;await api(reconcile,review,'POST',409);hiddenDoc=null;await api(reconcile,{...review,confirmed:false},'POST',400)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${reconcile}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify(review)})).status,404)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_premium_correction(premium_authorization_id,reversal_authorization_id,evidence,reference,created_by) VALUES($1,$2,$3,$4,99)',[a.id,r.id,{originalJournalId:'999',reversalJournalId:'999'},review.reference]),/confirmed matching/)
 const saved=await Promise.all([api(reconcile,review),api(reconcile,review)]);assert.equal(saved[0].id,saved[1].id);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_premium_correction')).rows.length,1);await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_premium_correction'),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_premium_authorization(id,invoice_id,request_key,preview,fingerprint,reference,created_by) SELECT $1,invoice_id,$2,preview,fingerprint,reference,created_by FROM payroll_carrier_premium_authorization WHERE id=$3',['12345678-1234-1234-1234-123456789015','cannot-reuse-reconciled-invoice',a.id]),/Revise the reconciled invoice/)
 await api(`${path}/${invoice.id}/accounting-check`,selected,'POST',409);await api(path,{...body,invoiceNumber:'OTHER-SEP'},'POST',409)
 const revisedBody={...body,previousId:invoice.id,accountingDate:'2026-09-03',amountCents:55000,reconciliation:'Corrected invoice applies one hundred dollars of employee contributions',allocation:{...body.allocation,employeeContributionCents:10000,contributions:[{key:source.contributions[0].key,amountCents:10000}]}}
 await api(path,{...revisedBody,accountingDate:'2026-02-30'},'POST',400)
 await api(path,{...revisedBody,accountingDate:'2026-09-01'},'POST',409)
 hiddenDoc=preview.payload.DocNumber;await api(path,revisedBody,'POST',409);hiddenDoc=null
 const revised=await api(path,revisedBody);assert.notEqual(revised.id,invoice.id)
 const history=(await api(`${path}?month=2026-09`)).history;assert.equal(history[0].revision,2);assert.equal(history[1].superseded,true);assert.equal(history[1].accountingStatus,'CORRECTION_RECONCILED');assert.equal(history[1].authorizations[0].reversals[0].correction_reference,review.reference)
 hiddenDoc=reversalPreview.payload.DocNumber;await api(`${path}/${revised.id}/accounting-check`,selected,'POST',409);hiddenDoc=null
 const correctedPreview=(await api(`${path}/${revised.id}/accounting-check`,selected)).premiumPreview;assert.notEqual(correctedPreview.payload.DocNumber,preview.payload.DocNumber);assert.equal(correctedPreview.payload.TxnDate,'2026-09-03');assert.equal(history[0].invoice.invoiceDate,'2026-09-01')
 const corrected=await api(`${path}/${revised.id}/premium-authorizations`,{...selected,confirmed:true,reference:'Reviewed corrected premium invoice journal',requestKey:'corrected-premium-posting-request',fingerprint:correctedPreview.fingerprint})
 assert.equal((await api(`/carrier-premium-authorizations/${corrected.id}/post`,{confirmed:true})).status,'SYNCED');assert.equal(creates,4)
 const balances={};for(const journal of journals.values())if(/^VTX[CR]-/.test(journal.DocNumber))for(const line of journal.Line){const id=line.JournalEntryLineDetail.AccountRef.value;balances[id]=(balances[id]||0)+Math.round(line.Amount*100)*(line.JournalEntryLineDetail.PostingType==='Debit'?1:-1)}assert.deepEqual(balances,{'7':45000,'5':10000,'8':-55000})
 await api(path,{...body,invoiceNumber:'REMAINDER',amountCents:2500,allocation:{...body.allocation,employerExpenseCents:0,employeeContributionCents:2500,contributions:[{key:source.contributions[0].key,amountCents:2500}]}})
 const secondPreview=await api(`/carrier-premium-authorizations/${corrected.id}/reversal-preview`,{reversalDate:'2026-09-04'}),secondReversal=await api(`/carrier-premium-authorizations/${corrected.id}/reversal-authorizations`,{confirmed:true,reference:'Reviewed second full reversal for later correction',requestKey:'second-correction-reversal-request',reversalDate:'2026-09-04',fingerprint:secondPreview.fingerprint})
 await api(`/carrier-reversal-authorizations/${secondReversal.id}/post`,{confirmed:true});await api(`/carrier-reversal-authorizations/${secondReversal.id}/reconcile`,{...review,reference:'Verified second correction and the prior offsetting journals'})
 const thirdBody={...revisedBody,previousId:revised.id,accountingDate:'2026-09-05',amountCents:50000,reconciliation:'Second correction reduces only the employer expense by fifty dollars',allocation:{...revisedBody.allocation,employerExpenseCents:40000}}
 await api(path,{...thirdBody,accountingDate:'2026-09-03'},'POST',409);hiddenDoc=preview.payload.DocNumber;await api(path,thirdBody,'POST',409);hiddenDoc=null
 const third=await api(path,thirdBody);hiddenDoc=reversalPreview.payload.DocNumber;await api(`${path}/${third.id}/accounting-check`,selected,'POST',409);hiddenDoc=null
 const thirdPreview=(await api(`${path}/${third.id}/accounting-check`,selected)).premiumPreview,thirdAuthorization=await api(`${path}/${third.id}/premium-authorizations`,{...selected,confirmed:true,reference:'Reviewed third invoice revision and both prior corrections',requestKey:'third-correction-premium-request',fingerprint:thirdPreview.fingerprint})
 await api(`/carrier-premium-authorizations/${thirdAuthorization.id}/post`,{confirmed:true});assert.equal(creates,6)
 const finalBalances={};for(const journal of journals.values())if(/^VTX[CR]-/.test(journal.DocNumber))for(const line of journal.Line){const id=line.JournalEntryLineDetail.AccountRef.value;finalBalances[id]=(finalBalances[id]||0)+Math.round(line.Amount*100)*(line.JournalEntryLineDetail.PostingType==='Debit'?1:-1)}assert.deepEqual(finalBalances,{'7':40000,'5':10000,'8':-50000})
 assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_premium_correction')).rows.length,2)

})
