import test from 'node:test'
import assert from 'node:assert/strict'
import {bankEnrollmentInput,provisionPayrollCounterparty,provisionPayrollBankAccount,verifyPayrollBankAccount} from '../modernTreasuryEnrollment.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const input={id:id(1),mode:'LIVE',holderName:'Synthetic Employee',accountType:'checking',routingNumber:'021000021',accountNumber:'000123456789'}
test('bank enrollment validates account input without changing leading zeros',()=>{
 assert.equal(bankEnrollmentInput(input).accountNumber,'000123456789')
 for(const bad of [{accountNumber:123456789},{routingNumber:21000021},{routingNumber:'021000022'},{routingNumber:'000000000'},{accountNumber:'12'},{holderName:'Bad\nName'},{mode:'OTHER'},{providerEnrollmentId:'invalid'}])assert.throws(()=>bankEnrollmentInput({...input,...bad}))
})
for(const variant of ['NORMAL','LOST_COUNTERPARTY','LOST_ACCOUNT','WRONG_ACCOUNT','NO_CONSENT','WRONG_AMOUNTS','LOST_VERIFICATION','WRONG_FUNDING'])test(`provider bank enrollment uses stable identities and read-only recovery (${variant})`,async()=>{
 let counterparty=null,account=null,posts=[]
 const config={organizationId:id(2),originatingAccountId:id(3),apiKey:'synthetic-enrollment-key',fetcher:async(url,options)=>{
  if(options.method==='POST'){
   posts.push(url);const body=JSON.parse(options.body)
   if(url.endsWith('/counterparties')){assert.equal(body.send_remittance_advice,false);counterparty={...body,id:id(4),live_mode:true};if(variant==='LOST_COUNTERPARTY')throw new Error('Synthetic lost response');return {ok:true,json:async()=>counterparty}}
   if(url.endsWith('/external_accounts')){assert.equal(body.account_details[0].account_number,input.accountNumber);account={...body,id:id(5),live_mode:true,verification_status:'unverified',account_details:[{account_number_safe:'6789'}]};if(variant==='LOST_ACCOUNT')throw new Error('Synthetic lost response');return {ok:true,json:async()=>account}}
   if(url.endsWith('/verify')){assert.deepEqual(body,{originating_account_id:id(3),payment_type:'ach',currency:'USD',priority:'normal'});account.verification_status='pending_verification';if(variant==='LOST_VERIFICATION')throw new Error('Synthetic lost verification response');return {ok:true}}
   if(url.endsWith('/complete_verification')){assert.deepEqual(body,{amounts:[12,34]});if(variant==='WRONG_AMOUNTS')return {ok:false,status:422};account.verification_status='verified';return {ok:true}}
   throw new Error('Unexpected provider mutation')
  }
  if(url.includes('/internal_accounts/'))return {ok:true,json:async()=>({id:id(3),currency:'USD',live_mode:variant!=='WRONG_FUNDING'})}
  if(url.includes('/counterparties?'))return {ok:true,json:async()=>counterparty?[counterparty]:[]}
  if(url.includes('/external_accounts?'))return {ok:true,json:async()=>account?[account]:[]}
  return {ok:true,json:async()=>variant==='WRONG_ACCOUNT'?{...account,id:id(9)}:account}
 }}
 assert.equal((await provisionPayrollCounterparty(input,config)).status,'NOT_FOUND');assert.equal(posts.length,0)
 const created=await provisionPayrollCounterparty(input,config,{allowCreate:true})
 assert.equal(created.status,variant==='LOST_COUNTERPARTY'?'UNCERTAIN':'RECORDED')
 const holder=await provisionPayrollCounterparty(input,config);assert.equal(holder.status,'RECORDED');assert.equal(posts.length,1)
 assert.equal((await provisionPayrollBankAccount(input,holder.counterpartyId,config)).status,'NOT_FOUND');assert.equal(posts.length,1)
 const saved=await provisionPayrollBankAccount(input,holder.counterpartyId,config,{allowCreate:true});assert.equal(saved.status,variant==='LOST_ACCOUNT'?'UNCERTAIN':'RECORDED')
 const bank=await provisionPayrollBankAccount(input,holder.counterpartyId,config);assert.equal(bank.status,'RECORDED');assert.equal(posts.length,2);assert.equal(JSON.stringify(bank).includes(input.accountNumber),false);assert.equal(JSON.stringify(bank).includes(input.routingNumber),false)
 const args=[input,holder.counterpartyId,bank.accountId,config]
 if(variant==='NO_CONSENT'){await assert.rejects(verifyPayrollBankAccount(...args,{action:'START',operationId:id(6)}),/Separate micro-deposit/);assert.equal(posts.length,2);return}
 const started=await verifyPayrollBankAccount(...args,{action:'START',operationId:id(6),verificationConsent:true})
 if(['WRONG_ACCOUNT','WRONG_FUNDING'].includes(variant)){assert.equal(started.status,'NEEDS_REVIEW');assert.equal(posts.length,2);return}
 assert.equal(started.status,variant==='LOST_VERIFICATION'?'UNCERTAIN':'RECORDED')
 const recovered=await verifyPayrollBankAccount(...args);assert.equal(recovered.verificationStatus,'pending_verification');assert.equal(posts.length,3)
 const complete=await verifyPayrollBankAccount(...args,{action:'COMPLETE',operationId:id(7),amounts:[12,34]});assert.equal(complete.status,variant==='WRONG_AMOUNTS'?'VERIFICATION_REJECTED':'RECORDED')
 assert.equal(posts.length,4)
 assert.equal((await verifyPayrollBankAccount(...args)).verificationStatus,variant==='WRONG_AMOUNTS'?'pending_verification':'verified');assert.equal(posts.length,4)
})
