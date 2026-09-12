import {readFile} from 'node:fs/promises'
import {verifyRetirementReturnAccountingSource} from '../retirementReturnAccountingSource.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementRemittanceAuthorizationFixture} from '../testing/retirementRemittanceAuthorizationFixture.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {encryptDocument,decryptDocument} from '../onboarding.js'
import {journalPayload} from '../quickbooks.js'
for(const unsent of [true,false])test(`return accounting release ${unsent?'permits a proven non-send replacement':'blocks an uncertain create'}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let journal=null,settlement=null,creditJournal=null,posts=0;let failSecondReview=false,preferenceChecks=0;let changed=false;let closed=false;const wrong=false;let qboFetcher,changeReturnDuringReview=false
 const provider=retirementBankProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),quickbooksFetcher:qboFetcher=async(url,options)=>{if(failSecondReview&&url.endsWith('/preferences')&&++preferenceChecks===2)provider.creditValid(false);if(changeReturnDuringReview&&url.endsWith('/preferences'))provider.creditValid(false);if(options.method==='POST'){posts++;const payload=JSON.parse(options.body);if(payload.PrivateNote.includes('returned bank'))creditJournal={...payload,Id:'101'};else settlement={...payload,Id:'100'};throw new Error('Synthetic lost settlement response')}if(url.includes('/query?'))return {ok:true,json:async()=>({QueryResponse:{JournalEntry:[settlement,creditJournal].filter(j=>j&&decodeURIComponent(url).includes(j.DocNumber))}})};const account=url.split('/').pop();return {ok:true,json:async()=>url.includes('/journalentry/')?{JournalEntry:url.endsWith('/100')?settlement:changed?{...journal,PrivateNote:'Changed outside application'}:journal}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:closed?{BookCloseDate:'2026-09-24'}:{}}}:{Account:{Id:wrong?'99':account,Name:`Account ${account}`,Active:true,AccountType:account==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
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
  await f.api(base+'/dispatch',{action:'RECOVER',confirmed:true})
  const encrypted=(await h.pool.query('SELECT encrypted_instruction FROM payroll_retirement_remittance_claim WHERE authorization_id=$1',[a.id])).rows[0].encrypted_instruction
  const intent=JSON.parse(decryptDocument(encrypted,`payroll-retirement-instruction:1:${a.id}`).toString())
  const withdrawal=(await h.pool.query('SELECT result FROM payroll_retirement_remittance_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[a.id])).rows[0].result
  const qbo=(await h.pool.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=1')).rows[0]
  const check=(company=qbo,w=withdrawal)=>verifyRetirementReturnAccountingSource(h.pool,1,a.id,intent,w,company,{fetcher:qboFetcher})
  const verified=await check();assert.equal(verified.journals.length,1);assert.equal(verified.journals[0].journalId,'100');assert.equal(verified.sourceJournalId,'99')
  provider.returnedCredit();await f.api(base+'/dispatch',{action:'RECOVER',confirmed:true})
  assert.equal((await check()).journals[0].journalId,'100')
  const returnedAssessment=await f.api(base+'/assessment');assert.equal(returnedAssessment.bankStatus,'RETURN_CREDIT_POSTED');assert.equal(returnedAssessment.returnAccountingStatus,'REQUIRED');assert.equal(returnedAssessment.status,'REVIEW_REQUIRED')
  const returnPreview=await f.api(base+'/return-preview',{})
  assert.equal(returnPreview.status,'RETURN_PREVIEW_ONLY');assert.equal(returnPreview.amountCents,1400)
  assert.equal(returnPreview.payload.TxnDate,'2026-09-24')
  assert.deepEqual(returnPreview.payload.Line.map(l=>[l.Amount,l.JournalEntryLineDetail.PostingType,l.JournalEntryLineDetail.AccountRef.value]),[[14,'Credit','7'],[14,'Debit','8']])
  assert.equal((await f.api(base+'/return-preview',{})).fingerprint,returnPreview.fingerprint)
  provider.creditValid(false);await f.api(base+'/return-preview',{},'POST',409);provider.creditValid(true)
  closed=true;await f.api(base+'/return-preview',{},'POST',409);closed=false
  changeReturnDuringReview=true;await f.api(base+'/return-preview',{},'POST',409);changeReturnDuringReview=false;provider.creditValid(true)
  const approvalPath=base+'/return-authorizations',approvalBody={fingerprint:returnPreview.fingerprint,confirmed:true,autoPost:true,outsideAccountingReviewed:true,reference:'Verified returned credit and no outside duplicate return accounting',requestKey:randomUUID()}
  await f.api(approvalPath,{...approvalBody,fingerprint:'0'.repeat(64)},'POST',409)
  const approvals=await Promise.all([f.api(approvalPath,approvalBody),f.api(approvalPath,approvalBody)])
  assert.equal(approvals[0].id,approvals[1].id);assert.equal(approvals.filter(r=>r.reused).length,1)
  await f.api(approvalPath,{...approvalBody,requestKey:randomUUID()},'POST',409)
  const returnId=approvals[0].id,cancelReturn=`/retirement-return-authorizations/${returnId}/cancel`,cancelBody={confirmed:true,reference:'Recheck returned credit review before posting any accounting'}
  const vault=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
  try{await f.api(cancelReturn,cancelBody);assert.equal((await f.api(cancelReturn,cancelBody)).reused,true);assert.equal((await f.api(approvalPath,approvalBody)).cancelled,true)}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
  await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_return_claim(authorization_id) VALUES($1)',[returnId]),/Cancelled return accounting/)
  const renewed=await f.api(approvalPath,{...approvalBody,requestKey:randomUUID()})
  const returnPost=`/retirement-return-authorizations/${renewed.id}/post`
  failSecondReview=unsent
  const first=await f.api(returnPost,{action:'POST',confirmed:true})
  assert.equal(first.result.status,unsent?'NOT_SENT':'UNCERTAIN');assert.equal(posts,unsent?1:2)
  const releasePath=`/retirement-return-authorizations/${renewed.id}`
  if(!unsent){await f.api(releasePath+'/release-preview',{},'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_retirement_return_release')).rowCount,0);return}
  failSecondReview=false;provider.creditValid(true)
  const stale=await f.api(releasePath+'/release-preview',{})
  await f.api(returnPost,{action:'RECOVER',confirmed:true})
  const releaseBody={fingerprint:stale.fingerprint,confirmed:true,outsideActivityReviewed:true,reference:'Reviewed affirmative return journal non-send and no outside duplicate accounting'}
  await f.api(releasePath+'/release-unsent',releaseBody,'POST',409)
  const reviewed=await f.api(releasePath+'/release-preview',{});releaseBody.fingerprint=reviewed.fingerprint
  const releases=await Promise.all([f.api(releasePath+'/release-unsent',releaseBody),f.api(releasePath+'/release-unsent',releaseBody)])
  assert.equal(releases.filter(r=>r.reused).length,1);assert.equal(posts,1)
  delete process.env.PAYROLL_DOCUMENT_KEY
  try{assert.equal((await f.api(releasePath+'/release-unsent',releaseBody)).reused,true)}finally{process.env.PAYROLL_DOCUMENT_KEY=vault}
  const released=(await f.api(approvalPath)).history[0];assert.ok(released.cancelled_at);assert.equal(released.release.reference,releaseBody.reference)
  await f.api(returnPost,{action:'RECOVER',confirmed:true},'POST',409)
  const fresh=await f.api(base+'/return-preview',{}),replacement=await f.api(approvalPath,{...approvalBody,fingerprint:fresh.fingerprint,requestKey:randomUUID()})
  const replacementPath=`/retirement-return-authorizations/${replacement.id}/post`
  const posted=await Promise.all([f.api(replacementPath,{action:'POST',confirmed:true}),f.api(replacementPath,{action:'POST',confirmed:true})])
  assert.equal(posts,2);assert.ok(posted.some(r=>r.status==='SYNCED'))
  assert.equal((await h.pool.query('SELECT * FROM payroll_retirement_return_journal')).rowCount,2)
  await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_return_release'),/append-only/)
  await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'))
  assert.equal((await f.api(replacementPath,{action:'RECOVER',confirmed:true})).status,'SYNCED');assert.equal(posts,2)
  const foreign=await fetch(h.url+'/api/admin/payroll'+releasePath+'/release-preview',{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:'{}'});assert.equal(foreign.status,404)
 }finally{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
