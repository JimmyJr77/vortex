import {modernTreasuryTransport} from './modernTreasuryPayments.js'
import {readPayrollDigitalCheck,digitalCheckReceipt} from './modernTreasuryChecks.js'
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
// Only the first durable claim may PATCH. Recovery always reads the original order.
export async function cancelPayrollDigitalCheck(intent,claim,config,{allowCancel=false}={}){
 if(!uuid(claim?.id)||!uuid(claim.providerId))throw new Error('Retain the original provider check cancellation identity.')
 let requestSent=false
 try{
  const payment=await readPayrollDigitalCheck(intent,config)
  if(payment.providerId!==claim.providerId||payment.dateMatches!==true||payment.expiryMatches!==true||payment.reconciliationStatus!=='unreconciled'||payment.liveMode!==(intent.mode==='LIVE'))return {status:'NEEDS_REVIEW',payment,requestSent}
  if(payment.status==='CANCELLED')return {status:'CANCEL_CONFIRMED',payment,requestSent}
  if(!['AWAITING_PROVIDER_APPROVAL','PROVIDER_APPROVED'].includes(payment.status))return {status:'NOT_ELIGIBLE',payment,requestSent}
  if(!allowCancel)return {status:'CANCEL_PENDING',payment,requestSent}
  requestSent=true
  const response=await modernTreasuryTransport(config)(`/payment_orders/${claim.providerId}`,{method:'PATCH',body:JSON.stringify({status:'cancelled'})})
  if(!response.ok)return {status:'UNCERTAIN',requestSent}
  const updated=digitalCheckReceipt(await response.json(),intent)
  if(updated.providerId!==claim.providerId||updated.dateMatches!==true||updated.expiryMatches!==true||updated.reconciliationStatus!=='unreconciled')return {status:'NEEDS_REVIEW',payment:updated,requestSent}
  return {status:updated.status==='CANCELLED'?'CANCEL_CONFIRMED':'CANCEL_PENDING',payment:updated,requestSent}
 }catch{return {status:'UNCERTAIN',requestSent}}
}
