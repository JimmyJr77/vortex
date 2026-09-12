import {modernTreasuryTransport,readBankSettlement} from './modernTreasuryPayments.js'
import {readRetirementReturnedBankEvidence} from './retirementReturnedBankEvidence.js'
import {readModernTreasuryCarrierAccount as readBusinessAccount} from './modernTreasuryCarrierPayments.js'
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(x)
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x
export function modernTreasuryRetirementInstruction(i){
 if(!i||![i.id,i.destinationId,i.originatingAccountId,i.receivingAccountId,i.counterpartyId].every(uuid)||![i.facilityId,i.runId,i.fundingRevisionId,i.amountCents].every(x=>Number.isSafeInteger(x)&&x>0)||!/^[-a-zA-Z0-9]{1,80}$/.test(i.planId||'')||!['TEST','LIVE'].includes(i.mode)||!date(i.paymentDate)||!Number.isFinite(Date.parse(i.submitBefore))||!/^[a-f0-9]{64}$/.test(i.destinationFingerprint||''))throw new Error('Complete the retained retirement payment instruction.')
 return {external_id:`vortex_retirement_${i.id}`,type:'ach',subtype:'CCD',amount:i.amountCents,direction:'credit',currency:'USD',originating_account_id:i.originatingAccountId,receiving_account_id:i.receivingAccountId,effective_date:i.paymentDate,priority:'normal',statement_descriptor:'RETIREMENT',send_remittance_advice:false,metadata:{facility_id:String(i.facilityId),payroll_run_id:String(i.runId),retirement_plan_id:i.planId,retirement_destination_id:i.destinationId,retirement_funding_revision_id:String(i.fundingRevisionId)}}
}
export function modernTreasuryRetirementReceipt(order,intent){
 const expected=modernTreasuryRetirementInstruction(intent)
 if(!uuid(order?.id)||order.live_mode!==(intent.mode==='LIVE')||['external_id','type','subtype','amount','direction','currency','originating_account_id','receiving_account_id'].some(k=>order[k]!==expected[k])||Object.entries(expected.metadata).some(([k,v])=>order.metadata?.[k]!==v))throw new Error('Provider payment does not match the retained retirement instruction.')
 const states={needs_approval:'AWAITING_PROVIDER_APPROVAL',approved:'PROVIDER_APPROVED',processing:'PROCESSING',sent:'SENT',completed:'COMPLETED',returned:'RETURNED',reversed:'REVERSED',failed:'FAILED',denied:'DENIED',cancelled:'CANCELLED',held:'HELD',stopped:'STOPPED'}
 return {providerId:order.id,externalId:order.external_id,status:Object.hasOwn(states,order.status)?states[order.status]:'REVIEW_REQUIRED',providerStatus:Object.hasOwn(states,order.status)?order.status:'unknown',dateMatches:order.effective_date===intent.paymentDate,effectiveDate:date(order.effective_date)?order.effective_date:null,reconciliationStatus:['reconciled','unreconciled'].includes(order.reconciliation_status)?order.reconciliation_status:'unknown',transactionIds:Array.isArray(order.transaction_ids)?order.transaction_ids.filter(uuid):[],liveMode:order.live_mode}
}
export async function readModernTreasuryRetirementPayment(intent,config){
 const instruction=modernTreasuryRetirementInstruction(intent),request=modernTreasuryTransport(config)
 try{
  const r=await request(`/payment_orders/${instruction.external_id}`);if(r.status===404)return {status:'NOT_FOUND'};if(!r.ok)return {status:'UNCERTAIN',httpStatus:r.status}
  const order=await r.json(),receipt=modernTreasuryRetirementReceipt(order,intent)
  if(receipt.status==='RETURNED')return {...receipt,settlementStatus:'EXCEPTION',...await readRetirementReturnedBankEvidence(order,intent,request)}
  if(receipt.status!=='COMPLETED'||receipt.reconciliationStatus!=='reconciled')return {...receipt,settlementStatus:['RETURNED','REVERSED','FAILED','DENIED','CANCELLED','STOPPED'].includes(receipt.status)?'EXCEPTION':'PENDING'}
  const bank=await readBankSettlement(order,intent,request)
  if(bank.settlementStatus==='BANK_POSTED'){
   const fresh=await request(`/payment_orders/${instruction.external_id}`);if(!fresh.ok)return {...receipt,settlementStatus:'UNAVAILABLE',settlementEvidence:[]}
   const after=modernTreasuryRetirementReceipt(await fresh.json(),intent);if(JSON.stringify(after)!==JSON.stringify(receipt))return {...after,settlementStatus:'NEEDS_REVIEW',settlementEvidence:[]}
  }
  return {...receipt,...bank}
 }catch{return {status:'UNCERTAIN'}}
}
export async function submitModernTreasuryRetirementPayment(intent,config,{now=()=>new Date()}={}){
 const instruction=modernTreasuryRetirementInstruction(intent),request=modernTreasuryTransport(config)
 let submissionAttempted=false
 try{
  const existing=await request(`/payment_orders/${instruction.external_id}`)
  if(existing.ok)return {...modernTreasuryRetirementReceipt(await existing.json(),intent),reused:true}
  if(existing.status!==404)return {status:'UNCERTAIN',submissionAttempted:false,noSendProof:true}
  const origin=await request(`/internal_accounts/${intent.originatingAccountId}`);if(!origin.ok)return {status:'BLOCKED_ACCOUNT_LOOKUP',submissionAttempted:false,noSendProof:true}
  const funding=await origin.json(),destination=await readBusinessAccount({...config,mode:intent.mode},intent.receivingAccountId)
  if(funding.id!==intent.originatingAccountId||funding.live_mode!==(intent.mode==='LIVE')||funding.currency!=='USD'||destination.status!=='VERIFIED'||destination.account.counterpartyId!==intent.counterpartyId||destination.account.fingerprint!==intent.destinationFingerprint)return {status:'BLOCKED_ACCOUNT_VERIFICATION',submissionAttempted:false,noSendProof:true}
  if(now()>=new Date(intent.submitBefore))return {status:'BLOCKED_CUTOFF',submissionAttempted:false,noSendProof:true}
  submissionAttempted=true
  const r=await request('/payment_orders',{method:'POST',headers:{'Idempotency-Key':`retirement_${intent.id}`},body:JSON.stringify(instruction)})
  if(r.status===409)return {...await readModernTreasuryRetirementPayment(intent,config),submissionAttempted:true}
  if(!r.ok)return {status:'UNCERTAIN',httpStatus:r.status,submissionAttempted:true}
  return {...modernTreasuryRetirementReceipt(await r.json(),intent),submissionAttempted:true,reused:false}
 }catch{return {status:'UNCERTAIN',submissionAttempted,noSendProof:!submissionAttempted}}
}
