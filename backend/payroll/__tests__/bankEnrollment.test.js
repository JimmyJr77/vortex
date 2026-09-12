import {runBankEnrollmentRecoverySweep} from '../bankEnrollmentRecoveryScheduler.js'
import {enrollmentCompletionState} from '../bankEnrollmentHistory.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {readBankEnrollment} from '../bankEnrollment.js'
test('employee bank intake retains encrypted consent, scopes ownership, and rejects stale or conflicting requests',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const key=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const h=await createHarness();t.after(async()=>{await h.close();if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key})
 const {api,employee}=await monthlyBenefitsFixture(h),path='/bank-enrollment'
 const empty=await api(path,undefined,'GET',200,true);assert.equal(empty.canEnroll,false)
 const configuration={organizationId:randomUUID(),originatingAccountId:randomUUID(),apiKey:'synthetic-enrollment-key',mode:'TEST',reference:'Synthetic bank enrollment connection',confirmed:true,expectedRevision:0}
 const connection=await api('/payment-connection',configuration,'POST',201)
 const disclosure=await api(path,undefined,'GET',200,true);assert.equal(disclosure.canEnroll,true)
 const body={id:randomUUID(),connectionId:connection.revision,expectedRevision:0,fingerprint:disclosure.fingerprint,holderName:'Monthly Benefits',accountType:'checking',accountNumber:'000123456789',routingNumber:'021000021',verificationConsent:true,signature:'Monthly Benefits'}
 await api(path,{...body,verificationConsent:false},'POST',400,true)
 await api(path,{...body,routingNumber:'123456789'},'POST',400,true)
 await api(path,{...body,fingerprint:'stale'},'POST',409,true)
 const concurrent=await Promise.all([1,2].map(()=>fetch(`${h.url}/api/payroll/employee${path}`,{method:'POST',headers:{Authorization:'Bearer monthly-benefits-session','Content-Type':'application/json'},body:JSON.stringify(body)})));assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,201]);const saved=(await concurrent[0].json()).data;assert.equal(saved.accountLast4,'6789')
 const again=await api(path,body,'POST',200,true);assert.equal(again.reused,true)
 await api(path,{...body,accountNumber:'000987654321'},'POST',409,true)
 await api(path,{...body,id:randomUUID()},'POST',409,true)
 const row=(await h.pool.query('SELECT * FROM payroll_bank_enrollment')).rows[0]
 assert.equal(readBankEnrollment(row).accountNumber,body.accountNumber)
 assert.equal(row.encrypted_request.includes(Buffer.from(body.accountNumber)),false)
 const view=await api(path,undefined,'GET',200,true)
 assert.equal(JSON.stringify(view).includes(body.accountNumber),false);assert.equal(JSON.stringify(view).includes(body.routingNumber),false)
 assert.equal(view.request.consent.signature,body.signature)
 const audit=JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='EMPLOYEE_BANK_ENROLLMENT_SAVED'")).rows)
 assert.equal(audit.includes(body.accountNumber),false);assert.equal(audit.includes(body.routingNumber),false)
 await assert.rejects(h.pool.query('DELETE FROM payroll_bank_enrollment'),/append-only/)
 const other=await api('/employees',{employeeNumber:'OTHER-BANK',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[other.id,hashPayrollToken('other-bank-session')])
 const otherRequest=async(suffix='',payload)=>fetch(`${h.url}/api/payroll/employee${path}${suffix}`,{method:payload?'POST':'GET',headers:{Authorization:'Bearer other-bank-session','Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined})
 assert.equal((await (await otherRequest()).json()).data.request,null)
 assert.equal((await otherRequest('',body)).status,409)
 assert.equal((await otherRequest('/advance',{enrollmentId:body.id,action:'RECOVER'})).status,409)
 assert.equal((await otherRequest('/recover',{enrollmentId:body.id,operationId:randomUUID()})).status,404)
 assert.equal((await otherRequest('/link',{enrollmentId:body.id,expectedDestinationRevision:0,confirmed:true})).status,409)
 const otherSession=(await h.pool.query('SELECT id FROM payroll_employee_session WHERE employee_id=$1',[other.id])).rows[0]
 await assert.rejects(h.pool.query("INSERT INTO payroll_bank_enrollment_operation(id,enrollment_id,stage,attempt,session_id) VALUES($1,$2,'COUNTERPARTY',1,$3)",[randomUUID(),body.id,otherSession.id]),/ownership mismatch/)
 await api('/payment-connection',{...configuration,expectedRevision:connection.revision,apiKey:'changed-synthetic-key'},'POST',201)
 await api(path,body,'POST',409,true)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id])
 assert.equal((await api(path,undefined,'GET',200,true)).canEnroll,false)
 await api(path,body,'POST',403,true)
 assert.equal((await h.pool.query('SELECT * FROM payroll_bank_enrollment')).rowCount,1)
})
for(const variant of ['NORMAL','LOST_CREATION','LOST_VERIFICATION','WRONG_AMOUNTS','VERIFICATION_REGRESSED','HISTORY','EXPIRED','RESTART','RESTART_LOST','SWEEP'])test(`bank verification claims provider operations before transmission and links only verified accounts (${variant})`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const key=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 let counterparty,account,posts=0,h,loseRestart=true
 const fetcher=async(url,options)=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null
  if(options.method==='POST'){
   posts++
   const stage=path.endsWith('complete_verification')?'COMPLETE':path.endsWith('/verify')?'START':path.endsWith('/counterparties')?'COUNTERPARTY':'ACCOUNT'
   assert.equal((await h.pool.query('SELECT * FROM payroll_bank_enrollment_operation WHERE stage=$1',[stage])).rowCount>0,true)
   if(stage==='COUNTERPARTY'){counterparty={...body,id:randomUUID(),live_mode:false};if(variant==='LOST_CREATION')throw new Error('Synthetic lost response');return {ok:true,json:async()=>counterparty}}
   if(stage==='ACCOUNT'){account={...body,id:randomUUID(),live_mode:false,verification_status:'unverified',account_details:[{account_number_safe:'6789'}]};return {ok:true,json:async()=>account}}
   if(stage==='START'){account.verification_status='pending_verification';if(variant==='RESTART_LOST'&&posts===9&&loseRestart){loseRestart=false;throw new Error('Synthetic lost restart response')}if(['LOST_VERIFICATION','SWEEP'].includes(variant))throw new Error('Synthetic lost response');return {ok:true,json:async()=>account}}
   if(body.amounts[0]!==11||body.amounts[1]!==22)return {ok:false,status:422,json:async()=>({})}
   account.verification_status='verified';return {ok:true,json:async()=>account}
  }
  if(path.includes('/internal_accounts/'))return {ok:true,json:async()=>({id:path.split('/').at(-1),currency:'USD',live_mode:false})}
  return {ok:true,json:async()=>path.endsWith('/counterparties')?(counterparty?[counterparty]:[]):path.endsWith('/external_accounts')?(account?[account]:[]):account}
 }
 h=await createHarness({paymentFetcher:fetcher});t.after(async()=>{await h.close();if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key})
 const {api,employee}=await monthlyBenefitsFixture(h),path='/bank-enrollment'
 const connection=await api('/payment-connection',{organizationId:randomUUID(),originatingAccountId:randomUUID(),apiKey:'synthetic-enrollment-key',mode:'TEST',reference:'Synthetic bank enrollment connection',confirmed:true,expectedRevision:0},'POST',201)
 const disclosure=await api(path,undefined,'GET',200,true),id=randomUUID()
 await api(path,{id,connectionId:connection.revision,expectedRevision:0,fingerprint:disclosure.fingerprint,holderName:'Monthly Benefits',accountType:'checking',accountNumber:'000123456789',routingNumber:'021000021',verificationConsent:true,signature:'Monthly Benefits'},'POST',201,true)
 const advance=(action='CONTINUE',extra={},status=200)=>api(`${path}/advance`,{enrollmentId:id,action,...extra},'POST',status,true)
 const link={enrollmentId:id,expectedDestinationRevision:0,confirmed:true}
 await api(`${path}/link`,link,'POST',409,true)
 await advance()
 if(variant==='LOST_CREATION'){assert.equal(posts,1);await advance('RECOVER');assert.equal(posts,1)}
 await advance()
 if(variant==='EXPIRED'){
  account.verification_status='pending_verification'
  await h.pool.query("INSERT INTO payroll_bank_enrollment_operation(id,enrollment_id,stage,attempt,session_id,created_at) SELECT $1,id,'START',1,session_id,clock_timestamp()-interval '57 days' FROM payroll_bank_enrollment WHERE id=$2",[randomUUID(),id])
 }
 await advance()
 if(variant==='LOST_VERIFICATION'){assert.equal(posts,3);await advance('RECOVER');assert.equal(posts,3)}
 if(variant==='SWEEP'){
  const alertKey=`bank-enrollment-${id}`
  const alert=async()=>(await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[alertKey])).rows[0]?.status
  assert.equal((await api(path,undefined,'GET',200,true)).request.status,'UNCERTAIN');assert.equal(await alert(),'OPEN')
  assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher})).checked,0)
  const savedKey=process.env.PAYROLL_DOCUMENT_KEY
  process.env.PAYROLL_DOCUMENT_KEY='invalid'
  try{assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:00:00Z')})).failed,1)}finally{process.env.PAYROLL_DOCUMENT_KEY=savedKey}
  assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:00:00Z')})).checked,0)
  const outcomes=await Promise.all([1,2].map(()=>runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:11:00Z')})))
  assert.equal(outcomes.reduce((n,r)=>n+r.checked,0),1);assert.equal(posts,3);assert.equal(await alert(),'DISMISSED')
  account.verification_status='verified'
  assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:22:00Z')})).checked,1)
  assert.equal((await api(path,undefined,'GET',200,true)).request.status,'VERIFIED');assert.equal(posts,3)
  assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T13:22:00Z')})).checked,0)
  assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher:async()=>{throw new Error('Synthetic outage')},now:()=>new Date('2052-01-03T12:00:00Z')})).checked,1)
  assert.equal(await alert(),'OPEN');assert.equal((await api(path,undefined,'GET',200,true)).request.status,'UNCERTAIN')
  await advance('RECOVER');assert.equal(await alert(),'DISMISSED');assert.equal(posts,3)
  assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='BANK_ENROLLMENT_RECOVERED' AND after_data->>'automatic'='true'")).rowCount,3)
  const state=await api(path,undefined,'GET',200,true)
  await api(path,{id:randomUUID(),connectionId:connection.revision,expectedRevision:state.request.revision,fingerprint:disclosure.fingerprint,holderName:'Monthly Benefits',accountType:'checking',accountNumber:'000987654321',routingNumber:'021000021',verificationConsent:true,signature:'Monthly Benefits'},'POST',201,true)
  assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-05T12:00:00Z')})).checked,0);assert.equal(posts,3)
  await assert.rejects(h.pool.query('DELETE FROM payroll_bank_enrollment_recovery_check'),/append-only/)
  assert.equal((await h.pool.query('SELECT * FROM payroll_payment_destination')).rowCount,0)
  return
 }
 assert.equal((await api(path,undefined,'GET',200,true)).request.status,'AWAITING_AMOUNTS')
 const operationId=randomUUID()
 if(['RESTART','RESTART_LOST','SWEEP'].includes(variant)){
  const body={id:randomUUID(),enrollmentId:id,fingerprint:disclosure.fingerprint,signature:'Monthly Benefits',confirmed:true}
  await api(`${path}/restart`,{...body,confirmed:false},'POST',400,true)
  await api(`${path}/restart`,body,'POST',409,true);assert.equal(posts,3)
  for(let i=0;i<5;i++){await advance('COMPLETE',{operationId:randomUUID(),amounts:[33,44]});await advance('RECOVER')}
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`bank-enrollment-${id}`])).rows[0].status,'OPEN')
  account.verification_status='unverified'
  await api(`${path}/restart`,{...body,fingerprint:'stale'},'POST',409,true)
  const outcomes=await Promise.all([api(`${path}/restart`,body,'POST',200,true),api(`${path}/restart`,body,'POST',200,true)])
  assert.equal(outcomes.filter(r=>r.reused).length,1);assert.equal(posts,8)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`bank-enrollment-${id}`])).rows[0].status,'DISMISSED')
  const child=(await api(path,undefined,'GET',200,true)).request;assert.equal(child.id,body.id);assert.equal(child.attempts,0)
  await api(`${path}/link`,{enrollmentId:child.id,expectedDestinationRevision:0,confirmed:true},'POST',409,true)
  assert.equal((await h.pool.query('SELECT * FROM payroll_bank_enrollment_restart')).rowCount,1)
  assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date('2052-01-01T12:00:00Z')})).checked,0)
  const next=(action='CONTINUE',extra={})=>api(`${path}/advance`,{enrollmentId:child.id,action,...extra},'POST',200,true)
  await next();assert.equal(posts,9)
  await next('RECOVER');assert.equal(posts,9)
  assert.equal((await api(path,undefined,'GET',200,true)).request.status,'AWAITING_AMOUNTS')
  await next('COMPLETE',{operationId:randomUUID(),amounts:[11,22]});assert.equal(posts,10)
  assert.equal((await api(path,undefined,'GET',200,true)).request.status,'VERIFIED')
  await api(`${path}/restart`,{...body,id:randomUUID(),enrollmentId:child.id},'POST',409,true)
  await api(`${path}/link`,{enrollmentId:child.id,expectedDestinationRevision:0,confirmed:true},'POST',200,true)
  assert.equal((await api('/payment-authorization',undefined,'GET',200,true)).status,'AUTHORIZATION_REQUIRED')
  await api(`${path}/restart`,{...body,id:randomUUID(),enrollmentId:child.id},'POST',409,true)
  await assert.rejects(h.pool.query('DELETE FROM payroll_bank_enrollment_restart'),/append-only/)
  return
 }
 if(variant==='EXPIRED'){
  const state=await api(path,undefined,'GET',200,true);assert.equal(state.request.completionBlockedReason,'EXPIRED');assert.equal(state.request.completionAllowed,false)
  await advance('COMPLETE',{operationId,amounts:[11,22]},409);assert.equal(posts,2)
  await advance('RECOVER');assert.equal(posts,2);return
 }
 if(variant==='HISTORY'){
  const old=(await api(`${path}/history`,undefined,'GET',200,true)).items[0],operation=old.operations.find(o=>o.stage==='START')
  assert.equal(old.current,true);assert.equal(old.operations.length,3)
  assert.equal(JSON.stringify(old).includes('000123456789'),false)
  const replacement={id:randomUUID(),connectionId:connection.revision,expectedRevision:old.revision,fingerprint:disclosure.fingerprint,holderName:'Monthly Benefits',accountType:'checking',accountNumber:'000987656789',routingNumber:'021000021',verificationConsent:true,signature:'Monthly Benefits'}
  await api(path,replacement,'POST',201,true)
  await advance('RECOVER',{},409)
  const history=await api(`${path}/history`,undefined,'GET',200,true);assert.equal(history.items.length,2);assert.equal(history.items[1].current,false)
  const body={enrollmentId:id,operationId:operation.id}
  assert.equal((await api(`${path}/recover`,body,'POST',200,true)).verificationStatus,'pending_verification')
  const adminPath=`/employees/${employee.id}/bank-enrollment`
  assert.equal((await api(`${adminPath}/history`)).items.length,2)
  account.verification_status='verified'
  assert.equal((await api(`${adminPath}/recover`,body)).verificationStatus,'verified');assert.equal(posts,3)
  await api(`${adminPath}/recover`,{...body,operationId:old.operations.find(o=>o.stage==='COUNTERPARTY').id})
  assert.equal((await api(`${adminPath}/history`)).items.find(r=>r.id===id).status,'VERIFIED');assert.equal(posts,3)
  await api(`${path}/link`,link,'POST',409,true)
  assert.equal((await h.pool.query('SELECT * FROM payroll_payment_destination')).rowCount,0)
  await api(`${adminPath}/recover`,{...body,enrollmentId:replacement.id},'POST',404)
  const cross=await fetch(`${h.url}/api/admin/payroll${adminPath}/recover`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(body)});assert.equal(cross.status,404)
  await api(`${path}/history?beforeRevision=bad`,undefined,'GET',400,true)
  assert.equal((await api(`${path}/history?beforeRevision=${history.items[0].revision}`,undefined,'GET',200,true)).items.length,1)
  const logs=JSON.stringify((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='BANK_ENROLLMENT_RECOVERED'")).rows)
  assert.equal(logs.includes('000123456789'),false);assert.equal(logs.includes('021000021'),false)
  assert.equal((await h.pool.query("SELECT * FROM payroll_bank_enrollment_operation WHERE enrollment_id=$1",[replacement.id])).rowCount,0)
  let revision=history.items[0].revision
  for(let i=0;i<20;i++){const saved=await api(path,{...replacement,id:randomUUID(),expectedRevision:revision},'POST',201,true);revision=saved.revision}
  const firstPage=await api(`${path}/history`,undefined,'GET',200,true);assert.equal(firstPage.items.length,20);assert.ok(firstPage.nextCursor)
  const secondPage=await api(`${path}/history?beforeRevision=${firstPage.nextCursor}`,undefined,'GET',200,true);assert.equal(secondPage.items.length,2);assert.equal(secondPage.nextCursor,null)
  assert.equal(new Set([...firstPage.items,...secondPage.items].map(r=>r.id)).size,22);assert.equal(posts,3)

  return
 }

 if(variant==='WRONG_AMOUNTS'){
  for(let i=0;i<5;i++){await advance('COMPLETE',{operationId:randomUUID(),amounts:[33,44]});await advance('RECOVER')}
  await advance('COMPLETE',{operationId,amounts:[11,22]},409)
  assert.equal(posts,8);await api(`${path}/link`,link,'POST',409,true);return
 }
 await advance('COMPLETE',{operationId,amounts:[11,22]});assert.equal(posts,4)
 await advance('COMPLETE',{operationId,amounts:[11,22]});assert.equal(posts,4)
 await advance('COMPLETE',{operationId,amounts:[44,55]},409)
 const verified=await api(path,undefined,'GET',200,true);assert.equal(verified.request.status,'VERIFIED')
 assert.equal(JSON.stringify(verified).includes('000123456789'),false)
 if(variant==='VERIFICATION_REGRESSED'){account.verification_status='unverified';await advance('CONTINUE');assert.equal((await api(path,undefined,'GET',200,true)).request.status,'RECORDED');await api(`${path}/link`,link,'POST',409,true);assert.equal(posts,4);return}
 const linked=await api(`${path}/link`,link,'POST',200,true)
 assert.equal((await api(`${path}/link`,link,'POST',200,true)).reused,true)
 const adminAccount=await api(`/employees/${(await h.pool.query('SELECT employee_id FROM payroll_bank_enrollment')).rows[0].employee_id}/payment-destination`);assert.equal(adminAccount.enrollment.status,'VERIFIED');assert.equal(JSON.stringify(adminAccount.enrollment).includes('signature'),false)
 const auth=await api('/payment-authorization',undefined,'GET',200,true)
 assert.equal(auth.destinationId,linked.destinationId);assert.equal(auth.status,'AUTHORIZATION_REQUIRED');assert.equal(auth.terms.account.accountLast4,'6789')
 await api('/payment-authorization',{destinationId:linked.destinationId,expectedRevision:0,decision:'AUTHORIZE',signature:'Monthly Benefits',confirmed:true,fingerprint:auth.fingerprint},'POST',201,true)
 assert.equal((await api('/payment-authorization',undefined,'GET',200,true)).status,'AUTHORIZED')
 await assert.rejects(h.pool.query('DELETE FROM payroll_bank_enrollment_operation'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_bank_enrollment_link'),/append-only/)
})

test('enrollment completion shows expiry and attempt limits without expiring verified evidence',()=>{
 const rows=[{stage:'START',created_at:'2026-01-01T00:00:00Z'}],now=Date.parse('2026-03-01T00:00:00Z')
 assert.equal(enrollmentCompletionState({rows,status:'AWAITING_AMOUNTS',attempts:0},now).completionBlockedReason,'EXPIRED')
 assert.equal(enrollmentCompletionState({rows,status:'VERIFIED',attempts:5},now).completionBlockedReason,null)
 assert.equal(enrollmentCompletionState({rows:[],status:'AWAITING_AMOUNTS',attempts:5},now).completionBlockedReason,'ATTEMPT_LIMIT')
})
