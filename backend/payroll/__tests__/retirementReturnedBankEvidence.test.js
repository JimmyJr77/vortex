import test from 'node:test'
import assert from 'node:assert/strict'
import {modernTreasuryRetirementInstruction} from '../modernTreasuryRetirementPayments.js'
import {readRetirementReturnedBankEvidence} from '../retirementReturnedBankEvidence.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
const intent={id:id(1),originatingAccountId:id(2),receivingAccountId:id(3),mode:'LIVE',amountCents:2500,facilityId:1,runId:1,employeeId:1,paymentDate:'2026-09-18',destinationId:id(10),counterpartyId:id(11),fundingRevisionId:1,planId:'standard',submitBefore:'2026-09-17T16:00:00Z',destinationFingerprint:'a'.repeat(64)}
for(const variant of ['POSTED','PENDING','WRONG_ORDER','NOC','PARTIAL','WRONG_ACCOUNT','DEBIT','PENDING_BANK','WRONG_LINE','WRONG_MODE','RETURN_CHANGED','ORDER_CHANGED','UNAVAILABLE'])test(`retirement return reader verifies posted bank credit (${variant})`,async()=>{
 const order={...modernTreasuryRetirementInstruction(intent),id:id(4),live_mode:true,status:'returned',reconciliation_status:'reconciled',transaction_ids:[],current_return:{id:id(5)}}
 const returned={id:id(5),returnable_type:'payment_order',returnable_id:id(4),type:'ach',amount:2500,currency:'USD',live_mode:true,internal_account_id:id(2),status:'completed',reconciliation_status:'reconciled',transaction_id:id(6),transaction_line_item_id:id(7),current_return:null,code:'R03',reason:'PRIVATE BANK DATA'}
 const bank={id:id(6),amount:100000,currency:'USD',live_mode:true,internal_account_id:id(2),direction:'credit',posted:true,as_of_date:'2026-09-20'}
 const line={id:id(7),amount:2500,live_mode:true,transaction_id:id(6),transactable_type:'return',transactable_id:id(5)}
 if(variant==='PENDING')returned.status='pending'
 if(variant==='WRONG_ORDER')returned.returnable_id=id(8)
 if(variant==='NOC')returned.type='ach_noc'
 if(variant==='PARTIAL')returned.amount=2499
 if(variant==='WRONG_ACCOUNT')bank.internal_account_id=id(8)
 if(variant==='DEBIT')bank.direction='debit'
 if(variant==='PENDING_BANK')bank.posted=false
 if(variant==='WRONG_LINE')line.transactable_id=id(8)
 if(variant==='WRONG_MODE')line.live_mode=false
 let reads=0,orderReads=0
 const result=await readRetirementReturnedBankEvidence(order,intent,async(url,options)=>{
  assert.equal(options.method,undefined)
  let value=order
  if(url.includes('/payment_orders/')&&++orderReads>=1&&variant==='ORDER_CHANGED')value={...order,status:'completed'}
  if(url.includes('/returns/')){reads++;value=reads>1&&variant==='RETURN_CHANGED'?{...returned,status:'returned'}:returned}
  if(url.includes('/transactions/')){if(variant==='UNAVAILABLE')throw new Error('Synthetic unavailable bank');value=bank}
  if(url.includes('/transaction_line_items?'))value=[line]
  return {ok:true,status:200,json:async()=>value}
 })
 assert.equal(result.returnEvidenceStatus,variant==='POSTED'?'BANK_CREDIT_POSTED':variant==='UNAVAILABLE'?'UNAVAILABLE':'NEEDS_REVIEW')
 if(variant==='POSTED')assert.deepEqual(result.returnEvidence,{returnId:id(5),code:'R03',transactionId:id(6),lineItemId:id(7),amountCents:2500,postedDate:'2026-09-20'})
 assert.equal(JSON.stringify(result).includes('PRIVATE'),false)
})
