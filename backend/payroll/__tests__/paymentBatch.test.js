import {runPaymentReturnCaseSweep} from '../paymentReturnCaseScheduler.js'
import {replacementReceipts} from '../paymentReplacementReceipt.js'
import {runReplacementRecoverySweep} from '../paymentReplacementRecoveryScheduler.js'
import {dispatchReplacementPayment} from '../paymentReplacementDispatch.js'
import {authorizeReplacementPayment} from '../paymentReplacementAuthorization.js'
import {runSettlementRecoverySweep} from '../settlementRecoveryScheduler.js'
import {configureSettlementFixture} from '../testing/settlementFixture.js'
import {runPaymentSubmissionSweep} from '../paymentSubmissionSchedule.js'
import {runAutomaticCloseouts} from '../automaticCloseout.js'
import {runPaymentRecoverySweep} from '../paymentRecoveryScheduler.js'
import {addMixedPaymentEmployees} from '../testing/mixedPaymentEmployees.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {randomBytes} from 'node:crypto'
import {dispatchPayrollInstruction} from '../paymentDispatch.js'
import {loadRunPreview,payrollFingerprint,finalizePayrollRun} from '../registerRoutes.js'
test('run payment authorization retains a single reviewed plan and blocks manual payment until cancelled',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const plan=await api(`/runs/${run.id}/payment-plan`),path=`/runs/${run.id}/payment-authorization`,body={fingerprint:plan.fingerprint,reference:'Synthetic reviewed payroll payment batch',confirmed:true}
 await api(path,{...body,confirmed:false},'POST',400);await api(path,{...body,fingerprint:'stale'},'POST',409)
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},url=`${h.url}/api/admin/payroll${path}`
 assert.equal((await fetch(url,{method:'POST',headers:{...headers,'x-test-facility':'2'},body:JSON.stringify(body)})).status,404)
 const race=await Promise.all([1,2].map(()=>fetch(url,{method:'POST',headers,body:JSON.stringify(body)})));assert.deepEqual(race.map(r=>r.status).sort(),[200,201])
 const batch=await api(path);assert.equal(batch.status,'AUTHORIZED');assert.equal(batch.plan.totals.totalCents,plan.totals.totalCents)
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_batch')).rowCount,1)
 await api(path,{...body,reference:'Conflicting reviewed batch evidence'},'POST',409)
 await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH',409)
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-BLOCKED-PAYMENT'},'POST',409)
 await assert.rejects(h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[run.id]),/Cancel the unsubmitted/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_batch'),/append-only/)
 const cancel={batchId:Number(batch.id),reference:'Synthetic cancellation before any dispatch',confirmed:true}
 await api(`${path}/cancel`,{...cancel,batchId:0},'POST',409);await api(`${path}/cancel`,cancel);assert.equal((await api(`${path}/cancel`,cancel)).reused,true)
 assert.equal((await api(path)).status,'CANCELLED');await api(path,body,'POST',409)
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_batch_cancellation'),/append-only/)
 await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH')
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,0)
})
for(const variant of ['REPEAT_REPLACEMENT','SETTLEMENT_POSTING','SCHEDULE','SCHEDULE_CANCEL','SCHEDULE_WITHDRAWN','SCHEDULE_RACE','SCHEDULE_EXPIRED','AUTOMATIC','AUTO_CANCEL','AUTO_RACE','SWEEP','MIXED','CLOSEOUT','BANK_SETTLEMENT','ADMIN_ROUTE','ACCEPTED','LOST_RESPONSE','WRITE_INTERRUPTED','WITHDRAWN','BLOCKED_LOOKUP','BLOCKED_VERIFICATION','OBSERVED_AFTER_BLOCK','UNKNOWN_LOOKUP'])test(`direct-deposit dispatch retains authorized instructions and recovers safely (${variant})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const previousKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
 let routeFetcher,quickbooksFetcher
 const h=await createHarness({quickbooksFetcher:async(...args)=>{if(!quickbooksFetcher)throw new Error('Synthetic QuickBooks unavailable');return quickbooksFetcher(...args)},payrollNow:()=>new Date(variant.startsWith('SCHEDULE')?'2026-09-10T12:00:00Z':['SETTLEMENT_POSTING','REPEAT_REPLACEMENT'].includes(variant)?'2026-09-20T12:00:00Z':'2051-01-01T12:00:00Z'),paymentFetcher:async(url,options)=>{if(routeFetcher)return routeFetcher(url,options);assert.equal(options.method,undefined);return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:id(2),currency:'USD',live_mode:true}:{id:id(3),counterparty_id:id(4),party_name:'Monthly Benefits',party_type:'individual',account_type:'checking',live_mode:true,verification_status:'verified',account_details:[{account_number_safe:'1234'}]}}}})
 t.after(async()=>{await h.close();if(previousKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=previousKey})
 const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const connection=await api('/payment-connection',{organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-batch-key',mode:'LIVE',reference:'Synthetic employer payment account review',confirmed:true,expectedRevision:0},'POST',201)
 await api('/payment-connection/verify',{expectedRevision:connection.revision})
 const destination=await api(`/employees/${employee.id}/payment-destination`,{connectionId:connection.revision,accountId:id(3),reference:'Synthetic employee bank account evidence',confirmed:true,expectedRevision:0},'POST',201)
 const disclosure=await api('/payment-authorization',undefined,'GET',200,true)
 await api('/payment-authorization',{destinationId:destination.revision,expectedRevision:0,decision:'AUTHORIZE',signature:'Monthly Benefits',confirmed:true,fingerprint:disclosure.fingerprint},'POST',201,true)
 await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
 const mixed=['MIXED','AUTOMATIC','AUTO_CANCEL','AUTO_RACE'].includes(variant)?await addMixedPaymentEmployees(h,api):null
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const plan=await api(`/runs/${run.id}/payment-plan`);assert.equal(plan.status,'READY_FOR_PAYMENT_REVIEW')
 const path=`/runs/${run.id}/payment-authorization`,batch=await api(path,{fingerprint:plan.fingerprint,reference:'Synthetic reviewed direct-deposit batch',confirmed:true},'POST',201)
 const instructions=(await h.pool.query('SELECT i.* FROM payroll_payment_instruction i JOIN payroll_payment_batch_instruction l ON l.instruction_id=i.id WHERE l.batch_id=$1',[batch.id])).rows
 assert.equal(instructions.length,1);assert.equal(instructions[0].receiving_account_id,id(3));assert.equal(instructions[0].originating_account_id,id(2));assert.equal(instructions[0].mode,'LIVE');assert.equal(Number(instructions[0].amount_cents),plan.totals.directDepositCents)
 const instructionId=instructions[0].id
 let order=null,posts=0,interrupted=false
 const fetcher=async(url,options)=>{
  if(url.includes('/transactions/'))return {ok:true,status:200,json:async()=>({id:id(6),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:plan.paymentDate,amount:plan.totals.directDepositCents+10000})}
  if(url.includes('/transaction_line_items?'))return {ok:true,status:200,json:async()=>[{id:id(7),transaction_id:id(6),transactable_type:'payment_order',transactable_id:id(5),live_mode:true,type:'originating',amount:plan.totals.directDepositCents}]}
  if(url.includes('/internal_accounts/')&&variant==='BLOCKED_LOOKUP')return {ok:false,status:503,json:async()=>({})}
  if(url.includes('/internal_accounts/')&&['BLOCKED_VERIFICATION','OBSERVED_AFTER_BLOCK'].includes(variant))return {ok:true,status:200,json:async()=>({id:id(2),currency:'USD',live_mode:false})}
  if(url.includes('/payment_orders/')&&variant==='UNKNOWN_LOOKUP')throw new Error('Synthetic ambiguous provider lookup failure')
  if(options.method==='POST'){
   posts++;assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt WHERE instruction_id=$1',[instructionId])).rowCount,1)
   order={...JSON.parse(options.body),id:id(5),live_mode:true,status:'processing',reconciliation_status:'unreconciled',transaction_ids:[]}
   if(variant==='LOST_RESPONSE')throw new Error('Synthetic response lost after provider acceptance')
   return {ok:true,status:200,json:async()=>order}
  }
  if(url.includes('/payment_orders/'))return {ok:!!order,status:order?200:404,json:async()=>order}
  return {ok:true,status:200,json:async()=>url.includes('/internal_accounts/')?{id:id(2),currency:'USD',live_mode:true}:{id:id(3),live_mode:true,verification_status:'verified'}}
 }
 routeFetcher=fetcher
 const dispatchPath=`${path}/${batch.id}/instructions/${instructionId}/dispatch`
 const sendBody={action:'SUBMIT',confirmed:true,fingerprint:plan.fingerprint}
 if(variant==='ADMIN_ROUTE'){
  await api(dispatchPath,{action:'RECOVER'},'POST',409)
  await api(dispatchPath,{...sendBody,confirmed:false},'POST',400)
  await api(dispatchPath,{...sendBody,fingerprint:'0'.repeat(64)},'POST',409)
  await api(dispatchPath.replace(`/runs/${run.id}/`,`/runs/999999/`),sendBody,'POST',404)
  const response=await fetch(`${h.url}/api/admin/payroll${dispatchPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(sendBody)})
  assert.equal(response.status,404)
  assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,0);assert.equal(posts,0)
 }
 if(variant==='SWEEP')assert.equal((await runPaymentRecoverySweep(h.pool,{fetcher})).checked,0)

 if(variant.startsWith('SCHEDULE')){
  const schedulePath=`${path}/${batch.id}/instructions/${instructionId}/schedule`,scheduleBody={confirmed:true,fingerprint:plan.fingerprint,submitAt:'2026-09-17T12:00:00.000Z',reference:'Synthetic scheduled payroll instruction'}
  await api(schedulePath,{...scheduleBody,confirmed:false},'POST',400)
  await api(schedulePath,{...scheduleBody,submitAt:'2026-09-19T12:00:00.000Z'},'POST',400)
  await api(schedulePath,{...scheduleBody,submitAt:'2026-09-09T12:00:00.000Z'},'POST',400)
  await api(schedulePath,scheduleBody);await api(schedulePath,scheduleBody)
  const sweepOptions={dispatch:dispatchPayrollInstruction,fetcher,loadRunPreview,payrollFingerprint,now:()=>new Date('2026-09-17T12:00:00Z')}
  assert.equal((await runPaymentSubmissionSweep(h.pool,{...sweepOptions,now:()=>new Date('2026-09-16T12:00:00Z')})).attempted,0)
  await api(dispatchPath,sendBody,'POST',409)
  if(variant==='SCHEDULE_CANCEL')await api(`${schedulePath}/cancel`,{confirmed:true,fingerprint:plan.fingerprint})
  if(variant==='SCHEDULE_WITHDRAWN'){
   const latest=(await api('/payment-authorization',undefined,'GET',200,true)).history[0]
   await api('/payment-authorization',{destinationId:destination.revision,expectedRevision:Number(latest.id),decision:'WITHDRAW',confirmed:true},'POST',201,true)
  }
  if(variant==='SCHEDULE_RACE')sweepOptions.dispatch=async(...args)=>{await api(`${schedulePath}/cancel`,{confirmed:true,fingerprint:plan.fingerprint});return dispatchPayrollInstruction(...args)}
  if(variant==='SCHEDULE_EXPIRED')sweepOptions.now=()=>new Date('2026-09-19T12:00:00Z')
  const sweeps=await Promise.all([runPaymentSubmissionSweep(h.pool,sweepOptions),runPaymentSubmissionSweep(h.pool,sweepOptions)])
  assert.equal(posts,variant==='SCHEDULE'?1:0);assert.equal(sweeps.reduce((sum,r)=>sum+r.attempted,0),variant==='SCHEDULE'?1:0)
  assert.equal((await runPaymentSubmissionSweep(h.pool,sweepOptions)).attempted,0)
  if(variant==='SCHEDULE')await api(`${schedulePath}/cancel`,{confirmed:true,fingerprint:plan.fingerprint},'POST',409)
  await assert.rejects(h.pool.query('DELETE FROM payroll_payment_submission_schedule'),/append-only/)
  return
 }
 const options={fetcher,loadRunPreview,payrollFingerprint,actorId:99}
 if(variant==='WITHDRAWN'){
  const latest=(await api('/payment-authorization',undefined,'GET',200,true)).history[0]
  await api('/payment-authorization',{destinationId:destination.revision,expectedRevision:Number(latest.id),decision:'WITHDRAW',confirmed:true},'POST',201,true)
  await assert.rejects(dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,options),/authorization changed/)
  assert.equal(posts,0);assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,0)
  await api(`${path}/cancel`,{batchId:batch.id,reference:'Synthetic cancellation after employee withdrawal',confirmed:true})
  return
 }
 if(['BLOCKED_LOOKUP','BLOCKED_VERIFICATION','OBSERVED_AFTER_BLOCK','UNKNOWN_LOOKUP'].includes(variant)){
  const first=await dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,options)
  assert.equal(posts,0)
  if(variant==='UNKNOWN_LOOKUP'){
   assert.equal(first.result.status,'UNCERTAIN');assert.equal((await api(path)).canCancel,false)
   await api(`${path}/cancel`,{batchId:batch.id,reference:'Synthetic uncertain lookup cancellation',confirmed:true},'POST',409)
   return
  }
  assert.equal(first.result.status,variant==='BLOCKED_LOOKUP'?'BLOCKED_ACCOUNT_LOOKUP':'BLOCKED_ACCOUNT_VERIFICATION')
  assert.equal((await api(path)).canCancel,true)
  const recovery=await dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,options);assert.equal(recovery.result.status,'NOT_FOUND');assert.equal(posts,0);assert.equal((await api(path)).canCancel,true)
  if(variant==='OBSERVED_AFTER_BLOCK'){
   order={id:id(5),external_id:`vortex_payroll_${instructionId}`,type:'ach',subtype:'PPD',amount:Number(instructions[0].amount_cents),direction:'credit',currency:'USD',originating_account_id:id(2),receiving_account_id:id(3),effective_date:plan.paymentDate,live_mode:true,status:'processing',reconciliation_status:'unreconciled',transaction_ids:[]}
   let releaseLookup,enteredLookup
   const gate=new Promise(resolve=>{releaseLookup=resolve}),entered=new Promise(resolve=>{enteredLookup=resolve})
   const recovering=dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,{...options,fetcher:async(url,request)=>{if(url.includes('/payment_orders/')){enteredLookup();await gate}return fetcher(url,request)}})
   await entered
   const cancellingClient=await h.pool.connect()
   try{
    const pid=(await cancellingClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const cancelling=cancellingClient.query("INSERT INTO payroll_payment_batch_cancellation(batch_id,reference,created_by) VALUES($1,'Synthetic cancellation waiting for recovery',99)",[batch.id]).then(()=>null,error=>error)
    let waiting=false
    for(let i=0;i<100;i++){const activity=(await h.pool.query('SELECT wait_event FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];if(activity?.wait_event==='advisory'){waiting=true;break}await new Promise(resolve=>setTimeout(resolve,10))}
    assert.equal(waiting,true)
    releaseLookup()
    assert.equal((await recovering).result.status,'PROCESSING')
    assert.match((await cancelling)?.message||'',/submitted payment requires provider reconciliation/)
   }finally{releaseLookup();await recovering.catch(()=>{});cancellingClient.release()}
   assert.equal((await api(path)).canCancel,false)
   order=null
   assert.equal((await dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,options)).result.status,'NOT_FOUND')
   assert.equal((await api(path)).canCancel,false)
   await api(`${path}/cancel`,{batchId:batch.id,reference:'Synthetic observed payment cancellation',confirmed:true},'POST',409)
   await assert.rejects(h.pool.query("INSERT INTO payroll_payment_batch_cancellation(batch_id,reference,created_by) VALUES($1,'Synthetic observed payment cancellation',99)",[batch.id]),/submitted payment requires provider reconciliation/)
   return
  }
  await api(`${path}/cancel`,{batchId:batch.id,reference:'Synthetic cancellation after definite preflight failure',confirmed:true})
  await assert.rejects(dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,options),/Cancelled payment authorization/)
  assert.equal(posts,0);assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,1)
  await api(`/runs/${run.id}/status`,{status:'VOID'},'PATCH')
  return
 }
 const dispatchPool=variant==='WRITE_INTERRUPTED'?{connect:async()=>{const client=await h.pool.connect();return {query:async(sql,params)=>{if(sql.startsWith('INSERT INTO payroll_payment_observation')&&!interrupted){interrupted=true;throw new Error('Synthetic observation write interrupted')}return client.query(sql,params)},release:destroy=>client.release(destroy)}}}:h.pool
 const outcomes=await Promise.allSettled(variant==='ADMIN_ROUTE'?[api(dispatchPath,sendBody),api(dispatchPath,sendBody)]:[dispatchPayrollInstruction(dispatchPool,1,batch.id,instructionId,options),dispatchPayrollInstruction(dispatchPool,1,batch.id,instructionId,options)])
 assert.equal(posts,1);assert.equal(outcomes.filter(r=>r.status==='rejected').length,variant==='WRITE_INTERRUPTED'?1:0)
 assert.ok(outcomes.some(r=>r.status==='fulfilled'&&r.value.recovery&&r.value.result.status==='PROCESSING'))
 const observations=(await h.pool.query('SELECT * FROM payroll_payment_observation ORDER BY id')).rows
 assert.equal(observations.length,variant==='WRITE_INTERRUPTED'?1:2)
 if(variant==='LOST_RESPONSE')assert.equal(observations[0].result.status,'UNCERTAIN')
 assert.equal(observations.at(-1).source,'RECOVERY');assert.equal(observations.at(-1).result.status,'PROCESSING')
 await assert.rejects(h.pool.query('DELETE FROM payroll_payment_observation'),/append-only/)
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,1)
 if(['REPEAT_REPLACEMENT','SETTLEMENT_POSTING','BANK_SETTLEMENT','CLOSEOUT','MIXED','AUTOMATIC','AUTO_CANCEL','AUTO_RACE'].includes(variant)){
  const closeBody={batchId:batch.id,fingerprint:plan.fingerprint,paymentDate:plan.paymentDate,reference:'Synthetic verified payment closeout',checkPayments:mixed?[{employeeId:mixed.checkEmployee.id,amountCents:plan.totals.checkCents,paymentDate:plan.paymentDate,reference:'Synthetic check 2001 delivered'}]:[],confirmed:true}
  if(['REPEAT_REPLACEMENT','SETTLEMENT_POSTING','CLOSEOUT','MIXED'].includes(variant))await api(`/runs/${run.id}/payment-closeout`,closeBody,'POST',409)
  if(['AUTOMATIC','AUTO_CANCEL','AUTO_RACE'].includes(variant)){
   await api(`/runs/${run.id}/payment-closeout/automatic`,closeBody)
   assert.equal((await api(path)).automatic_closeout.status,'SCHEDULED')
   assert.equal((await runPaymentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2051-01-01T12:00:00Z')})).closeout.finalized,0)
   if(variant==='AUTO_CANCEL')await api(`/runs/${run.id}/payment-closeout/automatic/cancel`,closeBody)
  }
  order.status='completed';order.reconciliation_status='reconciled';order.transaction_ids=[id(6)]
  const settled=await api(dispatchPath,{action:'RECOVER'});assert.equal(settled.result.settlementStatus,'BANK_POSTED');assert.equal(posts,1)
  assert.equal((await api(path)).instructions[0].settlementStatus,'BANK_POSTED')
  assert.equal((await h.pool.query('SELECT result FROM payroll_payment_observation ORDER BY id DESC LIMIT 1')).rows[0].result.settlementEvidence[0].amountCents,plan.totals.directDepositCents)
  if(['AUTOMATIC','AUTO_CANCEL','AUTO_RACE'].includes(variant)){
   if(variant==='AUTO_RACE'){
    const raced=await runAutomaticCloseouts(h.pool,{now:()=>new Date('2051-01-01T12:00:00Z'),finalize:async(...args)=>{await api(`/runs/${run.id}/payment-closeout/automatic/cancel`,closeBody);return finalizePayrollRun(...args)}})
    assert.equal(raced.finalized,0);assert.equal(raced.failed,0)
   }
   const results=await Promise.all([runPaymentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2051-01-01T12:00:00Z')}),runPaymentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2051-01-01T12:00:00Z')})])
   assert.equal(results.reduce((sum,r)=>sum+(r.closeout?.finalized||0),0),variant==='AUTOMATIC'?1:0);assert.equal(posts,1)
   assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,variant==='AUTOMATIC'?'FINALIZED':'APPROVED')
   if(variant==='AUTOMATIC')assert.equal((await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows.filter(r=>r.statement_snapshot.employeeName).length,3)
   if(variant==='AUTO_CANCEL')await api(`/runs/${run.id}/payment-closeout/automatic`,closeBody,'POST',409)
   await assert.rejects(h.pool.query('DELETE FROM payroll_automatic_closeout'),/append-only/)
   return
  }
  if(['REPEAT_REPLACEMENT','SETTLEMENT_POSTING','CLOSEOUT','MIXED'].includes(variant)){
   await h.pool.query("INSERT INTO payroll_payment_observation(attempt_id,source,result,created_at) SELECT attempt_id,source,result,clock_timestamp()-interval '16 minutes' FROM payroll_payment_observation ORDER BY id DESC LIMIT 1")
   await api(`/runs/${run.id}/payment-closeout`,closeBody,'POST',409)
   await api(dispatchPath,{action:'RECOVER'})
   await api(`/runs/${run.id}/payment-closeout`,{...closeBody,confirmed:false},'POST',400)
   const outcomes=await Promise.all([api(`/runs/${run.id}/payment-closeout`,closeBody),api(`/runs/${run.id}/payment-closeout`,closeBody)])
   if(mixed){
    assert.deepEqual(plan.payments.map(p=>p.method).sort(),['CHECK','DIRECT_DEPOSIT','ZERO_NET']);assert.equal(plan.totals.zeroNetEmployees,1)
    const rows=(await h.pool.query('SELECT employee_id,net_pay_cents,statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows
    assert.equal(rows.length,3);assert.ok(rows.every(r=>r.statement_snapshot.employeeName));assert.equal(Number(rows.find(r=>Number(r.employee_id)===mixed.zeroEmployee.id).net_pay_cents),0)
   }
   assert.ok(outcomes.every(r=>r.status==='FINALIZED'));assert.equal(outcomes.filter(r=>r.reused).length,1)
   assert.equal((await h.pool.query('SELECT * FROM payroll_payment_closeout')).rowCount,1);assert.equal((await h.pool.query('SELECT bank_observations FROM payroll_payment_closeout')).rows[0].bank_observations.length,1)
   assert.ok((await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].statement_snapshot.employeeName)
   await assert.rejects(h.pool.query('DELETE FROM payroll_payment_closeout'),/append-only/)
   if(['SETTLEMENT_POSTING','REPEAT_REPLACEMENT'].includes(variant)){
    const qbo=await configureSettlementFixture(h,api,run.id,connection.revision,value=>{quickbooksFetcher=value}),posting=`/runs/${run.id}/payment-accounting/posting`
    const before=(await h.pool.query('SELECT gross_pay_cents,employee_tax_cents,net_pay_cents FROM payroll_run WHERE id=$1',[run.id])).rows[0]
    let prepared=await api(posting);assert.deepEqual(prepared.issues,[]);assert.equal(prepared.items[0].canPost,true)
    const body={action:'SUBMIT',eventKey:prepared.items[0].key,fingerprint:prepared.fingerprint,reference:'Synthetic reviewed bank settlement journal',confirmed:true,noOtherPostingConfirmed:true}
    await api(posting,{...body,noOtherPostingConfirmed:false},'POST',400);assert.equal(qbo.posts,0)
    qbo.badGross=true;await api(posting,body,'POST',409);assert.equal(qbo.posts,0);assert.equal((await h.pool.query('SELECT * FROM payroll_settlement_journal')).rowCount,0);qbo.badGross=false
    const first=await api(posting,body);assert.equal(first.result.status,'UNCERTAIN');assert.equal(qbo.posts,1);assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`settlement-journal-${first.jobId}`])).rows[0].status,'OPEN')
    const returned={...settled.result,status:'RETURNED',settlementStatus:'EXCEPTION',settlementEvidence:[],returnEvidenceStatus:'BANK_CREDIT_POSTED',returnEvidence:{returnId:id(12),transactionId:id(13),lineItemId:id(14),postedDate:'2026-09-20',amountCents:plan.totals.directDepositCents}}
    await h.pool.query("INSERT INTO payroll_payment_observation(attempt_id,source,result) SELECT id,'RECOVERY',$2 FROM payroll_payment_dispatch_attempt WHERE instruction_id=$1",[instructionId,returned])
    const replacementPath=`/runs/${run.id}/payment-replacements`
    let replacement=(await api(replacementPath)).items[0];assert.equal(replacement.canReview,true);assert.equal(replacement.executionAvailable,false)
    const annualMissing=(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===replacement.employeeId);assert.ok(annualMissing.issues.some(i=>i.includes('requires an unpaid-wage')))
    const replacementBody={instructionId:replacement.instructionId,fingerprint:replacement.fingerprint,expectedRevision:0,replacementDate:'2026-09-21',taxTreatment:'ORIGINAL_PAYROLL_RETAINED',reference:'Synthetic employee unpaid balance review',taxReference:'Synthetic original wage reporting date review',confirmed:true,noOtherPaymentConfirmed:true}
    await api(replacementPath,{...replacementBody,noOtherPaymentConfirmed:false},'POST',400)
    await api(replacementPath,{...replacementBody,replacementDate:'2026-09-19'},'POST',400)
    await api(replacementPath,{...replacementBody,fingerprint:'stale'},'POST',409)
    const replacementResponses=await Promise.all([1,2].map(()=>fetch(`${h.url}/api/admin/payroll${replacementPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(replacementBody)})))
    assert.deepEqual(replacementResponses.map(r=>r.status).sort(),[200,409])
    replacement=(await api(replacementPath)).items[0];assert.equal(replacement.reviewStatus,'REVIEW_RETAINED');assert.equal(replacement.history.length,1)
    const annualBefore=(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===replacement.employeeId);assert.ok(!annualBefore.issues.some(i=>i.includes('Returned-payment replacement')));assert.deepEqual(annualBefore.replacementTaxReviews[0].issues,[])
    await api(replacementPath,{...replacementBody,expectedRevision:replacement.revision,taxTreatment:'CORRECTION_REQUIRED'})
    replacement=(await api(replacementPath)).items[0];assert.equal(replacement.reviewStatus,'TAX_CORRECTION_REQUIRED');assert.equal(replacement.history.length,2)
    const annualAfter=(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===replacement.employeeId);assert.ok(annualAfter.issues.some(i=>i.includes('Returned-payment replacement')));assert.notEqual(annualAfter.sourceFingerprint,annualBefore.sourceFingerprint)
    const authorizePath=`${replacementPath}/authorize`,authorizationBody={instructionId:replacement.instructionId,reviewId:replacement.revision,fingerprint:replacement.fingerprint,reference:'Synthetic exact replacement authorization',returnResolutionReference:'Synthetic recipient and return-cause resolution evidence',confirmed:true}
    await api(authorizePath,authorizationBody,'POST',409)
    await h.pool.query("INSERT INTO payroll_payment_observation(attempt_id,source,result) SELECT id,'RECOVERY',$2 FROM payroll_payment_dispatch_attempt WHERE instruction_id=$1",[instructionId,{status:'UNCERTAIN'}])
    const stale=(await api(replacementPath)).items[0];assert.equal(stale.reviewStatus,'REVIEW_CHANGED');assert.equal(stale.canReview,false)
    const annualUncertain=(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===replacement.employeeId);assert.ok(annualUncertain.issues.some(i=>i.includes('current bank reconciliation')));assert.notEqual(annualUncertain.sourceFingerprint,annualAfter.sourceFingerprint)
    await api(replacementPath,{...replacementBody,expectedRevision:replacement.revision},'POST',409)
    await h.pool.query("INSERT INTO payroll_payment_observation(attempt_id,source,result) SELECT id,'RECOVERY',$2 FROM payroll_payment_dispatch_attempt WHERE instruction_id=$1",[instructionId,returned])
    const annualRechecked=(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===replacement.employeeId);assert.equal(annualRechecked.sourceFingerprint,annualAfter.sourceFingerprint)
    replacement=(await api(replacementPath)).items[0]
    await api(replacementPath,{...replacementBody,fingerprint:replacement.fingerprint,expectedRevision:replacement.revision})
    replacement=(await api(replacementPath)).items[0]
    let authorizedBody={...authorizationBody,reviewId:replacement.revision,fingerprint:replacement.fingerprint}
    await api(authorizePath,{...authorizedBody,confirmed:false},'POST',400)
    await assert.rejects(authorizeReplacementPayment(h.pool,1,Number(run.id),authorizedBody,99,{now:()=>new Date('2026-09-22T12:00:00Z')}),/date has passed/)
    const authorizations=await Promise.all([api(authorizePath,authorizedBody),api(authorizePath,authorizedBody)])
    assert.equal(authorizations.filter(a=>a.reused).length,1);assert.equal(authorizations[0].id,authorizations[1].id)
    const authorization=authorizations[0],savedAuthorization=(await h.pool.query('SELECT * FROM payroll_payment_replacement_authorization WHERE id=$1',[authorization.id])).rows[0]
    assert.notEqual(savedAuthorization.id,instructionId);assert.equal(savedAuthorization.intent.receivingAccountId,id(3));assert.equal(savedAuthorization.intent.amountCents,plan.totals.directDepositCents)
    const historyPath=`${replacementPath}/${instructionId}/authorization`
    assert.equal((await api(historyPath))[0].status,'AUTHORIZED');assert.equal((await api(historyPath))[0].account.accountLast4,'1234')
    await api(authorizePath,{...authorizedBody,reference:'Synthetic conflicting authorization'},'POST',409)
    const cancellation={reference:'Synthetic replacement plan cancellation review',confirmed:true}
    await api(`${replacementPath}/${authorization.id}/cancel`,cancellation)
    assert.equal((await api(`${replacementPath}/${authorization.id}/cancel`,cancellation)).reused,true)
    await assert.rejects(h.pool.query('INSERT INTO payroll_payment_replacement_attempt(authorization_id,created_by) VALUES($1,99)',[authorization.id]),/cancelled/)
    const refreshReplacementReview=async()=>{replacement=(await api(replacementPath)).items[0];await api(replacementPath,{...replacementBody,fingerprint:replacement.fingerprint,expectedRevision:replacement.revision});replacement=(await api(replacementPath)).items[0];authorizedBody={...authorizationBody,reviewId:replacement.revision,fingerprint:replacement.fingerprint}}
    let wage=await api('/payment-authorization',undefined,'GET',200,true)
    await api('/payment-authorization',{destinationId:wage.destinationId,expectedRevision:Number(wage.history[0].id),decision:'WITHDRAW',signature:'Monthly Benefits',confirmed:true,fingerprint:wage.fingerprint},'POST',201,true)
    await refreshReplacementReview();await api(authorizePath,authorizedBody,'POST',409)
    await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
    await refreshReplacementReview();const checkAuthorization=await api(authorizePath,authorizedBody)
    const checkIntent=(await h.pool.query('SELECT intent FROM payroll_payment_replacement_authorization WHERE id=$1',[checkAuthorization.id])).rows[0].intent
    assert.equal(checkIntent.method,'CHECK');assert.equal(checkIntent.receivingAccountId,undefined)
    await api(`${replacementPath}/${checkAuthorization.id}/cancel`,cancellation)
    await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
    wage=await api('/payment-authorization',undefined,'GET',200,true)
    await api('/payment-authorization',{destinationId:wage.destinationId,expectedRevision:Number(wage.history[0].id),decision:'AUTHORIZE',signature:'Monthly Benefits',confirmed:true,fingerprint:wage.fingerprint},'POST',201,true)
    await refreshReplacementReview()
    const secondAuthorization=await api(authorizePath,authorizedBody)
    assert.notEqual(secondAuthorization.id,authorization.id)
    let replacementPosts=0,replacementOrder=null
    const replacementFetcher=async(url,request={})=>{
     if(url.includes('/transactions/'))return Response.json({id:id(92),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-21',amount:replacementOrder.amount})
     if(url.includes('/transaction_line_items?'))return Response.json([{id:id(93),transaction_id:id(92),transactable_type:'payment_order',transactable_id:id(91),live_mode:true,type:'originating',amount:replacementOrder.amount}])

     if(url.includes('/payment_orders/'))return Response.json(replacementOrder||{},{status:replacementOrder?200:404})
     if(url.includes('/internal_accounts/'))return Response.json({id:id(2),currency:'USD',live_mode:true})
     if(url.includes('/external_accounts/'))return Response.json({id:id(3),live_mode:true,verification_status:'verified'})
     if(url.endsWith('/payment_orders')&&request.method==='POST'){
      assert.equal((await h.pool.query('SELECT 1 FROM payroll_payment_replacement_attempt WHERE authorization_id=$1',[secondAuthorization.id])).rowCount,1)
      replacementPosts++;replacementOrder={...JSON.parse(request.body),id:id(91),live_mode:true,status:'processing',reconciliation_status:'unreconciled',transaction_ids:[]};throw new Error('Synthetic lost replacement response')
     }
     throw new Error('Unexpected synthetic replacement request')
    }
    const replacementOptions={fetcher:replacementFetcher,actorId:99,now:()=>new Date('2026-09-20T12:00:00Z')}
    await assert.rejects(dispatchReplacementPayment(h.pool,1,Number(run.id),secondAuthorization.id,{...replacementOptions,recoveryOnly:true}),/No replacement dispatch/)
    await assert.rejects(dispatchReplacementPayment(h.pool,1,Number(run.id),secondAuthorization.id,{...replacementOptions,now:()=>new Date('2026-09-22T12:00:00Z')}),/date has passed/)
    await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
    await assert.rejects(dispatchReplacementPayment(h.pool,1,Number(run.id),secondAuthorization.id,replacementOptions),/review or employee consent changed/)
    assert.equal(replacementPosts,0)
    await h.pool.query("UPDATE payroll_onboarding_task SET response='{\"method\":\"DIRECT_DEPOSIT\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
    await assert.rejects(dispatchReplacementPayment(h.pool,2,Number(run.id),secondAuthorization.id,replacementOptions),/not found/)
    const replacementDispatches=await Promise.all([dispatchReplacementPayment(h.pool,1,Number(run.id),secondAuthorization.id,replacementOptions),dispatchReplacementPayment(h.pool,1,Number(run.id),secondAuthorization.id,replacementOptions)])
    assert.equal(replacementPosts,1);assert.deepEqual(replacementDispatches.map(r=>r.result.status).sort(),['PROCESSING','UNCERTAIN']);assert.equal(replacementDispatches.filter(r=>r.recovery).length,1)
    assert.equal(replacementOrder.external_id,`vortex_payroll_${secondAuthorization.id}`)
    assert.equal((await api(historyPath))[0].provider.status,'PROCESSING')
    const sweepOptions={fetcher:replacementFetcher,now:()=>new Date('2052-01-01T12:00:00Z')}
    const replacementSweeps=await Promise.all([runReplacementRecoverySweep(h.pool,sweepOptions),runReplacementRecoverySweep(h.pool,sweepOptions)])
    assert.equal(replacementSweeps.reduce((n,r)=>n+r.checked,0),1);assert.equal(replacementPosts,1)
    assert.equal((await runReplacementRecoverySweep(h.pool,sweepOptions)).checked,0)
    const unavailable=await runReplacementRecoverySweep(h.pool,{...sweepOptions,now:()=>new Date('2052-01-01T12:11:00Z'),fetcher:async()=>{throw new Error('Synthetic unavailable')}})
    assert.equal(unavailable.checked,1);assert.equal((await api(historyPath))[0].provider.status,'UNCERTAIN')
    assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`replacement-payment-${secondAuthorization.id}`])).rows[0].status,'OPEN')
    assert.equal((await runReplacementRecoverySweep(h.pool,{...sweepOptions,now:()=>new Date('2052-01-01T12:11:00Z')})).checked,0)
    assert.equal((await runReplacementRecoverySweep(h.pool,{...sweepOptions,now:()=>new Date('2052-01-01T12:22:00Z')})).checked,1)
    assert.equal((await api(historyPath))[0].provider.status,'PROCESSING');assert.equal(replacementPosts,1)
    replacementOrder.status='completed';replacementOrder.reconciliation_status='reconciled';replacementOrder.transaction_ids=[id(92)]
    assert.equal((await runReplacementRecoverySweep(h.pool,{...sweepOptions,now:()=>new Date('2052-01-01T12:33:00Z')})).checked,1)
    assert.equal((await api(historyPath))[0].provider.settlementStatus,'BANK_POSTED')
    const receiptPath=`/runs/${run.id}/payment-replacement-receipts`
    const receipts=await api(receiptPath);assert.equal(receipts.length,1);assert.equal(receipts[0].status,'BANK_CONFIRMED');assert.equal(receipts[0].amountCents,plan.totals.directDepositCents);assert.equal(receipts[0].account.accountLast4,'1234')
    const employeeReceipts=await api('/payment-replacement-receipts',undefined,'GET',200,true);assert.deepEqual(employeeReceipts,receipts)
    assert.ok(!JSON.stringify(receipts).includes('Synthetic recipient'));assert.ok(!JSON.stringify(receipts).includes('receivingAccountId'))
    assert.deepEqual(await replacementReceipts(h.pool,2,{runId:Number(run.id)}),[])
    assert.deepEqual(await replacementReceipts(h.pool,1,{employeeId:999999}),[])
    await assert.rejects(h.pool.query("INSERT INTO payroll_payment_replacement_receipt(authorization_id,observation_id,snapshot) SELECT authorization_id,observation_id,'{}' FROM payroll_payment_replacement_receipt"),/matching bank recovery evidence/)
    await assert.rejects(h.pool.query('DELETE FROM payroll_payment_replacement_receipt'),/append-only/)

    assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`replacement-payment-${secondAuthorization.id}`])).rows[0].status,'DISMISSED')
    assert.equal((await runReplacementRecoverySweep(h.pool,{...sweepOptions,now:()=>new Date('2052-01-01T14:00:00Z')})).checked,0)
    replacementOrder.effective_date='2026-09-22'
    assert.equal((await runReplacementRecoverySweep(h.pool,{...sweepOptions,now:()=>new Date('2052-01-02T12:34:00Z')})).checked,1)
    assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`replacement-payment-${secondAuthorization.id}`])).rows[0].status,'OPEN');assert.equal(replacementPosts,1)
    assert.equal((await api(receiptPath))[0].status,'NEEDS_REVIEW');assert.equal((await h.pool.query('SELECT * FROM payroll_payment_replacement_receipt')).rowCount,1)
    await assert.rejects(h.pool.query('DELETE FROM payroll_payment_replacement_recovery_check'),/append-only/)
    assert.equal((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='PAYMENT_REPLACEMENT_OBSERVED' ORDER BY id DESC LIMIT 1")).rows[0].after_data.automatic,true)

    await assert.rejects(h.pool.query('DELETE FROM payroll_payment_replacement_observation'),/append-only/)

    await api(`${replacementPath}/${secondAuthorization.id}/cancel`,cancellation,'POST',409)
    await assert.rejects(h.pool.query('INSERT INTO payroll_payment_replacement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,99)',[secondAuthorization.id,cancellation.reference]),/dispatch has already started/)
    assert.equal((await api(historyPath))[0].canCancel,false)
    await assert.rejects(h.pool.query('DELETE FROM payroll_payment_replacement_authorization'),/append-only/)
    const cross=await fetch(`${h.url}/api/admin/payroll${replacementPath}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(cross.status,404)
    await assert.rejects(h.pool.query('DELETE FROM payroll_payment_replacement_review'),/append-only/)
    assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,1);assert.equal(qbo.posts,1)
    prepared=await api(posting);assert.equal(prepared.items.find(i=>i.kind==='RETURN').canPost,false)
    assert.equal((await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher})).checked,0)
    const sweepTime=()=>new Date('2052-01-01T12:00:00Z')
    const sweeps=await Promise.all([runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:sweepTime}),runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:sweepTime})])
    assert.equal(sweeps.reduce((sum,r)=>sum+r.checked,0),1);assert.equal(sweeps.reduce((sum,r)=>sum+r.failed,0),0)
    assert.equal((await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:sweepTime})).checked,0)
    assert.equal((await api(posting)).jobs[0].status,'SYNCED');assert.equal(qbo.posts,1);assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`settlement-journal-${first.jobId}`])).rows[0].status,'DISMISSED')
    prepared=await api(posting);const credit=prepared.items.find(i=>i.kind==='RETURN');assert.equal(credit.canPost,true)
    const creditBody={...body,eventKey:credit.key,fingerprint:prepared.fingerprint}
    qbo.badWithdrawal=true;await api(posting,creditBody,'POST',409);assert.equal(qbo.posts,1);qbo.badWithdrawal=false
    const outcomes=await Promise.all([api(posting,creditBody),api(posting,creditBody)]);assert.ok(outcomes.every(o=>o.result.status==='SYNCED'));assert.equal(qbo.posts,2)
    assert.equal((await h.pool.query('SELECT * FROM payroll_settlement_journal')).rowCount,2);assert.equal((await h.pool.query('SELECT * FROM payroll_settlement_journal_claim')).rowCount,2)
    assert.deepEqual((await h.pool.query('SELECT gross_pay_cents,employee_tax_cents,net_pay_cents FROM payroll_run WHERE id=$1',[run.id])).rows[0],before)
    await assert.rejects(h.pool.query('DELETE FROM payroll_settlement_journal'),/append-only/)
    const originalWithdrawal=structuredClone(qbo.journals.get('101'))
    qbo.journals.get('101').TxnDate='2026-09-22'
    const daily=await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:()=>new Date('2052-01-02T12:01:00Z')})
    assert.equal(daily.checked,2);assert.equal(daily.failed,0);assert.equal(qbo.posts,2)
    assert.equal((await api(posting)).jobs.find(j=>j.id===first.jobId).status,'NEEDS_REVIEW')
    assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`settlement-journal-${first.jobId}`])).rows[0].status,'OPEN')
    qbo.journals.set('101',originalWithdrawal)
    assert.equal((await api(posting,{action:'RECOVER',jobId:first.jobId})).result.status,'SYNCED')
    replacementOrder.effective_date='2026-09-21'
    await dispatchReplacementPayment(h.pool,1,Number(run.id),secondAuthorization.id,{...replacementOptions,recoveryOnly:true})
    prepared=await api(posting);const replacementMovement=prepared.items.find(i=>i.sourceKind==='REPLACEMENT');assert.equal(replacementMovement.canPost,true)
    const replacementPostingBody={...body,eventKey:replacementMovement.key,fingerprint:prepared.fingerprint}
    const originalCredit=structuredClone(qbo.journals.get('102'));qbo.journals.get('102').TxnDate='2026-09-22'
    await api(posting,replacementPostingBody,'POST',409);assert.equal(qbo.posts,2);qbo.journals.set('102',originalCredit)
    qbo.loseNextSettlement=true
    const replacementJournal=await api(posting,replacementPostingBody);assert.equal(replacementJournal.result.status,'UNCERTAIN');assert.equal(qbo.posts,3)
    assert.equal((await api(posting,{action:'RECOVER',jobId:replacementJournal.jobId})).result.status,'SYNCED');assert.equal(qbo.posts,3)
    const casePath=`/runs/${run.id}/payment-return-cases`
    assert.equal((await api(casePath))[0].status,'CLOSED');assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`payment-exception-${instructionId}`])).rows[0].status,'DISMISSED')
    const caseCount=(await h.pool.query('SELECT * FROM payroll_payment_return_case')).rowCount
    order.status='returned';order.current_return={id:id(12)}
    routeFetcher=async(url,request)=>{
     if(url.includes('/returns/'))return Response.json({id:id(12),returnable_type:'payment_order',returnable_id:id(5),type:'ach',live_mode:true,currency:'USD',amount:plan.totals.directDepositCents,internal_account_id:id(2),status:'completed',reconciliation_status:'reconciled',transaction_id:id(13),transaction_line_item_id:id(14)})
     if(url.includes('/transactions/')&&url.endsWith(id(13)))return Response.json({id:id(13),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'credit',posted:true,as_of_date:'2026-09-20',amount:plan.totals.directDepositCents})
     if(url.includes('/transaction_line_items?')&&url.includes('id%5B%5D'))return Response.json([{id:id(14),transaction_id:id(13),transactable_type:'return',transactable_id:id(12),amount:plan.totals.directDepositCents,live_mode:true}])
     return fetcher(url,request)
    }

    await api(dispatchPath,{action:'RECOVER'})
    assert.equal((await api(casePath))[0].status,'CLOSED');assert.equal((await h.pool.query('SELECT * FROM payroll_payment_return_case')).rowCount,caseCount)
    qbo.journals.get('103').TxnDate='2026-09-22'
    await api(posting,{action:'RECOVER',jobId:replacementJournal.jobId});assert.equal((await api(casePath))[0].status,'OPEN')
    qbo.journals.get('103').TxnDate='2026-09-21'
    await api(posting,{action:'RECOVER',jobId:replacementJournal.jobId});assert.equal((await api(casePath))[0].status,'CLOSED')
    await assert.rejects(h.pool.query('DELETE FROM payroll_payment_return_case'),/append-only/)
    const replacementPayload=qbo.journals.get('103');assert.equal(replacementPayload.TxnDate,'2026-09-21');assert.equal(replacementPayload.Line[0].Amount,plan.totals.directDepositCents/100)
    assert.equal((await api(`/runs/${run.id}/payment-accounting`)).totals.netOutflowCents,plan.totals.directDepositCents)
    assert.deepEqual((await h.pool.query('SELECT gross_pay_cents,employee_tax_cents,net_pay_cents FROM payroll_run WHERE id=$1',[run.id])).rows[0],before)
    if(variant==='REPEAT_REPLACEMENT'){
     const completedReplacement=(await h.pool.query('SELECT result FROM payroll_payment_replacement_observation WHERE authorization_id=$1 ORDER BY id DESC LIMIT 1',[secondAuthorization.id])).rows[0].result
     const repeatedReturn={...completedReplacement,status:'RETURNED',settlementStatus:'EXCEPTION',settlementEvidence:[],returnEvidenceStatus:'BANK_CREDIT_POSTED',returnEvidence:{returnId:id(95),transactionId:id(96),lineItemId:id(97),postedDate:'2026-09-22',amountCents:plan.totals.directDepositCents,code:'R03'}}
     await h.pool.query("INSERT INTO payroll_payment_replacement_observation(authorization_id,source,result) VALUES($1,'RECOVERY',$2)",[secondAuthorization.id,repeatedReturn])
     assert.ok((await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===Number(employee.id)).issues.some(i=>i.includes('Returned replacement requires')))
     let nextReview=(await api(replacementPath)).items[0];assert.equal(nextReview.predecessor.id,secondAuthorization.id);assert.equal(nextReview.canReview,true)
     await api(authorizePath,{...authorizedBody,reference:'Synthetic stale repeat payment request'},'POST',409)
     await api(replacementPath,{...replacementBody,replacementDate:'2026-09-21',expectedRevision:nextReview.revision,fingerprint:nextReview.fingerprint},'POST',400)
     await api(replacementPath,{...replacementBody,replacementDate:'2026-09-23',expectedRevision:nextReview.revision,fingerprint:nextReview.fingerprint})
     nextReview=(await api(replacementPath)).items[0]
     assert.ok(!(await api('/reports/year-end-preparation?year=2026')).employees.find(e=>e.employeeId===Number(employee.id)).issues.some(i=>i.includes('Returned replacement requires')))
     const nextBody={...authorizationBody,reviewId:nextReview.revision,fingerprint:nextReview.fingerprint,reference:'Synthetic second replacement authorization'}
     const nextAuthorizations=await Promise.all([api(authorizePath,nextBody),api(authorizePath,nextBody)]);assert.equal(nextAuthorizations[0].id,nextAuthorizations[1].id);assert.equal(nextAuthorizations.filter(a=>a.reused).length,1)
     await api(`${replacementPath}/${nextAuthorizations[0].id}/cancel`,cancellation)
     const nextAuthorization=await api(authorizePath,nextBody);assert.notEqual(nextAuthorization.id,nextAuthorizations[0].id)
     assert.equal((await h.pool.query('SELECT predecessor_id FROM payroll_payment_replacement_authorization WHERE id=$1',[nextAuthorization.id])).rows[0].predecessor_id,secondAuthorization.id)
     assert.equal((await api(historyPath)).find(a=>a.id===secondAuthorization.id).status,'SUPERSEDED')
     let nextOrder=null,nextPosts=0
     const nextFetcher=async(url,request={})=>{
      if(url.includes('/transactions/'))return Response.json({id:id(102),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-23',amount:plan.totals.directDepositCents})
      if(url.includes('/transaction_line_items?'))return Response.json([{id:id(103),transaction_id:id(102),transactable_type:'payment_order',transactable_id:id(101),live_mode:true,type:'originating',amount:plan.totals.directDepositCents}])
      if(url.includes('/payment_orders/'))return Response.json(nextOrder||{},{status:nextOrder?200:404})
      if(url.endsWith('/payment_orders')&&request.method==='POST'){nextPosts++;nextOrder={...JSON.parse(request.body),id:id(101),live_mode:true,status:'completed',reconciliation_status:'reconciled',transaction_ids:[id(102)]};throw new Error('Synthetic repeated-cycle lost response')}
      return replacementFetcher(url,request)
     }
     const nextOptions={fetcher:nextFetcher,actorId:99,now:()=>new Date('2026-09-23T12:00:00Z')}
     await h.pool.query("INSERT INTO payroll_payment_replacement_observation(authorization_id,source,result) VALUES($1,'RECOVERY',$2)",[secondAuthorization.id,{status:'UNCERTAIN'}])
     await assert.rejects(dispatchReplacementPayment(h.pool,1,Number(run.id),nextAuthorization.id,nextOptions),/review or employee consent changed/);assert.equal(nextPosts,0)
     await h.pool.query("INSERT INTO payroll_payment_replacement_observation(authorization_id,source,result) VALUES($1,'RECOVERY',$2)",[secondAuthorization.id,repeatedReturn])

     assert.equal((await dispatchReplacementPayment(h.pool,1,Number(run.id),nextAuthorization.id,nextOptions)).result.status,'UNCERTAIN')
     assert.equal((await dispatchReplacementPayment(h.pool,1,Number(run.id),nextAuthorization.id,{...nextOptions,recoveryOnly:true})).result.settlementStatus,'BANK_POSTED');assert.equal(nextPosts,1)
     prepared=await api(posting);assert.equal(prepared.items.find(i=>i.instructionId===nextAuthorization.id).canPost,false)
     const priorReturn=prepared.items.find(i=>i.instructionId===secondAuthorization.id&&i.kind==='RETURN');assert.equal(priorReturn.canPost,true)
     await api(posting,{...body,eventKey:priorReturn.key,fingerprint:prepared.fingerprint})
     prepared=await api(posting);const nextMovement=prepared.items.find(i=>i.instructionId===nextAuthorization.id);assert.equal(nextMovement.canPost,true)
     await api(posting,{...body,eventKey:nextMovement.key,fingerprint:prepared.fingerprint});assert.equal(qbo.posts,5)
     assert.equal((await api(casePath))[0].status,'CLOSED');assert.equal((await api(receiptPath)).length,2)
     nextReview=(await api(replacementPath)).items[0]
     await api(replacementPath,{...replacementBody,replacementDate:'2026-09-23',expectedRevision:nextReview.revision,fingerprint:nextReview.fingerprint,taxReference:'Synthetic same paid facts reconfirmed after payment'})
     assert.equal((await api(casePath))[0].status,'CLOSED')

     assert.equal((await api(`/runs/${run.id}/payment-accounting`)).totals.netOutflowCents,plan.totals.directDepositCents)
     assert.deepEqual((await h.pool.query('SELECT gross_pay_cents,employee_tax_cents,net_pay_cents FROM payroll_run WHERE id=$1',[run.id])).rows[0],before)
     return
    }
    await api('/quickbooks/disconnect',{})
    await api(posting,{action:'RECOVER',jobId:first.jobId},'POST',409)
    const nextDay=()=>new Date('2052-01-04T12:00:00Z')
    const caseSweeps=await Promise.all([runPaymentReturnCaseSweep(h.pool,{now:nextDay}),runPaymentReturnCaseSweep(h.pool,{now:nextDay})]);assert.equal(caseSweeps.reduce((n,r)=>n+r.checked,0),1)
    assert.equal((await runPaymentReturnCaseSweep(h.pool,{now:nextDay})).checked,0);assert.equal((await api(casePath))[0].status,'OPEN')
    assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`payment-exception-${instructionId}`])).rows[0].status,'OPEN')
    await assert.rejects(h.pool.query('DELETE FROM payroll_payment_return_case_check'),/append-only/)

    assert.equal((await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:nextDay,limit:1})).failed,1)
    assert.equal((await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:nextDay,limit:1})).failed,1)
    assert.equal((await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:nextDay,limit:1})).failed,1)
    assert.equal((await runSettlementRecoverySweep(h.pool,{fetcher:quickbooksFetcher,now:nextDay})).failed,0)
    assert.equal(qbo.posts,3)
    assert.equal((await h.pool.query('SELECT count(DISTINCT journal_id) AS count FROM payroll_settlement_recovery_check')).rows[0].count,'3')
    await assert.rejects(h.pool.query('DELETE FROM payroll_settlement_recovery_check'),/append-only/)

   }
   return
  }
 }
 if(variant==='SWEEP'){
  order.status='returned'
  const sweeps=await Promise.all([runPaymentRecoverySweep(h.pool,{fetcher}),runPaymentRecoverySweep(h.pool,{fetcher})])
  assert.equal(sweeps.reduce((sum,s)=>sum+s.checked,0),1);assert.equal(posts,1)
  assert.equal((await h.pool.query('SELECT * FROM payroll_payment_recovery_check')).rowCount,1)
  assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`payment-exception-${instructionId}`])).rows[0].status,'OPEN')
  assert.equal((await runPaymentRecoverySweep(h.pool,{fetcher})).checked,0)
  await h.pool.query("INSERT INTO payroll_payment_recovery_check(attempt_id,created_at) SELECT id,clock_timestamp()-interval '11 minutes' FROM payroll_payment_dispatch_attempt WHERE instruction_id=$1",[instructionId])
  const savedKey=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
  try{assert.equal((await runPaymentRecoverySweep(h.pool,{fetcher})).failed,1)}finally{process.env.PAYROLL_DOCUMENT_KEY=savedKey}
  assert.equal((await runPaymentRecoverySweep(h.pool,{fetcher})).checked,0);assert.equal(posts,1)
  await assert.rejects(h.pool.query('DELETE FROM payroll_payment_recovery_check'),/append-only/)
 }
 const latestAuthorization=(await api('/payment-authorization',undefined,'GET',200,true)).history[0]
 await api('/payment-authorization',{destinationId:destination.revision,expectedRevision:Number(latestAuthorization.id),decision:'WITHDRAW',confirmed:true},'POST',201,true)
 order.status='returned'
 const returned=variant==='ADMIN_ROUTE'?await api(dispatchPath,{action:'RECOVER'}):await dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,options);assert.equal(returned.recovery,true);assert.equal(returned.result.status,'RETURNED');assert.equal(posts,1);assert.equal((await api(path)).instructions[0].settlementStatus,'EXCEPTION')
 order=null
 const missing=await dispatchPayrollInstruction(h.pool,1,batch.id,instructionId,options);assert.equal(missing.result.status,'NOT_FOUND');assert.equal(posts,1)
 assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'APPROVED')
 await api(`${path}/cancel`,{batchId:batch.id,reference:'Synthetic attempted cancellation after claim',confirmed:true},'POST',409)
 await assert.rejects(h.pool.query("INSERT INTO payroll_payment_batch_cancellation(batch_id,reference,created_by) VALUES($1,'Synthetic direct cancellation attempt',99)",[batch.id]),/submitted payment requires provider reconciliation/)
 assert.equal((await api(path)).status,'AUTHORIZED')
})

