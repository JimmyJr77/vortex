import {runBankEnrollmentRecoverySweep} from '../bankEnrollmentRecoveryScheduler.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'

for(const mode of ['MANUAL','SCHEDULED'])test(`bank recovery follows stage and attempt order when operation timestamps tie (${mode})`, {skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='b'.repeat(64)
 let counterparty,account,posts=0
 const fetcher=async(url,options={})=>{
  const path=new URL(url).pathname,body=options.body?JSON.parse(options.body):null
  if(options.method==='POST'){
   posts++
   if(path.endsWith('/counterparties')){counterparty={...body,id:randomUUID(),live_mode:false};return {ok:true,json:async()=>counterparty}}
   if(path.endsWith('/external_accounts')){account={...body,id:randomUUID(),live_mode:false,verification_status:'unverified',account_details:[{account_number_safe:'6789'}]};return {ok:true,json:async()=>account}}
   if(path.endsWith('/verify')){account.verification_status='pending_verification';throw new Error('Synthetic response lost after verification started')}
   assert.ok(path.endsWith('/complete_verification'))
   if(body.amounts[0]!==11||body.amounts[1]!==22)return {ok:false,status:422,json:async()=>({})}
   account.verification_status='verified';return {ok:true,json:async()=>account}
  }
  if(path.includes('/internal_accounts/'))return {ok:true,json:async()=>({id:path.split('/').at(-1),currency:'USD',live_mode:false})}
  return {ok:true,json:async()=>path.endsWith('/counterparties')?(counterparty?[counterparty]:[]):path.endsWith('/external_accounts')?(account?[account]:[]):account}
 }
 const h=await createHarness({paymentFetcher:fetcher})
 t.after(async()=>{try{await h.close()}finally{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey}})
 // Synthetic insertion hook makes the ordering failure deterministic. It does
 // not alter production triggers or provider/session behavior.
 await h.pool.query(`CREATE FUNCTION tied_bank_operations() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  NEW.created_at='${new Date().toISOString()}';
  IF NEW.stage='COUNTERPARTY' THEN NEW.id='ffffffff-0000-4000-8000-000000000001';
  ELSIF NEW.stage='ACCOUNT' THEN NEW.id='eeeeeeee-0000-4000-8000-000000000002';
  ELSIF NEW.stage='START' THEN NEW.id='dddddddd-0000-4000-8000-000000000003'; END IF;
  RETURN NEW; END $$;
  CREATE TRIGGER tied_bank_operations BEFORE INSERT ON payroll_bank_enrollment_operation FOR EACH ROW EXECUTE FUNCTION tied_bank_operations()`)
 const {api}=await monthlyBenefitsFixture(h),path='/bank-enrollment'
 const connection=await api('/payment-connection',{organizationId:randomUUID(),originatingAccountId:randomUUID(),apiKey:'synthetic-key',mode:'TEST',reference:'Synthetic tied timestamp verification',confirmed:true,expectedRevision:0},'POST',201)
 const disclosure=await api(path,undefined,'GET',200,true),id=randomUUID()
 await api(path,{id,connectionId:connection.revision,expectedRevision:0,fingerprint:disclosure.fingerprint,holderName:'Monthly Benefits',accountType:'checking',accountNumber:'000123456789',routingNumber:'021000021',verificationConsent:true,signature:'Monthly Benefits'},'POST',201,true)
 let sweepTime=Date.now()+20*60000
 const advance=async(action='CONTINUE',extra={})=>{
  if(action==='RECOVER'&&mode==='SCHEDULED'){
   const verified=(await api(path,undefined,'GET',200,true)).request.status==='VERIFIED'
   sweepTime+=verified?25*60*60000:11*60000
   assert.equal((await runBankEnrollmentRecoverySweep(h.pool,{fetcher,now:()=>new Date(sweepTime)})).checked,1)
  }else return api(`${path}/advance`,{enrollmentId:id,action,...extra},'POST',200,true)
 }
 await advance();await advance();await advance()
 assert.equal((await api(path,undefined,'GET',200,true)).request.status,'UNCERTAIN')
 await advance('RECOVER')
 assert.equal((await api(path,undefined,'GET',200,true)).request.status,'AWAITING_AMOUNTS')
 assert.equal(posts,3,'Recovery must not repeat a provider write')
 await advance('COMPLETE',{operationId:'bbbbbbbb-0000-4000-8000-000000000004',amounts:[33,44]})
 await advance('RECOVER')
 await advance('COMPLETE',{operationId:'aaaaaaaa-0000-4000-8000-000000000005',amounts:[11,22]})
 await advance('RECOVER')
 const recovered=(await h.pool.query("SELECT o.stage,o.attempt FROM payroll_bank_enrollment_observation v JOIN payroll_bank_enrollment_operation o ON o.id=v.operation_id WHERE v.source='RECOVERY' ORDER BY v.id DESC LIMIT 1")).rows[0]
 assert.equal(recovered.stage,'COMPLETE');assert.equal(Number(recovered.attempt),2)
 assert.equal((await api(path,undefined,'GET',200,true)).request.status,'VERIFIED')
 assert.equal(posts,5)
 assert.equal((await h.pool.query('SELECT * FROM payroll_payment_destination')).rowCount,0,'Verification alone must not link a wage destination')
})
