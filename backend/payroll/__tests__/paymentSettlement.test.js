import test from 'node:test'
import assert from 'node:assert/strict'
import {readModernTreasuryPayment,modernTreasuryInstruction} from '../modernTreasuryPayments.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const intent={id:id(1),originatingAccountId:id(2),receivingAccountId:id(3),mode:'LIVE',amountCents:2500,facilityId:1,runId:1,employeeId:1,paymentDate:'2026-09-18'}
for(const variant of ['BULK','PAGINATED','PARTIAL','PENDING','WRONG_ACCOUNT','WRONG_MODE','WRONG_CURRENCY','CREDIT','WRONG_DATE','DUPLICATE','UNAVAILABLE','RETURNED','RETURN_DURING_READ'])test(`bank settlement verifies posted payment-order line items (${variant})`,async()=>{
 const order={...modernTreasuryInstruction(intent),id:id(4),live_mode:true,status:variant==='RETURNED'?'returned':'completed',reconciliation_status:'reconciled',transaction_ids:[id(5)]}
 const transaction={id:id(5),live_mode:true,internal_account_id:id(2),currency:'USD',direction:'debit',posted:true,as_of_date:'2026-09-18',amount:100000}
 if(variant==='PENDING')transaction.posted=false
 if(variant==='WRONG_ACCOUNT')transaction.internal_account_id=id(9)
 if(variant==='WRONG_MODE')transaction.live_mode=false
 if(variant==='WRONG_CURRENCY')transaction.currency='CAD'
 if(variant==='CREDIT')transaction.direction='credit'
 if(variant==='WRONG_DATE')order.effective_date='2026-09-19'
 const match={id:id(6),transaction_id:id(5),transactable_type:'payment_order',transactable_id:id(4),live_mode:true,type:'originating',amount:variant==='PARTIAL'?2499:2500}
 const requests=[];let orderReads=0
 const result=await readModernTreasuryPayment(intent,{organizationId:id(7),apiKey:'synthetic-settlement-key',fetcher:async(url,options)=>{
  assert.equal(options.method,undefined);requests.push(url)
  if(variant==='UNAVAILABLE'&&url.includes('/transactions/'))throw new Error('Synthetic outage')
  let value=order
  if(url.includes('/payment_orders/')&&++orderReads>1&&variant==='RETURN_DURING_READ')value={...order,status:'returned'}
  if(url.includes('/transactions/'))value=transaction
  if(url.includes('/transaction_line_items?')){
   value=[match,{id:id(8),transaction_id:id(5),transactable_type:'payment_order',transactable_id:id(9),amount:97500,description:'DO NOT RETAIN PRIVATE BANK DATA'}]
   if(variant==='DUPLICATE')value=[match,match]
   if(variant==='PAGINATED')value=url.includes('after_cursor=')?[match]:Array.from({length:100},(_,index)=>({id:id(100+index),transaction_id:id(5),transactable_type:null}))
  }
  return {ok:true,status:200,json:async()=>value}
 }})
 assert.equal(result.settlementStatus,['BULK','PAGINATED'].includes(variant)?'BANK_POSTED':variant==='UNAVAILABLE'?'UNAVAILABLE':variant==='RETURNED'?'EXCEPTION':'NEEDS_REVIEW')
 if(result.settlementStatus==='BANK_POSTED')assert.deepEqual(result.settlementEvidence,[{transactionId:id(5),postedDate:'2026-09-18',amountCents:2500,lineItems:[{id:id(6),amountCents:2500}]}])
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false)
 if(variant==='RETURNED')assert.equal(requests.length,1)
})