test('check closeout requires exact delivery evidence and retains one finalized run',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods,employee}=await monthlyBenefitsFixture(h)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const plan=await api(`/runs/${run.id}/payment-plan`),batch=await api(`/runs/${run.id}/payment-authorization`,{fingerprint:plan.fingerprint,reference:'Synthetic authorized check payroll',confirmed:true},'POST',201)
 const body={batchId:batch.id,fingerprint:plan.fingerprint,paymentDate:plan.paymentDate,reference:'Synthetic delivered check closeout',confirmed:true,checkPayments:[{employeeId:employee.id,amountCents:plan.totals.checkCents,paymentDate:plan.paymentDate,reference:'Check 1001 delivered in person'}]}
 await api(`/runs/${run.id}/payment-closeout`,{...body,checkPayments:[]},'POST',400)
 await api(`/runs/${run.id}/payment-closeout`,{...body,checkPayments:[{...body.checkPayments[0],amountCents:1}]},'POST',400)
 assert.equal((await api(`/runs/${run.id}/payment-closeout`,body)).status,'FINALIZED')
 assert.equal((await api(`/runs/${run.id}/payment-closeout`,body)).reused,true)
 assert.equal((await api(`/runs/${run.id}/payment-authorization`)).status,'CLOSED')
 await api(`/runs/${run.id}/payment-authorization/cancel`,{batchId:batch.id,reference:'Synthetic forbidden closed cancellation',confirmed:true},'POST',409)
 await assert.rejects(h.pool.query("INSERT INTO payroll_payment_batch_cancellation(batch_id,reference,created_by) VALUES($1,'Synthetic forbidden closed cancellation',99)",[batch.id]),/submitted payment requires provider reconciliation/)
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_dispatch_attempt')).rowCount,0)
})
