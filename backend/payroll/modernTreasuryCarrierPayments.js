import {createHash} from 'node:crypto'
import {modernTreasuryTransport,readBankSettlement} from './modernTreasuryPayments.js'

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const positive=value=>Number.isSafeInteger(value)&&value>0
const text=value=>typeof value==='string'&&value.trim().length>0&&value.length<=200&&!/[\u0000-\u001f\u007f]/.test(value)
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const routing=value=>typeof value==='string'&&/^\d{9}$/.test(value)&&!/^0+$/.test(value)&&[...value].reduce((sum,digit,index)=>sum+Number(digit)*[3,7,1][index%3],0)%10===0

// This snapshot is an internal binding, not proof the carrier authorized the
// destination. The coordinator must retain separate reviewed carrier evidence.
export function carrierAccountSnapshot(account,accountId,mode){
 if(!uuid(accountId)||!['TEST','LIVE'].includes(mode)||account?.id!==accountId||account.live_mode!==(mode==='LIVE')||account.party_type!=='business'||account.verification_status!=='verified'||!uuid(account.counterparty_id)||!['checking','savings'].includes(account.account_type)||!text(account.party_name)||typeof account.updated_at!=='string'||!Number.isFinite(Date.parse(account.updated_at)))throw new Error('Review the verified carrier business account.')
 const details=account.account_details,routes=account.routing_details
 if(!Array.isArray(details)||details.length!==1||!uuid(details[0].id)||!/^\d{4}$/.test(details[0].account_number_safe)||!Array.isArray(routes))throw new Error('Review the carrier account details.')
 const ach=routes.filter(row=>row.payment_type==='ach')
 if(ach.length!==1||!uuid(ach[0].id)||ach[0].routing_number_type!=='aba'||!routing(ach[0].routing_number))throw new Error('Review the carrier ACH routing details.')
 const snapshot={accountId,counterpartyId:account.counterparty_id,accountType:account.account_type,accountLast4:details[0].account_number_safe,holderName:account.party_name.trim(),mode,updatedAt:account.updated_at}
 return {...snapshot,fingerprint:hash({...snapshot,accountDetailId:details[0].id,routingDetailId:ach[0].id,routingNumber:ach[0].routing_number})}
}

export async function readModernTreasuryCarrierAccount(config,accountId){
 if(!uuid(accountId)||!['TEST','LIVE'].includes(config.mode))throw new Error('A valid carrier account and environment are required.')
 const request=modernTreasuryTransport(config)
 try{
  const response=await request(`/external_accounts/${accountId}`)
  if(!response.ok)return {status:'UNAVAILABLE'}
  const account=await response.json()
  try{return {status:'VERIFIED',account:carrierAccountSnapshot(account,accountId,config.mode)}}catch{return {status:'NEEDS_REVIEW'}}
 }catch{return {status:'UNAVAILABLE'}}
}

export function modernTreasuryCarrierInstruction(intent){
 if(!intent||![intent.id,intent.invoiceId,intent.payeeRevisionId,intent.originatingAccountId,intent.receivingAccountId,intent.counterpartyId].every(uuid)||![intent.facilityId,intent.invoiceRevision,intent.fundingRevisionId,intent.amountCents].every(positive)||!['TEST','LIVE'].includes(intent.mode)||!date(intent.paymentDate)||typeof intent.destinationFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(intent.destinationFingerprint))throw new Error('Complete the retained carrier payment instruction.')
 return {external_id:`vortex_carrier_${intent.id}`,type:'ach',subtype:'CCD',amount:intent.amountCents,direction:'credit',currency:'USD',originating_account_id:intent.originatingAccountId,receiving_account_id:intent.receivingAccountId,effective_date:intent.paymentDate,priority:'normal',statement_descriptor:'BENEFITS',send_remittance_advice:false,metadata:{facility_id:String(intent.facilityId),carrier_invoice_id:intent.invoiceId,carrier_invoice_revision:String(intent.invoiceRevision),carrier_payee_revision_id:intent.payeeRevisionId,carrier_funding_revision_id:String(intent.fundingRevisionId)}}
}

