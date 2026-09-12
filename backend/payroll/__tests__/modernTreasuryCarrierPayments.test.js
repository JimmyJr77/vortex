import test from 'node:test'
import assert from 'node:assert/strict'
import {carrierAccountSnapshot,readModernTreasuryCarrierAccount,modernTreasuryCarrierInstruction,modernTreasuryCarrierReceipt,submitModernTreasuryCarrierPayment,readModernTreasuryCarrierPayment} from '../modernTreasuryCarrierPayments.js'

const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const account={id:id(3),counterparty_id:id(4),party_type:'business',party_name:'Synthetic Benefits LLC',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:'2026-09-11T12:00:00Z',account_details:[{id:id(5),account_number_safe:'1234',account_number:'secret-number'}],routing_details:[{id:id(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}
const intent={id:id(1),originatingAccountId:id(2),receivingAccountId:id(3),counterpartyId:id(4),invoiceId:id(7),payeeRevisionId:id(8),fundingRevisionId:9,facilityId:1,invoiceRevision:2,amountCents:55000,paymentDate:'2026-09-18',mode:'TEST',destinationFingerprint:carrierAccountSnapshot(account,id(3),'TEST').fingerprint}
const config={organizationId:id(10),apiKey:'synthetic-carrier-key',mode:'TEST'}
const order=(patch={})=>({...modernTreasuryCarrierInstruction(intent),id:id(11),live_mode:false,status:'approved',reconciliation_status:'unreconciled',transaction_ids:[],...patch})
const response=(body,status=200)=>({status,ok:status>=200&&status<300,json:async()=>body})

test('carrier destination requires verified business ownership and unambiguous ACH routing without leaking full account details',async()=>{
 const snapshot=carrierAccountSnapshot(account,id(3),'TEST')
 assert.equal(snapshot.accountLast4,'1234');assert.equal(snapshot.holderName,'Synthetic Benefits LLC')
 assert.ok(!JSON.stringify(snapshot).includes('secret-number'));assert.ok(!JSON.stringify(snapshot).includes('021000021'))
 for(const patch of [{party_type:'individual'},{counterparty_id:null},{verification_status:'pending_verification'},{live_mode:true},{updated_at:null},{party_name:'bad\nname'},{account_details:[...account.account_details,...account.account_details]},{routing_details:[]},{routing_details:[{...account.routing_details[0],payment_type:'wire'}]},{routing_details:[{...account.routing_details[0],routing_number:'021000022'}]},{routing_details:[...account.routing_details,...account.routing_details]}]){
  assert.throws(()=>carrierAccountSnapshot({...account,...patch},id(3),'TEST'))
  assert.deepEqual(await readModernTreasuryCarrierAccount({...config,fetcher:async()=>response({...account,...patch})},id(3)),{status:'NEEDS_REVIEW'})
 }
 for(const patch of [{updated_at:'2026-09-11T12:00:01Z'},{party_name:'Other Carrier'},{account_details:[{...account.account_details[0],id:id(30)}]},{routing_details:[{...account.routing_details[0],routing_number:'011000015'}]}])assert.notEqual(carrierAccountSnapshot({...account,...patch},id(3),'TEST').fingerprint,snapshot.fingerprint)
 assert.deepEqual(await readModernTreasuryCarrierAccount({...config,fetcher:async()=>{throw Error('private provider error')}},id(3)),{status:'UNAVAILABLE'})
})

test('carrier instructions and receipts bind invoice and connection revisions separately from payroll identities',()=>{
 const instruction=modernTreasuryCarrierInstruction(intent)
 assert.equal(instruction.subtype,'CCD');assert.equal(instruction.external_id,`vortex_carrier_${intent.id}`);assert.equal(instruction.amount,55000)
 assert.equal(instruction.metadata.payroll_run_id,undefined);assert.equal(instruction.send_remittance_advice,false)
 for(const patch of [{amountCents:0},{amountCents:1.1},{amountCents:Number.MAX_SAFE_INTEGER+1},{invoiceRevision:0},{fundingRevisionId:id(9)},{invoiceId:'../invoice'},{paymentDate:'2026-02-30'},{destinationFingerprint:'missing'},{mode:'production'}])assert.throws(()=>modernTreasuryCarrierInstruction({...intent,...patch}))
 for(const patch of [{amount:1},{subtype:'PPD'},{live_mode:true},{receiving_account_id:id(20)},{metadata:{}},{metadata:{...instruction.metadata,carrier_invoice_revision:'1'}}])assert.throws(()=>modernTreasuryCarrierReceipt(order(patch),intent))
 assert.equal(modernTreasuryCarrierReceipt(order({status:'toString'}),intent).status,'REVIEW_REQUIRED')
 assert.equal(modernTreasuryCarrierReceipt(order({effective_date:'2026-09-19'}),intent).dateMatches,false)
})

test('first carrier dispatch rechecks reviewed destination and funding before a single create',async()=>{
 for(const patch of [null,{party_type:'individual'},{updated_at:'2026-09-11T12:01:00Z'},{counterparty_id:id(22)}]){
  let posts=0
  const result=await submitModernTreasuryCarrierPayment(intent,{...config,fetcher:async(url,options)=>{
   if(options.method==='POST'){posts++;assert.equal(options.headers['Idempotency-Key'],`carrier_${intent.id}`);assert.equal(options.redirect,'error');assert.deepEqual(JSON.parse(options.body),modernTreasuryCarrierInstruction(intent));return response(order())}
   if(url.includes('/payment_orders/'))return response(null,404)
   if(url.includes('/internal_accounts/'))return response({id:id(2),live_mode:false,currency:'USD'})
   return response({...account,...patch})
  }})
  assert.equal(result.status,patch?'BLOCKED_ACCOUNT_VERIFICATION':'PROVIDER_APPROVED');assert.equal(posts,patch?0:1)
 }
 let calls=0
 assert.equal((await submitModernTreasuryCarrierPayment(intent,{...config,fetcher:async()=>{calls++;return response(order())}})).reused,true)
 assert.equal(calls,1)
 let posts=0
 assert.equal((await submitModernTreasuryCarrierPayment(intent,{...config,fetcher:async(url,options)=>{if(options.method==='POST')posts++;return url.includes('/payment_orders/')?response(null,404):response({id:id(2),live_mode:true,currency:'USD'})}})).status,'BLOCKED_ACCOUNT_VERIFICATION')
 assert.equal(posts,0)
})

test('carrier conflict and lost-response recovery never create a second order',async()=>{
 for(const conflict of [true,false]){
  let lookups=0,posts=0
  const fetcher=async(url,options)=>{
   if(options.method==='POST'){posts++;if(conflict)return response(null,409);throw Error('synthetic lost response')}
   if(url.includes('/payment_orders/'))return ++lookups===1?response(null,404):response(order())
   if(url.includes('/internal_accounts/'))return response({id:id(2),live_mode:false,currency:'USD'})
   return response(account)
  }
  const result=await submitModernTreasuryCarrierPayment(intent,{...config,fetcher})
  assert.equal(result.status,conflict?'PROVIDER_APPROVED':'UNCERTAIN')
  assert.equal((await readModernTreasuryCarrierPayment(intent,{...config,fetcher})).status,'PROVIDER_APPROVED');assert.equal(posts,1)
 }
 for(const [body,code,status] of [[null,404,'NOT_FOUND'],[null,503,'UNCERTAIN'],[order({metadata:{}}),200,'UNCERTAIN']]){
  const calls=[]
  const result=await readModernTreasuryCarrierPayment(intent,{...config,fetcher:async(url,options)=>{calls.push(url);assert.equal(options.method,undefined);return response(body,code)}})
  assert.equal(result.status,status);assert.equal(calls.length,1)
 }
})

test('carrier completion requires exact bank allocation and stable fresh order evidence',async()=>{
 for(const scenario of ['settled','wrong-line','wrong-bank','wrong-date','changed-order','unreconciled','returned']){
  let reads=0
  const completed=order({status:scenario==='returned'?'returned':'completed',reconciliation_status:scenario==='unreconciled'?'unreconciled':'reconciled',transaction_ids:[id(12)],...(scenario==='wrong-date'?{effective_date:'2026-09-19'}:{})})
  const result=await readModernTreasuryCarrierPayment(intent,{...config,fetcher:async(url,options)=>{
   assert.equal(options.method,undefined)
   if(url.includes('/payment_orders/'))return response(++reads>1&&scenario==='changed-order'?{...completed,status:'returned'}:completed)
   if(url.includes('/transactions/'))return response({id:id(12),live_mode:false,internal_account_id:scenario==='wrong-bank'?id(20):id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-18',amount:60000})
   if(url.includes('/transaction_line_items?'))return response([{id:id(13),transaction_id:id(12),transactable_type:'payment_order',transactable_id:id(11),live_mode:false,type:'originating',amount:scenario==='wrong-line'?54999:55000}])
   throw Error('Unexpected request')
  }})
  assert.equal(result.settlementStatus,scenario==='settled'?'BANK_POSTED':scenario==='unreconciled'?'PENDING':scenario==='returned'?'EXCEPTION':'NEEDS_REVIEW')
  if(scenario==='settled')assert.equal(result.settlementEvidence[0].amountCents,55000)
  else assert.ok(!result.settlementEvidence?.length)
 }
})
