import {retirementAccountingStatus} from '../retirementAccountingEvidence.js'
import {runRetirementSettlementSweep,startRetirementSettlementScheduler} from '../retirementSettlementAutomation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementRemittanceAuthorizationFixture} from '../testing/retirementRemittanceAuthorizationFixture.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {encryptDocument} from '../onboarding.js'
import {journalPayload} from '../quickbooks.js'
test('retirement settlement commits one claim, recovers lost journal response and preserves cancellation/retry history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let journal=null,settlement=null,posts=0;let changed=false,closed=false;const wrong=false
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),quickbooksFetcher:async(url,options)=>{if(options.method==='POST'){posts++;settlement={...JSON.parse(options.body),Id:'100'};throw new Error('Synthetic lost settlement response')}if(url.includes('/query?'))return {ok:true,json:async()=>({QueryResponse:{JournalEntry:settlement?[settlement]:[]}})};const account=url.split('/').pop();return {ok:true,json:async()=>url.includes('/journalentry/')?{JournalEntry:changed?{...journal,PrivateNote:'Changed outside application'}:journal}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:closed?{BookCloseDate:'2026-09-22'}:{}}}:{Account:{Id:wrong?'99':account,Name:`Account ${account}`,Active:true,AccountType:account==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
 try{
  const f=await retirementRemittanceAuthorizationFixture(h),a=await f.api(f.path,f.body),base=`/retirement-remittance-authorizations/${a.id}`
  await f.api(base+'/dispatch',{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Verified original trustee instructions and separate allocation delivery'})
  const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6',retirement:'7'},run=(await h.pool.query("SELECT r.*,COALESCE(r.payment_date,p.pay_date) pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1",[f.run.id])).rows[0]
  journal={...journalPayload(run,accounts),Id:'99'}
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-settlement-token',expiresAt:Date.now()+3600000})),'quickbooks:1')])
  await h.pool.query("INSERT INTO payroll_quickbooks_sync(facility_id,payroll_run_id,realm_id,environment,request_id,payload,status,external_id) VALUES(1,$1,'123','sandbox','synthetic-source',$2,'SYNCED','99')",[f.run.id,journalPayload(run,accounts)])
  const mappingPath='/retirement-plans/standard/settlement-mapping',state=await f.api(mappingPath)
  await f.api(mappingPath,{confirmed:true,requestKey:randomUUID(),expectedRevision:0,fundingRevisionId:state.funding[0].id,connectionGeneration:state.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'8',liabilityAccountId:'7',reference:'Verified original payroll retirement liability and original funding bank'},'POST',201)
  await f.api(base+'/settlement-preview',{},'POST',409);provider.complete()
  const preview=await f.api(base+'/settlement-preview',{});assert.equal(preview.status,'PREVIEW_ONLY');assert.equal(preview.amountCents,1400);assert.equal(preview.sourceJournalId,'99');assert.equal(preview.journals[0].payload.TxnDate,'2026-09-22');assert.deepEqual(preview.journals[0].payload.Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value]),[[14,'Debit','7'],[14,'Credit','8']])
  assert.equal((await f.api(base+'/settlement-preview',{})).fingerprint,preview.fingerprint)
  const authPath=base+'/settlement-authorizations',body={fingerprint:preview.fingerprint,confirmed:true,autoPost:true,reference:'Reviewed exact bank settlement and absence of outside duplicate accounting',requestKey:randomUUID()}
  const cancelled=await f.api(authPath,body),cancelPath=`/retirement-settlement-authorizations/${cancelled.id}/cancel`,reason={confirmed:true,reference:'Recheck settlement review before any journal has been claimed'}
  await f.api(cancelPath,reason);assert.equal((await f.api(cancelPath,reason)).reused,true);assert.equal((await f.api(authPath,body)).cancelled,true)
  await f.api(`/retirement-settlement-authorizations/${cancelled.id}/post`,{action:'POST',confirmed:true},'POST',409)
  body.requestKey=randomUUID()
  const auth=await f.api(authPath,body);assert.equal((await f.api(authPath,body)).id,auth.id)
  await f.api(authPath,{...body,requestKey:randomUUID()},'POST',409)
  const postPath=`/retirement-settlement-authorizations/${auth.id}/post`,results=await Promise.all([f.api(postPath,{action:'POST',confirmed:true}),f.api(postPath,{action:'POST',confirmed:true})])
  assert.equal(posts,1);assert.ok(results.some(r=>r.status==='SYNCED'));assert.equal((await h.pool.query('SELECT * FROM payroll_retirement_settlement_claim')).rowCount,1)
  const history=await f.api(authPath);assert.equal(history.history[0].claimed,true);assert.equal(history.history[0].journals[0].result.status,'SYNCED')
  await f.api(`/retirement-settlement-authorizations/${auth.id}/cancel`,{confirmed:true,reference:'Cannot cancel after a journal claim has been retained'},'POST',409)
  assert.equal(await retirementAccountingStatus(h.pool,1,a.id),'MATCHED')
  closed=true;assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'SYNCED');assert.equal(await retirementAccountingStatus(h.pool,1,a.id),'MATCHED');closed=false
  changed=true;assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'NEEDS_REVIEW');assert.equal(await retirementAccountingStatus(h.pool,1,a.id),'REVIEW_REQUIRED');changed=false
  assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'SYNCED')
  assert.equal(await retirementAccountingStatus(h.pool,1,a.id,{now:new Date(Date.now()+25*3600000)}),'REVIEW_REQUIRED')
  settlement=null;assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'NEEDS_REVIEW');assert.equal(posts,1)
  await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_settlement_journal'),/append-only/)
  const foreign=await fetch(h.url+'/api/admin/payroll'+postPath,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify({action:'RECOVER',confirmed:true})});assert.equal(foreign.status,404)
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})