export function modernTreasuryCarrierReceipt(order,intent){
 const expected=modernTreasuryCarrierInstruction(intent)
 if(!uuid(order?.id)||order.live_mode!==(intent.mode==='LIVE')||['external_id','type','subtype','amount','direction','currency','originating_account_id','receiving_account_id'].some(key=>order[key]!==expected[key])||Object.entries(expected.metadata).some(([key,value])=>order.metadata?.[key]!==value))throw new Error('Provider payment does not match the retained carrier instruction.')
 const states={needs_approval:'AWAITING_PROVIDER_APPROVAL',approved:'PROVIDER_APPROVED',processing:'PROCESSING',sent:'SENT',completed:'COMPLETED',returned:'RETURNED',reversed:'REVERSED',failed:'FAILED',denied:'DENIED',cancelled:'CANCELLED',held:'HELD',stopped:'STOPPED'}
 return {providerId:order.id,externalId:order.external_id,status:Object.hasOwn(states,order.status)?states[order.status]:'REVIEW_REQUIRED',providerStatus:Object.hasOwn(states,order.status)?order.status:'unknown',dateMatches:order.effective_date===intent.paymentDate,effectiveDate:date(order.effective_date)?order.effective_date:null,reconciliationStatus:['reconciled','unreconciled'].includes(order.reconciliation_status)?order.reconciliation_status:'unknown',transactionIds:Array.isArray(order.transaction_ids)?order.transaction_ids.filter(uuid):[],liveMode:order.live_mode}
}

// Query-only recovery never resends a missing order. Completed orders still
// require exact posted bank line items, followed by another order observation.
export async function readModernTreasuryCarrierPayment(intent,config){
 const instruction=modernTreasuryCarrierInstruction(intent),request=modernTreasuryTransport(config)
 try{
  const response=await request(`/payment_orders/${instruction.external_id}`)
  if(response.status===404)return {status:'NOT_FOUND'}
  if(!response.ok)return {status:'UNCERTAIN',httpStatus:response.status}
  const order=await response.json(),receipt=modernTreasuryCarrierReceipt(order,intent)
  if(receipt.status!=='COMPLETED'||receipt.reconciliationStatus!=='reconciled')return {...receipt,settlementStatus:['RETURNED','REVERSED','FAILED','DENIED','CANCELLED','STOPPED'].includes(receipt.status)?'EXCEPTION':'PENDING'}
  const settlement=await readBankSettlement(order,intent,request)
  if(settlement.settlementStatus==='BANK_POSTED'){
   const freshResponse=await request(`/payment_orders/${instruction.external_id}`)
   if(!freshResponse.ok)return {...receipt,settlementStatus:'UNAVAILABLE',settlementEvidence:[]}
   const fresh=modernTreasuryCarrierReceipt(await freshResponse.json(),intent)
   if(JSON.stringify(fresh)!==JSON.stringify(receipt))return {...fresh,settlementStatus:'NEEDS_REVIEW',settlementEvidence:[]}
  }
  return {...receipt,...settlement}
 }catch{return {status:'UNCERTAIN'}}
}

// No default sender or route. A durable authorization/claim coordinator must
// call this only for a first dispatch; later attempts use the query-only reader.
export async function submitModernTreasuryCarrierPayment(intent,config){
 const instruction=modernTreasuryCarrierInstruction(intent),request=modernTreasuryTransport(config)
 const lookup=async()=>{const response=await request(`/payment_orders/${instruction.external_id}`);if(response.status===404)return null;if(!response.ok)throw new Error('Carrier payment lookup unavailable.');return modernTreasuryCarrierReceipt(await response.json(),intent)}
 try{
  const existing=await lookup();if(existing)return {...existing,reused:true}
  const originResponse=await request(`/internal_accounts/${intent.originatingAccountId}`)
  if(!originResponse.ok)return {status:'BLOCKED_ACCOUNT_LOOKUP'}
  const origin=await originResponse.json()
  if(origin.id!==intent.originatingAccountId||origin.live_mode!==(intent.mode==='LIVE')||origin.currency!=='USD')return {status:'BLOCKED_ACCOUNT_VERIFICATION'}
  const destination=await readModernTreasuryCarrierAccount({...config,mode:intent.mode},intent.receivingAccountId)
  if(destination.status==='UNAVAILABLE')return {status:'BLOCKED_ACCOUNT_LOOKUP'}
  if(destination.status!=='VERIFIED'||destination.account.counterpartyId!==intent.counterpartyId||destination.account.fingerprint!==intent.destinationFingerprint)return {status:'BLOCKED_ACCOUNT_VERIFICATION'}
  const response=await request('/payment_orders',{method:'POST',headers:{'Idempotency-Key':`carrier_${intent.id}`},body:JSON.stringify(instruction)})
  if(response.status===409){const found=await lookup();return found?{...found,reused:true}:{status:'UNCERTAIN'}}
  if(!response.ok)return {status:'UNCERTAIN',httpStatus:response.status}
  return {...modernTreasuryCarrierReceipt(await response.json(),intent),reused:false}
 }catch{return {status:'UNCERTAIN'}}
}
