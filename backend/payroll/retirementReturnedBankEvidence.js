import {modernTreasuryRetirementReceipt} from './modernTreasuryRetirementPayments.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v
// Return evidence never authorizes payment creation, accounting or replacement.
export async function readRetirementReturnedBankEvidence(order,intent,providerRequest){
 const review={returnEvidenceStatus:'NEEDS_REVIEW',returnEvidence:null},signal=AbortSignal.timeout(45000)
 const request=path=>{signal.throwIfAborted();return providerRequest(path,{signal})}
 try{if(modernTreasuryRetirementReceipt(order,intent).status!=='RETURNED')return review}catch{return review}
 const returnId=order.current_return?.id
 if(!uuid(returnId))return review
 const matches=returned=>returned.id===returnId&&returned.returnable_type==='payment_order'&&returned.returnable_id===order.id&&returned.type==='ach'&&returned.live_mode===(intent.mode==='LIVE')&&returned.currency==='USD'&&returned.amount===intent.amountCents&&returned.internal_account_id===intent.originatingAccountId&&returned.status==='completed'&&returned.reconciliation_status==='reconciled'&&!returned.current_return&&uuid(returned.transaction_id)&&uuid(returned.transaction_line_item_id)
 try{
  const response=await request(`/returns/${returnId}`)
  if(!response.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const returned=await response.json()
  if(!matches(returned))return review
  const bankResponse=await request(`/transactions/${returned.transaction_id}`)
  if(!bankResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const bank=await bankResponse.json()
  if(bank.id!==returned.transaction_id||bank.live_mode!==(intent.mode==='LIVE')||bank.internal_account_id!==intent.originatingAccountId||bank.currency!=='USD'||bank.direction!=='credit'||bank.posted!==true||!date(bank.as_of_date)||!Number.isSafeInteger(bank.amount)||bank.amount<intent.amountCents)return review
  const lineResponse=await request(`/transaction_line_items?${new URLSearchParams({'id[]':returned.transaction_line_item_id})}`)
  if(!lineResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const lines=await lineResponse.json(),line=Array.isArray(lines)&&lines.length===1?lines[0]:null
  if(!line||line.id!==returned.transaction_line_item_id||line.transaction_id!==returned.transaction_id||line.transactable_type!=='return'||line.transactable_id!==returnId||line.amount!==intent.amountCents||line.live_mode!==(intent.mode==='LIVE'))return review
  const freshResponse=await request(`/returns/${returnId}`)
  if(!freshResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const fresh=await freshResponse.json()
  if(!matches(fresh)||fresh.transaction_id!==returned.transaction_id||fresh.transaction_line_item_id!==returned.transaction_line_item_id)return review
  const orderResponse=await request(`/payment_orders/${order.external_id}`)
  if(!orderResponse.ok)return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}
  const freshOrder=await orderResponse.json(),freshReceipt=modernTreasuryRetirementReceipt(freshOrder,intent)
  if(freshOrder.id!==order.id||freshReceipt.status!=='RETURNED'||freshOrder.current_return?.id!==returnId)return review
  return {returnEvidenceStatus:'BANK_CREDIT_POSTED',returnEvidence:{returnId,code:typeof fresh.code==='string'&&/^R\d{2}$/.test(fresh.code)?fresh.code:null,transactionId:bank.id,lineItemId:line.id,amountCents:line.amount,postedDate:bank.as_of_date}}
 }catch{return {returnEvidenceStatus:'UNAVAILABLE',returnEvidence:null}}
}
