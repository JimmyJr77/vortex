import {recoverCarrierReversals} from '../carrierReversalRecovery.js'
import {recoverCarrierPremiums} from '../carrierPremiumRecovery.js'
import {runWorkforceAutomation} from '../workforceAutomation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {encryptDocument} from '../onboarding.js'
import {syncQuickbooksRun} from '../quickbooks.js'
for(const mode of ['SUCCESS','LOST_RESPONSE','CHANGED','NOT_SENT','CHANGED_AFTER_CLAIM','NOT_SENT_FOUND','REVERSAL_LOST_RESPONSE'])test(`carrier premium posting commits its claim and recovers without duplicate creation (${mode})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='23'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 let reversalJournal,reversalPosts=0,sourceJournal,premiumJournal,premiumPosts=0,queryFails=false,postingPreferences=0,changeAfterClaim=false,reversalClose=null,accountActive=true
 const fetcher=async(url,options)=>{let data
  if(url.includes('/account/'))data={Account:{Id:url.split('/').at(-1),Name:'Synthetic account',Active:accountActive,AccountType:url.endsWith('/7')?'Expense':'Other Current Liability',CurrencyRef:{value:'USD'}}}
  else if(url.endsWith('/preferences'))data={Preferences:{AccountingInfoPrefs:changeAfterClaim&&++postingPreferences>=4?{BookCloseDate:'2026-09-01'}:reversalClose?{BookCloseDate:reversalClose}:{},CurrencyPrefs:{HomeCurrency:{value:'USD'}}}}
  else if(url.includes('/query?')&&queryFails)throw new Error('Synthetic query unavailable before dispatch')
  else if(url.includes('/query?')){const found=url.includes('VTXR-')?reversalJournal:premiumJournal;data={QueryResponse:{JournalEntry:found?[found]:[]}}}
  else if(options.body){const body=JSON.parse(options.body);if(body.DocNumber.startsWith('VTXR-')){reversalPosts++;reversalJournal={...body,Id:'77'};if(mode==='REVERSAL_LOST_RESPONSE')throw new Error('Synthetic lost reversal response');data={JournalEntry:reversalJournal}}else if(body.DocNumber.startsWith('VTXC-')){premiumPosts++;premiumJournal={...body,Id:'66'};if(mode==='LOST_RESPONSE')throw new Error('Synthetic lost posting response');data={JournalEntry:premiumJournal}}else{sourceJournal={...body,Id:'55'};data={JournalEntry:sourceJournal}}}
  else data={JournalEntry:sourceJournal}
  return {ok:true,status:200,json:async()=>data}
 }
 const h=await createHarness({quickbooksFetcher:fetcher});t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-PREMIUM-POSTING'})
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'},encrypted=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encrypted]);await syncQuickbooksRun(h.pool,1,run.id,{fetcher})
 const path='/benefit-carrier-invoices',source=(await api(`${path}?month=2026-09`)).source
 const invoice=await api(path,{month:'2026-09',carrier:'Synthetic Health',invoiceNumber:'POST-SEP',invoiceDate:'2026-09-01',dueDate:'2026-09-30',amountCents:57500,reference:'Synthetic carrier invoice reference',reconciliation:'Matched medical coverage and retained employee contribution',confirmed:true,fingerprint:source.fingerprint,allocation:{employerExpenseCents:45000,employeeContributionCents:12500,confirmed:true,reference:'Verified retained payroll contribution',contributions:[{key:source.contributions[0].key,amountCents:12500}]}})
 const selected={prepareJournal:true,expenseAccountId:'7',carrierAccountId:'8'},preview=(await api(`${path}/${invoice.id}/accounting-check`,selected)).premiumPreview
 const authorization=await api(`${path}/${invoice.id}/premium-authorizations`,{...selected,fingerprint:preview.fingerprint,reference:'Verified premium journal authorization',confirmed:true,requestKey:'synthetic-premium-posting-request'}),post=`/carrier-premium-authorizations/${authorization.id}/post`,cancel=`/carrier-premium-authorizations/${authorization.id}/cancel`
 if(mode==='CHANGED'){
  await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=1');await api(post,{confirmed:true},'POST',409);assert.equal(premiumPosts,0);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_premium_claim')).rows.length,0);await api(cancel,{confirmed:true,reference:'Cancel changed connection before dispatch'});await api(post,{confirmed:true},'POST',409);await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_premium_claim(authorization_id) VALUES($1)',[authorization.id]),/Cancelled premium authorization/);return
 }
 if(['NOT_SENT','CHANGED_AFTER_CLAIM','NOT_SENT_FOUND'].includes(mode)){
  queryFails=mode!=='CHANGED_AFTER_CLAIM';changeAfterClaim=mode==='CHANGED_AFTER_CLAIM';assert.equal((await api(post,{confirmed:true})).status,queryFails?'UNCERTAIN':'NOT_SENT');changeAfterClaim=false;assert.equal(premiumPosts,0)
  assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_premium_no_send')).rows.length,1)
  await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_premium_no_send'),/append-only/)
  await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_premium_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[authorization.id,'Cannot bypass the fresh absence check']),/cannot be cancelled/)
  queryFails=true;await api(cancel,{confirmed:true,reference:'Cancel verified unsent invoice attempt'},'POST',409)
  queryFails=false;
  if(mode==='NOT_SENT_FOUND'){
   premiumJournal={...preview.payload,Id:'66'};assert.equal((await api(post,{confirmed:true})).status,'SYNCED');premiumJournal=undefined
   await api(cancel,{confirmed:true,reference:'Cannot cancel after retained journal evidence'},'POST',409)
   assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_premium_cancellation')).rows.length,0);assert.equal(premiumPosts,0);return
  }
  await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='999' WHERE facility_id=1");await api(cancel,{confirmed:true,reference:'Cannot cancel against a different company'},'POST',409);await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1")
  await api(cancel,{confirmed:true,reference:'Cancel verified unsent invoice attempt'});assert.equal((await api(cancel,{confirmed:true,reference:'Cancel verified unsent invoice attempt'})).reused,true)
  await api(post,{confirmed:true},'POST',409);assert.equal((await recoverCarrierPremiums(h.pool,1,{fetcher,now:new Date(Date.now()+6*60*1000)})).checked,0)
  const cancelled=(await api(`${path}?month=2026-09`)).history[0];assert.equal(cancelled.accountingStatus,'NOT_POSTED');assert.equal(cancelled.authorizations[0].no_send_proven,true)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-premium-${authorization.id}`])).rows[0].status,'DISMISSED')
  const renewed=await api(`${path}/${invoice.id}/premium-authorizations`,{...selected,fingerprint:preview.fingerprint,reference:'Reviewed replacement for proven unsent attempt',confirmed:true,requestKey:'synthetic-new-unsent-posting-request'})
  assert.equal((await api(`/carrier-premium-authorizations/${renewed.id}/post`,{confirmed:true})).status,'SYNCED');assert.equal(premiumPosts,1);return
 }
 const first=await api(post,{confirmed:true});assert.equal(first.status,mode==='LOST_RESPONSE'?'UNCERTAIN':'SYNCED');assert.equal(premiumPosts,1);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_premium_no_send')).rows.length,0)
 if(['SUCCESS','REVERSAL_LOST_RESPONSE'].includes(mode)){
  const path=`/carrier-premium-authorizations/${authorization.id}/reversal-preview`
  await api(path,{reversalDate:'2026-08-31'},'POST',409);await api(path,{reversalDate:'2026-02-30'},'POST',409)
  for(const [headers,status] of [[{'Authorization':'Bearer payroll-test-admin','x-test-facility':'2'},404],[{},401]])assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({reversalDate:'2026-09-02'})})).status,status)
  const reversal=await api(path,{reversalDate:'2026-09-02'});assert.equal(reversal.originalJournalId,'66');assert.equal(reversal.status,'PREVIEW_ONLY');assert.deepEqual(reversal.payload.Line.map(l=>[l.JournalEntryLineDetail.PostingType,l.Amount,l.JournalEntryLineDetail.AccountRef.value]),[['Credit',450,'7'],['Credit',125,'5'],['Debit',575,'8']]);assert.equal(premiumPosts,1)
  await h.pool.query('UPDATE payroll_settings SET quickbooks_connection_generation=quickbooks_connection_generation+1 WHERE facility_id=1');assert.notEqual((await api(path,{reversalDate:'2026-09-02'})).fingerprint,reversal.fingerprint)
  reversalClose='2026-09-02';await api(path,{reversalDate:'2026-09-02'},'POST',409);const later=await api(path,{reversalDate:'2026-09-03'});assert.notEqual(later.fingerprint,reversal.fingerprint);reversalClose=null
  accountActive=false;await api(path,{reversalDate:'2026-09-02'},'POST',409);accountActive=true
  await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='999' WHERE facility_id=1");await api(path,{reversalDate:'2026-09-02'},'POST',409);await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1")
  const retained=premiumJournal;premiumJournal={...retained,TxnDate:'2026-09-02'};await api(path,{reversalDate:'2026-09-02'},'POST',409);premiumJournal=retained;assert.equal(premiumPosts,1)
  const authorizePath=`/carrier-premium-authorizations/${authorization.id}/reversal-authorizations`,fresh=await api(path,{reversalDate:'2026-09-02'}),body={confirmed:true,reference:'Reviewed complete premium reversal and accounting date',requestKey:'synthetic-reversal-authorization',reversalDate:'2026-09-02',fingerprint:fresh.fingerprint}
  await api(authorizePath,{...body,fingerprint:reversal.fingerprint},'POST',409);await api(authorizePath,{...body,confirmed:false},'POST',400)
  const pair=await Promise.all([api(authorizePath,body),api(authorizePath,body)]);assert.equal(pair[0].id,pair[1].id)
  await api(authorizePath,{...body,requestKey:'different-active-reversal-request'},'POST',409)
  await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_reversal_authorization'),/append-only/)
  await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_reversal_authorization(id,premium_authorization_id,request_key,preview,fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,99)',['12345678-1234-1234-1234-123456789012',authorization.id,'direct-competing-reversal-request',fresh,fresh.fingerprint,body.reference]),/another active reversal/)
  const retainedHistory=(await api('/benefit-carrier-invoices?month=2026-09')).history[0];assert.equal(retainedHistory.authorizations[0].reversals[0].preview.originalJournalId,'66');assert.equal(retainedHistory.accountingStatus,'POSTED')
  const cancelReversal=`/carrier-reversal-authorizations/${pair[0].id}/cancel`,cancelBody={confirmed:true,reference:'Cancel reversal before posting for corrected review'}
  assert.equal((await fetch(`${h.url}/api/admin/payroll${cancelReversal}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify(cancelBody)})).status,404)
  await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='999' WHERE facility_id=1");await api(cancelReversal,cancelBody);await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1");assert.equal((await api(cancelReversal,cancelBody)).reused,true)
  await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_reversal_cancellation'),/append-only/);await api(authorizePath,body,'POST',409)
  await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_reversal_authorization(id,premium_authorization_id,request_key,preview,fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,99)',['12345678-1234-1234-1234-123456789013',authorization.id,'direct-wrong-original-journal', {...fresh,originalJournalId:'99'},fresh.fingerprint,body.reference]),/original journal evidence/)
  await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_reversal_authorization(id,premium_authorization_id,request_key,preview,fingerprint,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,99)',['12345678-1234-1234-1234-123456789014',authorization.id,'direct-missing-preview-binding', {...fresh,authorizationId:null},fresh.fingerprint,body.reference]),/preview_binding/)
  const renewedReversal=await api(authorizePath,{...body,requestKey:'fresh-reversal-after-cancellation'});assert.notEqual(renewedReversal.id,pair[0].id);const reversalPost=`/carrier-reversal-authorizations/${renewedReversal.id}/post`,reversalCancel=`/carrier-reversal-authorizations/${renewedReversal.id}/cancel`
  await api(`/carrier-reversal-authorizations/${pair[0].id}/post`,{confirmed:true},'POST',409);await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_reversal_claim(authorization_id,created_by) VALUES($1,99)',[pair[0].id]),/Cancelled reversal/)
  accountActive=false;await api(reversalPost,{confirmed:true},'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_reversal_claim')).rows.length,0);accountActive=true
  assert.equal((await api(reversalPost,{confirmed:true})).status,mode==='REVERSAL_LOST_RESPONSE'?'UNCERTAIN':'SYNCED');assert.equal(reversalPosts,1);assert.equal(premiumPosts,1)
  await api(reversalCancel,cancelBody,'POST',409);await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_reversal_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[renewedReversal.id,cancelBody.reference]),/cannot be cancelled/)
  assert.equal((await recoverCarrierReversals(h.pool,1,{fetcher})).checked,0)
  const recoveryAt=new Date(Date.now()+(mode==='REVERSAL_LOST_RESPONSE'?6*60*1000:25*60*60*1000));const recoveries=await Promise.all([recoverCarrierReversals(h.pool,1,{fetcher,now:recoveryAt}),recoverCarrierReversals(h.pool,1,{fetcher,now:recoveryAt})]);assert.equal(recoveries.reduce((n,r)=>n+r.checked,0),1);assert.equal(recoveries.reduce((n,r)=>n+r.synced,0),1);assert.equal((await recoverCarrierReversals(h.pool,2,{fetcher,now:recoveryAt})).checked,0)
  assert.equal((await api(reversalPost,{confirmed:true})).journalId,'77');assert.equal(reversalPosts,1)
  const postedInvoice=(await api('/benefit-carrier-invoices?month=2026-09')).history[0];assert.equal(postedInvoice.accountingStatus,'REVERSAL_POSTED');const postedHistory=postedInvoice.authorizations[0].reversals[0];assert.equal(postedHistory.claimed,true);assert.equal(postedHistory.posting_result.status,'SYNCED')
  const originalReversal=reversalJournal;reversalJournal=undefined;assert.equal((await api(reversalPost,{confirmed:true})).status,'NOT_FOUND');assert.equal(reversalPosts,1);reversalJournal=originalReversal
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-reversal-${renewedReversal.id}`])).rows[0].status,'OPEN');await api(reversalPost,{confirmed:true});assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-reversal-${renewedReversal.id}`])).rows[0].status,'DISMISSED')
  await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='999' WHERE facility_id=1");assert.equal((await recoverCarrierReversals(h.pool,1,{fetcher,now:new Date(recoveryAt.getTime()+25*60*60*1000)})).checked,1);assert.equal((await api('/benefit-carrier-invoices?month=2026-09')).history[0].authorizations[0].reversals[0].posting_result.status,'CONNECTION_CHANGED');await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1");assert.equal(reversalPosts,1)

 }
 const early=await recoverCarrierPremiums(h.pool,1,{fetcher});assert.equal(early.checked,0);assert.equal((await runWorkforceAutomation(h.pool,1,{quickbooksFetcher:fetcher})).premiumRecovery.checked,0)
 const tick=new Date(Date.now()+(mode==='LOST_RESPONSE'?6*60*1000:25*60*60*1000));const automatic=await Promise.all([recoverCarrierPremiums(h.pool,1,{fetcher,now:tick}),recoverCarrierPremiums(h.pool,1,{fetcher,now:tick})]);assert.equal(automatic.reduce((n,r)=>n+r.checked,0),1);assert.equal(automatic.reduce((n,r)=>n+r.synced,0),1);assert.equal(premiumPosts,1);assert.equal((await recoverCarrierPremiums(h.pool,2,{fetcher,now:tick})).checked,0)
 await api(cancel,{confirmed:true,reference:'Attempt cancellation after dispatch'},'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_premium_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[authorization.id,'Attempt direct cancellation after dispatch']),/cannot be cancelled/)
 const recovered=await Promise.all([api(post,{confirmed:true}),api(post,{confirmed:true})]);assert.equal(recovered.every(r=>r.status==='SYNCED'&&r.journalId==='66'),true);assert.equal(premiumPosts,1)
 const history=(await api(`${path}?month=2026-09`)).history[0];assert.equal(history.accountingStatus,['SUCCESS','REVERSAL_LOST_RESPONSE'].includes(mode)?'REVERSAL_RECOVERY':'POSTED');assert.equal(history.authorizations[0].claimed,true)
 const originalPremium=premiumJournal;
 premiumJournal=undefined;assert.equal((await api(post,{confirmed:true})).status,'NOT_FOUND');assert.equal(premiumPosts,1);assert.equal((await api(`${path}?month=2026-09`)).history[0].accountingStatus,['SUCCESS','REVERSAL_LOST_RESPONSE'].includes(mode)?'REVERSAL_RECOVERY':'NEEDS_RECOVERY')
 assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-premium-${authorization.id}`])).rows[0].status,'OPEN');premiumJournal=originalPremium;const later=new Date(tick.getTime()+25*60*60*1000);assert.equal((await recoverCarrierPremiums(h.pool,1,{fetcher,now:later})).synced,1);assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-premium-${authorization.id}`])).rows[0].status,'DISMISSED');assert.equal(premiumPosts,1);assert.equal((await recoverCarrierPremiums(h.pool,1,{fetcher,now:later})).checked,0)
 await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='999' WHERE facility_id=1");assert.equal((await recoverCarrierPremiums(h.pool,1,{fetcher,now:new Date(later.getTime()+25*60*60*1000)})).checked,1);assert.equal((await api(`${path}?month=2026-09`)).history[0].authorizations[0].posting_result.status,'CONNECTION_CHANGED');assert.equal(premiumPosts,1)
})
