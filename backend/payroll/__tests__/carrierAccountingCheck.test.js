import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
test('carrier accounting check verifies the actual source journal and rejects drift before premium posting',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const prior=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='19'.repeat(32);t.after(()=>{if(prior===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=prior})
 let journal,posts=0,accountingPreferences={}
 const fetcher=async(url,options)=>{let data;if(url.includes('/account/'))data={Account:{Id:url.split('/').at(-1),Name:'Synthetic account '+url.split('/').at(-1),Active:true,AccountType:url.endsWith('/7')?'Expense':'Other Current Liability',CurrencyRef:{value:'USD'}}};else if(url.endsWith('/preferences'))data={Preferences:{AccountingInfoPrefs:accountingPreferences,CurrencyPrefs:{HomeCurrency:{value:'USD'}}}};else if(options.body){posts++;journal={...JSON.parse(options.body),Id:'55'};data={JournalEntry:journal}}else data={JournalEntry:journal};return {ok:true,status:200,json:async()=>data}}
 const h=await createHarness({quickbooksFetcher:fetcher});t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-INVOICE-ACCOUNTING'})
 const path='/benefit-carrier-invoices',source=(await api(`${path}?month=2026-09`)).source
 const saved=await api(path,{month:'2026-09',carrier:'Synthetic Health',invoiceNumber:'ACC-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic carrier invoice reference',reconciliation:'Matched invoice coverage with employee payroll contributions',confirmed:true,fingerprint:source.fingerprint,allocation:{employerExpenseCents:45000,employeeContributionCents:12500,confirmed:true,reference:'Retained payroll medical contribution',contributions:[{key:source.contributions[0].key,amountCents:12500}]}}),check=`${path}/${saved.id}/accounting-check`
 await api(check,{},'POST',409)
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'},encrypted=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encrypted]);await api(check,{},'POST',409)
 await syncQuickbooksRun(h.pool,1,run.id,{fetcher});const result=await api(check,{});assert.equal(result.status,'SOURCE_PAYROLL_VERIFIED');assert.equal(result.deductionAccountId,'5');assert.equal(result.journals[0].journalId,'55');assert.equal(result.premiumJournalStatus,'NOT_POSTED');assert.equal(posts,1)
 const preview=await api(check,{prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'});assert.deepEqual(preview.premiumPreview.payload.Line.map(l=>l.Amount),[450,125,575]);assert.equal(posts,1);await api(check,{prepareJournal:true,expenseAccountId:'5',carrierAccountId:'8'},'POST',409);await api(check,{prepareJournal:true,expenseAccountId:'7',carrierAccountId:'5'},'POST',409)
 assert.equal(preview.premiumPreview.period.bookCloseDate,null);assert.equal((await api(check,{prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'})).premiumPreview.fingerprint,preview.premiumPreview.fingerprint)
 await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=1');assert.notEqual((await api(check,{prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'})).premiumPreview.fingerprint,preview.premiumPreview.fingerprint)
 accountingPreferences={BookCloseDate:'2026-09-01'};await api(check,{prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'},'POST',409);accountingPreferences={BookCloseDate:'2026-08-31'};assert.equal((await api(check,{prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'})).premiumPreview.period.bookCloseDate,'2026-08-31');accountingPreferences={}
 const authorizationPath=`${path}/${saved.id}/premium-authorizations`,review=await api(check,{prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'})
 const authorizationBody={expenseAccountId:'7',carrierAccountId:'8',fingerprint:review.premiumPreview.fingerprint,reference:'Reviewed carrier premium journal authorization',confirmed:true,requestKey:'synthetic-premium-authorization'}
 await api(authorizationPath,{...authorizationBody,confirmed:false},'POST',400);await api(authorizationPath,{...authorizationBody,fingerprint:'stale'},'POST',409)
 const authorized=await Promise.all([api(authorizationPath,authorizationBody),api(authorizationPath,authorizationBody)]);assert.equal(authorized[0].id,authorized[1].id);assert.equal(posts,1)
 const invoiceHistory=(await api(`${path}?month=2026-09`)).history;assert.equal(invoiceHistory[0].authorizations.length,1)
 const revision={...invoiceHistory[0].invoice,reconciliation:'Revised invoice reconciliation requires authorization cancellation first.',confirmed:true,fingerprint:source.fingerprint,previousId:saved.id}
 await api(path,revision,'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_benefit_carrier_invoice(id,facility_id,coverage_month,carrier_key,invoice_key,revision,invoice,source_snapshot,source_fingerprint,payload_fingerprint,created_by) SELECT $1,facility_id,coverage_month,carrier_key,invoice_key,revision+1,invoice,source_snapshot,source_fingerprint,payload_fingerprint,created_by FROM payroll_benefit_carrier_invoice WHERE id=$2',['11111111-1111-4111-8111-111111111111',saved.id]),/Cancel the active premium authorization/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_premium_authorization WHERE id=$1',[authorized[0].id]),/append-only/)
 const cancelPath=`/carrier-premium-authorizations/${authorized[0].id}/cancel`,cancel={confirmed:true,reference:'Cancel before any premium journal dispatch'}
 const foreignCancel=await fetch(`${h.url}/api/admin/payroll${cancelPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify(cancel)});assert.equal(foreignCancel.status,404)
 await api(cancelPath,cancel);assert.equal((await api(cancelPath,cancel)).reused,true);await api(authorizationPath,authorizationBody,'POST',409)
 const cancelled=(await api(`${path}?month=2026-09`)).history[0].authorizations[0];assert.ok(cancelled.cancelled_at)
 const renewed=await api(authorizationPath,{...authorizationBody,requestKey:'synthetic-premium-second-authorization'});assert.notEqual(renewed.id,authorized[0].id);await api(`/carrier-premium-authorizations/${renewed.id}/cancel`,cancel)
 journal.Line[0].Amount+=1;await api(check,{},'POST',409);journal.Line[0].Amount-=1
 await h.pool.query("UPDATE payroll_quickbooks_connection SET account_ids=jsonb_set(account_ids,'{deductions}','\"99\"') WHERE facility_id=1");await api(check,{},'POST',409)
 const cross=await fetch(`${h.url}/api/admin/payroll${check}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:'{}'});assert.equal(cross.status,404);assert.equal(posts,1);await api(path,revision)
})
