import {readFile} from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementRemittanceAuthorizationFixture} from '../testing/retirementRemittanceAuthorizationFixture.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {encryptDocument} from '../onboarding.js'
import {journalPayload} from '../quickbooks.js'
test('settlement release preserves reviewed proof and permits one newly approved replacement',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let journal=null,settlement=null,posts=0;let changed=false,closed=false;const wrong=false;let armed=false,sourceReads=0,absent=true
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),quickbooksFetcher:async(url,options)=>{if(options.method==='POST'){posts++;settlement={...JSON.parse(options.body),Id:'100'};throw new Error('Synthetic lost settlement response')}if(url.includes('/journalentry/')&&armed&&++sourceReads>=2)changed=true;if(url.includes('/query?')&&!absent)throw new Error('Synthetic unavailable lookup');if(url.includes('/query?'))return {ok:true,json:async()=>({QueryResponse:{JournalEntry:settlement?[settlement]:[]}})};const account=url.split('/').pop();return {ok:true,json:async()=>url.includes('/journalentry/')?{JournalEntry:changed?{...journal,PrivateNote:'Changed outside application'}:journal}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:closed?{BookCloseDate:'2026-09-22'}:{}}}:{Account:{Id:wrong?'99':account,Name:`Account ${account}`,Active:true,AccountType:account==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
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
  const postPath=`/retirement-settlement-authorizations/${auth.id}/post`,releasePath=`/retirement-settlement-authorizations/${auth.id}/release-preview`
  await f.api(releasePath,{},'POST',409)
  armed=true
  assert.equal((await f.api(postPath,{action:'POST',confirmed:true})).status,'NEEDS_REVIEW')
  assert.equal(posts,0)
  assert.equal((await h.pool.query('SELECT result FROM payroll_retirement_settlement_observation ORDER BY id DESC LIMIT 1')).rows[0].result.status,'NOT_SENT')
  armed=false;changed=false
  const release=await f.api(releasePath,{})
  assert.equal(release.status,'RELEASE_PREVIEW_ONLY');assert.equal(release.journals.length,1)
  assert.equal(release.journals[0].status,'NOT_FOUND');assert.equal(release.proof.length,1)
  assert.equal((await f.api(releasePath,{})).fingerprint,release.fingerprint)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_settlement_claim')).rows[0].n,1)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_settlement_cancellation WHERE authorization_id=$1',[auth.id])).rows[0].n,0)
  absent=false;await f.api(releasePath,{},'POST',409);absent=true
  const job=(await h.pool.query('SELECT * FROM payroll_retirement_settlement_journal WHERE authorization_id=$1',[auth.id])).rows[0]
  settlement={...job.payload,Id:'100'};await f.api(releasePath,{},'POST',409);settlement=null
  assert.equal(posts,0)
  const foreign=await fetch(h.url+'/api/admin/payroll'+releasePath,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:'{}'});assert.equal(foreign.status,404)
  const releaseAction=`/retirement-settlement-authorizations/${auth.id}/release-unsent`,releaseBody={fingerprint:release.fingerprint,confirmed:true,outsideActivityReviewed:true,reference:'Verified all original settlement jobs unsent and no outside accounting activity'}
  await f.api(releaseAction,{...releaseBody,fingerprint:'0'.repeat(64)},'POST',409)
  const releases=await Promise.all([f.api(releaseAction,releaseBody),f.api(releaseAction,releaseBody)])
  assert.equal(releases.filter(r=>r.reused).length,1)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_settlement_release')).rows[0].n,1)
  await f.api(releaseAction,{...releaseBody,reference:'Changed review must not overwrite the retained release'},'POST',409)
  await f.api(postPath,{action:'RECOVER',confirmed:true},'POST',409)
  const renewedPreview=await f.api(base+'/settlement-preview',{})
  const replacement=await f.api(authPath,{...body,fingerprint:renewedPreview.fingerprint,requestKey:randomUUID()})
  const replacementPath=`/retirement-settlement-authorizations/${replacement.id}/post`
  await f.api(replacementPath,{action:'POST',confirmed:true})
  assert.equal(posts,1)
  assert.equal((await f.api(replacementPath,{action:'RECOVER',confirmed:true})).status,'SYNCED')
  assert.equal(posts,1)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_settlement_journal')).rows[0].n,2)
  await f.api(`/retirement-settlement-authorizations/${replacement.id}/release-preview`,{},'POST',409)
  await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_settlement_release'),/append-only/)
  await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'))
  const vault=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
  try{assert.equal((await f.api(releaseAction,releaseBody)).reused,true)}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
