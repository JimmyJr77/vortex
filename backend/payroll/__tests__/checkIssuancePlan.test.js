import {stopPayrollCheck} from '../checkStop.js'
import {cancelPayrollCheck} from '../checkCancellation.js'
import {readFile} from 'node:fs/promises'
import {runAutomaticCloseouts} from '../automaticCloseout.js'
import {finalizePayrollRun} from '../registerRoutes.js'
import {runSettlementAutomationSweep} from '../settlementAutomationScheduler.js'
import {checkReplacementAchReceipts} from '../checkReplacementAchReceipt.js'
import {runPaymentReturnCaseSweep} from '../paymentReturnCaseScheduler.js'
import {processCheckReplacementDocument} from '../checkReplacementDocument.js'
import {runCheckReplacementRecoverySweep} from '../checkReplacementRecoveryScheduler.js'
import {authorizeCheckReplacement} from '../checkReplacementAuthorization.js'
import {checkReplacementAnnualEvidence} from '../checkReplacementReview.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {checkReceipts} from '../checkReceipts.js'
import {configureSettlementFixture} from '../testing/settlementFixture.js'
import {processCheckDocument} from '../checkDocument.js'
import {runCheckIssueRecoverySweep} from '../checkIssueRecoveryScheduler.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
async function assertCheckDownload(h,runId,id,status){
 for(const [prefix,token] of [[`/api/admin/payroll/runs/${runId}`,'payroll-test-admin'],['/api/payroll/employee','monthly-benefits-session']]){
  const response=await fetch(`${h.url}${prefix}/check-receipts/${id}/download`,{headers:{Authorization:`Bearer ${token}`}})
  assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment.*html/);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();assert.ok(html.includes(status));assert.ok(html.includes('Monthly Benefits Fixture'));assert.ok(html.includes('Employee acknowledgment'));assert.ok(!html.includes('encrypted_intent'))
 }
 const foreign=await fetch(`${h.url}/api/admin/payroll/runs/${runId}/check-receipts/${id}/download`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 assert.equal((await fetch(`${h.url}/api/payroll/employee/check-receipts/${id}/download`)).status,401)
}
for(const variant of ['STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE_RENEW','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONFLICT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_UNCERTAIN','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW','STOP_REVIEW_CLOSEOUT_RETRY','CANCEL_CONTINUE','CANCEL_CONTINUE_CHANGED','CANCEL_CONTINUE_STOP','CANCEL_CONTINUE_PAID','CANCEL_CONTINUE_FOREIGN','CANCEL_CONTINUE_CANCELLED','CANCEL_RETRY','CANCEL_RETRY_CRASH','CANCEL_RETRY_REPEAT','CANCEL_BANK_HISTORY','CANCEL_ALREADY','CANCEL_PROVIDER','CANCEL_RACE','CANCEL_HISTORY','CANCEL_FOREIGN','CANCEL_PENDING','PREFLIGHT_LOOKUP','PREFLIGHT_FUNDING','PREFLIGHT_UNCERTAIN','PREFLIGHT_HISTORY','PLAN','ISSUE','DOCUMENT','DELIVERY','RECOVERY','STOP_INITIAL_PAID','STOP_INITIAL_FOREIGN','STOP_INITIAL_RECONCILED','STOP_RELEASE_RACE','STOP_RELEASE_EVIDENCE','STOP_RELEASE_HISTORY','STOP_RELEASE_FOREIGN','STOP','STOP_RELEASE','STOP_REVIEW','STOP_REVIEW_DD','STOP_REVIEW_CLOSEOUT','STOP_REVIEW_CLOSEOUT_DD'])test(`check issuance binds approved wages and prevents duplicate payments (${variant})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,records={};let order=null,pdfBytes=Buffer.from('%PDF-1.4\nsynthetic retained check fixture\n%%EOF'),foreignDocument=false;let posts=0,clock='2026-09-18T12:00:00Z'
 let accountingFetcher=async()=>{throw new Error('Synthetic accounting not configured')}
 let preflight=false,lookupUncertain=false,cancelPatches=0,cancelRace=false;const priorStopActions=[];let expectedStopPosts=1,preflightRetryCount=0,renewalStopCount=0,stopLookupFails=false,stopAmbiguous=false,stopReleasePaidRace=false;let stopAction=null,stopPosts=0,replacementOrder=null,replacementExternal=null,replacementPosts=0,replacementBank=false
 const providerFetcher=async(url,options={})=>{
  const collection=new URL(url).pathname.split('/').pop()
  if(collection===uuid(40))return {ok:true,status:200,json:async()=>({id:uuid(40),counterparty_id:uuid(41),party_name:'Monthly Benefits',party_type:'individual',account_type:'checking',live_mode:true,verification_status:'verified',account_details:[{account_number_safe:'1234'}]})}
  if(collection==='payment_actions'){if(stopReleasePaidRace){order.status='sent';stopReleasePaidRace=false}if(stopAmbiguous)return {ok:true,status:200,json:async()=>[78,79].map(n=>({id:uuid(n),type:'stop',actionable_id:uuid(5),actionable_type:'payment_order',internal_account_id:uuid(2),live_mode:true,status:'pending'}))};if(stopLookupFails&&options.method!=='POST')return {ok:false,status:503};if(options.method==='POST'){assert.equal((await h.pool.query('SELECT * FROM payroll_check_stop')).rowCount,1);if(stopAction){assert.equal((await h.pool.query('SELECT * FROM payroll_check_stop_retry')).rowCount,stopPosts+preflightRetryCount);priorStopActions.push({...stopAction})}stopPosts++;stopAction={id:uuid(29+stopPosts),type:'stop',actionable_id:uuid(5),actionable_type:'payment_order',internal_account_id:uuid(2),live_mode:true,status:'pending',details:{private:'MUST NOT RETAIN'}};throw new Error('Synthetic lost stop response')}return {ok:true,status:200,json:async()=>[...priorStopActions,...(stopAction?[stopAction]:[])]}}
  if(collection===uuid(2))return preflight&&variant!=='PREFLIGHT_FUNDING'?{ok:false,status:503}:{ok:true,status:200,json:async()=>({id:uuid(2),currency:preflight?'EUR':'USD',live_mode:true})}
  if(new URL(url).pathname.includes('/transactions/'))return {ok:true,status:200,json:async()=>({id:uuid(20),live_mode:true,internal_account_id:uuid(2),currency:'USD',direction:'debit',posted:true,as_of_date:replacementBank?'2026-09-22':'2026-09-21',amount:5970})}
  if(collection==='transaction_line_items')return {ok:true,status:200,json:async()=>[{id:uuid(21),transaction_id:uuid(20),transactable_type:'payment_order',transactable_id:replacementBank?uuid(50):uuid(5),live_mode:true,type:'originating',amount:5970}]}
  if(new URL(url).pathname.includes('/payment_orders')){
   if(options.method==='PATCH'){assert.equal((await h.pool.query('SELECT * FROM payroll_check_cancellation')).rowCount,1);assert.deepEqual(JSON.parse(options.body),{status:'cancelled'});if(variant.startsWith('CANCEL_RETRY'))assert.equal((await h.pool.query('SELECT * FROM payroll_check_cancellation_retry')).rowCount,variant==='CANCEL_RETRY_REPEAT'?2:1);cancelPatches++;if(variant==='CANCEL_PENDING')return {ok:true,status:200,json:async()=>order};order.status=variant.startsWith('CANCEL_CONTINUE')?'sent':'cancelled';throw new Error('Synthetic cancellation response lost')}
   if(cancelRace&&order)order.status='sent'
   if(lookupUncertain&&options.method!=='POST')return {ok:false,status:503}
   if(replacementExternal&&(collection===replacementExternal||options.method==='POST')){if(options.method==='POST'){assert.equal((await h.pool.query('SELECT * FROM payroll_check_replacement_claim')).rowCount,1);replacementPosts++;replacementOrder={...JSON.parse(options.body),id:uuid(50),counterparty_id:uuid(3),live_mode:true,status:'sent',reconciliation_status:'unreconciled'};throw new Error('Synthetic lost replacement response')}return {ok:!!replacementOrder,status:replacementOrder?200:404,json:async()=>replacementOrder}}
   if(options.method==='POST'){assert.equal((await h.pool.query('SELECT * FROM payroll_check_issue')).rowCount,variant.startsWith('PREFLIGHT_')||variant.startsWith('CANCEL_')&&posts>2?2:1);posts++;order={...JSON.parse(options.body),id:uuid(variant.startsWith('CANCEL_')&&posts>3?6:5),counterparty_id:uuid(3),live_mode:true,status:variant.startsWith('CANCEL_')?'approved':'sent',reconciliation_status:'unreconciled'};throw new Error('Synthetic lost check response')}
   return {ok:!!order,status:order?200:404,json:async()=>order}
  }
  if(collection===uuid(3))return {ok:true,status:200,json:async()=>records.counterparties}
  if(collection===uuid(4))return {ok:true,status:200,json:async()=>records.external_accounts}
  if(collection==='documents')return {ok:true,status:200,json:async()=>[{id:uuid(new URL(url).searchParams.get('documentable_id')===uuid(50)?52:8),source:'modern_treasury',document_type:'rendered_check',documentable_type:'payment_order',documentable_id:foreignDocument?uuid(9):new URL(url).searchParams.get('documentable_id'),file:{content_type:'application/pdf'}}]}
  if(collection==='download')return new Response(pdfBytes,{status:200,headers:{'Content-Type':'application/pdf'}})
  assert.ok(['counterparties','external_accounts'].includes(collection))
  if(options.method==='POST'){posts++;records[collection]={...JSON.parse(options.body),id:uuid(collection==='counterparties'?3:4),live_mode:true,...(collection==='external_accounts'?{account_details:[],routing_details:[]}: {})};return {ok:true,status:201,json:async()=>records[collection]}}
  return {ok:true,status:200,json:async()=>records[collection]?[records[collection]]:[]}
 }
 const h=await createHarness({payrollNow:()=>new Date(clock),paymentFetcher:providerFetcher,quickbooksFetcher:(...args)=>accountingFetcher(...args)})
 t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const plan=await api(`/runs/${run.id}/payment-plan`),batch=await api(`/runs/${run.id}/payment-authorization`,{fingerprint:plan.fingerprint,reference:'Synthetic check payroll authorization',confirmed:true},'POST',201)
 assert.equal((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher})).checked,0)
 const route=`/runs/${run.id}/payment-authorization/${batch.id}/checks/${employee.id}/plan`
 assert.equal((await api(route)).status,'NEEDS_REVIEW');assert.equal(posts,0)
 const c=await api('/payment-connection',{organizationId:uuid(1),originatingAccountId:uuid(2),apiKey:'synthetic-check-issuance-key',mode:'LIVE',reference:'Synthetic check employer connection',expectedRevision:0,confirmed:true},'POST',201)
 await api('/payment-connection/verify',{expectedRevision:c.revision})
 const setup=await api('/check-configuration',{connectionId:c.revision,expectedRevision:0,enabled:true,expiryDays:90,activationReference:'Synthetic digital check activation',confirmed:true},'POST',201)
 const payeePath=`/employees/${employee.id}/check-payee`,payee=await api(payeePath,{connectionId:c.revision,expectedRevision:0,payeeName:'Monthly Benefits',reference:'Synthetic legal check name review',confirmed:true},'POST',201)
 for(const stage of ['COUNTERPARTY','ACCOUNT'])await api(`${payeePath}/${payee.id}/advance`,{stage,action:'CONTINUE',confirmed:true})
 const ready=await api(route);assert.equal(ready.status,'READY_FOR_CHECK_REVIEW');assert.equal(ready.amountCents,5970);assert.equal(ready.payeeName,'Monthly Benefits');assert.equal(ready.executionAvailable,true);assert.equal(posts,2)
 assert.equal(JSON.stringify(ready).includes(uuid(4)),false);assert.equal((await api(route)).fingerprint,ready.fingerprint)
 if(variant.startsWith('CANCEL_')){
  const issueRoute=route.replace('/plan','/issue'),cancelRoute=route.replace('/plan','/cancellation'),issueBody={action:'SUBMIT',fingerprint:ready.fingerprint,reference:'Synthetic unprocessed provider check',confirmed:true,noPriorPaymentConfirmed:true}
  await api(issueRoute,issueBody);if(variant==='CANCEL_ALREADY')order.status='cancelled';await api(issueRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).canRequest,true)
  assert.equal((await api(route.replace('/plan','/document'))).status,'NOT_RETAINED')
  const issue=await api(issueRoute),body={action:'SUBMIT',reference:'Synthetic reviewed provider cancellation',confirmed:true},batchCancel={batchId:batch.id,reference:'Synthetic release after confirmed provider cancellation',confirmed:true},batchPath=`/runs/${run.id}/payment-authorization`,cancelBatch=()=>api(`${batchPath}/cancel`,batchCancel)
  await api(cancelRoute,{...body,confirmed:false},'POST',400)
  await assert.rejects(cancelPayrollCheck(h.pool,1,run.id,batch.id,employee.id,{fetcher:providerFetcher,actorId:99,automatic:true,reference:body.reference,confirmed:true}),/Automatic cancellation can only recover/)
  for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${cancelRoute}`,{method:'POST',headers,body:JSON.stringify(body)})).status,status)
  if(['CANCEL_HISTORY','CANCEL_BANK_HISTORY'].includes(variant)){
   if(variant==='CANCEL_BANK_HISTORY')order.reconciliation_status='reconciled';else order.status='sent';await api(issueRoute,{action:'RECOVER'});order.status='approved';order.reconciliation_status='unreconciled';await api(issueRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).canRequest,false);await api(cancelRoute,body,'POST',409);const source=(await h.pool.query('SELECT id FROM payroll_check_issue_observation WHERE issue_id=$1 ORDER BY id DESC LIMIT 1',[issue.id])).rows[0];await assert.rejects(h.pool.query('INSERT INTO payroll_check_cancellation(id,issue_id,provider_id,source_observation_id,reference,created_by) VALUES($1,$2,$3,$4,$5,99)',[uuid(77),issue.id,uuid(5),source.id,body.reference]),/current unprocessed check/);assert.equal(cancelPatches,0);return
  }
  if(variant.startsWith('CANCEL_CONTINUE')){
   await api(cancelRoute,body);assert.equal(cancelPatches,1);assert.equal((await api(cancelRoute)).canContinue,false)
   await api(cancelRoute,{action:'RECOVER'});let review=await api(cancelRoute);assert.equal(review.canContinue,true);assert.equal(review.readyToRelease,false);assert.equal((await api(batchPath)).canCancel,false)
   const continuation=()=>({reference:'Synthetic available original check after cancellation failed',confirmed:true,originalCheckAvailable:true,expectedCancellationObservationId:review.continuationReview?.cancellationObservationId,expectedCheckObservationId:review.continuationReview?.checkObservationId})
   if(['CANCEL_CONTINUE_PAID','CANCEL_CONTINUE_FOREIGN','CANCEL_CONTINUE_CANCELLED'].includes(variant)){
    if(variant==='CANCEL_CONTINUE_PAID')order.status='completed';else if(variant==='CANCEL_CONTINUE_FOREIGN')order.id=uuid(66);else order.status='cancelled'
    await api(cancelRoute,{action:'RECOVER'});order.status='sent';order.id=uuid(5);await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).canContinue,false);await api(cancelRoute+'/continue',continuation(),'POST',409);return
   }
   if(variant==='CANCEL_CONTINUE_STOP'){
    const stopRoute=route.replace('/plan','/stop');await api(stopRoute,{action:'SUBMIT',reference:'Synthetic unavailable original requires bank stop',confirmed:true,stopPaymentsEnabled:true});assert.equal(stopPosts,expectedStopPosts)
    stopAction.status='acknowledged';order.status='stopped';await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).status,'STOP_CONFIRMED');await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).canContinue,false);assert.equal((await api(batchPath)).canCancel,false);assert.equal(cancelPatches,1);return
   }
   await api(cancelRoute+'/continue',{...continuation(),originalCheckAvailable:false},'POST',400)
   for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${cancelRoute}/continue`,{method:'POST',headers,body:JSON.stringify(continuation())})).status,status)
   const stale=continuation();await api(cancelRoute,{action:'RECOVER'});await api(cancelRoute+'/continue',stale,'POST',409);review=await api(cancelRoute)
   await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409)
   const results=await Promise.all([0,1].map(()=>fetch(`${h.url}/api/admin/payroll${cancelRoute}/continue`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(continuation())})))
   assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await api(cancelRoute)).continuation.current,true)
   if(variant==='CANCEL_CONTINUE_CHANGED'){
    order.id=uuid(66);await api(cancelRoute,{action:'RECOVER'});order.id=uuid(5);await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).continuation.current,false);await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409);assert.equal((await api(batchPath)).canCancel,false);return
   }
   await h.pool.query("INSERT INTO payroll_check_issue_observation(issue_id,source,result) SELECT issue_id,'RECOVERY',jsonb_set(result,'{expiresAt}',to_jsonb((now()-interval '1 day')::text)) FROM payroll_check_issue_observation WHERE issue_id=$1 ORDER BY id DESC LIMIT 1",[issue.id]);assert.equal((await api(cancelRoute)).continuation.current,false);await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409);await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).continuation.current,true)
   lookupUncertain=true;await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).continuation.current,false);await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409);lookupUncertain=false
   await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+11*60000)});assert.equal((await api(cancelRoute)).continuation.current,true);assert.equal(cancelPatches,1)
   assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`check-cancel-${issue.id}`])).rows[0].status,'DISMISSED')
   const retained=(await api(cancelRoute)).continuation;await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.deepEqual((await api(cancelRoute)).continuation,retained)
   await assert.rejects(h.pool.query('DELETE FROM payroll_check_cancellation_continuation'),/append-only/)
   const docRoute=route.replace('/plan','/document');await api(docRoute,{action:'RETAIN'});const download=await fetch(`${h.url}/api/admin/payroll${docRoute}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({action:'DOWNLOAD'})});assert.equal(download.status,200);await download.arrayBuffer()
   const handoff={confirmed:true,deliveredInPerson:true,amountCents:5970,paymentDate:plan.paymentDate,reference:'Synthetic continued original handed to employee'};await api(route.replace('/plan','/delivery'),handoff)
   await api(`/runs/${run.id}/payment-closeout`,{batchId:Number(batch.id),fingerprint:plan.fingerprint,paymentDate:plan.paymentDate,reference:'Synthetic original closeout after cancellation disposition',confirmed:true,checkPayments:[{employeeId:employee.id,amountCents:5970,paymentDate:plan.paymentDate,reference:handoff.reference}]})
   assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'FINALIZED')
   order.status='completed';order.reconciliation_status='reconciled';order.transaction_ids=[uuid(20)];await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).continuation.current,true);assert.equal((await api(`/runs/${run.id}/check-receipts`))[0].status,'BANK_CONFIRMED');assert.equal(posts,3);assert.equal(cancelPatches,1);return
  }
  if(variant.startsWith('CANCEL_RETRY')){
   lookupUncertain=true;assert.equal((await api(cancelRoute,body)).status,'NEEDS_REVIEW');assert.equal(cancelPatches,0);assert.equal((await api(cancelRoute)).canRetry,false)
   lookupUncertain=false;await api(cancelRoute,{action:'RECOVER'});let review=await api(cancelRoute);assert.equal(review.canRetry,true)
   const retryBody=()=>({...body,action:'RETRY',expectedSubmissionId:review.retryReview.submissionId,expectedCheckObservationId:review.retryReview.checkObservationId})
   await api(cancelRoute,{...retryBody(),confirmed:false},'POST',400)
   await assert.rejects(cancelPayrollCheck(h.pool,1,run.id,batch.id,employee.id,{fetcher:providerFetcher,actorId:99,automatic:true,recoveryOnly:true,retry:true,...retryBody()}),/Automatic cancellation can only recover/)
   const stale=retryBody();await api(cancelRoute,{action:'RECOVER'});await api(cancelRoute,stale,'POST',409);review=await api(cancelRoute)
   const claim=(await h.pool.query('SELECT id FROM payroll_check_cancellation WHERE issue_id=$1',[issue.id])).rows[0]
   if(variant==='CANCEL_RETRY_CRASH'){
    await h.pool.query('INSERT INTO payroll_check_cancellation_retry(id,cancellation_id,prior_submission_id,source_observation_id,reference,created_by) VALUES($1,$2,$3,$4,$5,99)',[uuid(78),claim.id,review.retryReview.submissionId,review.retryReview.checkObservationId,body.reference])
    await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).canRetry,false);await api(cancelRoute,retryBody(),'POST',409);assert.equal(cancelPatches,0)
    assert.equal((await h.pool.query('SELECT payroll_check_cancellation_blocks($1) AS blocked',[issue.id])).rows[0].blocked,true);return
   }
   if(variant==='CANCEL_RETRY_REPEAT'){
    lookupUncertain=true;assert.equal((await api(cancelRoute,retryBody())).status,'NEEDS_REVIEW');assert.equal(cancelPatches,0);lookupUncertain=false;await api(cancelRoute,{action:'RECOVER'});review=await api(cancelRoute);assert.equal(review.canRetry,true)
   }
   const concurrent=await Promise.all([0,1].map(()=>fetch(`${h.url}/api/admin/payroll${cancelRoute}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(retryBody())})))
   assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);assert.equal(cancelPatches,1);assert.equal((await api(cancelRoute)).canRetry,false)
   await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(cancelRoute)).readyToRelease,true);assert.equal((await api(cancelRoute)).canRetry,false)
   const history=(await api(cancelRoute)).retries;assert.equal(history.length,variant==='CANCEL_RETRY_REPEAT'?2:1)
   const evidence=await api(route.replace('/plan','/evidence'));assert.ok(evidence.entries.some(e=>e.category==='CANCELLATION'&&e.attempt===(variant==='CANCEL_RETRY_REPEAT'?3:2)));assert.ok(evidence.entries.some(e=>e.category==='CANCELLATION'&&e.requestSent===true))
   await assert.rejects(h.pool.query('DELETE FROM payroll_check_cancellation_retry'),/append-only/)
   await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.deepEqual((await api(cancelRoute)).retries,history)
   await cancelBatch();assert.equal((await api(batchPath)).cancellation_provider_evidence.length,1);return
  }
  cancelRace=variant==='CANCEL_RACE'
  const results=await Promise.all([api(cancelRoute,body),api(cancelRoute,body)])
  assert.equal((await h.pool.query('SELECT * FROM payroll_check_cancellation')).rowCount,1);assert.equal(cancelPatches,cancelRace||variant==='CANCEL_ALREADY'?0:1)
  assert.equal((await api(cancelRoute)).canRetry,false)
  await api(cancelRoute,{...body,action:'RETRY',expectedSubmissionId:1,expectedCheckObservationId:1},'POST',409)
  if(cancelRace||variant==='CANCEL_PENDING'){
   assert.ok(results.every(r=>r.status===(cancelRace?'NOT_ELIGIBLE':'CANCEL_PENDING')));assert.equal((await api(batchPath)).canCancel,false);await api(`${batchPath}/cancel`,batchCancel,'POST',409);return
  }
  assert.deepEqual(results.map(r=>r.status).sort(),variant==='CANCEL_ALREADY'?['CANCEL_CONFIRMED','CANCEL_CONFIRMED']:['CANCEL_CONFIRMED','UNCERTAIN']);assert.equal((await api(cancelRoute)).readyToRelease,true)
  assert.equal((await api(route.replace('/plan','/document'))).status,'NOT_RETAINED');await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409)
  if(variant==='CANCEL_FOREIGN'){
   order.id=uuid(66);await api(cancelRoute,{action:'RECOVER'});order.id=uuid(5);await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(batchPath)).canCancel,false);await api(`${batchPath}/cancel`,batchCancel,'POST',409);return
  }
  const claim=(await h.pool.query('SELECT id FROM payroll_check_cancellation WHERE issue_id=$1',[issue.id])).rows[0]
  await h.pool.query("INSERT INTO payroll_check_cancellation_observation(cancellation_id,source,result,created_at) SELECT cancellation_id,'RECOVERY',result,now()-interval '16 minutes' FROM payroll_check_cancellation_observation WHERE cancellation_id=$1 ORDER BY id DESC LIMIT 1",[claim.id]);assert.equal((await api(batchPath)).canCancel,false);await api(`${batchPath}/cancel`,batchCancel,'POST',409)
  lookupUncertain=true;await api(cancelRoute,{action:'RECOVER'});assert.equal((await api(batchPath)).canCancel,false);lookupUncertain=false
  assert.equal((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+11*60000)})).checked,1);assert.equal((await api(batchPath)).canCancel,true);assert.equal(cancelPatches,variant==='CANCEL_ALREADY'?0:1)
  await cancelBatch();await cancelBatch();const cancelled=await api(batchPath);assert.equal(cancelled.cancellation_provider_evidence.length,1);assert.equal(cancelled.cancellation_provider_evidence[0].issueId,issue.id)
  assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`check-cancel-${issue.id}`])).rows[0].status,'DISMISSED')
  assert.equal((await api(cancelRoute,{action:'RECOVER'})).status,'AUTHORIZATION_CANCELLED');assert.equal((await api(issueRoute,{action:'RECOVER'})).status,'CANCELLED_AT_PROVIDER')
  for(const table of ['payroll_check_cancellation','payroll_check_cancellation_observation'])await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
  await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.deepEqual((await api(batchPath)).cancellation_provider_evidence,cancelled.cancellation_provider_evidence)
  await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH')
  const rebuilt=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${rebuilt.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${rebuilt.id}/status`,{status:'APPROVED'},'PATCH')
  const nextPlan=await api(`/runs/${rebuilt.id}/payment-plan`),nextBatch=await api(`/runs/${rebuilt.id}/payment-authorization`,{fingerprint:nextPlan.fingerprint,reference:'Synthetic rebuilt payroll after provider cancellation',confirmed:true},'POST',201),nextBase=`/runs/${rebuilt.id}/payment-authorization/${nextBatch.id}/checks/${employee.id}`,nextCheck=await api(`${nextBase}/plan`)
  order=null;await api(`${nextBase}/issue`,{...issueBody,fingerprint:nextCheck.fingerprint});await api(`${nextBase}/issue`,{action:'RECOVER'});assert.equal(posts,4);assert.equal(cancelPatches,variant==='CANCEL_ALREADY'?0:1);return
 }
 if(variant.startsWith('PREFLIGHT_')){
  preflight=true;lookupUncertain=variant==='PREFLIGHT_UNCERTAIN'
  const issueRoute=route.replace('/plan','/issue'),body={action:'SUBMIT',fingerprint:ready.fingerprint,reference:'Synthetic blocked check issuance review',confirmed:true,noPriorPaymentConfirmed:true}
  const issue=await api(issueRoute,body);assert.equal(issue.status,lookupUncertain?'UNCERTAIN':variant==='PREFLIGHT_FUNDING'?'BLOCKED_PAYEE_OR_FUNDING':'BLOCKED_ACCOUNT_LOOKUP');assert.equal(posts,2)
  const cancelPath=`/runs/${run.id}/payment-authorization/cancel`,cancel={batchId:batch.id,reference:'Synthetic reviewed cancellation before any check submission',confirmed:true},currentBatch=()=>api(`/runs/${run.id}/payment-authorization`)
  assert.equal((await currentBatch()).canCancel,false);await api(cancelPath,cancel,'POST',409)
  lookupUncertain=false
  assert.equal((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+11*60000)})).checked,1)
  if(variant==='PREFLIGHT_UNCERTAIN'){
   assert.equal((await currentBatch()).canCancel,false);await api(cancelPath,cancel,'POST',409)
   await assert.rejects(h.pool.query('INSERT INTO payroll_payment_batch_cancellation(batch_id,reference,created_by) VALUES($1,$2,99)',[batch.id,cancel.reference]),/submitted payment/);assert.equal(posts,2);return
  }
  assert.equal((await api(issueRoute)).preflightStatus,'READY_TO_CANCEL');assert.equal((await currentBatch()).canCancel,true)
  if(variant==='PREFLIGHT_HISTORY'){
   await h.pool.query("INSERT INTO payroll_check_issue_observation(issue_id,source,result) VALUES($1,'RECOVERY',$2)",[issue.id,{status:'SENT',providerId:uuid(5)}]);await api(issueRoute,{action:'RECOVER'})
   assert.equal((await currentBatch()).canCancel,false);await api(cancelPath,cancel,'POST',409);assert.equal(posts,2);return
  }
  await h.pool.query("INSERT INTO payroll_check_issue_observation(issue_id,source,result,created_at) VALUES($1,'RECOVERY',$2,now()-interval '16 minutes')",[issue.id,{status:'NOT_FOUND'}]);assert.equal((await currentBatch()).canCancel,false);await api(cancelPath,cancel,'POST',409)
  lookupUncertain=true;await api(issueRoute,{action:'RECOVER'});assert.equal((await currentBatch()).canCancel,false)
  lookupUncertain=false;await api(issueRoute,{action:'RECOVER'});assert.equal((await currentBatch()).canCancel,true)
  const cancelled=await Promise.all([api(cancelPath,cancel),api(cancelPath,cancel)]);assert.ok(cancelled.every(r=>r.status==='CANCELLED'))
  const retained=await currentBatch();assert.equal(retained.cancellation_check_evidence.length,1);assert.equal(retained.cancellation_check_evidence[0].issueId,issue.id);assert.equal(retained.cancellation_check_evidence[0].amountCents,5970)
  await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.deepEqual((await currentBatch()).cancellation_check_evidence,retained.cancellation_check_evidence)
  assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='PAYMENT_AUTHORIZATION_CANCELLED'")).rowCount,1)
  assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`check-issue-${issue.id}`])).rows[0].status,'DISMISSED')
  assert.equal((await runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>new Date(Date.now()+86400000)})).checked,0)
  assert.equal((await api(issueRoute,body)).status,'CANCELLED_BEFORE_SUBMISSION');assert.equal((await api(issueRoute)).status,'CANCELLED_BEFORE_SUBMISSION')
  await assert.rejects(h.pool.query('DELETE FROM payroll_payment_batch_cancellation'),/append-only/)
  await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH');preflight=false
  const rebuilt=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${rebuilt.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${rebuilt.id}/status`,{status:'APPROVED'},'PATCH')
  const nextPlan=await api(`/runs/${rebuilt.id}/payment-plan`),nextBatch=await api(`/runs/${rebuilt.id}/payment-authorization`,{fingerprint:nextPlan.fingerprint,reference:'Synthetic rebuilt payroll after preflight cancellation',confirmed:true},'POST',201)
  const nextBase=`/runs/${rebuilt.id}/payment-authorization/${nextBatch.id}/checks/${employee.id}`,nextCheck=await api(`${nextBase}/plan`)
  await api(`${nextBase}/issue`,{...body,fingerprint:nextCheck.fingerprint});assert.equal((await api(`${nextBase}/issue`,{action:'RECOVER'})).status,'SENT');assert.equal(posts,3)
  assert.equal((await api(issueRoute,body)).status,'CANCELLED_BEFORE_SUBMISSION');assert.equal(posts,3);return
 }
 if(['STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE_RENEW','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONFLICT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_UNCERTAIN','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW','STOP_REVIEW_CLOSEOUT_RETRY','ISSUE','DOCUMENT','DELIVERY','RECOVERY','STOP_INITIAL_PAID','STOP_INITIAL_FOREIGN','STOP_INITIAL_RECONCILED','STOP_RELEASE_RACE','STOP_RELEASE_EVIDENCE','STOP_RELEASE_HISTORY','STOP_RELEASE_FOREIGN','STOP','STOP_RELEASE','STOP_REVIEW','STOP_REVIEW_DD','STOP_REVIEW_CLOSEOUT','STOP_REVIEW_CLOSEOUT_DD'].includes(variant)){
  const issueRoute=route.replace('/plan','/issue'),body={action:'SUBMIT',fingerprint:ready.fingerprint,reference:'Synthetic check issuance with no prior payment',confirmed:true,noPriorPaymentConfirmed:true}
  await api(issueRoute,{...body,noPriorPaymentConfirmed:false},'POST',400)
  await api(issueRoute,{action:'RECOVER'},'POST',409)
  const pair=await Promise.all([api(issueRoute,body),api(issueRoute,body)])
  assert.deepEqual(pair.map(x=>x.status).sort(),['SENT','UNCERTAIN']);assert.equal(pair[0].id,pair[1].id);assert.equal(posts,3)
  const issued=await api(issueRoute);assert.equal(issued.status,'SENT');assert.equal(issued.dateMatches,true);assert.equal(issued.expiryMatches,true);assert.equal(JSON.stringify(issued).includes(uuid(5)),false)
  assert.equal((await api(`/runs/${run.id}/payment-authorization`)).canCancel,false)
  await api(`/runs/${run.id}/payment-authorization/cancel`,{confirmed:true,reference:'Synthetic cancellation must remain blocked'},'POST',409)
  const delivery={batchId:Number(batch.id),fingerprint:plan.fingerprint,paymentDate:plan.paymentDate,reference:'Synthetic manual closeout must remain blocked',confirmed:true,checkPayments:[{employeeId:employee.id,amountCents:5970,paymentDate:plan.paymentDate,reference:'Synthetic check reference'}]}
  await api(`/runs/${run.id}/payment-closeout`,delivery,'POST',409)
  await api(`/runs/${run.id}/payment-closeout/automatic`,delivery,'POST',409)
  assert.equal((await h.pool.query('SELECT payroll_payment_closeout_ready($1,$2) AS ready',[batch.id,JSON.stringify(delivery.checkPayments)])).rows[0].ready,false)
  await assert.rejects(h.pool.query('INSERT INTO payroll_payment_batch_cancellation(batch_id,reference,created_by) VALUES($1,$2,99)',[batch.id,'Synthetic forbidden cancellation']),/submitted payment/)
  assert.equal((await api(route)).status,'NEEDS_REVIEW')
  assert.equal((await h.pool.query('SELECT * FROM payroll_check_issue')).rowCount,1)
  for(const table of ['payroll_check_issue','payroll_check_issue_observation'])await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
  if(['DOCUMENT','DELIVERY'].includes(variant)){
   const docRoute=route.replace('/plan','/document'),handoffRoute=route.replace('/plan','/delivery'),handoff={confirmed:true,deliveredInPerson:true,amountCents:5970,paymentDate:plan.paymentDate,reference:'Synthetic printed check handed to employee'}
   assert.equal((await api(docRoute)).status,'NOT_RETAINED')
   await api(docRoute,{action:'DOWNLOAD'},'POST',409)
   assert.equal((await api(docRoute,{action:'RETAIN'})).status,'RETAINED')
   assert.equal((await api(docRoute,{action:'RETAIN'})).reused,true)
   if(variant==='DELIVERY')await api(handoffRoute,handoff,'POST',409)
   const stored=(await h.pool.query('SELECT * FROM payroll_check_document')).rows[0]
   assert.equal(stored.encrypted_pdf.includes(Buffer.from('synthetic retained check fixture')),false)
   const download=async(facility=1)=>fetch(`${h.url}/api/admin/payroll${docRoute}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify({action:'DOWNLOAD'})})
   const success=await download();assert.equal(success.status,200);assert.equal(success.headers.get('content-type'),'application/pdf');assert.equal(success.headers.get('cache-control'),'no-store');assert.equal(success.headers.get('x-content-type-options'),'nosniff');assert.match(success.headers.get('content-disposition'),/^attachment;/);assert.deepEqual(Buffer.from(await success.arrayBuffer()),pdfBytes)
   assert.equal((await download(2)).status,404)
   const original=pdfBytes;pdfBytes=Buffer.from('%PDF-1.4\nchanged check fixture\n%%EOF')
   assert.equal((await download()).status,409);await api(docRoute,{action:'RETAIN'},'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_check_document')).rowCount,1);pdfBytes=original
   foreignDocument=true;assert.equal((await download()).status,409);foreignDocument=false
   order.id=uuid(9);assert.equal((await download()).status,409);order.id=uuid(5)
   order.status='stopped';assert.equal((await download()).status,409);order.status='completed';assert.equal((await download()).status,409);order.status='sent'
   clock='2026-09-17T12:00:00Z';assert.equal((await download()).status,409)
   clock='2027-01-01T12:00:00Z';assert.equal((await download()).status,409);clock='2026-09-18T12:00:00Z'
   const final=await download();assert.equal(final.status,200);await final.arrayBuffer()
   for(const table of ['payroll_check_document','payroll_check_document_check'])await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
   assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-document-%' AND status='OPEN'")).rowCount,0)
   const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='CHECK_DOCUMENT_CHECKED'")).rows
   assert.ok(audit.length>=10);assert.equal(JSON.stringify(audit).includes('synthetic retained check fixture'),false)
   await api(`/runs/${run.id}/payment-closeout`,delivery,'POST',409)
   assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'APPROVED')
   if(variant==='DELIVERY'){
    assert.deepEqual(await api('/check-receipts',undefined,'GET',200,true),[])
    await api(handoffRoute,{...handoff,deliveredInPerson:false},'POST',400)
    await api(handoffRoute,{...handoff,amountCents:5971},'POST',409)
    clock='2026-09-19T12:00:00Z';await api(handoffRoute,handoff,'POST',409);clock='2026-09-18T12:00:00Z'
    const saved=await Promise.all([api(handoffRoute,handoff),api(handoffRoute,handoff)]);assert.equal(saved.filter(r=>r.reused).length,1)
    assert.equal((await api(handoffRoute)).status,'DELIVERY_RETAINED');assert.equal((await h.pool.query('SELECT * FROM payroll_check_delivery')).rowCount,1)
    const receiptPath=`/runs/${run.id}/check-receipts`,handed=await api(receiptPath)
    assert.equal(handed.length,1);assert.equal(handed[0].status,'OUTSTANDING');assert.equal(handed[0].amountCents,5970)
    assert.deepEqual(await api('/check-receipts',undefined,'GET',200,true),handed)
    assert.deepEqual(await checkReceipts(h.pool,2,{runId:Number(run.id)}),[])
    assert.deepEqual(await checkReceipts(h.pool,1,{employeeId:Number(employee.id)+1}),[])
    for(const secret of [handoff.reference,uuid(5),'sha256','encrypted','source_check'])assert.equal(JSON.stringify(handed).includes(secret),false)
    const foreignReceipt=await fetch(`${h.url}/api/admin/payroll${receiptPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreignReceipt.status,404)

    await api(handoffRoute,{...handoff,reference:'A different handoff reference'},'POST',409)
    assert.equal((await download()).status,409)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_delivery'),/append-only/)
    await api(`/runs/${run.id}/payment-closeout`,delivery,'POST',409)
    const close={...delivery,checkPayments:delivery.checkPayments.map(c=>({...c,reference:handoff.reference}))}
    order.status='stopped';await api(issueRoute,{action:'RECOVER'});await api(`/runs/${run.id}/payment-closeout`,close,'POST',409)
    order.status='sent';await api(issueRoute,{action:'RECOVER'})
    await api(`/runs/${run.id}/payment-closeout`,close)
    assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'FINALIZED')
    clock='2026-09-19T12:00:00Z';assert.equal((await api(`/runs/${run.id}/payment-closeout`,close)).reused,true);assert.equal((await api(handoffRoute,handoff)).reused,true)
    assert.equal((await h.pool.query('SELECT * FROM payroll_payment_closeout')).rowCount,1)
    const accounting=await configureSettlementFixture(h,api,run.id,c.revision,value=>{accountingFetcher=value})
    assert.equal((await api(`/runs/${run.id}/payment-accounting`)).events.length,0)
    order.status='completed';order.reconciliation_status='reconciled';order.transaction_ids=[uuid(20)]
    await api(issueRoute,{action:'RECOVER'})
    const clearedReceipt=await api(receiptPath);assert.equal(clearedReceipt[0].status,'BANK_CONFIRMED');assert.deepEqual(clearedReceipt[0].bankPostedDates,['2026-09-21']);assert.equal(clearedReceipt[0].deliveredAt,handed[0].deliveredAt)
    const bank=await api(`/runs/${run.id}/payment-accounting`);assert.equal(bank.status,'EVIDENCE_READY');assert.equal(bank.events.length,1);assert.equal(bank.events[0].sourceKind,'CHECK');assert.equal(bank.totals.netOutflowCents,5970)
    const postingPath=`/runs/${run.id}/payment-accounting/posting`,posting=await api(postingPath)
    assert.equal(posting.items[0].canPost,true)
    const body={action:'SUBMIT',eventKey:posting.items[0].key,fingerprint:posting.fingerprint,reference:'Synthetic cleared check bank journal',confirmed:true,noOtherPostingConfirmed:true}
    const journal=await api(postingPath,body);assert.equal(journal.result.status,'UNCERTAIN')
    const recovered=await api(postingPath,{action:'RECOVER',jobId:journal.jobId});assert.equal(recovered.result.status,'SYNCED');assert.equal(accounting.posts,1)
    assert.equal((await api(postingPath,body)).recovery,true);assert.equal(accounting.posts,1)
    order.status='stopped';await api(issueRoute,{action:'RECOVER'})
    const changed=await api(postingPath);assert.ok(changed.items[0].issues.length);assert.equal(changed.items[0].canPost,false)
    const reviewedReceipt=await api('/check-receipts',undefined,'GET',200,true);assert.equal(reviewedReceipt[0].status,'NEEDS_REVIEW');assert.equal(reviewedReceipt[0].id,handed[0].id);assert.equal(reviewedReceipt[0].deliveredAt,handed[0].deliveredAt)
    const acknowledgmentPath=`/check-receipts/${handed[0].id}/acknowledge`
    await api(acknowledgmentPath,{acknowledged:false},'POST',400,true)
    await api(`/check-receipts/${uuid(100)}/acknowledge`,{acknowledged:true},'POST',404,true)
    await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id])
    const acknowledgments=await Promise.all([api(acknowledgmentPath,{acknowledged:true},'POST',200,true),api(acknowledgmentPath,{acknowledged:true},'POST',200,true)])
    assert.equal(acknowledgments.filter(a=>a.reused).length,1)
    assert.equal((await api(receiptPath))[0].acknowledgedAt,acknowledgments[0].acknowledgedAt)
    assert.equal((await h.pool.query('SELECT * FROM payroll_check_receipt_acknowledgment')).rowCount,1)
    assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_RECEIPT_ACKNOWLEDGED'")).rowCount,1)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_receipt_acknowledgment'),/append-only/)
    await assertCheckDownload(h,run.id,handed[0].id,'Check evidence needs review')
    await h.pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[employee.id])
    await api(acknowledgmentPath,{acknowledged:true},'POST',401,true)

    assert.equal((await h.pool.query('SELECT * FROM payroll_payment_closeout')).rowCount,1)

   }
   assert.equal(posts,3);return
  }
  await api('/check-configuration',{connectionId:c.revision,expectedRevision:setup.revision,enabled:false,expiryDays:90,activationReference:'Synthetic disabled check configuration',confirmed:true},'POST',201)
  clock='2026-09-19T12:00:00Z'
  await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
  assert.equal((await api(issueRoute,{action:'RECOVER'})).status,'SENT');assert.equal(posts,3)
  if(!variant.startsWith('STOP')){
  order.id=uuid(6);assert.equal((await api(issueRoute,{action:'RECOVER'})).status,'REVIEW_REQUIRED');assert.equal(posts,3)
  order.id=uuid(5);assert.equal((await api(issueRoute,{action:'RECOVER'})).status,'SENT');assert.equal(posts,3)
  }
  assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-issue-%' AND status='OPEN'")).rowCount,0)
  if(['STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE_RENEW','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONFLICT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_UNCERTAIN','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW','STOP_REVIEW_CLOSEOUT_RETRY','STOP_INITIAL_PAID','STOP_INITIAL_FOREIGN','STOP_INITIAL_RECONCILED','STOP_RELEASE_RACE','STOP_RELEASE_EVIDENCE','STOP_RELEASE_HISTORY','STOP_RELEASE_FOREIGN','STOP','STOP_RELEASE','STOP_REVIEW','STOP_REVIEW_DD','STOP_REVIEW_CLOSEOUT','STOP_REVIEW_CLOSEOUT_DD'].includes(variant)){
   const stopRoute=route.replace('/plan','/stop'),stopBody={action:'SUBMIT',confirmed:true,stopPaymentsEnabled:true,reference:'Synthetic lost check stop request'}
   clock='2026-09-18T12:00:00Z'
   await api(route.replace('/plan','/document'),{action:'RETAIN'})
   const printable=await fetch(`${h.url}/api/admin/payroll${route.replace('/plan','/document')}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({action:'DOWNLOAD'})});assert.equal(printable.status,200);await printable.arrayBuffer()
   await api(route.replace('/plan','/delivery'),{confirmed:true,deliveredInPerson:true,amountCents:5970,paymentDate:plan.paymentDate,reference:'Synthetic check handed over before loss'})
   assert.equal((await h.pool.query('SELECT payroll_check_delivery_ready(id) AS ready FROM payroll_check_issue')).rows[0].ready,true)
   if(variant.startsWith('STOP_REVIEW')){
    await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
    if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))await api(`/runs/${run.id}/payment-closeout`,{...delivery,checkPayments:delivery.checkPayments.map(p=>({...p,reference:'Synthetic check handed over before loss'}))})
   }

   if(variant.startsWith('STOP_INITIAL_')){
    if(variant.endsWith('_PAID'))order.status='completed';else if(variant.endsWith('_FOREIGN'))order.id=uuid(6);else order.reconciliation_status='reconciled'
    await api(stopRoute,stopBody,'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_check_stop')).rowCount,0);assert.equal(stopPosts,0)
    order.status='sent';order.id=uuid(5);order.reconciliation_status='unreconciled';await api(issueRoute,{action:'RECOVER'});await api(stopRoute,stopBody,'POST',409)
    const retained=await api(route.replace('/plan','/evidence'));assert.ok(retained.entries.some(e=>variant.endsWith('_FOREIGN')?e.identityMismatch:e.paidObserved))
    assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_STOP_PREFLIGHT_OBSERVED'")).rowCount,2)
    await assert.rejects(h.pool.query('INSERT INTO payroll_check_stop(id,issue_id,provider_id,reference,created_by) SELECT $1,id,$2,$3,99 FROM payroll_check_issue',[uuid(88),uuid(5),stopBody.reference]),/current unpaid original/);assert.equal(stopPosts,0);return
   }
   await api(stopRoute,{action:'RECOVER'},'POST',409)
   await api(stopRoute,{...stopBody,stopPaymentsEnabled:false},'POST',400)
   if(variant.startsWith('STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT')){
    stopLookupFails=true;assert.equal((await api(stopRoute,stopBody)).status,'UNCERTAIN');assert.equal(stopPosts,0);assert.equal((await api(stopRoute)).canRetry,false)
    stopLookupFails=false
    if(variant.endsWith('_CONFLICT')){
     stopAmbiguous=true;assert.equal((await api(stopRoute,{action:'RECOVER'})).status,'NEEDS_REVIEW');stopAmbiguous=false;await api(stopRoute,{action:'RECOVER'});const current=await api(stopRoute);assert.equal(current.status,'NOT_FOUND');assert.equal(current.canRetry,false);await api(`${stopRoute}/release`,{confirmed:true,originalCheckAvailable:true,reference:'Synthetic unsafe missing action continuation',expectedObservationId:current.observationId},'POST',409);await api(stopRoute,{...stopBody,action:'RETRY',originalCheckUnavailable:true,expectedObservationId:current.observationId},'POST',409);assert.equal(stopPosts,0);return
    }
    await api(stopRoute,{action:'RECOVER'});let state=await api(stopRoute);assert.equal(state.canRetry,true);assert.equal(state.retryKind,'NOT_TRANSMITTED')

    if(variant.includes('_CONTINUE')){
     await api(issueRoute,{action:'RECOVER'});state=await api(stopRoute);assert.equal(state.canContinueNoSend,true)
     const continuation=()=>({confirmed:true,originalCheckAvailable:true,reference:'Synthetic original found after unsent stop',expectedObservationId:state.observationId})
     const stale=continuation();await api(stopRoute,{action:'RECOVER'});await api(`${stopRoute}/release`,stale,'POST',409);state=await api(stopRoute)
     for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${stopRoute}/release`,{method:'POST',headers,body:JSON.stringify(continuation())})).status,status)
     const retained=await Promise.all([api(`${stopRoute}/release`,continuation()),api(`${stopRoute}/release`,continuation())]);assert.equal(retained.filter(r=>r.reused).length,1)
     assert.equal((await api(stopRoute)).blocking,false);assert.equal((await api(stopRoute)).canRetry,false);assert.equal((await h.pool.query('SELECT action_id FROM payroll_check_stop_release')).rows[0].action_id,null)
     if(variant.endsWith('_RENEW')){
      for(let cycle=1;cycle<=2;cycle++){
       state=await api(stopRoute);assert.equal(state.canRenew,true);stopLookupFails=true;await api(stopRoute,{...stopBody,action:'RENEW',originalCheckUnavailable:true,expectedObservationId:state.observationId,expectedReleaseId:state.currentReleaseId});assert.equal((await api(stopRoute)).releasedAt,null);assert.equal((await api(stopRoute)).blocking,true)
       stopLookupFails=false;await api(stopRoute,{action:'RECOVER'});state=await api(stopRoute);assert.equal(state.canContinueNoSend,true);await api(`${stopRoute}/release`,{...continuation(),reference:`Synthetic unsent renewal continuation ${cycle}`});assert.equal((await api(stopRoute)).continuations.length,cycle+1);assert.equal(stopPosts,0)
      }
     }
     await assert.rejects(h.pool.query('DELETE FROM payroll_check_stop_release'),/append-only/)
     await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await api(stopRoute)).blocking,false)
     await h.pool.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result,retry_id,created_at) SELECT stop_id,source,result,retry_id,now()-interval '16 minutes' FROM payroll_check_stop_observation ORDER BY id DESC LIMIT 1");assert.equal((await api(stopRoute)).blocking,true);await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).blocking,false)
     stopLookupFails=true;await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).blocking,true);await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409)
     stopLookupFails=false;await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).blocking,false)
     await api(route.replace('/plan','/document'),{action:'RETAIN'});await api(`/runs/${run.id}/payment-closeout`,{...delivery,checkPayments:delivery.checkPayments.map(p=>({...p,reference:'Synthetic check handed over before loss'}))});assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'FINALIZED')
     order.status='completed';order.reconciliation_status='reconciled';await api(stopRoute,{action:'RECOVER'});await api(issueRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).blocking,false)
     order.status='sent';order.reconciliation_status='unreconciled';await api(stopRoute,{action:'RECOVER'});await api(issueRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).blocking,true)
     assert.equal(stopPosts,0);assert.equal(posts,3);return
    }
    const retry=()=>({...stopBody,action:'RETRY',originalCheckUnavailable:true,expectedObservationId:state.observationId})
    if(variant.endsWith('_CRASH')){
     await h.pool.query('INSERT INTO payroll_check_stop_retry(id,stop_id,prior_observation_id,prior_action_id,reference,created_by) VALUES($1,$2,$3,NULL,$4,99)',[uuid(98),state.id,state.observationId,stopBody.reference]);await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).canRetry,false);await api(`${stopRoute}/release`,{confirmed:true,originalCheckAvailable:true,reference:'Synthetic unsafe unanswered stop continuation',expectedObservationId:(await api(stopRoute)).observationId},'POST',409);await api(stopRoute,retry(),'POST',409);assert.equal(stopPosts,0);return
    }
    stopLookupFails=true;await api(stopRoute,retry());assert.equal(stopPosts,0);stopLookupFails=false;await api(stopRoute,{action:'RECOVER'});state=await api(stopRoute);assert.equal(state.retryKind,'NOT_TRANSMITTED')
    preflightRetryCount=2;await api(stopRoute,retry());assert.equal(stopPosts,1)
    if(variant.endsWith('_UNCERTAIN')){
     stopAction=null;await api(stopRoute,{action:'RECOVER'});state=await api(stopRoute);assert.equal(state.status,'NOT_FOUND');assert.equal(state.canRetry,false);await api(`${stopRoute}/release`,{confirmed:true,originalCheckAvailable:true,reference:'Synthetic unsafe transmitted stop continuation',expectedObservationId:state.observationId},'POST',409);await api(stopRoute,retry(),'POST',409);assert.equal(stopPosts,1);return
    }
    await api(stopRoute,{action:'RECOVER'})
    assert.deepEqual((await h.pool.query('SELECT prior_action_id FROM payroll_check_stop_retry ORDER BY sequence')).rows,[{prior_action_id:null},{prior_action_id:null}])
   }else{
    const results=await Promise.all([api(stopRoute,stopBody),api(stopRoute,stopBody)])
    assert.deepEqual(results.map(r=>r.status).sort(),['PENDING','UNCERTAIN']);assert.equal(results[0].id,results[1].id);assert.equal(stopPosts,expectedStopPosts)
   }

   assert.equal((await api(stopRoute)).status,'PENDING')
   await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409)
   await api(route.replace('/plan','/document'),{action:'DOWNLOAD'},'POST',409)
   if(variant.startsWith('STOP_REVIEW_CLOSEOUT_RETRY')){
    stopAction.status='failed';await api(stopRoute,{action:'RECOVER'});let state=await api(stopRoute);assert.equal(state.canRetry,true)
    const retry=()=>({...stopBody,action:'RETRY',originalCheckUnavailable:true,expectedObservationId:state.observationId})
    if(variant.includes('_RENEW')){
     for(let cycle=1;cycle<=2;cycle++){
      const reference=`Synthetic original continuation cycle ${cycle}`
      await api(`${stopRoute}/release`,{confirmed:true,originalCheckAvailable:true,reference});state=await api(stopRoute);assert.equal(state.canRetry,false);assert.equal(state.canRenew,true);assert.equal(state.continuations.length,cycle)
      const renew={...retry(),action:'RENEW',expectedReleaseId:state.currentReleaseId}
      if(variant.endsWith('_CRASH')){
       await h.pool.query('INSERT INTO payroll_check_stop_retry(id,stop_id,prior_observation_id,prior_action_id,reference,created_by,prior_release_id) VALUES($1,$2,$3,$4,$5,99,$6)',[uuid(88),state.id,state.observationId,stopAction.id,stopBody.reference,state.currentReleaseId]);await api(stopRoute,{action:'RECOVER'});state=await api(stopRoute);assert.equal(state.status,'NOT_FOUND');assert.equal(state.blocking,true);assert.equal(state.canRetry,false);assert.equal(state.canRenew,false);assert.equal(state.releasedAt,null);await api(stopRoute,renew,'POST',409);assert.equal(stopPosts,1);return
      }
      for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${stopRoute}`,{method:'POST',headers,body:JSON.stringify(renew)})).status,status)
      await api(stopRoute,{...renew,originalCheckUnavailable:false},'POST',400)
      await api(stopRoute,{...renew,expectedReleaseId:'-1'},'POST',409)
      await assert.rejects(stopPayrollCheck(h.pool,1,run.id,batch.id,employee.id,{fetcher:providerFetcher,actorId:99,automatic:true,recoveryOnly:true,renewal:true,...renew}),/Automatic stop processing can only recover/)
      const requests=await Promise.all([0,1].map(()=>fetch(`${h.url}/api/admin/payroll${stopRoute}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(renew)})))
      assert.deepEqual(requests.map(r=>r.status).sort(),[200,409]);renewalStopCount++;assert.equal(stopPosts,1+renewalStopCount);assert.equal((await api(stopRoute)).releasedAt,null);assert.equal((await api(stopRoute)).blocking,true)
      assert.equal((await h.pool.query('SELECT prior_release_id FROM payroll_check_stop_retry ORDER BY sequence DESC LIMIT 1')).rows[0].prior_release_id,state.currentReleaseId)
      await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409)
      await api(stopRoute,{action:'RECOVER'});stopAction.status='failed';await api(stopRoute,{action:'RECOVER'});state=await api(stopRoute);assert.equal(state.canRetry,true);assert.equal(state.canRenew,false)
      await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await api(stopRoute)).continuations.length,cycle)
     }
    }
    await assert.rejects(stopPayrollCheck(h.pool,1,run.id,batch.id,employee.id,{fetcher:providerFetcher,actorId:99,automatic:true,recoveryOnly:true,retry:true,...retry()}),/Automatic stop processing can only recover/)
    for(const [headers,status] of [[{'Content-Type':'application/json'},401],[{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${stopRoute}`,{method:'POST',headers,body:JSON.stringify(retry())})).status,status)
    if(variant==='STOP_REVIEW_CLOSEOUT_RETRY_CRASH'){
     await h.pool.query('INSERT INTO payroll_check_stop_retry(id,stop_id,prior_observation_id,prior_action_id,reference,created_by) VALUES($1,$2,$3,$4,$5,99)',[uuid(89),state.id,state.observationId,uuid(30),stopBody.reference])
     assert.equal((await api(stopRoute,{action:'RECOVER'})).status,'NOT_FOUND');assert.equal((await api(stopRoute)).canRetry,false);await api(stopRoute,retry(),'POST',409);assert.equal(stopPosts,1);return
    }
    await api(stopRoute,{...retry(),originalCheckUnavailable:false},'POST',400)
    const stale=retry();await api(stopRoute,{action:'RECOVER'});await api(stopRoute,stale,'POST',409);state=await api(stopRoute)
    const responses=await Promise.all([0,1].map(()=>fetch(`${h.url}/api/admin/payroll${stopRoute}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(retry())})))
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);expectedStopPosts=2+renewalStopCount;assert.equal(stopPosts,expectedStopPosts);assert.equal((await api(stopRoute)).canRetry,false)
    await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).status,'PENDING');stopAction.status='failed';await api(stopRoute,{action:'RECOVER'});state=await api(stopRoute);assert.equal(state.canRetry,true)
    await api(stopRoute,retry());expectedStopPosts=3+renewalStopCount;await api(stopRoute,{action:'RECOVER'});assert.equal(stopPosts,expectedStopPosts);assert.equal((await api(stopRoute)).retries.length,2+preflightRetryCount+renewalStopCount)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_stop_retry'),/append-only/)
    const observations=await api(route.replace('/plan','/evidence'));assert.ok(observations.entries.some(e=>e.category==='STOP'&&e.attempt===3+preflightRetryCount+renewalStopCount))
    const history=(await api(stopRoute)).retries;await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.deepEqual((await api(stopRoute)).retries,history)
   }
   if(variant.startsWith('STOP_RELEASE')){
    const releaseBody={confirmed:true,originalCheckAvailable:true,reference:'Synthetic original check found and no replacement issued'}
    await api(`${stopRoute}/release`,releaseBody,'POST',409)
    stopAction.status='failed';await api(stopRoute,{action:'RECOVER'})
    if(variant==='STOP_RELEASE_RACE'){
     order.status='completed';stopReleasePaidRace=true;await api(`${stopRoute}/release`,releaseBody,'POST',409);const observed=(await h.pool.query('SELECT result FROM payroll_check_stop_observation ORDER BY id DESC LIMIT 1')).rows[0].result;assert.equal(observed.checkStatus,'SENT');assert.equal(observed.checkPaidObserved,true);assert.ok((await api(route.replace('/plan','/evidence'))).entries.some(e=>e.category==='STOP'&&e.checkStatus==='SENT'&&e.paidObserved));assert.equal((await api(stopRoute)).canContinue,false);await api(`${stopRoute}/release`,releaseBody,'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_check_stop_release')).rowCount,0);assert.equal(stopPosts,1);return
    }
    if(['STOP_RELEASE_HISTORY','STOP_RELEASE_EVIDENCE'].includes(variant)){
     order.status='completed';await api(stopRoute,{action:'RECOVER'});order.status='sent';await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).canContinue,false);await api(`${stopRoute}/release`,releaseBody,'POST',409);assert.equal((await h.pool.query('SELECT * FROM payroll_check_stop_release')).rowCount,0);assert.equal(stopPosts,1)
     if(variant==='STOP_RELEASE_EVIDENCE'){
      const evidencePath=route.replace('/plan','/evidence'),initial=await api(evidencePath);assert.ok(initial.entries.some(e=>e.category==='STOP'&&e.paidObserved));assert.ok(initial.entries.some(e=>e.category==='ORIGINAL'));assert.ok(initial.entries.every(e=>e.attempt===1))
      for(const [headers,status] of [[{},401],[{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'},404]])assert.equal((await fetch(`${h.url}/api/admin/payroll${evidencePath}`,{headers})).status,status)
      for(const cursor of ['bad cursor','%%%','A'.repeat(601)])await api(`${evidencePath}?cursor=${encodeURIComponent(cursor)}`,undefined,'GET',400)
      await h.pool.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result,created_at) SELECT stop_id,'RECOVERY',result||'{\"privatePayload\":\"MUST_NOT_EXPOSE_EVIDENCE\"}'::jsonb,'2026-09-11T00:00:00.123456Z' FROM payroll_check_stop_observation CROSS JOIN generate_series(1,35) WHERE id=(SELECT max(id) FROM payroll_check_stop_observation)")
      const expected=Number((await h.pool.query('SELECT (SELECT count(*) FROM payroll_check_issue_observation)+(SELECT count(*) FROM payroll_check_stop_observation) AS count')).rows[0].count)
      let page=await api(evidencePath);assert.equal(page.entries.length,20);assert.ok(page.nextCursor);const cursor=JSON.parse(Buffer.from(page.nextCursor,'base64url').toString());assert.equal(cursor.at,'2026-09-11T00:00:00.123456Z')
      await api(`${evidencePath}?cursor=${Buffer.from(JSON.stringify({...cursor,issueId:uuid(99)})).toString('base64url')}`,undefined,'GET',400)
      await api(`${evidencePath}?cursor=${Buffer.from(JSON.stringify({...cursor,at:'2026-02-31T00:00:00.123456Z'})).toString('base64url')}`,undefined,'GET',400)
      await h.pool.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result) SELECT stop_id,source,result FROM payroll_check_stop_observation ORDER BY id DESC LIMIT 1")
      const entries=[...page.entries];while(page.nextCursor){page=await api(`${evidencePath}?cursor=${page.nextCursor}`);entries.push(...page.entries)}assert.equal(entries.length,expected);assert.equal(new Set(entries.map(e=>e.key)).size,expected);assert.equal(JSON.stringify(entries).includes('MUST_NOT_EXPOSE_EVIDENCE'),false);assert.equal(JSON.stringify(entries).includes(uuid(5)),false);assert.equal(stopPosts,1)
      assert.equal((await fetch(`${h.url}/api/admin/payroll${evidencePath}`,{headers:{Authorization:'Bearer payroll-test-admin'}})).headers.get('cache-control'),'no-store')
     }
     return
    }
    await api(`${stopRoute}/release`,{...releaseBody,originalCheckAvailable:false},'POST',400)
    const released=await Promise.all([api(`${stopRoute}/release`,releaseBody),api(`${stopRoute}/release`,releaseBody)])
    assert.equal(released.filter(r=>r.reused).length,1);assert.equal((await api(stopRoute)).blocking,false)
    await api(`${stopRoute}/release`,{...releaseBody,reference:'Different original check review'},'POST',409)
    await api(route.replace('/plan','/document'),{action:'RETAIN'})
    assert.equal((await h.pool.query('SELECT payroll_check_delivery_ready(id) AS ready FROM payroll_check_issue')).rows[0].ready,true)
    assert.equal((await api('/check-receipts',undefined,'GET',200,true))[0].status,'OUTSTANDING')
    await api(stopRoute,{action:'RECOVER'});assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-stop-%' AND status='OPEN'")).rowCount,0)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_stop_release'),/append-only/)
    if(variant==='STOP_RELEASE_FOREIGN'){
     order.id=uuid(6);await api(stopRoute,{action:'RECOVER'});order.id=uuid(5);await api(stopRoute,{action:'RECOVER'});assert.equal((await api(stopRoute)).blocking,true);await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409);assert.equal(stopPosts,1);return
    }
    stopAction.status='acknowledged';order.status='stopped';await api(stopRoute,{action:'RECOVER'});await api(issueRoute,{action:'RECOVER'})
    assert.equal((await api(stopRoute)).blocking,true);assert.equal((await h.pool.query('SELECT payroll_check_delivery_ready(id) AS ready FROM payroll_check_issue')).rows[0].ready,false)
    await api(route.replace('/plan','/document'),{action:'RETAIN'},'POST',409)
    stopAction.status='failed';order.status='sent';await api(stopRoute,{action:'RECOVER'});await api(issueRoute,{action:'RECOVER'})
    assert.equal((await api(stopRoute)).blocking,true)
    assert.equal((await h.pool.query('SELECT * FROM payroll_check_stop_release')).rowCount,1);assert.equal(stopPosts,expectedStopPosts);assert.equal(posts,3);return
   }
   stopAction.status='acknowledged';assert.equal((await api(stopRoute,{action:'RECOVER'})).status,'NEEDS_REVIEW')
   order.status='stopped';assert.equal((await api(stopRoute,{action:'RECOVER'})).status,'STOP_CONFIRMED')
   stopAction.id=uuid(31);assert.equal((await api(stopRoute,{action:'RECOVER'})).status,'NEEDS_REVIEW');stopAction.id=uuid(29+expectedStopPosts)
   stopAction.actionable_id=uuid(99);assert.equal((await api(stopRoute,{action:'RECOVER'})).status,'NEEDS_REVIEW');stopAction.actionable_id=uuid(5)
   stopAction=null;assert.equal((await api(stopRoute,{action:'RECOVER'})).status,'NOT_FOUND');assert.equal(stopPosts,expectedStopPosts)
   assert.equal((await h.pool.query('SELECT payroll_check_delivery_ready(id) AS ready FROM payroll_check_issue')).rows[0].ready,false)
   for(const table of ['payroll_check_stop','payroll_check_stop_observation'])await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
   assert.equal(JSON.stringify((await h.pool.query('SELECT result FROM payroll_check_stop_observation')).rows).includes('MUST NOT RETAIN'),false)
   const foreignStop=await fetch(`${h.url}/api/admin/payroll${stopRoute}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreignStop.status,404)
   const recoveryTime=new Date(Date.now()+2*86400000),sweep=()=>runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>recoveryTime})
   const documentsBefore=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_check_document_check')).rows[0].n
   assert.equal((await sweep()).checked,1);assert.equal((await api(stopRoute)).status,'NOT_FOUND');assert.equal((await sweep()).checked,0)
   stopAction={id:uuid(29+expectedStopPosts),type:'stop',actionable_id:uuid(5),actionable_type:'payment_order',internal_account_id:uuid(2),live_mode:true,status:'acknowledged'}
   recoveryTime.setMinutes(recoveryTime.getMinutes()+11);assert.equal((await sweep()).checked,1);assert.equal((await api(stopRoute)).status,'STOP_CONFIRMED');assert.equal((await api(issueRoute)).status,'STOPPED')
   recoveryTime.setMinutes(recoveryTime.getMinutes()+11);assert.equal((await sweep()).checked,0)
   recoveryTime.setDate(recoveryTime.getDate()+1);assert.equal((await sweep()).checked,1)
   assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_check_document_check')).rows[0].n,documentsBefore)
   assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_STOP_OBSERVED' AND after_data->>'automatic'='true' AND actor_user_id IS NULL")).rowCount,3)
   assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-stop-%' AND status='OPEN'")).rowCount,1)
   const stopKey=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY;recoveryTime.setDate(recoveryTime.getDate()+2)
   try{assert.deepEqual(await sweep(),{skipped:false,checked:0,failed:1})}finally{process.env.PAYROLL_DOCUMENT_KEY=stopKey}
   assert.equal((await api(stopRoute)).status,'RECOVERY_UNAVAILABLE');assert.equal((await sweep()).checked,0)
   recoveryTime.setMinutes(recoveryTime.getMinutes()+11);assert.equal((await sweep()).checked,1);assert.equal((await api(stopRoute)).status,'STOP_CONFIRMED')
   if(variant.startsWith('STOP_REVIEW')){
    const reviewRoute=route.replace('/plan','/replacement-review'),before=await api(reviewRoute)
    assert.equal(before.canReview,true);assert.equal(before.executionAvailable,false);assert.equal(before.status,'REVIEW_REQUIRED');assert.equal(JSON.stringify(before).includes(uuid(5)),false)
    if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))assert.ok((await checkReplacementAnnualEvidence(h.pool,1))[0].issues.length)
    const annual=async()=>(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===Number(employee.id));if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))assert.ok((await annual()).issues.some(i=>i.includes('Stopped check')))
    let reviewBody={fingerprint:before.fingerprint,expectedRevision:0,confirmed:true,noOtherPaymentConfirmed:true,replacementDate:'2026-09-22',taxTreatment:'ORIGINAL_PAYROLL_RETAINED',reference:'Synthetic full unpaid check balance review',taxReference:'Synthetic reviewed original reporting treatment'}
    await api(reviewRoute,{...reviewBody,noOtherPaymentConfirmed:false},'POST',400)
    const retained=await Promise.all([api(reviewRoute,reviewBody),api(reviewRoute,reviewBody)]);assert.equal(retained.filter(r=>r.reused).length,1)
    let reviewed=await api(reviewRoute);assert.equal(reviewed.status,'REVIEW_RETAINED');if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))assert.deepEqual((await checkReplacementAnnualEvidence(h.pool,1))[0].issues,[])
    const annualReviewed=await annual();if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))assert.deepEqual(annualReviewed.replacementTaxReviews[0].issues,[])
    await api(stopRoute,{action:'RECOVER'});await api(issueRoute,{action:'RECOVER'});assert.equal((await api(reviewRoute)).fingerprint,reviewed.fingerprint)
    if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))assert.equal((await annual()).sourceFingerprint,annualReviewed.sourceFingerprint)
    if(variant.endsWith('_DD')){
     await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
     const changed=await api(reviewRoute);reviewBody={...reviewBody,fingerprint:changed.fingerprint,expectedRevision:changed.revision}
     await api(reviewRoute,reviewBody);reviewed=await api(reviewRoute)
    }
    const authorizationRoute=route.replace('/plan','/replacement-authorization')
    assert.equal((await api(authorizationRoute)).canAuthorize,false)
    const disabledSetup=await api('/check-configuration')
    await api('/check-configuration',{connectionId:c.revision,expectedRevision:disabledSetup.revision,enabled:true,expiryDays:90,activationReference:'Synthetic replacement check activation',confirmed:true},'POST',201)
    if(variant.endsWith('_DD')){
     const destination=await api(`/employees/${employee.id}/payment-destination`,{connectionId:c.revision,accountId:uuid(40),reference:'Synthetic replacement employee bank account',confirmed:true,expectedRevision:0},'POST',201)
     const disclosure=await api('/payment-authorization',undefined,'GET',200,true)
     await api('/payment-authorization',{destinationId:destination.revision,expectedRevision:0,decision:'AUTHORIZE',signature:'Monthly Benefits',confirmed:true,fingerprint:disclosure.fingerprint},'POST',201,true)
    }
    const authorizationPlan=await api(authorizationRoute)
    assert.equal(authorizationPlan.canAuthorize,true);assert.equal(JSON.stringify(authorizationPlan).includes(uuid(4)),false)
    const authorizationBody={reviewId:reviewed.revision,fingerprint:authorizationPlan.fingerprint,reference:'Synthetic stopped-check replacement authorization',confirmed:true}
    await assert.rejects(authorizeCheckReplacement(h.pool,1,Number(run.id),Number(batch.id),Number(employee.id),authorizationBody,{actorId:99,now:()=>new Date('2026-09-23T12:00:00Z')}),/changed/)
    assert.equal((await fetch(`${h.url}/api/admin/payroll${authorizationRoute}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(authorizationBody)})).status,404)
    await api(authorizationRoute,{...authorizationBody,confirmed:false},'POST',400)
    await api(authorizationRoute,{...authorizationBody,fingerprint:'0'.repeat(64)},'POST',409)
    const authorized=await Promise.all([api(authorizationRoute,authorizationBody),api(authorizationRoute,authorizationBody)]);assert.equal(authorized.filter(r=>r.reused).length,1)
    const authorizationId=authorized[0].id;assert.equal(authorized[1].id,authorizationId)
    assert.equal((await api(authorizationRoute)).canAuthorize,false)
    await api(authorizationRoute,{...authorizationBody,reference:'Synthetic competing replacement request'},'POST',409)
    const savedAuthorization=(await h.pool.query('SELECT * FROM payroll_check_replacement_authorization WHERE id=$1',[authorizationId])).rows[0]
    assert.equal(Buffer.isBuffer(savedAuthorization.encrypted_intent),true);assert.equal(savedAuthorization.encrypted_intent.includes(Buffer.from(uuid(4))),false)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_authorization'),/append-only/)
    const cancellation={authorizationId,reference:'Synthetic replacement cancellation before dispatch',confirmed:true}
    const cancelled=await Promise.all([api(authorizationRoute+'/cancel',cancellation),api(authorizationRoute+'/cancel',cancellation)]);assert.equal(cancelled.filter(r=>r.reused).length,1)
    await assert.rejects(h.pool.query('INSERT INTO payroll_check_replacement_claim(authorization_id,created_by) VALUES($1,99)',[authorizationId]),/Cancelled/)
    const replan=await api(authorizationRoute);assert.equal(replan.canAuthorize,true)
    const again=await api(authorizationRoute,{...authorizationBody,fingerprint:replan.fingerprint});assert.notEqual(again.id,authorizationId)
    const dispatchRoute=`${authorizationRoute}/${again.id}/dispatch`
    const replacementClock=new Date(Date.now()+2*86400000),replacementSweep=(extra={})=>runCheckReplacementRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>replacementClock,...extra})
    assert.equal((await replacementSweep()).checked,0)
    await assert.rejects(replacementSweep({limit:0}),/limit/);await assert.rejects(replacementSweep({now:()=>new Date('invalid')}),/time/)

    await api(dispatchRoute,{action:'RECOVER'},'POST',409)
    await api(dispatchRoute,{action:'SUBMIT',confirmed:false},'POST',400)
    await h.pool.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result) SELECT id,'RECOVERY','{\"status\":\"UNCERTAIN\"}' FROM payroll_check_stop")
    await api(dispatchRoute,{action:'SUBMIT',confirmed:true},'POST',409)
    assert.equal((await h.pool.query('SELECT * FROM payroll_check_replacement_claim')).rowCount,0)
    await api(stopRoute,{action:'RECOVER'})
    replacementExternal=`vortex_payroll_${variant.endsWith('_DD')?'':'check_'}${again.id}`
    const dispatched=await Promise.all([api(dispatchRoute,{action:'SUBMIT',confirmed:true}),api(dispatchRoute,{action:'SUBMIT',confirmed:true})])
    assert.deepEqual(dispatched.map(x=>x.status).sort(),['SENT','UNCERTAIN']);assert.equal(replacementPosts,1)
    const firstReplacementId=replacementOrder.id;replacementOrder.id=uuid(51)
    assert.equal((await api(dispatchRoute,{action:'RECOVER'})).status,'REVIEW_REQUIRED')
    replacementOrder.id=firstReplacementId
    assert.equal((await api(dispatchRoute,{action:'RECOVER'})).status,'SENT')
    const savedReplacement=replacementOrder;replacementOrder=null
    assert.equal((await api(dispatchRoute,{action:'SUBMIT',confirmed:true})).status,'NOT_FOUND');assert.equal(replacementPosts,1)
    replacementOrder=savedReplacement
    const sweepLock=await h.pool.connect();await sweepLock.query("SELECT pg_advisory_lock(hashtextextended('payroll-check-replacement-recovery-sweep',0))")
    try{assert.equal((await replacementSweep()).skipped,true)}finally{await sweepLock.query("SELECT pg_advisory_unlock(hashtextextended('payroll-check-replacement-recovery-sweep',0))");sweepLock.release()}
    assert.deepEqual(await replacementSweep(),{skipped:false,checked:1,failed:0});assert.equal(replacementPosts,1)
    if(variant.endsWith('_DD')){
     await api(`${authorizationRoute}/${again.id}/document`,{action:'RETAIN'},'POST',404)
     await assert.rejects(h.pool.query('INSERT INTO payroll_check_replacement_document(authorization_id,provider_id,document_id,sha256,encrypted_pdf,source_check_id,created_by) VALUES($1,$2,$3,$4,$5,0,99)',[again.id,uuid(50),uuid(52),'0'.repeat(64),Buffer.from('synthetic rejected PDF')]),/Only CHECK/)
    }
    if(['STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE_RENEW','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONFLICT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_UNCERTAIN','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW','STOP_REVIEW_CLOSEOUT_RETRY','STOP_REVIEW','STOP_REVIEW_CLOSEOUT'].includes(variant)){
     const documentRoute=`${authorizationRoute}/${again.id}/document`
     const stored=(await h.pool.query('SELECT * FROM payroll_check_replacement_document')).rows[0]
     assert.equal(stored.automatic,true);assert.equal(stored.created_by,null);assert.equal(stored.provider_id,uuid(50));assert.equal(stored.encrypted_pdf.includes(pdfBytes),false)
     await assert.rejects(processCheckReplacementDocument(h.pool,1,Number(run.id),Number(batch.id),Number(employee.id),again.id,{action:'DOWNLOAD',automatic:true,fetcher:providerFetcher}),/context/)
     await api(documentRoute,{action:'DOWNLOAD'},'POST',409)
     clock='2026-09-22T12:00:00Z'
     const deliveryRoute=documentRoute.replace('/document','/delivery'),handoff={confirmed:true,deliveredInPerson:true,amountCents:5970,paymentDate:'2026-09-22',reference:'Synthetic replacement handed to employee'}
     await api(deliveryRoute,handoff,'POST',409)
     const download=await fetch(`${h.url}/api/admin/payroll${documentRoute}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({action:'DOWNLOAD'})})
     assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdfBytes)
     const savedPdf=pdfBytes;pdfBytes=Buffer.from('%PDF-1.4\nchanged replacement check\n%%EOF')
     await api(documentRoute,{action:'DOWNLOAD'},'POST',409);pdfBytes=savedPdf
     foreignDocument=true;await api(documentRoute,{action:'RETAIN'},'POST',409);foreignDocument=false
     assert.equal((await api(documentRoute,{action:'RETAIN'})).reused,true)
     await api(route.replace('/plan','/document'),{action:'DOWNLOAD'},'POST',409)
     await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_document'),/append-only/)
     await api(deliveryRoute,{...handoff,amountCents:5971},'POST',409)
     await api(deliveryRoute,{...handoff,deliveredInPerson:false},'POST',400)
     clock='2026-09-23T12:00:00Z';await api(deliveryRoute,handoff,'POST',409);clock='2026-09-22T12:00:00Z'
     const deliveries=await Promise.all([api(deliveryRoute,handoff),api(deliveryRoute,handoff)]);assert.equal(deliveries.filter(r=>r.reused).length,1)
     await api(deliveryRoute,{...handoff,reference:'Synthetic conflicting handoff evidence'},'POST',409)
     await api(documentRoute,{action:'DOWNLOAD'},'POST',409)
     assert.equal((await api(documentRoute,{action:'RETAIN'})).reused,true)
     assert.equal((await api(authorizationRoute)).history.find(a=>a.id===again.id).delivery.reference,handoff.reference)
     await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_delivery'),/append-only/)
     const receipt=(await api('/check-receipts',undefined,'GET',200,true)).find(r=>r.id===again.id)
     assert.equal(receipt.sourceKind,'REPLACEMENT_CHECK');assert.equal(receipt.originalPaymentDate,'2026-09-18');assert.equal(receipt.paymentDate,'2026-09-22');assert.equal(receipt.status,'OUTSTANDING')
     assert.equal(JSON.stringify(receipt).includes(handoff.reference),false);assert.equal(JSON.stringify(receipt).includes(uuid(50)),false)
     const acknowledge=`/check-receipts/${again.id}/acknowledge`
     await api(acknowledge,{acknowledged:false},'POST',400,true)
     const acknowledgments=await Promise.all([api(acknowledge,{acknowledged:true},'POST',200,true),api(acknowledge,{acknowledged:true},'POST',200,true)])
     assert.equal(acknowledgments.filter(r=>r.reused).length,1)
     assert.equal((await api(`/runs/${run.id}/check-receipts`)).find(r=>r.id===again.id).acknowledgedAt,acknowledgments[0].acknowledgedAt)
     await assertCheckDownload(h,run.id,again.id,'Awaiting bank clearance')
     assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_REPLACEMENT_RECEIPT_ACKNOWLEDGED'")).rowCount,1)
     await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_receipt_acknowledgment'),/append-only/)


     clock='2026-09-18T12:00:00Z'
    }
    assert.equal((await replacementSweep()).checked,0)
    assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_REPLACEMENT_OBSERVED' AND actor_user_id IS NULL AND after_data->>'automatic'='true'")).rowCount,1)
    replacementClock.setMinutes(replacementClock.getMinutes()+11)
    const replacementKey=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
    try{assert.deepEqual(await replacementSweep(),{skipped:false,checked:0,failed:1})}finally{process.env.PAYROLL_DOCUMENT_KEY=replacementKey}
    assert.equal((await replacementSweep()).checked,0)
    replacementClock.setMinutes(replacementClock.getMinutes()+11);assert.equal((await replacementSweep()).checked,1)
    assert.equal((await h.pool.query('SELECT * FROM payroll_check_replacement_ach_receipt')).rowCount,0)
    replacementBank=true;Object.assign(replacementOrder,{status:'completed',reconciliation_status:'reconciled',transaction_ids:[uuid(20)]})
    replacementClock.setMinutes(replacementClock.getMinutes()+11);assert.equal((await replacementSweep()).checked,1)
    assert.equal((await h.pool.query("SELECT result->>'settlementStatus' AS status FROM payroll_check_replacement_observation ORDER BY id DESC LIMIT 1")).rows[0].status,'BANK_POSTED')
    if(variant.startsWith('STOP_REVIEW_CLOSEOUT')){
     const close={...delivery,reference:'Synthetic closeout after confirmed stopped-check replacement',checkPayments:delivery.checkPayments.map(p=>({...p,reference:'Synthetic check handed over before loss'}))}
     const authorization=await api(`/runs/${run.id}/payment-authorization`);assert.equal(authorization.check_deliveries[0].ready,true);assert.equal(authorization.check_deliveries[0].replacement.replacementDate,'2026-09-22')
     const renewed=await api(reviewRoute);await api(reviewRoute,{...reviewBody,fingerprint:renewed.fingerprint,expectedRevision:renewed.revision,reference:'Synthetic current wage review after replacement confirmation'})
     assert.equal((await api(`/runs/${run.id}/payment-authorization`)).check_deliveries[0].ready,false)
     await api(dispatchRoute,{action:'RECOVER'});assert.equal((await api(`/runs/${run.id}/payment-authorization`)).check_deliveries[0].ready,true)
     await api(`/runs/${run.id}/payment-closeout`,close,'POST',409)
     const election=(await h.pool.query("SELECT id,response FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])).rows[0]
     await h.pool.query("UPDATE payroll_onboarding_task SET response=jsonb_set(response,'{method}',to_jsonb($2::text)) WHERE id=$1",[election.id,variant.endsWith('_DD')?'CHECK':'DIRECT_DEPOSIT'])
     assert.equal((await api(`/runs/${run.id}/payment-authorization`)).check_deliveries[0].ready,false)
     await h.pool.query('UPDATE payroll_onboarding_task SET response=$2 WHERE id=$1',[election.id,election.response])
     order.status='sent';await api(issueRoute,{action:'RECOVER'});assert.equal((await api(`/runs/${run.id}/payment-authorization`)).check_deliveries[0].ready,false)
     order.status='stopped';await api(issueRoute,{action:'RECOVER'});assert.equal((await api(`/runs/${run.id}/payment-authorization`)).check_deliveries[0].ready,true)
     await assert.rejects(h.pool.query('INSERT INTO payroll_check_replacement_closeout(issue_id,authorization_id,review_id,original_observation_id,stop_observation_id,replacement_observation_id,evidence) SELECT issue_id,authorization_id,review_id,(SELECT min(id) FROM payroll_check_issue_observation WHERE issue_id=p.issue_id),stop_observation_id,replacement_observation_id,evidence FROM payroll_check_replacement_closeout p ORDER BY id DESC LIMIT 1'),/current matching/)
     clock='2026-09-22T12:00:00Z';if(variant.endsWith('_DD')){await api(`/runs/${run.id}/payment-closeout/automatic`,close);assert.deepEqual(await runAutomaticCloseouts(h.pool,{now:()=>new Date(clock),finalize:finalizePayrollRun}),{finalized:1,failed:0})}else await api(`/runs/${run.id}/payment-closeout`,close)
     assert.equal((await api(`/runs/${run.id}/payment-closeout`,close)).reused,true)
     const retained=(await h.pool.query('SELECT * FROM payroll_payment_closeout')).rows;assert.equal(retained.length,1);assert.equal(retained[0].replacement_evidence[0].evidence.wageDate,'2026-09-18');assert.equal(retained[0].replacement_evidence[0].evidence.replacementDate,'2026-09-22')
     assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'FINALIZED')
     const wages=(await h.pool.query('SELECT net_pay_cents,statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows;assert.equal(wages.length,1);assert.equal(Number(wages[0].net_pay_cents),5970);assert.ok(wages[0].statement_snapshot)
     assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='FINALIZE' AND entity_id=$1",[String(run.id)])).rowCount,1)
     await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_closeout'),/append-only/)
     clock='2026-09-23T12:00:00Z';const finalReview=await api(reviewRoute);assert.equal(finalReview.status,'REVIEW_CHANGED')
     await api(reviewRoute,{...reviewBody,fingerprint:finalReview.fingerprint,expectedRevision:finalReview.revision,reference:'Synthetic historical review after original payroll closeout'})
     assert.deepEqual((await checkReplacementAnnualEvidence(h.pool,1))[0].issues,[]);assert.equal(replacementPosts,1)
     return
    }

    if(['STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE_RENEW','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONTINUE','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CONFLICT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_UNCERTAIN','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT','STOP_REVIEW_CLOSEOUT_RETRY_PREFLIGHT_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW_CRASH','STOP_REVIEW_CLOSEOUT_RETRY_RENEW','STOP_REVIEW_CLOSEOUT_RETRY','STOP_REVIEW','STOP_REVIEW_CLOSEOUT'].includes(variant)){
     const receipt=(await api('/check-receipts',undefined,'GET',200,true)).find(r=>r.id===again.id)
     assert.equal(receipt.status,'BANK_CONFIRMED');assert.deepEqual(receipt.bankPostedDates,['2026-09-22'])
     replacementOrder.status='stopped';await api(dispatchRoute,{action:'RECOVER'})
     assert.equal((await api('/check-receipts',undefined,'GET',200,true)).find(r=>r.id===again.id).status,'NEEDS_REVIEW')
     replacementOrder.status='completed';await api(dispatchRoute,{action:'RECOVER'})
    }
    if(variant.endsWith('_DD')){
     const employeeReceipts=await api('/payment-replacement-receipts',undefined,'GET',200,true),receipt=employeeReceipts.find(r=>r.id===again.id)
     assert.equal(receipt.status,'BANK_CONFIRMED');assert.equal(receipt.sourceKind,'STOPPED_CHECK');assert.equal(receipt.amountCents,5970);assert.equal(receipt.paymentDate,'2026-09-22');assert.equal(receipt.originalPaymentDate,'2026-09-18');assert.deepEqual(receipt.bankPostedDates,['2026-09-22'])
     assert.ok(!JSON.stringify(receipt).includes(uuid(50)));assert.ok(!JSON.stringify(receipt).includes('encrypted_intent'))
     assert.deepEqual(await api(`/runs/${run.id}/payment-replacement-receipts`),employeeReceipts)
     const downloadPath=`/payment-replacement-receipts/${again.id}/download`
     for(const [prefix,token] of [[`/api/admin/payroll/runs/${run.id}`,'payroll-test-admin'],['/api/payroll/employee','monthly-benefits-session']]){
      const response=await fetch(`${h.url}${prefix}${downloadPath}`,{headers:{Authorization:`Bearer ${token}`}})
      assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/attachment.*\.html/);assert.equal(response.headers.get('cache-control'),'no-store');const html=await response.text();assert.ok(html.includes('Bank evidence confirmed'));assert.ok(html.includes('Monthly Benefits Fixture'));assert.ok(html.includes('2026-09-22'));assert.ok(!html.includes(uuid(50)))
     }
     const denied=await fetch(`${h.url}/api/admin/payroll/runs/${run.id}${downloadPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(denied.status,404)
     assert.equal((await fetch(`${h.url}/api/payroll/employee${downloadPath}`)).status,401)

     assert.deepEqual(await checkReplacementAchReceipts(h.pool,2,{runId:run.id}),[])
     assert.deepEqual(await checkReplacementAchReceipts(h.pool,1,{employeeId:999999}),[])
     await api(dispatchRoute,{action:'RECOVER'})
     assert.equal((await h.pool.query('SELECT * FROM payroll_check_replacement_ach_receipt')).rowCount,1)
     await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_ach_receipt'),/append-only/)
    }else {
     assert.equal((await h.pool.query('SELECT * FROM payroll_check_replacement_ach_receipt')).rowCount,0)
     await assert.rejects(h.pool.query('INSERT INTO payroll_check_replacement_ach_receipt(authorization_id,observation_id) SELECT authorization_id,id FROM payroll_check_replacement_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[again.id]),/Direct-deposit replacement receipt/)
    }
    const replacementBankView=await api(`/runs/${run.id}/payment-accounting`)
    assert.equal(replacementBankView.events.length,1);assert.equal(replacementBankView.events[0].sourceKind,'CHECK_REPLACEMENT');assert.equal(replacementBankView.events[0].paymentRail,variant.endsWith('_DD')?'DIRECT_DEPOSIT':'CHECK');assert.equal(replacementBankView.totals.netOutflowCents,5970)
    const replacementAccounting=await configureSettlementFixture(h,api,run.id,c.revision,value=>{accountingFetcher=value}),replacementPostingRoute=`/runs/${run.id}/payment-accounting/posting`,replacementPosting=await api(replacementPostingRoute)
    assert.equal(replacementPosting.items[0].canPost,true)
    const replacementJournalBody={action:'SUBMIT',eventKey:replacementPosting.items[0].key,fingerprint:replacementPosting.fingerprint,reference:'Synthetic stopped-check replacement bank journal',confirmed:true,noOtherPostingConfirmed:true}
    let replacementJournal
    let automationClock=new Date(Date.now()+12*86400000)
    if(variant.endsWith('_DD')){
     const automationRoute=`/runs/${run.id}/payment-accounting/automation`,reviewAutomation=()=>api(automationRoute)
     let automatic=await reviewAutomation();assert.equal(automatic.status,'DISABLED');assert.equal(automatic.canEnable,true)
     const automationBody={enabled:true,expectedRevision:automatic.revision,fingerprint:automatic.fingerprint,reference:'Synthetic authorization for automatic bank journals',confirmed:true,noOtherPostingConfirmed:true}
     await api(automationRoute,{...automationBody,noOtherPostingConfirmed:false},'POST',400)
     await api(automationRoute,{...automationBody,fingerprint:'stale'},'POST',409)
     await api(automationRoute,automationBody)
     automatic=await reviewAutomation();assert.equal(automatic.status,'ENABLED')
     await api(automationRoute,{...automationBody,enabled:false,expectedRevision:automatic.revision,fingerprint:automatic.fingerprint})
     assert.equal((await runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>automationClock})).posted,0)
     automatic=await reviewAutomation();await api(automationRoute,{...automationBody,expectedRevision:automatic.revision,fingerprint:automatic.fingerprint})
     await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='456' WHERE facility_id=1")
     assert.equal((await reviewAutomation()).status,'NEEDS_REVIEW')
     assert.equal((await runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>automationClock})).failed,1);assert.equal(replacementAccounting.posts,0)
     await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1");automationClock.setMinutes(automationClock.getMinutes()+11)
     replacementAccounting.badGross=true
     assert.equal((await runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>automationClock})).failed,1)
     assert.equal((await h.pool.query('SELECT * FROM payroll_settlement_journal')).rowCount,0)
     replacementAccounting.badGross=false;automationClock.setMinutes(automationClock.getMinutes()+11)
     const results=await Promise.all([runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>automationClock}),runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>automationClock})])
     assert.equal(results.reduce((n,r)=>n+r.posted,0),1);assert.equal(results.reduce((n,r)=>n+r.failed,0),0)
     const retained=(await h.pool.query('SELECT id,created_by,automation_id FROM payroll_settlement_journal')).rows[0]
     assert.equal(retained.created_by,null);assert.ok(retained.automation_id)
     const executionHistory=(await reviewAutomation()).executions
     assert.equal(executionHistory.filter(e=>e.status==='FAILED').length,2)
     assert.equal(executionHistory.find(e=>e.status==='COMPLETED').journals[0].id,retained.id)
     assert.equal(executionHistory.find(e=>e.status==='COMPLETED').journals[0].status,'UNCERTAIN')
     const oldAttempt=(await h.pool.query('INSERT INTO payroll_settlement_automation_check(automation_id) SELECT min(id) FROM payroll_settlement_automation RETURNING id')).rows[0].id
     assert.equal((await reviewAutomation()).executions[0].status,'UNCONFIRMED')
     await assert.rejects(h.pool.query('DELETE FROM payroll_settlement_automation_result'),/append-only/)

     await assert.rejects(h.pool.query("INSERT INTO payroll_settlement_journal(id,facility_id,payroll_run_id,mapping_id,payroll_journal_id,event_key,event,realm_id,environment,payload,reference,created_by,automation_id) SELECT $2,facility_id,payroll_run_id,mapping_id,payroll_journal_id,event_key,event,realm_id,environment,payload,reference,NULL,NULL FROM payroll_settlement_journal WHERE id=$1",[retained.id,uuid(96)]),/Manual journal requires/)
     await assert.rejects(h.pool.query("INSERT INTO payroll_settlement_journal(id,facility_id,payroll_run_id,mapping_id,payroll_journal_id,event_key,event,realm_id,environment,payload,reference,created_by,automation_id,automation_check_id) SELECT $2,facility_id,payroll_run_id,mapping_id,payroll_journal_id,event_key,event,realm_id,environment,payload,reference,NULL,(SELECT min(id) FROM payroll_settlement_automation),$3 FROM payroll_settlement_journal WHERE id=$1",[retained.id,uuid(96),oldAttempt]),/current matching authorization/)
     await assert.rejects(h.pool.query('INSERT INTO payroll_settlement_journal_claim(journal_id,created_by) VALUES($1,99)',[retained.id]),/claim actor/)

     assert.equal((await h.pool.query('SELECT created_by FROM payroll_settlement_journal_claim')).rows[0].created_by,null)
     assert.equal((await h.pool.query("SELECT actor_user_id FROM payroll_audit_log WHERE action='SETTLEMENT_JOURNAL_CHECKED'")).rows[0].actor_user_id,null)
     assert.equal((await runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>automationClock})).posted,0)
     await assert.rejects(h.pool.query('DELETE FROM payroll_settlement_automation'),/append-only/)
     await assert.rejects(h.pool.query('DELETE FROM payroll_settlement_automation_check'),/append-only/)
     replacementJournal={jobId:retained.id,result:{status:(await h.pool.query('SELECT result FROM payroll_settlement_journal_observation ORDER BY id DESC LIMIT 1')).rows[0].result.status}}
    }else replacementJournal=await api(replacementPostingRoute,replacementJournalBody)
    assert.equal(replacementJournal.result.status,'UNCERTAIN')
    assert.equal((await api(replacementPostingRoute,{action:'RECOVER',jobId:replacementJournal.jobId})).result.status,'SYNCED');assert.equal(replacementAccounting.posts,1)
    if(variant.endsWith('_DD'))assert.equal((await api(`/runs/${run.id}/payment-accounting/automation`)).executions.flatMap(e=>e.journals).find(j=>j.id===replacementJournal.jobId).status,'SYNCED')
    assert.equal((await api(replacementPostingRoute,replacementJournalBody)).recovery,true);assert.equal(replacementAccounting.posts,1)
    const caseRoute=`/runs/${run.id}/check-stop-cases`
    assert.equal((await api(caseRoute))[0].status,'CLOSED')
    const caseCount=async()=>Number((await h.pool.query('SELECT count(*) FROM payroll_check_stop_case')).rows[0].count)
    const stableCount=await caseCount()
    await api(replacementPostingRoute,{action:'RECOVER',jobId:replacementJournal.jobId});assert.equal(await caseCount(),stableCount)
    replacementAccounting.journals.get('101').TxnDate='2026-09-19'
    await api(replacementPostingRoute,{action:'RECOVER',jobId:replacementJournal.jobId})
    assert.equal((await api(caseRoute))[0].status,'OPEN')
    assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key LIKE 'check-stop-%'")).rows[0].status,'OPEN')
    replacementAccounting.journals.get('101').TxnDate='2026-09-22'
    await api(replacementPostingRoute,{action:'RECOVER',jobId:replacementJournal.jobId})
    assert.equal((await api(caseRoute))[0].status,'CLOSED')
    assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key LIKE 'check-stop-%'")).rows[0].status,'DISMISSED')
    const caseClock=new Date(Date.now()+10*86400000)
    assert.equal((await runPaymentReturnCaseSweep(h.pool,{now:()=>caseClock})).checked,1)
    assert.equal((await runPaymentReturnCaseSweep(h.pool,{now:()=>caseClock})).checked,0)
    await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='456' WHERE facility_id=1")
    caseClock.setMinutes(caseClock.getMinutes()+11)
    assert.equal((await runPaymentReturnCaseSweep(h.pool,{now:()=>caseClock})).checked,1)
    assert.equal((await api(caseRoute))[0].status,'OPEN')
    await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1")
    caseClock.setMinutes(caseClock.getMinutes()+11)
    assert.equal((await runPaymentReturnCaseSweep(h.pool,{now:()=>caseClock})).checked,1)
    assert.equal((await api(caseRoute))[0].status,'CLOSED')
    assert.equal(Number((await h.pool.query("SELECT count(*) FROM payroll_audit_log WHERE action='CHECK_STOP_CASE_REVIEWED' AND actor_user_id IS NOT NULL")).rows[0].count),0)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_stop_case'),/append-only/)
    replacementClock.setHours(replacementClock.getHours()+1);assert.equal((await replacementSweep()).checked,0)
    replacementClock.setDate(replacementClock.getDate()+1);assert.equal((await replacementSweep()).checked,1)
    assert.equal(replacementPosts,1)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_recovery_check'),/append-only/)
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_observation'),/append-only/)

    await api(authorizationRoute+'/cancel',{...cancellation,authorizationId:again.id},'POST',409)
    await assert.rejects(h.pool.query('INSERT INTO payroll_check_replacement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[again.id,cancellation.reference]),/Claimed/)
    const stopId=(await api(stopRoute)).id
    await h.pool.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result,created_at) SELECT stop_id,'RECOVERY',result,now()-interval '16 minutes' FROM payroll_check_stop_observation WHERE stop_id=$1 ORDER BY id DESC LIMIT 1",[stopId])
    assert.equal((await api(reviewRoute)).canReview,false);if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))assert.deepEqual((await checkReplacementAnnualEvidence(h.pool,1))[0].issues,[])
    await api(stopRoute,{action:'RECOVER'})
    await api(reviewRoute,{...reviewBody,expectedRevision:reviewed.revision,taxTreatment:'CORRECTION_REQUIRED'})
    if(!variant.startsWith('STOP_REVIEW_CLOSEOUT'))assert.ok((await checkReplacementAnnualEvidence(h.pool,1))[0].issues.some(i=>i.includes('correction')))
    assert.equal((await api(dispatchRoute,{action:'RECOVER'})).status,'COMPLETED');assert.equal(replacementPosts,1)
    if(variant.endsWith('_DD')){
     const prior=(await h.pool.query('SELECT result FROM payroll_check_replacement_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[again.id])).rows[0].result
     await h.pool.query("INSERT INTO payroll_check_replacement_observation(authorization_id,source,result) VALUES($1,'RECOVERY',$2)",[again.id,{...prior,status:'RETURNED',settlementStatus:'EXCEPTION',settlementEvidence:[],returnEvidenceStatus:'BANK_CREDIT_POSTED',returnEvidence:{returnId:uuid(54),transactionId:uuid(55),lineItemId:uuid(56),postedDate:'2026-09-23',amountCents:5970}}])
     assert.equal((await api('/payment-replacement-receipts',undefined,'GET',200,true)).find(r=>r.id===again.id).status,'NEEDS_REVIEW')
     const returned=await api(replacementPostingRoute),credit=returned.items.find(i=>i.kind==='RETURN');assert.equal(credit.canPost,true)
     await h.pool.query("CREATE FUNCTION fail_worker_observation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SETTLEMENT_JOURNAL_CHECKED' THEN RAISE EXCEPTION 'Synthetic worker observation failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_worker_observation_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION fail_worker_observation_audit()")
     automationClock.setMinutes(automationClock.getMinutes()+11);assert.equal((await runSettlementAutomationSweep(h.pool,{fetcher:accountingFetcher,now:()=>automationClock})).failed,1)
     await h.pool.query('DROP TRIGGER fail_worker_observation_audit ON payroll_audit_log; DROP FUNCTION fail_worker_observation_audit()')
     const partial=(await api(`/runs/${run.id}/payment-accounting/automation`)).executions[0]
     assert.equal(partial.status,'FAILED');assert.equal(partial.journals.length,1);assert.equal(partial.journals[0].status,'UNCERTAIN');assert.equal(replacementAccounting.posts,2)

     assert.equal((await api(replacementPostingRoute,{...replacementJournalBody,eventKey:credit.key,fingerprint:returned.fingerprint})).result.status,'SYNCED');assert.equal(replacementAccounting.posts,2)
     assert.equal((await api(`/runs/${run.id}/payment-accounting`)).totals.netOutflowCents,0)
    }

    await h.pool.query("UPDATE payroll_onboarding_task SET response=$2 WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id,{method:variant.endsWith('_DD')?'CHECK':'DIRECT_DEPOSIT'}]);assert.equal((await api(reviewRoute)).status,'REVIEW_CHANGED')
    await assert.rejects(h.pool.query('DELETE FROM payroll_check_replacement_review'),/append-only/)
   }
   assert.equal(stopPosts,expectedStopPosts);assert.equal(posts,3)
  }
  if(variant==='RECOVERY'){
   const recoveryClock=new Date(Date.now()+2*86400000),sweep=(extra={})=>runCheckIssueRecoverySweep(h.pool,{fetcher:providerFetcher,now:()=>recoveryClock,...extra})
   await assert.rejects(sweep({limit:0}),/limit/);await assert.rejects(sweep({now:()=>new Date('invalid')}),/time/)
   const lock=await h.pool.connect();await lock.query("SELECT pg_advisory_lock(hashtextextended('payroll-check-issue-recovery-sweep',0))")
   try{assert.equal((await sweep()).skipped,true)}finally{await lock.query("SELECT pg_advisory_unlock(hashtextextended('payroll-check-issue-recovery-sweep',0))");lock.release()}
   const savedOrder=order;order=null
   assert.deepEqual(await sweep({limit:1}),{skipped:false,checked:1,failed:0})
   assert.equal((await api(issueRoute)).status,'NOT_FOUND');assert.equal(posts,3)
   assert.equal((await sweep()).checked,0)
   assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-issue-%' AND status='OPEN'")).rowCount,1)
   order=savedOrder;recoveryClock.setMinutes(recoveryClock.getMinutes()+11)
   assert.equal((await sweep()).checked,1);assert.equal((await api(issueRoute)).status,'SENT')
   assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-issue-%' AND status='OPEN'")).rowCount,0)
   const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY;recoveryClock.setMinutes(recoveryClock.getMinutes()+11)
   try{assert.deepEqual(await sweep(),{skipped:false,checked:0,failed:1})}finally{process.env.PAYROLL_DOCUMENT_KEY=key}
   assert.equal((await sweep()).checked,0)
   recoveryClock.setMinutes(recoveryClock.getMinutes()+11);assert.equal((await sweep()).checked,1)
   await h.pool.query("INSERT INTO payroll_check_issue_observation(issue_id,source,result,created_at) SELECT issue_id,'RECOVERY',result||'{\"status\":\"COMPLETED\",\"settlementStatus\":\"BANK_POSTED\"}'::jsonb,$1 FROM payroll_check_issue_observation ORDER BY id DESC LIMIT 1",[recoveryClock])
   recoveryClock.setMinutes(recoveryClock.getMinutes()+11);assert.equal((await sweep()).checked,0)
   recoveryClock.setDate(recoveryClock.getDate()+1);assert.equal((await sweep()).checked,1)
   assert.equal(posts,3);assert.equal((await h.pool.query('SELECT * FROM payroll_check_issue')).rowCount,1)
   assert.equal((await h.pool.query('SELECT * FROM payroll_check_issue_recovery_check')).rowCount,5)
   await assert.rejects(h.pool.query('DELETE FROM payroll_check_issue_recovery_check'),/append-only/)
   assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='CHECK_ISSUANCE_OBSERVED' AND after_data->>'automatic'='true' AND actor_user_id IS NULL")).rowCount,4)
   const prepared=(await h.pool.query('SELECT * FROM payroll_check_document')).rows
   assert.equal(prepared.length,1);assert.equal(prepared[0].automatic,true);assert.equal(prepared[0].created_by,null)
   await assert.rejects(processCheckDocument(h.pool,1,Number(run.id),Number(batch.id),employee.id,{action:'DOWNLOAD',fetcher:providerFetcher,automatic:true}),/admin or automatic retention/)
   await assert.rejects(h.pool.query("INSERT INTO payroll_check_document_check(issue_id,action,status,metadata,automatic) VALUES($1,'DOWNLOAD','DOWNLOADED','{}',true)",[prepared[0].issue_id]),/payroll_check_document_check_actor/)
   await assert.rejects(h.pool.query("INSERT INTO payroll_check_document(issue_id,provider_id,document_id,sha256,encrypted_pdf,source_check_id,created_by,automatic) SELECT issue_id,provider_id,document_id,sha256,encrypted_pdf,source_check_id,99,false FROM payroll_check_document"),/verified issued-check evidence/)

   assert.equal((await h.pool.query("SELECT * FROM payroll_check_document_check WHERE action='DOWNLOAD'")).rowCount,0)
   assert.equal((await h.pool.query('SELECT * FROM payroll_check_delivery')).rowCount,0)
   foreignDocument=true;recoveryClock.setMinutes(recoveryClock.getMinutes()+11)
   assert.deepEqual(await sweep(),{skipped:false,checked:0,failed:1})
   assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-document-%' AND status='OPEN'")).rowCount,1)
   assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-issue-%' AND status='OPEN'")).rowCount,0)
   foreignDocument=false;recoveryClock.setMinutes(recoveryClock.getMinutes()+11)
   assert.equal((await sweep()).checked,1)
   assert.equal((await h.pool.query("SELECT * FROM payroll_alert WHERE dedupe_key LIKE 'check-document-%' AND status='OPEN'")).rowCount,0)
   assert.equal((await h.pool.query('SELECT * FROM payroll_check_document')).rowCount,1);assert.equal(posts,3)

  }
  assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,variant.startsWith('STOP_REVIEW')?'FINALIZED':'APPROVED')
  return
 }
 const foreign=await fetch(`${h.url}/api/admin/payroll${route}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 clock='2026-09-19T12:00:00Z';assert.ok((await api(route)).issues.some(i=>i.includes('date has passed')));clock='2026-09-18T12:00:00Z'
 const operation=(await h.pool.query("SELECT id FROM payroll_check_payee_operation WHERE stage='ACCOUNT'")).rows[0]
 await h.pool.query("INSERT INTO payroll_check_payee_observation(operation_id,source,result,created_at) SELECT $1,'RECOVERY',result,now()-interval '16 minutes' FROM payroll_check_payee_observation WHERE operation_id=$1 ORDER BY id DESC LIMIT 1",[operation.id])
 assert.equal((await api(route)).status,'NEEDS_REVIEW')
 await api(`${payeePath}/${payee.id}/advance`,{stage:'ACCOUNT',action:'RECOVER'});assert.equal((await api(route)).fingerprint,ready.fingerprint)
 await api('/check-configuration',{connectionId:c.revision,expectedRevision:setup.revision,enabled:true,expiryDays:120,activationReference:'Synthetic revised check expiration',confirmed:true},'POST',201)
 const changed=await api(route);assert.equal(changed.expiryDays,120);assert.notEqual(changed.fingerprint,ready.fingerprint)
 await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id]);await api(route,undefined,'GET',409)
 await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
 const closeout={batchId:Number(batch.id),fingerprint:plan.fingerprint,paymentDate:plan.paymentDate,reference:'Synthetic retained manual check delivery',confirmed:true,checkPayments:[{employeeId:employee.id,amountCents:5970,paymentDate:plan.paymentDate,reference:'Synthetic delivered check 1001'}]}
 await api(`/runs/${run.id}/payment-closeout/automatic`,closeout,'POST',200)
 assert.ok((await api(route)).issues.some(i=>i.includes('delivery was confirmed')))
 await api(`/runs/${run.id}/payment-closeout/automatic/cancel`,closeout)
 assert.ok((await api(route)).issues.some(i=>i.includes('delivery was confirmed')))
 assert.equal(posts,2);assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,0)
})
