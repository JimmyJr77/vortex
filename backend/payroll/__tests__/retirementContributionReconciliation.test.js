import {retirementAccountingStatus} from '../retirementAccountingEvidence.js'
import {refreshRetirementContribution} from '../retirementContributionReconciliation.js'
import {runRetirementContributionSweep} from '../retirementContributionAutomation.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementReceiptIntakeFixture} from '../testing/retirementReceiptIntakeFixture.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {readRetirementSftpReceipt,transferRetirementAllocation,verifyRetirementSftpConnection} from '../retirementSftpTransport.js'
import {checkRetirementReceipts} from '../retirementReceiptAutomation.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {encryptDocument} from '../onboarding.js'
import {journalPayload} from '../quickbooks.js'
test('full contribution reconciles payroll bank participant posting and accounting then reopens when accounting changes',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let journal=null,settlement=null,posts=0;let changed=false,closed=false;const wrong=false
 const server=await createRetirementSftpServer(),provider=retirementBankProvider(),h=await createHarness({retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,f,o)=>transferRetirementAllocation(c,f,{...server.options,...o}),paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T15:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z'),quickbooksFetcher:async(url,options)=>{if(options.method==='POST'){posts++;settlement={...JSON.parse(options.body),Id:'100'};throw new Error('Synthetic lost settlement response')}if(url.includes('/query?'))return {ok:true,json:async()=>({QueryResponse:{JournalEntry:settlement?[settlement]:[]}})};const account=url.split('/').pop();return {ok:true,json:async()=>url.includes('/journalentry/')?{JournalEntry:changed?{...journal,PrivateNote:'Changed outside application'}:journal}:url.endsWith('/preferences')?{Preferences:{CurrencyPrefs:{HomeCurrency:{value:'USD'}},AccountingInfoPrefs:closed?{BookCloseDate:'2026-09-22'}:{}}}:{Account:{Id:wrong?'99':account,Name:`Account ${account}`,Active:true,AccountType:account==='8'?'Bank':'Other Current Liability',CurrencyRef:{value:'USD'}}}}}})
 try{
  const f=await retirementReceiptIntakeFixture(h,server.config),a={id:f.remittanceId},base=`/retirement-remittance-authorizations/${a.id}`
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
  await f.api(postPath,{action:'RECOVER',confirmed:true})
  server.files.set(f.remotePath,f.receipt());await checkRetirementReceipts(h.pool,1,{reader:(c,r)=>readRetirementSftpReceipt(c,r,server.options),receiptNow:()=>new Date('2026-09-19T15:00:00Z')})
  assert.equal((await f.api(base+'/assessment')).status,'RECONCILED')
  const baseline=(await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_contribution_assessment')).rows[0].n
  assert.ok(baseline>0)
  assert.equal((await h.pool.query('SELECT summary FROM payroll_retirement_contribution_assessment ORDER BY id DESC LIMIT 1')).rows[0].summary.status,'RECONCILED')
  const checkedAt=new Date(),retained=await Promise.all([refreshRetirementContribution(h.pool,1,a.id,{now:checkedAt}),refreshRetirementContribution(h.pool,1,a.id,{now:checkedAt})])
  assert.equal(retained.filter(r=>r.changed).length,0);assert.equal(retained[0].assessmentId,retained[1].assessmentId)
  assert.equal(retained[0].status,'RECONCILED')
  const ownedKeys=[`retirement-bank-${a.id}`,`retirement-allocation-${f.allocationId}`,`retirement-receipt-${f.allocationId}`]
  const cleared=await h.pool.query('SELECT status FROM payroll_alert WHERE facility_id=1 AND dedupe_key=ANY($1::text[])',[ownedKeys])
  assert.equal(cleared.rowCount,3);assert.ok(cleared.rows.every(r=>r.status==='DISMISSED'))
  await h.pool.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES(1,'retirement-bank-unrelated','WARNING','Unrelated contribution','Keep this warning open')")
  await refreshRetirementContribution(h.pool,1,a.id)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_contribution_assessment')).rows[0].n,baseline)
  assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='retirement-bank-unrelated'")).rows[0].status,'OPEN')
  await assert.rejects(refreshRetirementContribution(h.pool,2,a.id),e=>e.status===404)
  await assert.rejects(h.pool.query('UPDATE payroll_retirement_contribution_assessment SET created_by=1'),/append-only/)
  await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_contribution_checkpoint'),/append-only/)
  await assert.rejects(h.pool.query('UPDATE payroll_retirement_contribution_checkpoint SET facility_id=2'),/scoped retirement authorization/)
  await assert.rejects(h.pool.query("UPDATE payroll_retirement_contribution_checkpoint SET checked_at=checked_at-interval '1 minute'"),/backwards/)
  assert.equal(await retirementAccountingStatus(h.pool,1,a.id),'MATCHED')
  closed=true;assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'SYNCED');assert.equal(await retirementAccountingStatus(h.pool,1,a.id),'MATCHED');closed=false
  changed=true;assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'NEEDS_REVIEW');assert.equal(await retirementAccountingStatus(h.pool,1,a.id),'REVIEW_REQUIRED');assert.equal((await f.api(base+'/assessment')).status,'DELIVERY_EVIDENCE_MATCHED');changed=false
  const reopened=await refreshRetirementContribution(h.pool,1,a.id)
  assert.equal(reopened.status,'REVIEW_REQUIRED');assert.equal(reopened.changed,false)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`retirement-contribution-${a.id}`])).rows[0].status,'OPEN')
  await assert.rejects(h.pool.query('UPDATE payroll_retirement_contribution_checkpoint SET assessment_id=$1',[retained[0].assessmentId]),/latest scoped assessment/)
  assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'SYNCED')
  const restored=await refreshRetirementContribution(h.pool,1,a.id)
  assert.equal(restored.status,'RECONCILED');assert.equal(restored.changed,false)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`retirement-contribution-${a.id}`])).rows[0].status,'DISMISSED')
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_contribution_assessment')).rows[0].n,baseline+2)
  const recorded=await f.api(base+'/assessment-history',{})
  assert.equal(recorded.changed,false)
  const assessmentHistory=await f.api(base+'/assessment-history')
  assert.equal(assessmentHistory.history.length,baseline+2);assert.equal(assessmentHistory.nextCursor,null)
  assert.equal(assessmentHistory.checkpoint.assessment_id,recorded.assessmentId)
  assert.deepEqual(assessmentHistory.history.slice(0,3).map(r=>r.summary.status),['RECONCILED','REVIEW_REQUIRED','RECONCILED'])
  assert.equal((await f.api(base+'/assessment-history?beforeId='+assessmentHistory.history[1].id)).history.length,baseline)
  await f.api(base+'/assessment-history?beforeId=9223372036854775808',undefined,'GET',400)
  const foreignHistory=await fetch(h.url+'/api/admin/payroll'+base+'/assessment-history',{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})
  assert.equal(foreignHistory.status,404)
  const sweepNow=new Date(Date.now()+360000)
  const sweeps=await Promise.all([runRetirementContributionSweep(h.pool,{facility:1,now:sweepNow}),runRetirementContributionSweep(h.pool,{facility:1,now:sweepNow})])
  assert.equal(sweeps.reduce((n,r)=>n+r.attempted,0),1)
  assert.equal((await runRetirementContributionSweep(h.pool,{facility:1,now:sweepNow})).attempted,0)
  assert.equal((await runRetirementContributionSweep(h.pool,{facility:2,now:sweepNow})).attempted,0)
  await h.pool.query("CREATE FUNCTION synthetic_assessment_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic private failure'; END $$")
  await h.pool.query('CREATE TRIGGER synthetic_assessment_failure BEFORE UPDATE ON payroll_retirement_contribution_checkpoint FOR EACH ROW EXECUTE FUNCTION synthetic_assessment_failure()')
  const failureNow=new Date(+sweepNow+360000)
  assert.equal((await runRetirementContributionSweep(h.pool,{facility:1,now:failureNow})).failed,1)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_contribution_failure')).rows[0].n,1)
  assert.equal((await runRetirementContributionSweep(h.pool,{facility:1,now:failureNow})).attempted,0)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`retirement-contribution-check-${a.id}`])).rows[0].status,'OPEN')
  await h.pool.query('DROP TRIGGER synthetic_assessment_failure ON payroll_retirement_contribution_checkpoint')
  assert.equal((await runRetirementContributionSweep(h.pool,{facility:1,now:new Date(+failureNow+360000)})).failed,0)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`retirement-contribution-check-${a.id}`])).rows[0].status,'DISMISSED')
  await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_contribution_failure'),/append-only/)
  const failures=await f.api(base+'/assessment-history')
  assert.equal(failures.failures.length,1);assert.equal(failures.nextFailureCursor,null)
  assert.ok(!failures.failures[0].message.includes('Synthetic private'))
  assert.equal((await f.api(base+'/assessment-history?beforeFailureId='+failures.failures[0].id)).failures.length,0)
  await f.api(base+'/assessment-history?beforeFailureId=bad',undefined,'GET',400)
  assert.equal(await retirementAccountingStatus(h.pool,1,a.id,{now:new Date(Date.now()+25*3600000)}),'REVIEW_REQUIRED')
  settlement=null;assert.equal((await f.api(postPath,{action:'RECOVER',confirmed:true})).status,'NEEDS_REVIEW');assert.equal(posts,1)
  const beforeObservation=(await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_settlement_observation')).rows[0].n
  const beforeFailure=(await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_contribution_failure')).rows[0].n
  await h.pool.query('CREATE TRIGGER synthetic_assessment_failure BEFORE UPDATE ON payroll_retirement_contribution_checkpoint FOR EACH ROW EXECUTE FUNCTION synthetic_assessment_failure()')
  await f.api(postPath,{action:'RECOVER',confirmed:true})
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_settlement_observation')).rows[0].n,beforeObservation+1)
  assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_contribution_failure')).rows[0].n,beforeFailure+1)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`retirement-contribution-check-${a.id}`])).rows[0].status,'OPEN')
  await h.pool.query('DROP TRIGGER synthetic_assessment_failure ON payroll_retirement_contribution_checkpoint')
  await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_settlement_journal'),/append-only/)
  const foreign=await fetch(h.url+'/api/admin/payroll'+postPath,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify({action:'RECOVER',confirmed:true})});assert.equal(foreign.status,404)
 }finally{await h.close();await server.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old}
})