test('approved settlement automatically posts, retries once after uncertainty and rechecks missing journals without recreating',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let journal=null,settlement=null,posts=0;const changed=false,closed=false,wrong=false
 let settlementFetcher;const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),quickbooksFetcher:settlementFetcher=async(url,options)=>{if(options.method==='POST'){posts++;settlement={...JSON.parse(options.body),Id:'100'};throw new Error('Synthetic lost settlement response')}if(url.includes('/query?'))return {ok:true,json:async()=>({QueryResponse:{JournalEntry:settlement?[settlement]:[]}})};const account=url.split('/').pop();return {ok:true,json:async()=>url.includes('/journalentry/')?{JournalEntry:changed?{...journal,PrivateNote:'Changed outside application'}:journal}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:closed?{BookCloseDate:'2026-09-22'}:{}}}:{Account:{Id:wrong?'99':account,Name:`Account ${account}`,Active:true,AccountType:account==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
 try{
  const f=await retirementRemittanceAuthorizationFixture(h),a=await f.api(f.path,f.body),base=`/retirement-remittance-authorizations/${a.id}`
  await f.api(base+'/dispatch',{action:'SUBMIT',confirmed:true,bankInstructionsReviewed:true,outsideActivityReviewed:true,reference:'Verified original trustee instructions and separate allocation delivery'})
  const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6',retirement:'7'},run=(await h.pool.query("SELECT r.*,COALESCE(r.payment_date,p.pay_date) pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1",[f.run.id])).rows[0]
  journal={...journalPayload(run,accounts),Id:'99'}
  await h.pool.query("INSERT INTO payroll_quickbooks_connection(facility_id,realm_id,environment,account_ids,encrypted_tokens) VALUES(1,'123','sandbox',$1,$2)",[accounts,encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic-settlement-token',expiresAt:Date.now()+3600000})),'quickbooks:1')])
  await h.pool.query("INSERT INTO payroll_quickbooks_sync(facility_id,payroll_run_id,realm_id,environment,request_id,payload,status,external_id) VALUES(1,$1,'123','sandbox','synthetic-source',$2,'SYNCED','99')",[f.run.id,journalPayload(run,accounts)])
  const mappingPath='/retirement-plans/standard/settlement-mapping',state=await f.api(mappingPath)
  await f.api(mappingPath,{confirmed:true,requestKey:randomUUID(),expectedRevision:0,fundingRevisionId:state.funding[0].id,connectionGeneration:state.connection.generation,realmId:'123',environment:'sandbox',bankAccountId:'8',liabilityAccountId:'7',reference:'Verified original payroll retirement liability and original funding bank'},'POST',201)
  await f.api(base+'/settlement-preview',{},'POST',409);provider.complete()
  const preview=await f.api(base+'/settlement-preview',{});assert.equal(preview.status,'PREVIEW_ONLY');assert.equal(preview.amountCents,1400);assert.equal(preview.sourceJournalId,'99');assert.equal(preview.journals[0].payload.TxnDate,'2026-09-22');assert.deepEqual(preview.journals[0].payload.Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value]),[[14,'Debit','7'],[14,'Credit','8']])
  assert.equal((await f.api(base+'/settlement-preview',{})).fingerprint,preview.fingerprint)
  const authPath=base+'/settlement-authorizations',body={fingerprint:preview.fingerprint,confirmed:true,autoPost:true,reference:'Reviewed exact bank settlement and absence of outside duplicate accounting',requestKey:randomUUID()}
  const cancelled=await f.api(authPath,body),cancelPath=`/retirement-settlement-authorizations/${cancelled.id}/cancel`,reason={confirmed:true,reference:'Recheck settlement review before any journal has been claimed'}
  await f.api(cancelPath,reason);assert.equal((await f.api(cancelPath,reason)).reused,true);assert.equal((await f.api(authPath,body)).cancelled,true)
  await f.api(`/retirement-settlement-authorizations/${cancelled.id}/post`,{action:'POST',confirmed:true},'POST',409)
  body.requestKey=randomUUID()
  const auth=await f.api(authPath,body);assert.equal((await f.api(authPath,body)).id,auth.id)
  await f.api(authPath,{...body,requestKey:randomUUID()},'POST',409)
  const options={facility:1,fetcher:settlementFetcher,paymentFetcher:provider.fetcher}
  const pair=await Promise.all([runRetirementSettlementSweep(h.pool,options),runRetirementSettlementSweep(h.pool,options)]);assert.equal(pair.reduce((n,r)=>n+r.attempted,0),1);assert.equal(pair.reduce((n,r)=>n+r.synced,0),0);assert.equal(posts,1)
  assert.equal((await runRetirementSettlementSweep(h.pool,options)).attempted,0)
  const later=new Date(Date.now()+6*60000),recovered=await runRetirementSettlementSweep(h.pool,{...options,now:later});assert.equal(recovered.synced,1);assert.equal(posts,1)
  const history=await f.api(authPath);assert.equal(history.history[0].attempts.length,2);assert.equal(history.history[0].attempts[0].status,'SYNCED');assert.equal((await h.pool.query('SELECT created_by FROM payroll_retirement_settlement_claim')).rows[0].created_by,null)
  settlement=null;assert.equal((await runRetirementSettlementSweep(h.pool,{...options,now:new Date(+later+25*3600000)})).synced,0);assert.equal(posts,1)
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})

test('retirement settlement scheduler respects disabled and test environments',()=>{const old=process.env.PAYROLL_RETIREMENT_SETTLEMENT_ENABLED;try{process.env.PAYROLL_RETIREMENT_SETTLEMENT_ENABLED='false';assert.equal(startRetirementSettlementScheduler({}),null)}finally{if(old===undefined)delete process.env.PAYROLL_RETIREMENT_SETTLEMENT_ENABLED;else process.env.PAYROLL_RETIREMENT_SETTLEMENT_ENABLED=old}})
