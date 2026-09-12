import test from 'node:test'
import assert from 'node:assert/strict'
import {modernTreasuryInstruction,modernTreasuryReceipt,submitModernTreasuryPayment,readModernTreasuryPayment,verifyModernTreasuryFundingAccount} from '../modernTreasuryPayments.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const intent={id:id(1),originatingAccountId:id(2),receivingAccountId:id(3),facilityId:1,runId:2,employeeId:3,amountCents:12345,paymentDate:'2026-09-18',mode:'TEST'}
const receipt=(overrides={})=>({...modernTreasuryInstruction(intent),id:id(4),live_mode:false,status:'approved',reconciliation_status:'unreconciled',transaction_ids:[],...overrides})
const response=(body,status=200)=>({status,ok:status>=200&&status<300,json:async()=>body})
const config={organizationId:id(5),apiKey:'synthetic-test-key'}
test('funding checks reject mismatched account details and sanitize provider errors without creating payments',async()=>{
 for(const [body,httpStatus,status,reason] of [
  [{id:id(2),currency:'USD',live_mode:false},200,'VERIFIED','FUNDING_ACCOUNT_MATCHED'],
  [{id:id(2),currency:'EUR',live_mode:false},200,'FAILED','ACCOUNT_OR_ENVIRONMENT_MISMATCH'],
  [{id:id(8),currency:'USD',live_mode:false},200,'FAILED','ACCOUNT_OR_ENVIRONMENT_MISMATCH'],
  [{id:id(2),currency:'USD',live_mode:true},200,'FAILED','ACCOUNT_OR_ENVIRONMENT_MISMATCH'],
  [{secret:'do not return'},401,'FAILED','CREDENTIALS_OR_ACCESS'],
  [{secret:'do not return'},403,'FAILED','CREDENTIALS_OR_ACCESS'],
  [null,404,'FAILED','ACCOUNT_NOT_FOUND'],[null,503,'UNAVAILABLE','PROVIDER_UNAVAILABLE']
 ]){
  const result=await verifyModernTreasuryFundingAccount({...config,originatingAccountId:id(2),mode:'TEST',fetcher:async(url,options)=>{assert.equal(options.method,undefined);assert.ok(url.endsWith(`/internal_accounts/${id(2)}`));return response(body,httpStatus)}})
  assert.deepEqual(result,{status,reason})
 }
 assert.deepEqual(await verifyModernTreasuryFundingAccount({...config,originatingAccountId:id(2),mode:'TEST',fetcher:async()=>{throw new Error('synthetic-private-error')}}),{status:'UNAVAILABLE',reason:'PROVIDER_UNAVAILABLE'})
})
test('payroll ACH instruction is stable, exact cents and validates all required identities',()=>{
 const value=modernTreasuryInstruction(intent);assert.equal(value.subtype,'PPD');assert.equal(value.direction,'credit');assert.equal(value.amount,12345);assert.equal(value.send_remittance_advice,false);assert.equal(value.external_id,`vortex_payroll_${intent.id}`)
 for(const patch of [{amountCents:0},{amountCents:-1},{amountCents:1.5},{amountCents:Number.MAX_SAFE_INTEGER+1},{paymentDate:'2026-02-30'},{mode:'production'},{receivingAccountId:'../account'},{employeeId:0}])assert.throws(()=>modernTreasuryInstruction({...intent,...patch}))
})
test('read-only recovery cannot submit after missing, unavailable or mismatched provider evidence',async()=>{
 for(const [body,code,status] of [[null,404,'NOT_FOUND'],[null,503,'UNCERTAIN'],[receipt({amount:1}),200,'UNCERTAIN'],[receipt({status:'returned'}),200,'RETURNED']]){
  let calls=0
  const result=await readModernTreasuryPayment(intent,{...config,fetcher:async(url,options)=>{calls++;assert.equal(options.method,undefined);assert.ok(url.endsWith(`/payment_orders/vortex_payroll_${intent.id}`));return response(body,code)}})
  assert.equal(result.status,status);assert.equal(calls,1)
 }
 assert.equal(modernTreasuryReceipt(receipt({status:'toString',effective_date:'2026-02-30'}),intent).status,'REVIEW_REQUIRED')
 assert.equal(modernTreasuryReceipt(receipt({effective_date:'2026-02-30'}),intent).effectiveDate,null)
})
test('a create conflict recovers the same immutable external ID without a second POST',async()=>{
 let lookups=0,posts=0
 const fetcher=async(url,options)=>{
  if(options.method==='POST'){posts++;return response(null,409)}
  if(url.includes('/payment_orders/'))return ++lookups===1?response(null,404):response(receipt())
  return response(url.includes('/internal_accounts/')?{id:intent.originatingAccountId,live_mode:false,currency:'USD'}:{id:intent.receivingAccountId,live_mode:false,verification_status:'verified'})
 }
 const result=await submitModernTreasuryPayment(intent,{...config,fetcher});assert.equal(result.reused,true);assert.equal(posts,1);assert.equal(lookups,2)
})
test('receipts distinguish completion, reconciliation, returns and payment date changes',()=>{
 assert.equal(modernTreasuryReceipt(receipt(),intent).status,'PROVIDER_APPROVED')
 const completed=modernTreasuryReceipt(receipt({status:'completed',effective_date:'2026-09-21'}),intent);assert.equal(completed.status,'COMPLETED');assert.equal(completed.reconciliationStatus,'unreconciled');assert.equal(completed.dateMatches,false);assert.equal(completed.paid,undefined)
 assert.equal(modernTreasuryReceipt(receipt({status:'returned'}),intent).status,'RETURNED');assert.equal(modernTreasuryReceipt(receipt({status:'novel_state'}),intent).status,'REVIEW_REQUIRED')
 for(const patch of [{amount:1},{live_mode:true},{receiving_account_id:id(8)},{external_id:'other'},{currency:'EUR'}])assert.throws(()=>modernTreasuryReceipt(receipt(patch),intent))
})
test('transport looks up a stable external ID, verifies accounts, then submits one bounded request',async()=>{
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});if(url.includes('/payment_orders/vortex_'))return response(null,404);if(url.includes('/internal_accounts/'))return response({id:id(2),live_mode:false,currency:'USD'});if(url.includes('/external_accounts/'))return response({id:id(3),live_mode:false,verification_status:'verified'});return response(receipt())}
 const result=await submitModernTreasuryPayment(intent,{...config,fetcher});assert.equal(result.status,'PROVIDER_APPROVED');assert.equal(calls.length,4);const post=calls[3];assert.equal(post.options.method,'POST');assert.equal(post.options.redirect,'error');assert.equal(post.options.headers['Idempotency-Key'],`payroll_${intent.id}`);assert.equal(JSON.parse(post.options.body).amount,12345)
})
test('existing orders avoid new sends; ambiguous failures and mode mismatches never trigger another POST',async()=>{
 let calls=0;assert.equal((await submitModernTreasuryPayment(intent,{...config,fetcher:async()=>{calls++;return response(receipt())}})).reused,true);assert.equal(calls,1)
 let posts=0;const fetcher=async(url,options)=>{if(options.method==='POST'){posts++;throw new Error('Synthetic interrupted response')}if(url.includes('/payment_orders/'))return response(null,404);return response(url.includes('/internal_accounts/')?{id:id(2),live_mode:false,currency:'USD'}:{id:id(3),live_mode:false,verification_status:'verified'})}
 assert.equal((await submitModernTreasuryPayment(intent,{...config,fetcher})).status,'UNCERTAIN');assert.equal(posts,1)
 assert.equal((await submitModernTreasuryPayment({...intent,mode:'LIVE'},{...config,fetcher})).status,'BLOCKED_ACCOUNT_VERIFICATION');assert.equal(posts,1)
})
